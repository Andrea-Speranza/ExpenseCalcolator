import type { MemberAmount, Split } from '@expense/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type ExpenseInput, splitExpense } from '../src/index';
import { expense as expenseArbitrary } from './arbitraries';
import { unwrap, unwrapError } from './helpers';

const eur = (memberId: string, minor: number): MemberAmount => ({
  memberId,
  amount: { minor, currency: 'EUR' },
});

/** Spesa da 90 € pagata da m_a, con la divisione indicata. */
function expense(split: Split, overrides: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    id: 'e_1',
    total: { minor: 9000, currency: 'EUR' },
    paidBy: [eur('m_a', 9000)],
    split,
    ...overrides,
  };
}

const owed = (input: ExpenseInput) => unwrap(splitExpense(input)).owed;

describe('splitExpense: modalità di divisione', () => {
  it('parti uguali', () => {
    expect(owed(expense({ method: 'equal', memberIds: ['m_a', 'm_b', 'm_c'] }))).toEqual([
      eur('m_a', 3000),
      eur('m_b', 3000),
      eur('m_c', 3000),
    ]);
  });

  it('importi esatti, anche zero', () => {
    const amounts = [eur('m_a', 9000), eur('m_b', 0)];
    expect(owed(expense({ method: 'exact', amounts }))).toEqual(amounts);
  });

  it('percentuali in punti base', () => {
    const split: Split = {
      method: 'percentage',
      percentages: [
        { memberId: 'm_a', basisPoints: 5000 },
        { memberId: 'm_b', basisPoints: 3000 },
        { memberId: 'm_c', basisPoints: 2000 },
      ],
    };
    expect(owed(expense(split))).toEqual([eur('m_a', 4500), eur('m_b', 2700), eur('m_c', 1800)]);
  });

  it('quote', () => {
    const split: Split = {
      method: 'shares',
      weights: [
        { memberId: 'm_a', weight: 2 },
        { memberId: 'm_b', weight: 1 },
        { memberId: 'm_c', weight: 1 },
      ],
    };
    expect(owed(expense(split))).toEqual([eur('m_a', 4500), eur('m_b', 2250), eur('m_c', 2250)]);
  });

  it('il centesimo avanzato ruota in base all’id della spesa', () => {
    const tenEuro = (id: string) =>
      expense(
        { method: 'equal', memberIds: ['m_a', 'm_b', 'm_c'] },
        { id, total: { minor: 1000, currency: 'EUR' }, paidBy: [eur('m_a', 1000)] },
      );
    // FNV-1a("e_1") mod 3 = 0, FNV-1a("e_3") mod 3 = 1 (vedi spec/test-vectors/02).
    expect(owed(tenEuro('e_1')).map(({ amount }) => amount.minor)).toEqual([334, 333, 333]);
    expect(owed(tenEuro('e_3')).map(({ amount }) => amount.minor)).toEqual([333, 334, 333]);
  });

  it('restituisce anche chi ha pagato quanto', () => {
    const paidBy = [eur('m_a', 6000), eur('m_b', 3000)];
    const result = unwrap(
      splitExpense(expense({ method: 'equal', memberIds: ['m_c'] }, { paidBy })),
    );
    expect(result.paid).toEqual(paidBy);
  });
});

