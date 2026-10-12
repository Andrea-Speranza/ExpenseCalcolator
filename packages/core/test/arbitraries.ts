import type { CurrencyCode, MemberAmount, MemberId, Split, SplitMethod } from '@expense/schema';
import fc from 'fast-check';
import {
  allocate,
  type CurrencyBalances,
  type ExpenseInput,
  type LedgerInput,
  type SettlementInput,
  type Transfer,
} from '../src/index';
import { unwrap } from './helpers';

// Generatori di dati casuali ma sempre validi, per i test property-based.

export const MEMBERS: readonly MemberId[] = ['m_a', 'm_b', 'm_c', 'm_d', 'm_e'];
const CURRENCIES: readonly CurrencyCode[] = ['EUR', 'USD'];
const METHODS: readonly SplitMethod[] = ['equal', 'exact', 'percentage', 'shares'];

const memberSet = fc.uniqueArray(fc.constantFrom(...MEMBERS), {
  minLength: 1,
  maxLength: MEMBERS.length,
});
const weights = fc.array(fc.integer({ min: 1, max: 100 }), {
  minLength: MEMBERS.length,
  maxLength: MEMBERS.length,
});

/** Divide `total` tra i membri in proporzione ai pesi (usa `allocate`, verificata a parte). */
function distribute(
  total: number,
  memberIds: readonly MemberId[],
  memberWeights: readonly number[],
  currency: CurrencyCode,
): MemberAmount[] {
  const shares = unwrap(allocate(total, memberWeights.slice(0, memberIds.length)));
  return memberIds.map((memberId, index) => ({
    memberId,
    amount: { minor: shares[index] ?? 0, currency },
  }));
}

function buildSplit(
  method: SplitMethod,
  total: number,
  memberIds: readonly MemberId[],
  memberWeights: readonly number[],
  currency: CurrencyCode,
): Split {
  switch (method) {
    case 'equal':
      return { method, memberIds };
    case 'exact':
      return { method, amounts: distribute(total, memberIds, memberWeights, currency) };
    case 'percentage':
      return {
        method,
        percentages: distribute(10_000, memberIds, memberWeights, currency).map(
          ({ memberId, amount }) => ({ memberId, basisPoints: amount.minor }),
        ),
      };
    case 'shares':
      return {
        method,
        weights: memberIds.map((memberId, index) => ({
          memberId,
          weight: memberWeights[index] ?? 1,
        })),
      };
  }
}

export const expense: fc.Arbitrary<ExpenseInput> = fc
  .record({
    id: fc.stringMatching(/^e_[a-z0-9]{1,6}$/),
    currency: fc.constantFrom(...CURRENCIES),
    total: fc.integer({ min: 1, max: 1_000_000_000 }),
    payers: memberSet,
    payerWeights: weights,
    participants: memberSet,
    splitWeights: weights,
    method: fc.constantFrom(...METHODS),
  })
  .map(({ id, currency, total, payers, payerWeights, participants, splitWeights, method }) => ({
    id,
    total: { minor: total, currency },
    // Con totali piccoli qualche pagatore riceverebbe 0: un pagatore deve aver pagato qualcosa.
    paidBy: distribute(total, payers, payerWeights, currency).filter(
      ({ amount }) => amount.minor > 0,
    ),
    split: buildSplit(method, total, participants, splitWeights, currency),
  }));

export const settlement: fc.Arbitrary<SettlementInput> = fc
  .record({
    id: fc.stringMatching(/^s_[a-z0-9]{1,6}$/),
    from: fc.constantFrom(...MEMBERS),
    offset: fc.integer({ min: 1, max: MEMBERS.length - 1 }),
    currency: fc.constantFrom(...CURRENCIES),
    minor: fc.integer({ min: 1, max: 1_000_000 }),
  })
  .map(({ id, from, offset, currency, minor }) => ({
    id,
    from,
    // Un membro diverso da `from`, scelto spostandosi di `offset` posizioni nell'elenco.
    to: MEMBERS[(MEMBERS.indexOf(from) + offset) % MEMBERS.length] ?? from,
    amount: { minor, currency },
  }));

export const ledger: fc.Arbitrary<LedgerInput> = fc.record({
  expenses: fc.array(expense, { maxLength: 8 }),
  settlements: fc.array(settlement, { maxLength: 4 }),
});

/** Applica i trasferimenti ai saldi: chi paga si avvicina a zero dal basso, chi riceve dall'alto. */
export function applyTransfers(
  balances: readonly CurrencyBalances[],
  transfers: readonly Transfer[],
): Map<string, number> {
  const result = new Map<string, number>();
  const change = (currency: CurrencyCode, memberId: MemberId, delta: number) => {
    const key = `${currency} ${memberId}`;
    result.set(key, (result.get(key) ?? 0) + delta);
  };
  for (const { currency, balances: members } of balances) {
    for (const { memberId, amount } of members) change(currency, memberId, amount.minor);
  }
  for (const { from, to, amount } of transfers) {
    change(amount.currency, from, amount.minor);
    change(amount.currency, to, 0 - amount.minor);
  }
  return result;
}
