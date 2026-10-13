import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { projectProfile } from '../src/index';
import { hlc, profileEvent } from './helpers';

describe('projectProfile', () => {
  it('impostazioni: per ogni chiave vince la modifica più recente', () => {
    const profile = projectProfile('p_1', [
      profileEvent(
        'SettingChanged',
        { key: 'defaultCurrency', value: 'CHF' },
        { at: 2, device: 'd_tel' },
      ),
      profileEvent(
        'SettingChanged',
        { key: 'defaultCurrency', value: 'EUR' },
        { at: 1, device: 'd_pc' },
      ),
      profileEvent('SettingChanged', { key: 'language', value: 'it' }, { at: 3 }),
    ]);
    expect(profile.settings.defaultCurrency).toEqual({
      value: 'CHF',
      hlc: hlc(2, 'd_tel'),
      actor: null,
    });
    expect(profile.settings.language?.value).toBe('it');
    expect(profile.settings.displayName).toBeUndefined();
    expect(profile.version).toBe(hlc(3));
  });

  it('gruppi collegati, scollegati e "chi sono io"', () => {
    const profile = projectProfile('p_1', [
      profileEvent('GroupLinked', { groupId: 'g_1', mode: 'local' }, { at: 1 }),
      profileEvent('MemberClaimed', { groupId: 'g_1', memberId: 'm_anna' }, { at: 2 }),
      profileEvent('MemberClaimed', { groupId: 'g_2', memberId: null }, { at: 3 }),
      profileEvent('GroupUnlinked', { groupId: 'g_2' }, { at: 4 }),
    ]);
    expect(profile.groups.get('g_1')).toMatchObject({
      mode: { value: 'local' },
      linked: { value: true },
      me: { value: 'm_anna' },
    });
    expect(profile.groups.get('g_2')).toMatchObject({
      mode: null,
      linked: { value: false },
      me: { value: null },
    });
  });

  it('ignora gli eventi di altri profili', () => {
    const other = profileEvent(
      'SettingChanged',
      { key: 'language', value: 'en' },
      { at: 1, stream: 'p_2' },
    );
    expect(projectProfile('p_1', [other])).toEqual({
      id: 'p_1',
      settings: {},
      groups: new Map(),
      version: null,
    });
  });

  it('stesso stato qualunque sia l’ordine di arrivo', () => {
    const events = [
      profileEvent(
        'SettingChanged',
        { key: 'displayName', value: 'Anna' },
        { at: 1, device: 'd_pc' },
      ),
      profileEvent(
        'SettingChanged',
        { key: 'displayName', value: 'Anna R.' },
        { at: 1, device: 'd_tel' },
      ),
      profileEvent('GroupLinked', { groupId: 'g_1', mode: 'personal' }, { at: 2 }),
      profileEvent('GroupLinked', { groupId: 'g_1', mode: 'shared' }, { at: 3, device: 'd_tel' }),
    ];
    fc.assert(
      fc.property(
        fc.shuffledSubarray(events, { minLength: events.length, maxLength: events.length }),
        (shuffled) => {
          expect(projectProfile('p_1', shuffled)).toEqual(projectProfile('p_1', events));
        },
      ),
    );
  });
});
