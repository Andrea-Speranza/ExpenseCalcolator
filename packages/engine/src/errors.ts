import type {
  CurrencyMismatch,
  ExpenseError,
  LedgerError,
  SettlementError,
  UnbalancedBalances,
} from '@expense/core';

/** Un problema nei dati ricevuti: `path` indica il campo (es. "expenses.0.total.minor"). */
export interface InputIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Dati in ingresso che non rispettano gli schemi (ADR 0003). I messaggi sono quelli di Zod, nella lingua
 * configurata dall'applicazione che usa l'engine.
 */
export interface InvalidInput {
  readonly code: 'InvalidInput';
  readonly issues: readonly InputIssue[];
}

/** L'elemento indicato non esiste (o non esiste in quel gruppo). */
export interface NotFound {
  readonly code: 'NotFound';
  readonly entity: 'group' | 'member' | 'expense' | 'settlement';
  readonly id: string;
}

/** Una modifica senza nessun campo da cambiare. */
export interface NoChanges {
  readonly code: 'NoChanges';
}

/** Il salvataggio locale non è riuscito: lo stato non è cambiato e il comando si può ripetere. */
export interface StorageFailed {
  readonly code: 'StorageFailed';
  readonly message: string;
}

/**
 * Un file che non si può importare: non è JSON, non è un file di scambio di questa app, oppure l'ha scritto
 * una versione più recente dell'app (che va aggiornata).
 */
export interface InvalidExchangeFile {
  readonly code: 'InvalidExchangeFile';
  readonly reason: 'notJson' | 'notExchangeFile' | 'newerVersion';
}

export type CommandError =
  InvalidInput | NotFound | NoChanges | StorageFailed | ExpenseError | SettlementError;

export type QueryError =
  InvalidInput | NotFound | LedgerError | UnbalancedBalances | CurrencyMismatch;
