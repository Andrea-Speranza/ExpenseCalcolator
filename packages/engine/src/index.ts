// API pubblica di @expense/engine: è l'unico punto d'ingresso per la UI e gli altri consumatori.
export { calculateLedger } from './calculate';
export type { CalculationError, LedgerReport } from './calculate';
export type { CommandResult, CommandResults } from './commands';
export { openEngine } from './engine';
export type { Engine, EngineDependencies, QueryResults, ReceiveSummary } from './engine';
export {
  exportGroupFile,
  importExchangeFile,
  parseExchangeFile,
  serializeExchangeFile,
} from './exchange';
export type { ImportSummary } from './exchange';
export type {
  CommandError,
  InputIssue,
  InvalidExchangeFile,
  InvalidInput,
  NoChanges,
  NotFound,
  QueryError,
  StorageFailed,
} from './errors';
export { createManualClock, createMemoryStore, createSequentialIds } from './memory';
export type { Clock, DeviceRecord, IdGenerator, LocalStore } from './ports';
export { timeOfHlc } from './time';
export { DEFAULT_SETTINGS } from './views';
export type {
  BalancesView,
  ExcludedEntry,
  ExpenseView,
  GroupSummary,
  GroupView,
  MemberView,
  SettingsView,
  SettlementView,
} from './views';

// Dal core e da sync, ciò che serve ai consumatori: tipi dei risultati e degli errori, e le funzioni per
// mostrare gli importi. Così UI e CLI non dipendono direttamente da core e sync.
export { decimalsOf, knownCurrencies, toDecimalString, fromDecimalString } from '@expense/core';
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
export type {
  Command,
  CommandType,
  ExchangeFile,
  ExpenseAmounts,
  Hlc,
  Ledger,
  MemberAmount,
  Money,
  Query,
  QueryType,
  SettlementTransfer,
  Split,
  StoredEvent,
} from '@expense/schema';
export type { Conflict, HlcClock, Policy } from '@expense/sync';
