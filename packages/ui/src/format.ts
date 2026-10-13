import { decimalsOf, type Hlc, type Money, timeOfHlc, toDecimalString } from '@expense/engine';

// Formattazione per l'utente, in italiano (PLANNING §7.4). Gli importi restano interi in unità minori fino a
// qui: Intl riceve il valore come testo decimale esatto, senza passare da numeri con la virgola.

const LOCALE = 'it-IT';

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Importo nel formato italiano (es. "1.234,50 €"); con `signed` mostra anche il "+". */
export function formatMoney(amount: Money, signed = false): string {
  const decimal = toDecimalString(amount);
  const decimals = decimalsOf(amount.currency);
  if (!decimal.ok || !decimals.ok) return `${String(amount.minor)} ${amount.currency}`;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: decimals.value,
    maximumFractionDigits: decimals.value,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(decimal.value as `${number}`);
}

/** Importo da mettere in un campo di testo (es. "12,50"), senza simbolo né separatore delle migliaia. */
export function amountInputValue(amount: Money): string {
  const decimal = toDecimalString(amount);
  return decimal.ok ? decimal.value.replace('.', ',') : String(amount.minor);
}

/** Percentuale da punti base (es. 3333 → "33,33%"). */
export function formatPercentage(basisPoints: number): string {
  return `${percentageInputValue(basisPoints)}%`;
}

/** Percentuale da mettere in un campo di testo (es. 3333 → "33,33"). */
export function percentageInputValue(basisPoints: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2, useGrouping: false }).format(
    basisPoints / 100,
  );
}

/** Data di calendario "2026-10-12" → "12 ott 2026". */
export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : dateFormat.format(parsed);
}

const longDateFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Data di calendario per esteso, per le intestazioni (es. "martedì 13 ottobre 2026"). */
export function formatLongDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : longDateFormat.format(parsed);
}

/** Giorno e ora di un istante (millisecondi), nel fuso orario del dispositivo o in quello indicato. */
export function formatMoment(
  ms: number,
  timeZone?: string,
): { readonly day: string; readonly time: string } {
  const zone = timeZone === undefined ? {} : { timeZone };
  const moment = new Date(ms);
  return {
    day: new Intl.DateTimeFormat(LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...zone,
    }).format(moment),
    time: new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', ...zone }).format(
      moment,
    ),
  };
}

/**
 * Quando un elemento è stato inserito e, se è cambiato dopo, quando è stato modificato l'ultima volta
 * (es. "Inserita il 13 ott 2026 alle 16:42 · modificata il 14 ott 2026 alle 09:10"). Le ore vengono
 * dall'orologio del dispositivo che ha scritto la modifica.
 */
export function entryTimes(
  { createdAt, version }: { readonly createdAt: Hlc; readonly version: Hlc },
  inserted: 'Inserita' | 'Inserito',
  timeZone?: string,
): string {
  const created = timeOfHlc(createdAt);
  if (created === null) return '';
  const first = formatMoment(created, timeZone);
  const text = `${inserted} il ${first.day} alle ${first.time}`;
  const updated = timeOfHlc(version);
  if (version === createdAt || updated === null) return text;
  const last = formatMoment(updated, timeZone);
  const modified = inserted === 'Inserita' ? 'modificata' : 'modificato';
  return `${text} · ${modified} il ${last.day} alle ${last.time}`;
}
/** Data di oggi nel fuso orario del dispositivo, come AAAA-MM-GG. */
export function today(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const currencyNames = new Intl.DisplayNames(LOCALE, { type: 'currency' });

/** Nome della valuta in italiano (es. "EUR · euro"). */
export function currencyLabel(code: string): string {
  const name = currencyNames.of(code);
  return name === undefined || name === code ? code : `${code} · ${name}`;
}
