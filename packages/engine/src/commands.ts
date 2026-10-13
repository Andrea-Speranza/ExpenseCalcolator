import { err, ok, type Result, splitExpense, validateSettlement } from '@expense/core';
import type {
  Command,
  CommandType,
  ExpenseAmounts,
  ExpenseId,
  GroupEvent,
  GroupId,
  Hlc,
  MemberId,
  ProfileEvent,
  ProfileId,
  SettlementId,
  SettlementTransfer,
  StreamId,
} from '@expense/schema';
import type { GroupState, ProfileState } from '@expense/sync';
import type { CommandError, NotFound } from './errors';
import { settingsView } from './views';

// Pianificazione dei comandi: controlli di dominio ed eventi da scrivere. È una funzione pura: riceve lo
// stato attuale e restituisce gli eventi, oppure un errore. Id, orologio e salvataggio li aggiunge l'engine.

type Body<E> = E extends { readonly type: unknown; readonly payload: unknown }
  ? Pick<E, 'type' | 'payload'>
  : never;

/** Evento da scrivere: l'engine aggiunge id, HLC, dispositivo e versione dello schema. */
export type PlannedEvent = {
  readonly stream: StreamId;
  readonly actor: MemberId | null;
  readonly base?: Hlc;
} & (Body<GroupEvent> | Body<ProfileEvent>);

export interface Plan {
  readonly events: readonly PlannedEvent[];
  readonly result: unknown;
}

/** Cosa restituisce ogni comando: l'id dell'elemento creato, oppure null. */
export interface CommandResults {
  readonly CreateGroup: { readonly groupId: GroupId; readonly memberId: MemberId | null };
  readonly AddMember: { readonly memberId: MemberId };
  readonly AddExpense: { readonly expenseId: ExpenseId };
  readonly AddSettlement: { readonly settlementId: SettlementId };
}
export type CommandResult<T extends CommandType> = T extends keyof CommandResults
  ? CommandResults[T]
  : null;

export interface PlanContext {
  readonly profileId: ProfileId;
  readonly profile: ProfileState;
  group(groupId: GroupId): GroupState | undefined;
  newId(): string;
}

type Planned = Result<Plan, CommandError>;

export function planCommand(command: Command, context: PlanContext): Planned {
  if (command.type === 'CreateGroup') return planCreateGroup(command, context);
  if (command.type === 'UpdateSettings') {
    const { changes } = command;
    if (!hasChanges(changes)) return err({ code: 'NoChanges' });
    const settings = [
      ...(changes.defaultCurrency === undefined
        ? []
        : [{ key: 'defaultCurrency', value: changes.defaultCurrency } as const]),
      ...(changes.language === undefined
        ? []
        : [{ key: 'language', value: changes.language } as const]),
      ...(changes.displayName === undefined
        ? []
        : [{ key: 'displayName', value: changes.displayName } as const]),
    ];
    return ok({
      events: settings.map((payload) => ({
        stream: context.profileId,
        actor: null,
        type: 'SettingChanged' as const,
        payload,
      })),
      result: null,
    });
  }
  const group = context.group(command.groupId);
  if (group === undefined) return notFound('group', command.groupId);
  return planGroupCommand(command, group, context);
}

function planCreateGroup(
  command: Extract<Command, { readonly type: 'CreateGroup' }>,
  context: PlanContext,
): Planned {
  const groupId = context.newId();
  const memberId = command.me === null ? null : context.newId();
  const baseCurrency = command.baseCurrency ?? settingsView(context.profile).defaultCurrency;
  const events: PlannedEvent[] = [
    {
      stream: groupId,
      actor: memberId,
      type: 'GroupCreated',
      payload: { name: command.name, baseCurrency },
    },
  ];
  if (command.me !== null && memberId !== null) {
    events.push({
      stream: groupId,
      actor: memberId,
      type: 'MemberAdded',
      payload: { memberId, name: command.me.name },
    });
  }
  events.push(
    {
      stream: context.profileId,
      actor: null,
      type: 'GroupLinked',
      payload: { groupId, mode: 'local' },
    },
    {
      stream: context.profileId,
      actor: null,
      type: 'MemberClaimed',
      payload: { groupId, memberId },
    },
  );
  return ok({ events, result: { groupId, memberId } });
}

