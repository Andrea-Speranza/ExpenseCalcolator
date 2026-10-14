import { decimalsOf, type Money, toDecimalString } from '@expense/engine';

// Formattazione per l'utente nella lingua scelta (ADR 0010). Gli importi restano interi in unità minori fino a
// qui: Intl riceve il valore come testo decimale esatto, senza passare da numeri con la virgola.

export interface Formatter {
  readonly locale: string;
  /** Importo (es. "1.234,50 €" in italiano, "€1,234.50" in inglese); con `signed` mostra anche il "+". */
  money(amount: Money, signed?: boolean): string;
  /** Importo da mettere in un campo di testo (es. "12,50" o "12.50"), senza simbolo né migliaia. */
  amountInput(amount: Money): string;
  /** Percentuale da punti base (es. 3333 → "33,33%"). */
  percentage(basisPoints: number): string;
  /** Percentuale da mettere in un campo di testo (es. 3333 → "33,33"). */
  percentageInput(basisPoints: number): string;
  /** Data di calendario "2026-10-12" → "12 ott 2026". */
  date(date: string): string;
  /** Data per esteso, per le intestazioni (es. "martedì 13 ottobre 2026"). */
  longDate(date: string): string;
  /** Data con l'ora se c'è (es. "13 ott 2026, 20:30"). */
  dateTime(date: string, time: string | null): string;
  /** Giorno e ora di un istante (millisecondi), nel fuso orario del dispositivo o in quello indicato. */
  moment(ms: number, timeZone?: string): { readonly day: string; readonly time: string };
  /** Nome della valuta (es. "EUR · euro"). */
  currency(code: string): string;
}

export function createFormatter(locale: string): Formatter {
  const dayFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const longDayFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const percentFormat = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  const decimalSeparator =
    new Intl.NumberFormat(locale).formatToParts(1.5).find(({ type }) => type === 'decimal')
      ?.value ?? '.';
  const currencyNames = new Intl.DisplayNames(locale, { type: 'currency' });
  const calendarDay = (date: string, format: Intl.DateTimeFormat) => {
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? date : format.format(parsed);
  };

  const formatter: Formatter = {
    locale,
    money(amount, signed = false) {
      const decimal = toDecimalString(amount);
      const decimals = decimalsOf(amount.currency);
      if (!decimal.ok || !decimals.ok) return `${String(amount.minor)} ${amount.currency}`;
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: amount.currency,
        minimumFractionDigits: decimals.value,
        maximumFractionDigits: decimals.value,
        signDisplay: signed ? 'exceptZero' : 'auto',
      }).format(decimal.value as `${number}`);
    },
    amountInput(amount) {
      const decimal = toDecimalString(amount);
      return decimal.ok ? decimal.value.replace('.', decimalSeparator) : String(amount.minor);
    },
    percentage(basisPoints) {
      return `${formatter.percentageInput(basisPoints)}%`;
    },
    percentageInput(basisPoints) {
      return percentFormat.format(basisPoints / 100);
    },
    date(date) {
      return calendarDay(date, dayFormat);
    },
    longDate(date) {
      return calendarDay(date, longDayFormat);
    },
    dateTime(date, time) {
      return time === null ? formatter.date(date) : `${formatter.date(date)}, ${time}`;
    },
    moment(ms, timeZone) {
      const zone = timeZone === undefined ? {} : { timeZone };
      const moment = new Date(ms);
      return {
        day: new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          ...zone,
        }).format(moment),
        time: new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          ...zone,
        }).format(moment),
      };
    },
    currency(code) {
      const name = currencyNames.of(code);
      return name === undefined || name === code ? code : `${code} · ${name}`;
    },
  };
  return formatter;
}
