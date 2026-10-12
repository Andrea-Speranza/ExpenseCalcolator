/**
 * Esito di un'operazione che può fallire per un motivo di dominio.
 * Gli errori di dominio sono valori, non eccezioni (PLANNING §4.2): qualsiasi chiamante li gestisce allo
 * stesso modo, anche attraverso un confine serializzato (worker, bridge nativo).
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
