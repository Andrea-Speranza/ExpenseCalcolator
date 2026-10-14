import { fromDecimalString, type Money, type Result } from '@expense/engine';

// Numeri scritti dall'utente nei form: "12,50" e "12.50" valgono uguale, in ogni lingua. Gli errori sono
// codici con i dati che servono a spiegarli; il testo lo compone la UI nella lingua attiva (ADR 0010).

export type InputProblem =
  | { readonly code: 'amountRequired' }
  | { readonly code: 'invalidAmount' }
  | { readonly code: 'tooManyDecimals'; readonly currency: string; readonly max: number }
  | { readonly code: 'tooLarge' }
  | { readonly code: 'unknownCurrency'; readonly currency: string }
  | { readonly code: 'invalidPercentage' }
  | { readonly code: 'percentageOver100' }
  | { readonly code: 'invalidWeight' };

export function parseAmount(text: string, currency: string): Result<Money, InputProblem> {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return { ok: false, error: { code: 'amountRequired' } };
  const parsed = fromDecimalString(normalized, currency);
  if (parsed.ok) return parsed;
  switch (parsed.error.code) {
    case 'InvalidAmountFormat':
      return { ok: false, error: { code: 'invalidAmount' } };
    case 'TooManyDecimals':
      return {
        ok: false,
        error: { code: 'tooManyDecimals', currency, max: parsed.error.maxDecimals },
      };
    case 'AmountOutOfRange':
      return { ok: false, error: { code: 'tooLarge' } };
    case 'UnknownCurrency':
      return { ok: false, error: { code: 'unknownCurrency', currency } };
  }
}

/** Percentuale con al massimo due decimali ("33,33") in punti base (3333). */
export function parsePercentage(text: string): Result<number, InputProblem> {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (match === null) return { ok: false, error: { code: 'invalidPercentage' } };
  const [, integer = '0', fraction = ''] = match;
  const basisPoints = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  if (basisPoints > 10_000) return { ok: false, error: { code: 'percentageOver100' } };
  return { ok: true, value: basisPoints };
}

/** Quota intera (es. 2 = paga il doppio di chi ha 1). */
export function parseWeight(text: string): Result<number, InputProblem> {
  const trimmed = text.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return { ok: false, error: { code: 'invalidWeight' } };
  return { ok: true, value: Number(trimmed) };
}
