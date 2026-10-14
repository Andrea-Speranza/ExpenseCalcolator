import { describe, expect, it } from 'vitest';
import { parseAmount, parsePercentage, parseWeight } from '../src/amounts';
import type { FormProblem } from '../src/expense-draft';
import { today } from '../src/format';
import { createUiI18n } from '../src/i18n';
import { describeProblem } from '../src/messages';

describe('parseAmount', () => {
  it('accetta la virgola e il punto come separatore decimale', () => {
    expect(parseAmount('12,50', 'EUR')).toEqual({
      ok: true,
      value: { minor: 1250, currency: 'EUR' },
    });
    expect(parseAmount(' 12.5 ', 'EUR')).toEqual({
      ok: true,
      value: { minor: 1250, currency: 'EUR' },
    });
  });

  it('restituisce codici, non testi', () => {
    expect(parseAmount('', 'EUR')).toEqual({ ok: false, error: { code: 'amountRequired' } });
    expect(parseAmount('dieci', 'EUR')).toEqual({ ok: false, error: { code: 'invalidAmount' } });
    expect(parseAmount('1,234', 'EUR')).toEqual({
      ok: false,
      error: { code: 'tooManyDecimals', currency: 'EUR', max: 2 },
    });
    expect(parseAmount('1,5', 'JPY')).toEqual({
      ok: false,
      error: { code: 'tooManyDecimals', currency: 'JPY', max: 0 },
    });
  });
});

describe('parsePercentage e parseWeight', () => {
  it('convertono in punti base e quote intere', () => {
    expect(parsePercentage('33,33')).toEqual({ ok: true, value: 3333 });
    expect(parsePercentage('50')).toEqual({ ok: true, value: 5000 });
    expect(parsePercentage('100,5')).toEqual({ ok: false, error: { code: 'percentageOver100' } });
    expect(parsePercentage('1,234')).toEqual({ ok: false, error: { code: 'invalidPercentage' } });
    expect(parseWeight('2')).toEqual({ ok: true, value: 2 });
    expect(parseWeight('1,5')).toEqual({ ok: false, error: { code: 'invalidWeight' } });
  });
});

describe('testi dei problemi nei form', () => {
  const problems: readonly FormProblem[] = [
    { code: 'tooManyDecimals', currency: 'EUR', max: 2 },
    { code: 'tooManyDecimals', currency: 'JPY', max: 0 },
    { code: 'participantsRequired' },
  ];

  it('si compongono nella lingua attiva', () => {
    const describe = (language: 'it' | 'en') =>
      problems.map((problem) => describeProblem(createUiI18n(language), problem));
    expect(describe('it')).toEqual([
      'In EUR si usano al massimo 2 decimali.',
      'In JPY non si usano decimali.',
      'Scegli almeno una persona.',
    ]);
    expect(describe('en')).toEqual([
      'EUR uses at most 2 decimals.',
      'JPY has no decimals.',
      'Choose at least one person.',
    ]);
  });
});

describe('today', () => {
  it('usa il fuso orario del dispositivo', () => {
    expect(today(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
