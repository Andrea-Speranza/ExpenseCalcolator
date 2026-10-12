import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  computeBalances,
  type ExpenseInput,
  type SettlementInput,
  validateSettlement,
} from '../src/index';
import { ledger as ledgerArbitrary } from './arbitraries';
import { unwrap, unwrapError } from './helpers';

const lunch: ExpenseInput = {
  id: 'e_1',
  total: { minor: 9000, currency: 'EUR' },
  paidBy: [{ memberId: 'm_a', amount: { minor: 9000, currency: 'EUR' } }],
  split: { method: 'equal', memberIds: ['m_a', 'm_b', 'm_c'] },
};

const settlement = (overrides: Partial<SettlementInput> = {}): SettlementInput => ({
  id: 's_1',
  from: 'm_b',
  to: 'm_a',
  amount: { minor: 3000, currency: 'EUR' },
  ...overrides,
});

/** Spesa pagata interamente da `payer` per il solo `debtor`. */
const loan = (id: string, payer: string, debtor: string, minor: number): ExpenseInput => ({
  id,
  total: { minor, currency: 'EUR' },
  paidBy: [{ memberId: payer, amount: { minor, currency: 'EUR' } }],
  split: { method: 'equal', memberIds: [debtor] },
});

describe('validateSettlement', () => {
  it('accetta un rimborso valido', () => {
    expect(unwrap(validateSettlement(settlement()))).toEqual(settlement());
  });

  it.each([
    ['importo zero', { amount: { minor: 0, currency: 'EUR' } }, 'nonPositiveAmount'],
    ['stesso membro', { to: 'm_b' }, 'sameMember'],
  ])('rifiuta: %s', (_case, overrides: Partial<SettlementInput>, reason) => {
    expect(unwrapError(validateSettlement(settlement(overrides)))).toEqual({
      code: 'InvalidSettlement',
      reason,
    });
  });

  it('rifiuta un importo che non è un intero sicuro', () => {
    expect(
      unwrapError(validateSettlement(settlement({ amount: { minor: 1.5, currency: 'EUR' } }))),
    ).toEqual({ code: 'AmountOutOfRange' });
  });
});

describe('computeBalances', () => {
  it('registro vuoto: nessun saldo', () => {
    expect(unwrap(computeBalances({ expenses: [], settlements: [] }))).toEqual([]);
  });

  it('spese e rimborsi, con i membri in ordine di id', () => {
    expect(unwrap(computeBalances({ expenses: [lunch], settlements: [settlement()] }))).toEqual([
      {
        currency: 'EUR',
        balances: [
          { memberId: 'm_a', amount: { minor: 3000, currency: 'EUR' } },
          { memberId: 'm_b', amount: { minor: 0, currency: 'EUR' } },
          { memberId: 'm_c', amount: { minor: -3000, currency: 'EUR' } },
        ],
      },
    ]);
  });

  it('indica quale voce non è valida', () => {
    const badExpense = { ...lunch, id: 'e_bad', total: { minor: -1, currency: 'EUR' } };
    expect(unwrapError(computeBalances({ expenses: [badExpense], settlements: [] }))).toEqual({
      code: 'InvalidEntry',
      entry: 'expense',
      id: 'e_bad',
      error: { code: 'InvalidExpense', reason: 'nonPositiveTotal' },
    });

    const badSettlement = settlement({ id: 's_bad', to: 'm_b' });
    expect(unwrapError(computeBalances({ expenses: [], settlements: [badSettlement] }))).toEqual({
      code: 'InvalidEntry',
      entry: 'settlement',
      id: 's_bad',
      error: { code: 'InvalidSettlement', reason: 'sameMember' },
    });
  });

  it('segnala un saldo che supera gli interi sicuri', () => {
    const max = Number.MAX_SAFE_INTEGER;
    const expenses = [loan('e_1', 'm_a', 'm_b', max), loan('e_2', 'm_a', 'm_c', max)];
    expect(unwrapError(computeBalances({ expenses, settlements: [] }))).toEqual({
      code: 'AmountOutOfRange',
    });
  });
});

describe('computeBalances: invarianti', () => {
  it('per ogni valuta i saldi sommano a zero', () => {
    fc.assert(
      fc.property(ledgerArbitrary, (input) => {
        for (const { currency, balances } of unwrap(computeBalances(input))) {
          expect(balances.every(({ amount }) => amount.currency === currency)).toBe(true);
          expect(balances.reduce((acc, { amount }) => acc + amount.minor, 0)).toBe(0);
        }
      }),
    );
  });

  it('il risultato non dipende dall’ordine di spese e rimborsi', () => {
    fc.assert(
      fc.property(ledgerArbitrary, (input) => {
        const reversed = {
          expenses: [...input.expenses].reverse(),
          settlements: [...input.settlements].reverse(),
        };
        expect(computeBalances(reversed)).toEqual(computeBalances(input));
      }),
    );
  });
});