describe('splitExpense: errori', () => {
  const equal: Split = { method: 'equal', memberIds: ['m_a', 'm_b'] };

  it.each([
    ['totale zero', { total: { minor: 0, currency: 'EUR' } }, { reason: 'nonPositiveTotal' }],
    ['nessun pagatore', { paidBy: [] }, { reason: 'noPayers' }],
    [
      'pagatore ripetuto',
      { paidBy: [eur('m_a', 4500), eur('m_a', 4500)] },
      { reason: 'duplicateMember', memberId: 'm_a' },
    ],
    [
      'pagatore con importo zero',
      { paidBy: [eur('m_a', 9000), eur('m_b', 0)] },
      { reason: 'nonPositivePayment', memberId: 'm_b' },
    ],
  ])('%s', (_case, overrides: Partial<ExpenseInput>, expected) => {
    expect(unwrapError(splitExpense(expense(equal, overrides)))).toEqual({
      code: 'InvalidExpense',
      ...expected,
    });
  });

  it.each<[string, Split, object]>([
    [
      'parti uguali senza partecipanti',
      { method: 'equal', memberIds: [] },
      { reason: 'noParticipants' },
    ],
    [
      'importi esatti senza partecipanti',
      { method: 'exact', amounts: [] },
      { reason: 'noParticipants' },
    ],
    [
      'partecipante ripetuto',
      { method: 'equal', memberIds: ['m_a', 'm_a'] },
      { reason: 'duplicateMember', memberId: 'm_a' },
    ],
    [
      'importo esatto ripetuto',
      { method: 'exact', amounts: [eur('m_b', 4500), eur('m_b', 4500)] },
      { reason: 'duplicateMember', memberId: 'm_b' },
    ],
    [
      'importo esatto negativo',
      { method: 'exact', amounts: [eur('m_a', 9100), eur('m_b', -100)] },
      { reason: 'negativeAmount', memberId: 'm_b' },
    ],
  ])('%s', (_case, split, expected) => {
    expect(unwrapError(splitExpense(expense(split)))).toEqual({
      code: 'InvalidExpense',
      ...expected,
    });
  });

  it('i pagatori non arrivano al totale', () => {
    expect(unwrapError(splitExpense(expense(equal, { paidBy: [eur('m_a', 8000)] })))).toEqual({
      code: 'TotalMismatch',
      field: 'paidBy',
      expected: 9000,
      actual: 8000,
    });
  });

  it('gli importi esatti non arrivano al totale', () => {
    const split: Split = { method: 'exact', amounts: [eur('m_a', 5000), eur('m_b', 3000)] };
    expect(unwrapError(splitExpense(expense(split)))).toEqual({
      code: 'TotalMismatch',
      field: 'amounts',
      expected: 9000,
      actual: 8000,
    });
  });

  it('le percentuali non fanno 100%', () => {
    const split: Split = {
      method: 'percentage',
      percentages: [
        { memberId: 'm_a', basisPoints: 5000 },
        { memberId: 'm_b', basisPoints: 4000 },
      ],
    };
    expect(unwrapError(splitExpense(expense(split)))).toEqual({
      code: 'TotalMismatch',
      field: 'percentages',
      expected: 10_000,
      actual: 9000,
    });
  });

  it('una percentuale negativa', () => {
    const split: Split = {
      method: 'percentage',
      percentages: [
        { memberId: 'm_a', basisPoints: 11_000 },
        { memberId: 'm_b', basisPoints: -1000 },
      ],
    };
    expect(unwrapError(splitExpense(expense(split)))).toEqual({
      code: 'InvalidAllocation',
      reason: 'negativeWeight',
    });
  });

  it('quote tutte a zero', () => {
    const split: Split = { method: 'shares', weights: [{ memberId: 'm_a', weight: 0 }] };
    expect(unwrapError(splitExpense(expense(split)))).toEqual({
      code: 'InvalidAllocation',
      reason: 'zeroTotalWeight',
    });
  });

  it('valute diverse tra totale e pagatori o importi', () => {
    const usd: MemberAmount = { memberId: 'm_a', amount: { minor: 9000, currency: 'USD' } };
    const mismatch = { code: 'CurrencyMismatch', expected: 'EUR', actual: 'USD' };
    expect(unwrapError(splitExpense(expense(equal, { paidBy: [usd] })))).toEqual(mismatch);
    expect(unwrapError(splitExpense(expense({ method: 'exact', amounts: [usd] })))).toEqual(
      mismatch,
    );
  });

  it('importi che non sono interi sicuri', () => {
    const outOfRange = { code: 'AmountOutOfRange' };
    expect(
      unwrapError(splitExpense(expense(equal, { total: { minor: 0.5, currency: 'EUR' } }))),
    ).toEqual(outOfRange);
    expect(unwrapError(splitExpense(expense(equal, { paidBy: [eur('m_a', 9000.5)] })))).toEqual(
      outOfRange,
    );
  });
});

describe('splitExpense: invarianti', () => {
  const sumOf = (amounts: readonly MemberAmount[]) =>
    amounts.reduce((acc, { amount }) => acc + amount.minor, 0);

  it('pagato e dovuto sommano sempre al totale, nella valuta della spesa', () => {
    fc.assert(
      fc.property(expenseArbitrary, (input) => {
        const { paid, owed: shares } = unwrap(splitExpense(input));
        expect(sumOf(paid)).toBe(input.total.minor);
        expect(sumOf(shares)).toBe(input.total.minor);
        for (const { amount } of [...paid, ...shares]) {
          expect(amount.currency).toBe(input.total.currency);
          expect(amount.minor).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it('è deterministica', () => {
    fc.assert(
      fc.property(expenseArbitrary, (input) => {
        expect(splitExpense(input)).toEqual(splitExpense(structuredClone(input)));
      }),
    );
  });
});
