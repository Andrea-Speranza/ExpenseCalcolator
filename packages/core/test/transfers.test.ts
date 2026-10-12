import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  computeBalances,
  type CurrencyBalances,
  type ExpenseInput,
  pairwiseTransfers,
  simplifiedTransfers,
} from '../src/index';
import { applyTransfers, ledger as ledgerArbitrary } from './arbitraries';
import { unwrap, unwrapError } from './helpers';

const eurBalances = (entries: Record<string, number>): CurrencyBalances[] => [
  {
    currency: 'EUR',
    balances: Object.entries(entries).map(([memberId, minor]) => ({
      memberId,
      amount: { minor, currency: 'EUR' },
    })),
  },
];

const transfer = (from: string, to: string, minor: number) => ({
  from,
  to,
  amount: { minor, currency: 'EUR' },
});

describe('simplifiedTransfers', () => {
  it('il debitore più grande paga il creditore più grande', () => {
    expect(unwrap(simplifiedTransfers(eurBalances({ m_a: -11000, m_b: 8500, m_c: 2500 })))).toEqual(
      [transfer('m_a', 'm_b', 8500), transfer('m_a', 'm_c', 2500)],
    );
  });

  it('a parità di importo precede il membro con l’id minore, in qualunque ordine arrivino', () => {
    const expected = [transfer('m_b', 'm_a', 100), transfer('m_c', 'm_a', 100)];
    expect(unwrap(simplifiedTransfers(eurBalances({ m_c: -100, m_b: -100, m_a: 200 })))).toEqual(
      expected,
    );
    expect(unwrap(simplifiedTransfers(eurBalances({ m_a: 200, m_b: -100, m_c: -100 })))).toEqual(
      expected,
    );
  });

  it('saldi tutti a zero: nessun trasferimento', () => {
    expect(unwrap(simplifiedTransfers(eurBalances({ m_a: 0, m_b: 0 })))).toEqual([]);
  });

  it('rifiuta saldi che non sommano a zero', () => {
    expect(unwrapError(simplifiedTransfers(eurBalances({ m_a: 100, m_b: -50 })))).toEqual({
      code: 'UnbalancedBalances',
      currency: 'EUR',
    });
  });

  it('rifiuta importi in una valuta diversa da quella del gruppo di saldi', () => {
    const balances: CurrencyBalances[] = [
      { currency: 'EUR', balances: [{ memberId: 'm_a', amount: { minor: 0, currency: 'USD' } }] },
    ];
    expect(unwrapError(simplifiedTransfers(balances))).toEqual({
      code: 'CurrencyMismatch',
      expected: 'EUR',
      actual: 'USD',
    });
  });

  it('rifiuta importi che non sono interi sicuri', () => {
    expect(unwrapError(simplifiedTransfers(eurBalances({ m_a: 0.5, m_b: -0.5 })))).toEqual({
      code: 'AmountOutOfRange',
    });
  });
});

describe('pairwiseTransfers', () => {
  it('passa gli errori del registro', () => {
    const bad: ExpenseInput = {
      id: 'e_bad',
      total: { minor: 100, currency: 'EUR' },
      paidBy: [],
      split: { method: 'equal', memberIds: ['m_a'] },
    };
    expect(unwrapError(pairwiseTransfers({ expenses: [bad], settlements: [] }))).toMatchObject({
      code: 'InvalidEntry',
      id: 'e_bad',
    });
  });

  it('segnala un debito che supera gli interi sicuri', () => {
    const max = Number.MAX_SAFE_INTEGER;
    const loan = (id: string): ExpenseInput => ({
      id,
      total: { minor: max, currency: 'EUR' },
      paidBy: [{ memberId: 'm_a', amount: { minor: max, currency: 'EUR' } }],
      split: { method: 'equal', memberIds: ['m_b'] },
    });
    expect(
      unwrapError(pairwiseTransfers({ expenses: [loan('e_1'), loan('e_2')], settlements: [] })),
    ).toEqual({ code: 'AmountOutOfRange' });
  });
});

describe('trasferimenti: invarianti', () => {
  const allZero = (values: Map<string, number>) => [...values.values()].every((v) => v === 0);

  it('i trasferimenti semplificati pareggiano tutti i saldi, con al massimo n − 1 passaggi', () => {
    fc.assert(
      fc.property(ledgerArbitrary, (input) => {
        const balances = unwrap(computeBalances(input));
        const transfers = unwrap(simplifiedTransfers(balances));
        expect(allZero(applyTransfers(balances, transfers))).toBe(true);
        for (const { currency, balances: members } of balances) {
          const open = members.filter(({ amount }) => amount.minor !== 0).length;
          const count = transfers.filter(({ amount }) => amount.currency === currency).length;
          expect(count).toBeLessThanOrEqual(Math.max(open - 1, 0));
        }
      }),
    );
  });

  it('i trasferimenti per coppia pareggiano gli stessi saldi', () => {
    fc.assert(
      fc.property(ledgerArbitrary, (input) => {
        const balances = unwrap(computeBalances(input));
        const transfers = unwrap(pairwiseTransfers(input));
        expect(allZero(applyTransfers(balances, transfers))).toBe(true);
      }),
    );
  });

  it('ogni trasferimento è positivo e tra due membri diversi', () => {
    fc.assert(
      fc.property(ledgerArbitrary, (input) => {
        const simplified = unwrap(simplifiedTransfers(unwrap(computeBalances(input))));
        for (const { from, to, amount } of [...simplified, ...unwrap(pairwiseTransfers(input))]) {
          expect(amount.minor).toBeGreaterThan(0);
          expect(from).not.toBe(to);
        }
      }),
    );
  });

  it('i trasferimenti per coppia non dipendono dall’ordine delle voci', () => {
    fc.assert(
      fc.property(ledgerArbitrary, (input) => {
        const reversed = {
          expenses: [...input.expenses].reverse(),
          settlements: [...input.settlements].reverse(),
        };
        expect(pairwiseTransfers(reversed)).toEqual(pairwiseTransfers(input));
      }),
    );
  });
});
