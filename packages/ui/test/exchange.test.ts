import { dictionaryDifferences, SHARED_DICTIONARIES } from '@expense/i18n';
import { describe, expect, it } from 'vitest';
import { safeFileName } from '../src/download';
import { K, UI_ONLY_DICTIONARIES } from '../src/i18n';

describe('nome del file esportato', () => {
  it('parte dal nome del gruppo, senza caratteri vietati nei nomi di file', () => {
    expect(safeFileName('Vacanza in Sicilia')).toBe('Vacanza in Sicilia');
    expect(safeFileName('Casa 1/2: "bollette"?')).toBe('Casa 1-2- -bollette--');
    expect(safeFileName('  ')).toBe('');
  });
});

describe('dizionari della UI', () => {
  it('l’inglese ha gli stessi testi e gli stessi segnaposto dell’italiano', () => {
    expect(
      dictionaryDifferences(UI_ONLY_DICTIONARIES.it, UI_ONLY_DICTIONARIES.en, 'en-GB'),
    ).toEqual([]);
  });

  it('le sezioni della UI non si sovrappongono a quelle condivise', () => {
    const shared = Object.keys(SHARED_DICTIONARIES.it);
    expect(Object.keys(UI_ONLY_DICTIONARIES.it).filter((key) => shared.includes(key))).toEqual([]);
  });

  it('le chiavi sono i percorsi dei testi', () => {
    expect(K.groups.title).toBe('groups.title');
    expect(K.group.people).toBe('group.people');
  });
});
