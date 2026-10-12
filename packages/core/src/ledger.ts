import type { CurrencyCode, MemberAmount, MemberId, Money, SettlementId } from '@expense/schema';
import type { LedgerError, SettlementError } from './errors';
import { type ExpenseInput, expenseNets, splitExpense } from './expense';
import { compareStrings } from './order';
import { err, ok, type Result } from './result';

/** Rimborso: `from` dà a `to` l'importo indicato. */
export interface SettlementInput {
  readonly id: SettlementId;
  readonly from: MemberId;
  readonly to: MemberId;
  readonly amount: Money;
}

/** Tutte le spese e i rimborsi di un gruppo. */
export interface LedgerInput {
  readonly expenses: readonly ExpenseInput[];
  readonly settlements: readonly SettlementInput[];
}

/**
 * Saldi di una valuta, ordinati per membro. Positivo: il membro deve ricevere; negativo: deve dare
 * (PLANNING §9.4).
 */
export interface CurrencyBalances {
  readonly currency: CurrencyCode;
  readonly balances: readonly MemberAmount[];
}

/** Effetto di una voce del registro: per ogni membro, quanto avanza (+) o deve (−) in una valuta. */
export interface EntryEffect {
  readonly currency: CurrencyCode;
  readonly nets: readonly MemberAmount[];
}

export function validateSettlement(
  settlement: SettlementInput,
): Result<SettlementInput, SettlementError> {
  if (!Number.isSafeInteger(settlement.amount.minor)) return err({ code: 'AmountOutOfRange' });
  if (settlement.amount.minor <= 0) {
    return err({ code: 'InvalidSettlement', reason: 'nonPositiveAmount' });
  }
  if (settlement.from === settlement.to) {
    return err({ code: 'InvalidSettlement', reason: 'sameMember' });
  }
  return ok(settlement);
}

/**
 * Saldi di ogni membro per valuta: pagato − dovuto + rimborsi dati − rimborsi ricevuti.
 * Il risultato non dipende dall'ordine di spese e rimborsi e, per ogni valuta, somma a zero.
 */
export function computeBalances(
  ledger: LedgerInput,
): Result<readonly CurrencyBalances[], LedgerError> {
  const effects = ledgerEffects(ledger);
  if (!effects.ok) return effects;

  const totals = new Map<CurrencyCode, Map<MemberId, number>>();
  for (const { currency, nets } of effects.value) {
    const members = totals.get(currency) ?? new Map<MemberId, number>();
    totals.set(currency, members);
    for (const { memberId, amount } of nets) {
      const next = (members.get(memberId) ?? 0) + amount.minor;
      if (!Number.isSafeInteger(next)) return err({ code: 'AmountOutOfRange' });
      members.set(memberId, next);
    }
  }

  return ok(
    [...totals.entries()]
      .sort(([a], [b]) => compareStrings(a, b))
      .map(([currency, members]) => ({
        currency,
        balances: [...members.entries()]
          .sort(([a], [b]) => compareStrings(a, b))
          .map(([memberId, minor]) => ({ memberId, amount: { minor, currency } })),
      })),
  );
}

/** Verifica ogni voce del registro e ne restituisce l'effetto sui saldi, nello stesso ordine. */
export function ledgerEffects(ledger: LedgerInput): Result<readonly EntryEffect[], LedgerError> {
  const effects: EntryEffect[] = [];
  for (const expense of ledger.expenses) {
    const breakdown = splitExpense(expense);
    if (!breakdown.ok) {
      return err({
        code: 'InvalidEntry',
        entry: 'expense',
        id: expense.id,
        error: breakdown.error,
      });
    }
    const { currency } = expense.total;
    effects.push({ currency, nets: expenseNets(breakdown.value, currency) });
  }
  for (const settlement of ledger.settlements) {
    const valid = validateSettlement(settlement);
    if (!valid.ok) {
      return err({
        code: 'InvalidEntry',
        entry: 'settlement',
        id: settlement.id,
        error: valid.error,
      });
    }
    const { from, to, amount } = settlement;
    effects.push({
      currency: amount.currency,
      nets: [
        { memberId: from, amount },
        { memberId: to, amount: { minor: 0 - amount.minor, currency: amount.currency } },
      ],
    });
  }
  return ok(effects);
}
