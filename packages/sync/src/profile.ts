import type {
  GroupId,
  GroupMode,
  Hlc,
  MemberId,
  ProfileEvent,
  ProfileId,
  Setting,
  SettingKey,
} from '@expense/schema';
import { type Field, initialField } from './field';
import { orderEvents } from './log';

// Stato del profilo personale (ADR 0005): impostazioni, gruppi collegati e "chi sono io" in ogni gruppo.
// Stesse regole dei gruppi: per ogni chiave vince la modifica più recente (ADR 0007, punto 6).

export type SettingValue<K extends SettingKey> = Extract<Setting, { readonly key: K }>['value'];

export type Settings = { readonly [K in SettingKey]?: Field<SettingValue<K>> };

export interface LinkedGroup {
  readonly groupId: GroupId;
  readonly mode: Field<GroupMode> | null;
  /** false dopo "scollega": il gruppo resta salvato ma non compare più nell'elenco. */
  readonly linked: Field<boolean> | null;
  /** Il membro che rappresenta l'utente in quel gruppo; null se non ne fa parte. */
  readonly me: Field<MemberId | null> | null;
}

export interface ProfileState {
  readonly id: ProfileId;
  readonly settings: Settings;
  readonly groups: ReadonlyMap<GroupId, LinkedGroup>;
  readonly version: Hlc | null;
}

export function projectProfile(profileId: ProfileId, events: Iterable<ProfileEvent>): ProfileState {
  let settings: Settings = {};
  const groups = new Map<GroupId, LinkedGroup>();
  let version: Hlc | null = null;

  for (const event of orderEvents(events)) {
    if (event.stream !== profileId) continue;
    version = event.hlc;
    switch (event.type) {
      case 'SettingChanged':
        settings = { ...settings, [event.payload.key]: initialField(event.payload.value, event) };
        break;
      case 'GroupLinked': {
        const group = linkedGroup(groups, event.payload.groupId);
        groups.set(group.groupId, {
          ...group,
          mode: initialField(event.payload.mode, event),
          linked: initialField(true, event),
        });
        break;
      }
      case 'GroupUnlinked': {
        const group = linkedGroup(groups, event.payload.groupId);
        groups.set(group.groupId, { ...group, linked: initialField(false, event) });
        break;
      }
      case 'MemberClaimed': {
        const group = linkedGroup(groups, event.payload.groupId);
        groups.set(group.groupId, { ...group, me: initialField(event.payload.memberId, event) });
        break;
      }
    }
  }
  return { id: profileId, settings, groups, version };
}

function linkedGroup(groups: ReadonlyMap<GroupId, LinkedGroup>, groupId: GroupId): LinkedGroup {
  return groups.get(groupId) ?? { groupId, mode: null, linked: null, me: null };
}
