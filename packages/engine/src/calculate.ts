import {
  computeBalances,
  type CurrencyBalances,
  type CurrencyMismatch,
  err,
  type LedgerError,
  ok,
  pairwiseTransfers,
  type Result,
  simplifiedTransfers,
  type Transfer,
  type UnbalancedBalances,
} from '@expense/core';
import { type Ledger, LedgerSchema } from '@expense/schema';
import type { InvalidInput } from './errors';
import { invalidInput } from './input';

/** Registro validato, con saldi e trasferimenti suggeriti nei due modi (PLANNING §9.4–9.5). */
export interface LedgerReport {
  readonly ledger: Ledger;
  readonly balances: readonly CurrencyBalances[];
  readonly simplifiedTransfers: readonly Transfer[];
  readonly pairwiseTransfers: readonly Transfer[];
}

export type CalculationError = InvalidInput | LedgerError | UnbalancedBalances | CurrencyMismatch;

/**
 * Query senza stato: calcola saldi e trasferimenti da un registro arrivato dall'esterno (un file, un altro
 * processo). Il registro viene prima validato con gli schemi dei dati, poi passato al core.
 */
export function calculateLedger(input: unknown): Result<LedgerReport, CalculationError> {
  const parsed = LedgerSchema.safeParse(input);
  if (!parsed.success) return err(invalidInput(parsed.error.issues));
  const ledger = parsed.data;

  const balances = computeBalances(ledger);
  if (!balances.ok) return balances;
  const pairwise = pairwiseTransfers(ledger);
  if (!pairwise.ok) return pairwise;
  const simplified = simplifiedTransfers(balances.value);
  if (!simplified.ok) return simplified;

  return ok({
    ledger,
    balances: balances.value,
    simplifiedTransfers: simplified.value,
    pairwiseTransfers: pairwise.value,
  });
}
