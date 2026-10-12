// API pubblica di @expense/core: tutto ciò che non è esportato da qui è interno al pacchetto.
export { allocate } from './allocate';
export { decimalsOf, isKnownCurrency, knownCurrencies } from './currency';
export type {
  AmountOutOfRange,
  CurrencyMismatch,
  ExpenseError,
  InvalidAllocation,
  InvalidAmountFormat,
  InvalidEntry,
  InvalidExpense,
  InvalidSettlement,
  LedgerError,
  SettlementError,
  TooManyDecimals,
  TotalMismatch,
  UnbalancedBalances,
  UnknownCurrency,
} from './errors';
export { splitExpense } from './expense';
export type { ExpenseBreakdown, ExpenseInput } from './expense';
export { computeBalances, validateSettlement } from './ledger';
export type { CurrencyBalances, LedgerInput, SettlementInput } from './ledger';
export {
  add,
  fromDecimalString,
  money,
  negate,
  subtract,
  sum,
  toDecimalString,
  zero,
} from './money';
export { err, ok } from './result';
export type { Result } from './result';
export { pairwiseTransfers, simplifiedTransfers } from './transfers';
export type { Transfer } from './transfers';