function planGroupCommand(
  command: Exclude<Command, { readonly type: 'CreateGroup' | 'UpdateSettings' }>,
  group: GroupState,
  context: PlanContext,
): Planned {
  const actor = context.profile.groups.get(group.id)?.me?.value ?? null;
  const single = (
    event: Body<GroupEvent> & { readonly base?: Hlc },
    result: unknown = null,
  ): Planned => ok({ events: [{ stream: group.id, actor, ...event }], result });

  switch (command.type) {
    case 'UpdateGroup':
      if (!hasChanges(command.changes)) return err({ code: 'NoChanges' });
      return single({
        type: 'GroupUpdated',
        base: command.base ?? group.version,
        payload: { changes: command.changes },
      });
    case 'AddMember': {
      const memberId = context.newId();
      return single(
        { type: 'MemberAdded', payload: { memberId, name: command.name } },
        { memberId },
      );
    }
    case 'UpdateMember': {
      const member = group.members.get(command.memberId);
      if (member === undefined) return notFound('member', command.memberId);
      if (!hasChanges(command.changes)) return err({ code: 'NoChanges' });
      return single({
        type: 'MemberUpdated',
        base: command.base ?? member.version,
        payload: { memberId: command.memberId, changes: command.changes },
      });
    }
    case 'ClaimMember': {
      if (command.memberId !== null && !group.members.has(command.memberId)) {
        return notFound('member', command.memberId);
      }
      return ok({
        events: [
          {
            stream: context.profileId,
            actor: null,
            type: 'MemberClaimed',
            payload: { groupId: group.id, memberId: command.memberId },
          },
        ],
        result: null,
      });
    }
    case 'AddExpense': {
      const expenseId = context.newId();
      const valid = checkAmounts(group, expenseId, command.amounts);
      if (!valid.ok) return valid;
      const { description, date, amounts, category, notes } = command;
      return single(
        {
          type: 'ExpenseAdded',
          payload: { expenseId, description, date, amounts, category, notes },
        },
        { expenseId },
      );
    }
    case 'UpdateExpense': {
      const expense = group.expenses.get(command.expenseId);
      if (expense === undefined) return notFound('expense', command.expenseId);
      if (!hasChanges(command.changes)) return err({ code: 'NoChanges' });
      if (command.changes.amounts !== undefined) {
        const valid = checkAmounts(group, command.expenseId, command.changes.amounts);
        if (!valid.ok) return valid;
      }
      return single({
        type: 'ExpenseUpdated',
        base: command.base ?? expense.version,
        payload: { expenseId: command.expenseId, changes: command.changes },
      });
    }
    case 'DeleteExpense':
    case 'RestoreExpense':
      if (!group.expenses.has(command.expenseId)) return notFound('expense', command.expenseId);
      return single({
        type: command.type === 'DeleteExpense' ? 'ExpenseDeleted' : 'ExpenseRestored',
        payload: { expenseId: command.expenseId },
      });
    case 'AddSettlement': {
      const settlementId = context.newId();
      const valid = checkTransfer(group, settlementId, command.transfer);
      if (!valid.ok) return valid;
      const { transfer, date, notes } = command;
      return single(
        { type: 'SettlementAdded', payload: { settlementId, transfer, date, notes } },
        { settlementId },
      );
    }
    case 'UpdateSettlement': {
      const settlement = group.settlements.get(command.settlementId);
      if (settlement === undefined) return notFound('settlement', command.settlementId);
      if (!hasChanges(command.changes)) return err({ code: 'NoChanges' });
      if (command.changes.transfer !== undefined) {
        const valid = checkTransfer(group, command.settlementId, command.changes.transfer);
        if (!valid.ok) return valid;
      }
      return single({
        type: 'SettlementUpdated',
        base: command.base ?? settlement.version,
        payload: { settlementId: command.settlementId, changes: command.changes },
      });
    }
    case 'DeleteSettlement':
    case 'RestoreSettlement':
      if (!group.settlements.has(command.settlementId))
        return notFound('settlement', command.settlementId);
      return single({
        type: command.type === 'DeleteSettlement' ? 'SettlementDeleted' : 'SettlementRestored',
        payload: { settlementId: command.settlementId },
      });
  }
}

/** Importi coerenti (regole del core) e riferiti solo a membri del gruppo. */
function checkAmounts(
  group: GroupState,
  expenseId: ExpenseId,
  amounts: ExpenseAmounts,
): Result<null, CommandError> {
  const unknown = membersOf(amounts).find((memberId) => !group.members.has(memberId));
  if (unknown !== undefined) return notFound('member', unknown);
  const split = splitExpense({ id: expenseId, ...amounts });
  return split.ok ? ok(null) : split;
}

function checkTransfer(
  group: GroupState,
  settlementId: SettlementId,
  transfer: SettlementTransfer,
): Result<null, CommandError> {
  const unknown = [transfer.from, transfer.to].find((memberId) => !group.members.has(memberId));
  if (unknown !== undefined) return notFound('member', unknown);
  const valid = validateSettlement({ id: settlementId, ...transfer });
  return valid.ok ? ok(null) : valid;
}

function membersOf({ paidBy, split }: ExpenseAmounts): MemberId[] {
  const payers = paidBy.map(({ memberId }) => memberId);
  switch (split.method) {
    case 'equal':
      return [...payers, ...split.memberIds];
    case 'exact':
      return [...payers, ...split.amounts.map(({ memberId }) => memberId)];
    case 'percentage':
      return [...payers, ...split.percentages.map(({ memberId }) => memberId)];
    case 'shares':
      return [...payers, ...split.weights.map(({ memberId }) => memberId)];
  }
}

function hasChanges(changes: object): boolean {
  return Object.values(changes).some((value) => value !== undefined);
}

function notFound(entity: NotFound['entity'], id: string): Result<never, NotFound> {
  return err({ code: 'NotFound', entity, id });
}
