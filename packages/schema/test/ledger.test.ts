import { describe, expect, it } from 'vitest';
import { LedgerSchema } from '../src/index';

const expense = {
  id: 'e_1',
  total: { minor: 9000, currency: 'EUR' },
  paidBy: [{ memberId: 'm_a', amount: { minor: 9000, currency: 'EUR' } }],
  split: { method: 'equal', memberIds: ['m_a', 'm_b'] },
};
const settlement = { id: 's_1', from: 'm_b', to: 'm_a', amount: { minor: 4500, currency: 'EUR' } };

describe('LedgerSchema', () => {
  it('accetta spese e rimborsi', () => {
    expect(LedgerSchema.safeParse({ expenses: [expense], settlements: [settlement] }).success).toBe(
      true,
    );
  });

  it('ignora i campi in più (es. descrizioni e nomi dei membri)', () => {
    const parsed = LedgerSchema.parse({
      members: [{ id: 'm_a', name: 'Anna' }],
      expenses: [{ ...expense, description: 'Cena' }],
      settlements: [],
    });
    expect(parsed).toEqual({ expenses: [expense], settlements: [] });
  });

  it.each([
    ['senza rimborsi', { expenses: [] }],
    ['spesa senza divisione', { expenses: [{ ...expense, split: undefined }], settlements: [] }],
    [
      'rimborso senza valuta',
      { expenses: [], settlements: [{ ...settlement, amount: { minor: 1 } }] },
    ],
  ])('rifiuta un registro %s', (_case, ledger) => {
    expect(LedgerSchema.safeParse(ledger).success).toBe(false);
  });
});
