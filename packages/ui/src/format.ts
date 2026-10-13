import { decimalsOf, type Money, toDecimalString } from '@expense/engine';

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
