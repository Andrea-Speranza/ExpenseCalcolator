import { type Hlc, timeOfHlc } from '@expense/engine';
import type { UiI18n } from './i18n';
import { K } from './i18n';

// Date e ore per le schermate. Importi, date e nomi delle valute si formattano con `useI18n().format`
// (@expense/i18n), nella lingua attiva; qui ci sono solo i testi che dipendono dall'ora degli eventi.

/**
 * Per gli elenchi: quando un elemento è cambiato l'ultima volta (l'inserimento conta come prima modifica),
 * es. "Ultima modifica il 13 ott 2026 alle 17:20". I dettagli completi stanno nella pagina dell'elemento.
 */
export function lastChange(
  { t, format }: UiI18n,
  { version }: { readonly version: Hlc },
  timeZone?: string,
): string {
  const time = timeOfHlc(version);
  if (time === null) return '';
  const { day, time: hour } = format.moment(time, timeZone);
  return t(K.entry.lastChange, { day, time: hour });
}

/**
 * Quando una spesa è stata inserita e, se è cambiata dopo, quando è stata modificata l'ultima volta. Le ore
 * vengono dall'orologio del dispositivo che ha scritto la modifica.
 */
export function expenseTimes(
  { t, format }: UiI18n,
  { createdAt, version }: { readonly createdAt: Hlc; readonly version: Hlc },
  timeZone?: string,
): string {
  const created = timeOfHlc(createdAt);
  if (created === null) return '';
  const first = format.moment(created, timeZone);
  const updated = timeOfHlc(version);
  if (version === createdAt || updated === null) {
    return t(K.expense.created, { day: first.day, time: first.time });
  }
  const last = format.moment(updated, timeZone);
  return t(K.expense.createdAndModified, {
    day: first.day,
    time: first.time,
    lastDay: last.day,
    lastTime: last.time,
  });
}

/** Data di oggi nel fuso orario del dispositivo, come AAAA-MM-GG. */
export function today(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
