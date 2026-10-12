import type { CurrencyCode } from '@expense/schema';

// Errori di dominio del core. Contengono solo dati: il testo da mostrare all'utente lo sceglie la UI
// in base al `code`, nella lingua dell'utente.

/** Operazione tra importi di valute diverse (ADR 0004: il core non mescola mai valute). */
export interface CurrencyMismatch {
  readonly code: 'CurrencyMismatch';
  readonly expected: CurrencyCode;
  readonly actual: CurrencyCode;
}

/** Valuta assente dalla tabella ISO 4217 del core. */
export interface UnknownCurrency {
  readonly code: 'UnknownCurrency';
  readonly currency: string;
}

/** Importo che non è un intero sicuro (`Number.isSafeInteger`), in ingresso o come risultato. */
export interface AmountOutOfRange {
  readonly code: 'AmountOutOfRange';
}

/** Testo che non rappresenta un importo decimale (es. "12.34"). */
export interface InvalidAmountFormat {
  readonly code: 'InvalidAmountFormat';
  readonly input: string;
}

/** Importo con più decimali di quelli previsti dalla valuta (es. "1.5" yen). */
export interface TooManyDecimals {
  readonly code: 'TooManyDecimals';
  readonly currency: CurrencyCode;
  readonly maxDecimals: number;
}

/** Parametri non validi per una ripartizione proporzionale. */
export interface InvalidAllocation {
  readonly code: 'InvalidAllocation';
  readonly reason:
    'noWeights' | 'negativeWeight' | 'nonIntegerWeight' | 'zeroTotalWeight' | 'invalidRotation';
}
