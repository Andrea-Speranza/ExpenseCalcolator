// API pubblica di @expense/core: tutto ciò che non è esportato da qui è interno al pacchetto.
export { allocate } from './allocate';
export { decimalsOf, isKnownCurrency, knownCurrencies } from './currency';
export type {
  AmountOutOfRange,
  CurrencyMismatch,
  InvalidAllocation,
  InvalidAmountFormat,
  TooManyDecimals,
  UnknownCurrency,
} from './errors';
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
