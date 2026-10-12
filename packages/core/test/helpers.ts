import type { Result } from '../src/index';

/** Estrae il valore di un risultato riuscito; fa fallire il test se è un errore. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Errore inatteso: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Estrae l'errore di un risultato fallito; fa fallire il test se è riuscito. */
export function unwrapError<T, E>(result: Result<T, E>): E {
  if (result.ok) throw new Error(`Successo inatteso: ${JSON.stringify(result.value)}`);
  return result.error;
}
