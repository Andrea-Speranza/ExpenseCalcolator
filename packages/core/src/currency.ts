import type { CurrencyCode } from '@expense/schema';
import type { UnknownCurrency } from './errors';
import { err, ok, type Result } from './result';

// Valute in uso secondo ISO 4217, raggruppate per numero di decimali delle unità minori.
// Esclusi fondi (es. CLF, USN), metalli preziosi e valute ritirate.
// La tabella è interna e non deriva da `Intl`, i cui dati cambiano tra browser e versioni:
// il calcolo deve dare lo stesso risultato su ogni dispositivo (ADR 0004).
const ZERO_DECIMALS = 'BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF';
const THREE_DECIMALS = 'BHD IQD JOD KWD LYD OMR TND';
const TWO_DECIMALS =
  'AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF ' +
  'CNY COP CRC CUP CVE CZK DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GTQ GYD HKD HNL ' +
  'HTG HUF IDR ILS INR IRR JMD KES KGS KHR KPW KYD KZT LAK LBP LKR LRD LSL MAD MDL MGA MKD MMK MNT ' +
  'MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR RON RSD RUB ' +
  'SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TOP TRY TTD TWD TZS UAH ' +
  'USD UYU UZS VED VES WST XCD XCG YER ZAR ZMW ZWG';

function withDecimals(codes: string, decimals: number): [string, number][] {
  return codes.split(' ').map((code) => [code, decimals]);
}

const DECIMALS_BY_CURRENCY: ReadonlyMap<string, number> = new Map([
  ...withDecimals(ZERO_DECIMALS, 0),
  ...withDecimals(TWO_DECIMALS, 2),
  ...withDecimals(THREE_DECIMALS, 3),
]);

/** Numero di decimali della valuta (EUR 2, JPY 0, KWD 3). */
export function decimalsOf(currency: CurrencyCode): Result<number, UnknownCurrency> {
  const decimals = DECIMALS_BY_CURRENCY.get(currency);
  return decimals === undefined ? err({ code: 'UnknownCurrency', currency }) : ok(decimals);
}

export function isKnownCurrency(code: string): boolean {
  return DECIMALS_BY_CURRENCY.has(code);
}

/** Tutte le valute conosciute, in ordine alfabetico (es. per il selettore della UI). */
export function knownCurrencies(): readonly CurrencyCode[] {
  return [...DECIMALS_BY_CURRENCY.keys()].sort();
}
