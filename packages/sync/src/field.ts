import type { Hlc, MemberId } from '@expense/schema';
import { compareText } from './text';

/**
 * Valore di un campo con chi l'ha scritto e quando. Vince l'ultima modifica nell'ordine degli eventi
 * (last-writer-wins per campo o per blocco, ADR 0007).
 */
export interface Field<T> {
  readonly value: T;
  readonly hlc: Hlc;
  readonly actor: MemberId | null;
}

/**
 * Modifica contemporanea: chi ha scritto `by` non aveva visto il valore `overwritten`, che resta qui e si può
 * recuperare (ADR 0007, punto 5).
 */
export interface Conflict {
  readonly field: string;
  readonly overwritten: unknown;
  readonly overwrittenBy: MemberId | null;
  readonly overwrittenAt: Hlc;
  readonly by: MemberId | null;
  readonly at: Hlc;
}

/** Le parti di un evento che servono per scrivere un campo. */
export interface Write {
  readonly hlc: Hlc;
  readonly actor: MemberId | null;
  readonly base?: Hlc | undefined;
}

export function initialField<T>(value: T, write: Write): Field<T> {
  return { value, hlc: write.hlc, actor: write.actor };
}

/**
 * Scrive un nuovo valore. Gli eventi si applicano in ordine di HLC, quindi la scrittura nuova vince sempre;
 * se però il suo autore non aveva visto il valore attuale (`base` più vecchio), è una modifica contemporanea.
 */
export function overwrite<T>(
  current: Field<T>,
  value: T,
  write: Write,
  name: string,
): { readonly field: Field<T>; readonly conflict: Conflict | undefined } {
  const unseen = write.base !== undefined && compareText(write.base, current.hlc) < 0;
  return {
    field: initialField(value, write),
    conflict: unseen
      ? {
          field: name,
          overwritten: current.value,
          overwrittenBy: current.actor,
          overwrittenAt: current.hlc,
          by: write.actor,
          at: write.hlc,
        }
      : undefined,
  };
}
