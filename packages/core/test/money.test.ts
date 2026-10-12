import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  add,
  fromDecimalString,
  knownCurrencies,
  money,
  negate,
  subtract,
  sum,
  toDecimalString,
  zero,
} from '../src/index';
import { unwrap, unwrapError } from './helpers';

const eur = (minor: number) => unwrap(money(minor, 'EUR'));
const safeMinor = fc.integer({ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER });
const halfSafeMinor = fc.integer({
  min: Math.ceil(Number.MIN_SAFE_INTEGER / 2),
  max: Math.floor(Number.MAX_SAFE_INTEGER / 2),
});

describe('money', () => {
  it('crea un importo da un intero', () => {
    expect(unwrap(money(1234, 'EUR'))).toEqual({ minor: 1234, currency: 'EUR' });
  });

  it.each([12.34, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rifiuta %d',
    (minor) => {
      expect(unwrapError(money(minor, 'EUR'))).toEqual({ code: 'AmountOutOfRange' });
    },
  );
});

describe('add, subtract, negate', () => {
  it('somma e sottrae importi della stessa valuta', () => {
    expect(unwrap(add(eur(1000), eur(234)))).toEqual(eur(1234));
    expect(unwrap(subtract(eur(1000), eur(1234)))).toEqual(eur(-234));
  });

  it('rifiuta valute diverse', () => {
    const usd = unwrap(money(100, 'USD'));
    expect(unwrapError(add(eur(100), usd))).toEqual({
      code: 'CurrencyMismatch',
      expected: 'EUR',
      actual: 'USD',
    });
  });

  it('segnala il superamento degli interi sicuri', () => {
    expect(unwrapError(add(eur(Number.MAX_SAFE_INTEGER), eur(1)))).toEqual({
      code: 'AmountOutOfRange',
    });
  });

  it('non produce mai lo zero negativo', () => {
    expect(Object.is(negate(zero('EUR')).minor, 0)).toBe(true);
  });

  it('sottrarre ciò che si è sommato riporta al valore di partenza', () => {
    fc.assert(
      fc.property(halfSafeMinor, halfSafeMinor, (a, b) => {
        expect(unwrap(subtract(unwrap(add(eur(a), eur(b))), eur(b)))).toEqual(eur(a));
      }),
    );
  });
});

describe('sum', () => {
  it('somma un elenco, anche vuoto', () => {
    expect(unwrap(sum([eur(100), eur(250), eur(-50)], 'EUR'))).toEqual(eur(300));
    expect(unwrap(sum([], 'EUR'))).toEqual(eur(0));
  });

  it('rifiuta un elenco con valute diverse', () => {
    const usd = unwrap(money(100, 'USD'));
    expect(unwrapError(sum([eur(100), usd], 'EUR'))).toMatchObject({ code: 'CurrencyMismatch' });
  });
});

describe('fromDecimalString', () => {
  it.each([
    ['12.34', 'EUR', 1234],
    ['12', 'EUR', 1200],
    ['0.5', 'EUR', 50],
    ['1.50', 'EUR', 150],
    ['1.500', 'EUR', 150],
    ['-0.05', 'EUR', -5],
    ['12', 'JPY', 12],
    ['1.0', 'JPY', 1],
    ['0.001', 'KWD', 1],
  ])('%s %s → %i', (input, currency, minor) => {
    expect(unwrap(fromDecimalString(input, currency))).toEqual({ minor, currency });
  });

  it('non produce lo zero negativo', () => {
    expect(Object.is(unwrap(fromDecimalString('-0.00', 'EUR')).minor, 0)).toBe(true);
  });

  it.each(['', 'abc', '1,5', '.5', '1.', '+1', ' 1', '1e3'])('rifiuta il formato %j', (input) => {
    expect(unwrapError(fromDecimalString(input, 'EUR'))).toEqual({
      code: 'InvalidAmountFormat',
      input,
    });
  });

  it('rifiuta decimali oltre quelli della valuta, senza arrotondare', () => {
    expect(unwrapError(fromDecimalString('1.505', 'EUR'))).toEqual({
      code: 'TooManyDecimals',
      currency: 'EUR',
      maxDecimals: 2,
    });
    expect(unwrapError(fromDecimalString('1.5', 'JPY'))).toMatchObject({ code: 'TooManyDecimals' });
  });

  it('rifiuta valute sconosciute e importi fuori scala', () => {
    expect(unwrapError(fromDecimalString('1', 'XYZ'))).toMatchObject({ code: 'UnknownCurrency' });
    expect(unwrapError(fromDecimalString('90071992547409.92', 'EUR'))).toEqual({
      code: 'AmountOutOfRange',
    });
  });
});

describe('toDecimalString', () => {
  it.each([
    [1234, 'EUR', '12.34'],
    [-5, 'EUR', '-0.05'],
    [0, 'EUR', '0.00'],
    [12, 'JPY', '12'],
    [-12, 'JPY', '-12'],
    [1, 'KWD', '0.001'],
  ])('%i %s → %s', (minor, currency, expected) => {
    expect(unwrap(toDecimalString(unwrap(money(minor, currency))))).toBe(expected);
  });

  it('segnala una valuta sconosciuta', () => {
    expect(unwrapError(toDecimalString(unwrap(money(1, 'XYZ'))))).toMatchObject({
      code: 'UnknownCurrency',
    });
  });

  it('è l’inverso di fromDecimalString per ogni valuta conosciuta', () => {
    fc.assert(
      fc.property(safeMinor, fc.constantFrom(...knownCurrencies()), (minor, currency) => {
        const amount = unwrap(money(minor, currency));
        expect(unwrap(fromDecimalString(unwrap(toDecimalString(amount)), currency))).toEqual(
          amount,
        );
      }),
    );
  });
});
