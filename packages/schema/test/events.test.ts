import { describe, expect, it } from 'vitest';
import {
  CommandSchema,
  GroupEventSchema,
  HlcSchema,
  ProfileEventSchema,
  QuerySchema,
  StoredEventSchema,
} from '../src/index';

const envelope = {
  id: 'ev_1',
  stream: 'g_1',
  hlc: '1760350000000:00000:d_pc',
  deviceId: 'd_pc',
  actor: 'm_anna',
  v: 1,
};

const amounts = {
  total: { minor: 9000, currency: 'EUR' },
  paidBy: [{ memberId: 'm_anna', amount: { minor: 9000, currency: 'EUR' } }],
  split: { method: 'equal', memberIds: ['m_anna', 'm_luca'] },
};

describe('HlcSchema', () => {
  it.each(['1760350000000:00000:d_pc', '0000000000000:99999:01J9Z5XK3M7Q8R2T4V6W8Y0A1B'])(
    'accetta %j',
    (hlc) => {
      expect(HlcSchema.safeParse(hlc).success).toBe(true);
    },
  );

  it.each(['1760350000000:0:d_pc', '176035000000:00000:d_pc', '1760350000000:00000:', 'abc'])(
    'rifiuta %j',
    (hlc) => {
      expect(HlcSchema.safeParse(hlc).success).toBe(false);
    },
  );
});

describe('GroupEventSchema', () => {
  it('accetta una spesa aggiunta', () => {
    const event = {
      ...envelope,
      type: 'ExpenseAdded',
      payload: { expenseId: 'e_1', description: 'Cena', date: '2026-10-12', amounts },
    };
    expect(GroupEventSchema.safeParse(event).success).toBe(true);
  });

  it('accetta una modifica con la versione di partenza e un campo da togliere', () => {
    const event = {
      ...envelope,
      type: 'ExpenseUpdated',
      base: '1760340000000:00003:d_tel',
      payload: { expenseId: 'e_1', changes: { description: 'Cena al rifugio', notes: null } },
    };
    expect(GroupEventSchema.safeParse(event).success).toBe(true);
  });

  it.each([
    ['tipo sconosciuto', { ...envelope, type: 'ExpenseSplitted', payload: {} }],
    [
      'versione futura',
      { ...envelope, v: 2, type: 'ExpenseDeleted', payload: { expenseId: 'e_1' } },
    ],
    [
      'data non valida',
      {
        ...envelope,
        type: 'ExpenseAdded',
        payload: { expenseId: 'e_1', description: 'x', date: '12/10/2026', amounts },
      },
    ],
    ['nome vuoto', { ...envelope, type: 'MemberAdded', payload: { memberId: 'm_1', name: '' } }],
  ])('rifiuta: %s', (_case, event) => {
    expect(GroupEventSchema.safeParse(event).success).toBe(false);
  });
});

describe('StoredEventSchema', () => {
  it('conserva eventi di tipi e versioni sconosciuti, scritti da app più recenti', () => {
    const future = { ...envelope, v: 3, type: 'ExpenseSplitted', payload: { anything: true } };
    expect(StoredEventSchema.parse(future)).toEqual(future);
  });

  it('rifiuta una busta incompleta', () => {
    expect(
      StoredEventSchema.safeParse({ ...envelope, hlc: undefined, type: 'X', payload: {} }).success,
    ).toBe(false);
  });
});

describe('ProfileEventSchema', () => {
  const profile = { ...envelope, stream: 'p_1', actor: null };

  it('accetta impostazioni tipizzate per chiave', () => {
    const event = {
      ...profile,
      type: 'SettingChanged',
      payload: { key: 'defaultCurrency', value: 'CHF' },
    };
    expect(ProfileEventSchema.safeParse(event).success).toBe(true);
  });

  it('rifiuta un valore non valido per la chiave', () => {
    const event = { ...profile, type: 'SettingChanged', payload: { key: 'language', value: 'fr' } };
    expect(ProfileEventSchema.safeParse(event).success).toBe(false);
  });

  it('accetta "non sono un membro di questo gruppo"', () => {
    const event = {
      ...profile,
      type: 'MemberClaimed',
      payload: { groupId: 'g_1', memberId: null },
    };
    expect(ProfileEventSchema.safeParse(event).success).toBe(true);
  });
});

describe('CommandSchema e QuerySchema', () => {
  it('toglie gli spazi iniziali e finali dai testi', () => {
    const command = CommandSchema.parse({
      type: 'CreateGroup',
      name: '  Weekend  ',
      me: { name: ' Anna ' },
    });
    expect(command).toEqual({ type: 'CreateGroup', name: 'Weekend', me: { name: 'Anna' } });
  });

  it('rifiuta un testo fatto solo di spazi', () => {
    expect(
      CommandSchema.safeParse({ type: 'AddMember', groupId: 'g_1', name: '   ' }).success,
    ).toBe(false);
  });

  it('accetta una query', () => {
    expect(QuerySchema.safeParse({ type: 'GetBalances', groupId: 'g_1' }).success).toBe(true);
  });
});
