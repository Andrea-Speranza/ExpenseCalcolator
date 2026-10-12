// API pubblica di @expense/engine: è l'unico punto d'ingresso per la UI e gli altri consumatori.
export { calculateLedger } from './calculate';
export type { CalculationError, LedgerReport } from './calculate';
export type { InputIssue, InvalidInput } from './errors';

// Dal core, ciò che serve ai consumatori: tipi dei risultati e degli errori, e le funzioni per
// mostrare gli importi. Così UI e CLI non dipendono direttamente dal core.
export { decimalsOf, toDecimalString } from '@expense/core';
export type {
  AmountOutOfRange,
  CurrencyBalances,
  CurrencyMismatch,
  ExpenseError,
  InvalidAllocation,
  InvalidEntry,
  InvalidExpense,
  InvalidSettlement,
  LedgerError,
  PercentagesMismatch,
  Result,
  SettlementError,
  TotalMismatch,
  Transfer,
  UnbalancedBalances,
} from '@expense/core';
export type { Ledger, MemberAmount, Money } from '@expense/schema';
