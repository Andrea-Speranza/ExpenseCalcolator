import type { InvalidInput } from './errors';

interface Issue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/** Converte gli errori di validazione di Zod in un errore serializzabile, con il percorso di ogni campo. */
export function invalidInput(issues: readonly Issue[]): InvalidInput {
  return {
    code: 'InvalidInput',
    issues: issues.map(({ path, message }) => ({ path: path.map(String).join('.'), message })),
  };
}
