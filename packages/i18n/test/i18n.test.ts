import { LanguageSchema } from '@expense/schema';
import { describe, expect, it } from 'vitest';
import {
  createFormatter,
  createTranslator,
  describeError,
  describeFileError,
  describeImport,
  detectLanguage,
  dictionaryDifferences,
  keysOf,
  LANGUAGES,
  type Localized,
  SHARED,
  SHARED_DICTIONARIES,
} from '../src/index';

/** Gli spazi non separabili che Intl mette negli importi diventano spazi normali. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

function localized(language: 'it' | 'en'): Localized {
  const { t, locale } = createTranslator(SHARED_DICTIONARIES, language);
  return { t, format: createFormatter(locale) };
}

describe('chiavi', () => {
  it('ogni testo diventa il proprio percorso, senza le desinenze dei plurali', () => {
    const keys = keysOf({ a: { b: 'x', count_one: 'uno', count_other: 'tanti' }, c: 'y' });
    expect(keys).toEqual({ a: { b: 'a.b', count: 'a.count' }, c: 'c' });
    expect(SHARED.errors.notFound.group).toBe('errors.notFound.group');
    expect(SHARED.exchange.imported).toBe('exchange.imported');
  });
});

describe('dizionari', () => {
  it('le lingue sono quelle del profilo', () => {
    expect([...LANGUAGES]).toEqual(LanguageSchema.options);
  });

  it('l’inglese ha gli stessi testi e gli stessi segnaposto dell’italiano', () => {
    expect(dictionaryDifferences(SHARED_DICTIONARIES.it, SHARED_DICTIONARIES.en, 'en-GB')).toEqual(
      [],
    );
  });

  it('il controllo trova chiavi mancanti, in più e segnaposto diversi', () => {
    expect(
      dictionaryDifferences(
        { a: 'Ciao {{name}}', b: 'x', n_one: 'uno', n_other: '{{count}}' },
        { a: 'Hello {{nome}}', c: 'y', n_other: '{{count}}' },
        'en-GB',
      ),
    ).toEqual([
      '"a" ha segnaposto diversi: {name} invece di {nome}',
      'manca "b"',
      '"n" non ha le forme one',
      '"c" non esiste nella lingua di base',
    ]);
  });
});

describe('lingua iniziale', () => {
  it('prende la prima lingua conosciuta del dispositivo, altrimenti l’inglese', () => {
    expect(detectLanguage(['it-IT', 'en-US'])).toBe('it');
    expect(detectLanguage(['de-DE', 'en-US'])).toBe('en');
    expect(detectLanguage(['fr-FR'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
});

describe('traduzione e formattazione', () => {
  it('usa plurali, segnaposto e formati della lingua', () => {
    const it_ = localized('it');
    const en = localized('en');
    expect(it_.t(SHARED.exchange.imported, { count: 1 })).toBe('Importata 1 modifica.');
    expect(en.t(SHARED.exchange.imported, { count: 3 })).toBe('Imported 3 changes.');
    expect(plain(it_.format.money({ minor: 123_450, currency: 'EUR' }))).toBe('1234,50 €');
    expect(en.format.money({ minor: 123_450, currency: 'EUR' })).toBe('€1,234.50');
    expect(en.format.amountInput({ minor: 1250, currency: 'EUR' })).toBe('12.50');
    expect(it_.format.amountInput({ minor: 1250, currency: 'EUR' })).toBe('12,50');
    expect(en.format.date('2026-10-13')).toBe('13 Oct 2026');
    expect(it_.format.longDate('2026-10-13')).toBe('martedì 13 ottobre 2026');
    expect(en.format.currency('EUR')).toBe('EUR · Euro');
  });

  it('spiega gli errori dell’engine nella lingua scelta', () => {
    const error = {
      code: 'TotalMismatch',
      field: 'amounts',
      expected: { minor: 3000, currency: 'EUR' },
      actual: { minor: 1000, currency: 'EUR' },
    } as const;
    expect(plain(describeError(localized('it'), error))).toBe(
      'Gli importi sommano 10,00 € invece di 30,00 €.',
    );
    expect(describeError(localized('en'), error)).toBe(
      'The amounts add up to €10.00 instead of €30.00.',
    );
    expect(
      describeError(
        localized('it'),
        { code: 'InvalidExpense', reason: 'negativeAmount', memberId: 'm1' },
        new Map([['m1', 'Luca']]),
      ),
    ).toBe('Un importo è negativo (Luca).');
    expect(
      describeError(localized('en'), { code: 'NotFound', entity: 'settlement', id: 's' }),
    ).toBe('The payment no longer exists (it may have been removed on another device).');
  });

  it('descrive l’importazione di un file', () => {
    const group = {
      groupId: 'g',
      name: 'Vacanza',
      baseCurrency: 'EUR',
      archived: false,
      mode: 'local',
      me: null,
      createdAt: '1760000000000:00000:d',
    } as const;
    expect(describeImport(localized('it'), { added: 4, invalid: 1, groups: [group] })).toBe(
      'Importate 4 modifiche in «Vacanza». Scartata 1 voce non valida.',
    );
    expect(describeImport(localized('en'), { added: 0, invalid: 0, groups: [] })).toBe(
      'Nothing new: these changes were already here.',
    );
    expect(
      describeFileError(localized('en'), { code: 'InvalidExchangeFile', reason: 'newerVersion' }),
    ).toContain('newer version');
  });
});
