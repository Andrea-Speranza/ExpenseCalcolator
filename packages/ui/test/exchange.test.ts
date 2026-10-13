import { describe, expect, it } from 'vitest';
import { exportFileName } from '../src/download';
import { describeFileError, describeImport } from '../src/messages';

const group = {
  groupId: 'g1',
  name: 'Vacanza',
  baseCurrency: 'EUR',
  archived: false,
  mode: 'local',
  me: null,
} as const;

describe('nome del file esportato', () => {
  it('parte dal nome del gruppo, senza caratteri vietati nei nomi di file', () => {
    expect(exportFileName('Vacanza in Sicilia')).toBe('Vacanza in Sicilia.spese.json');
    expect(exportFileName('Casa 1/2: "bollette"?')).toBe('Casa 1-2- -bollette--.spese.json');
    expect(exportFileName('  ')).toBe('gruppo.spese.json');
  });
});

describe('esito dell’importazione', () => {
  it('dice quante modifiche sono arrivate e in quale gruppo', () => {
    expect(describeImport({ added: 12, invalid: 0, groups: [group] })).toBe(
      'Importate 12 modifiche in «Vacanza».',
    );
    expect(describeImport({ added: 1, invalid: 1, groups: [] })).toBe(
      'Importata 1 modifica. Scartata 1 voce non valida.',
    );
    expect(describeImport({ added: 0, invalid: 3, groups: [group] })).toBe(
      'Nessuna novità: queste modifiche erano già presenti. Scartate 3 voci non valide.',
    );
  });

  it('spiega perché un file non si può importare', () => {
    expect(describeFileError({ code: 'InvalidExchangeFile', reason: 'notJson' })).toBe(
      'Questo file non è un gruppo esportato da questa app.',
    );
    expect(describeFileError({ code: 'InvalidExchangeFile', reason: 'newerVersion' })).toContain(
      'versione più recente',
    );
  });
});
