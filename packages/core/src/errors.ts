import type { CurrencyCode, MemberId } from '@expense/schema';

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

/** Spesa non valida. `memberId`, se presente, indica il membro a cui si riferisce il problema. */
export interface InvalidExpense {
  readonly code: 'InvalidExpense';
  readonly reason:
    | 'nonPositiveTotal'
    | 'noPayers'
    | 'nonPositivePayment'
    | 'noParticipants'
    | 'duplicateMember'
    | 'negativeAmount';
  readonly memberId?: MemberId;
}

/**
 * Una somma non torna: quanto hanno pagato i pagatori o gli importi esatti (in unità minori) rispetto al
 * totale della spesa, oppure le percentuali (in punti base) rispetto a 10000.
 */
export interface TotalMismatch {
  readonly code: 'TotalMismatch';
  readonly field: 'paidBy' | 'amounts' | 'percentages';
  readonly expected: number;
  readonly actual: number;
}

/** Rimborso non valido. */
export interface InvalidSettlement {
  readonly code: 'InvalidSettlement';
  readonly reason: 'nonPositiveAmount' | 'sameMember';
}

/** Saldi la cui somma, per una valuta, non è zero: non si possono pareggiare con dei trasferimenti. */
export interface UnbalancedBalances {
  readonly code: 'UnbalancedBalances';
  readonly currency: CurrencyCode;
}

export type ExpenseError =
  InvalidExpense | TotalMismatch | CurrencyMismatch | InvalidAllocation | AmountOutOfRange;

export type SettlementError = InvalidSettlement | AmountOutOfRange;

/** Una spesa o un rimborso del registro non è valido: `id` dice quale, `error` perché. */
export interface InvalidEntry {
  readonly code: 'InvalidEntry';
  readonly entry: 'expense' | 'settlement';
  readonly id: string;
  readonly error: ExpenseError | SettlementError;
}

export type LedgerError = InvalidEntry | AmountOutOfRange;
