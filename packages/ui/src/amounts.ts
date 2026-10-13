import { fromDecimalString, type Money, type Result } from '@expense/engine';

// Numeri scritti dall'utente nei form, in formato italiano: "12,50" e "12.50" valgono uguale.
// Gli errori sono già testi da mostrare accanto al campo.

export function parseAmount(text: string, currency: string): Result<Money, string> {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return { ok: false, error: 'Indica un importo.' };
  const parsed = fromDecimalString(normalized, currency);
  if (parsed.ok) return parsed;
  switch (parsed.error.code) {
    case 'InvalidAmountFormat':
      return { ok: false, error: 'Non è un importo valido (esempi: 12 oppure 12,50).' };
    case 'TooManyDecimals':
      return {
        ok: false,
        error:
          parsed.error.maxDecimals === 0
            ? `In ${currency} non si usano decimali.`
            : `In ${currency} si usano al massimo ${String(parsed.error.maxDecimals)} decimali.`,
      };
    case 'AmountOutOfRange':
      return { ok: false, error: 'L’importo è troppo grande.' };
    case 'UnknownCurrency':
      return { ok: false, error: `Valuta sconosciuta: ${currency}.` };
  }
}

/** Percentuale con al massimo due decimali ("33,33") in punti base (3333). */
export function parsePercentage(text: string): Result<number, string> {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (match === null) {
    return { ok: false, error: 'Non è una percentuale valida (esempi: 50 oppure 33,33).' };
  }
  const [, integer = '0', fraction = ''] = match;
  const basisPoints = Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
  if (basisPoints > 10_000) return { ok: false, error: 'La percentuale supera il 100%.' };
  return { ok: true, value: basisPoints };
}

/** Quota intera (es. 2 = paga il doppio di chi ha 1). */
export function parseWeight(text: string): Result<number, string> {
  const trimmed = text.trim();
  if (!/^\d{1,6}$/.test(trimmed)) return { ok: false, error: 'Usa un numero intero (es. 1 o 2).' };
  return { ok: true, value: Number(trimmed) };
}
