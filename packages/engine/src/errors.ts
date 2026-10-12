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
