import type { CurrencyCode, Money } from '@expense/schema';
import { decimalsOf } from './currency';
import type {
  AmountOutOfRange,
  CurrencyMismatch,
  InvalidAmountFormat,
  TooManyDecimals,
  UnknownCurrency,
} from './errors';
import { err, ok, type Result } from './result';

const OUT_OF_RANGE: AmountOutOfRange = { code: 'AmountOutOfRange' };
const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

export function money(minor: number, currency: CurrencyCode): Result<Money, AmountOutOfRange> {
  return Number.isSafeInteger(minor) ? ok({ minor, currency }) : err(OUT_OF_RANGE);
}

export function zero(currency: CurrencyCode): Money {
  return { minor: 0, currency };
}

export function add(a: Money, b: Money): Result<Money, CurrencyMismatch | AmountOutOfRange> {
  if (a.currency !== b.currency) {
    return err({ code: 'CurrencyMismatch', expected: a.currency, actual: b.currency });
  }
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Result<Money, CurrencyMismatch | AmountOutOfRange> {
  return add(a, negate(b));
}

export function negate(amount: Money): Money {
  // `0 - x` invece di `-x`: evita lo zero negativo (-0).
  return { minor: 0 - amount.minor, currency: amount.currency };
}

/** Somma importi della stessa valuta. La valuta va indicata perché l'elenco può essere vuoto. */
export function sum(
  amounts: readonly Money[],
  currency: CurrencyCode,
): Result<Money, CurrencyMismatch | AmountOutOfRange> {
  let total = zero(currency);
  for (const amount of amounts) {
    const next = add(total, amount);
    if (!next.ok) return next;
    total = next.value;
  }
  return ok(total);
}

/**
 * Converte un decimale testuale (es. "12.34", "-0.5") in importo.
 * Accetta solo il punto come separatore: la UI normalizza prima il formato locale.
 * Non arrotonda mai: più decimali di quelli della valuta sono un errore, a meno che siano zeri.
 */
export function fromDecimalString(
  input: string,
  currency: CurrencyCode,
): Result<Money, UnknownCurrency | InvalidAmountFormat | TooManyDecimals | AmountOutOfRange> {
  const decimals = decimalsOf(currency);
  if (!decimals.ok) return decimals;

  const match = DECIMAL_PATTERN.exec(input);
  if (match === null) return err({ code: 'InvalidAmountFormat', input });
  const [, sign = '', integerPart = '', fractionPart = ''] = match;

  if (/[^0]/.test(fractionPart.slice(decimals.value))) {
    return err({ code: 'TooManyDecimals', currency, maxDecimals: decimals.value });
  }
  const digits = integerPart + fractionPart.slice(0, decimals.value).padEnd(decimals.value, '0');

  const magnitude = BigInt(digits);
  if (magnitude > BigInt(Number.MAX_SAFE_INTEGER)) return err(OUT_OF_RANGE);
  const minor = Number(magnitude);
  return ok({ minor: sign === '-' ? 0 - minor : minor, currency });
}

/** Rappresentazione decimale non localizzata (es. "12.34"): per i test vector e lo scambio di dati. */
export function toDecimalString(amount: Money): Result<string, UnknownCurrency> {
  const decimals = decimalsOf(amount.currency);
  if (!decimals.ok) return decimals;

  const sign = amount.minor < 0 ? '-' : '';
  const digits = String(Math.abs(amount.minor)).padStart(decimals.value + 1, '0');
  if (decimals.value === 0) return ok(sign + digits);
  const integerPart = digits.slice(0, -decimals.value);
  const fractionPart = digits.slice(-decimals.value);
  return ok(`${sign}${integerPart}.${fractionPart}`);
}
