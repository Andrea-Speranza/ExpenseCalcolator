import type { Result } from '@expense/engine';

/** Ciò che la CLI stampa e l'exit code: 0 = tutto bene, 1 = errore nei dati, 2 = comando usato male. */
export interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export const done = (stdout: string): CliResult => ({ stdout, stderr: '', exitCode: 0 });

export const failure = (message: string): CliResult => ({
  stdout: '',
  stderr: `${message}\n`,
  exitCode: 1,
});

export const usageError = (message: string, help: string): CliResult => ({
  stdout: '',
  stderr: `Errore: ${message}.\n\n${help}`,
  exitCode: 2,
});

/** Errore da mostrare all'utente (exit code 1). Nella CLI è più leggibile di un Result propagato a mano. */
export class UserError extends Error {}

/** Errore nell'uso del comando (exit code 2): si mostra con l'aiuto del comando. */
export class UsageError extends Error {}

/** Estrae il valore di un risultato dell'engine; se è un errore lo trasforma in un messaggio per l'utente. */
export function orFail<T, E>(result: Result<T, E>, describe: (error: E) => string): T {
  if (!result.ok) throw new UserError(describe(result.error));
  return result.value;
}
