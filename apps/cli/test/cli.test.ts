import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type CliResult, run } from '../src/cli';

const EXAMPLE = readFileSync(join(import.meta.dirname, '../examples/weekend.json'), 'utf8');

const lunch = {
  id: 'e_1',
  total: { minor: 9000, currency: 'EUR' },
  paidBy: [{ memberId: 'm_a', amount: { minor: 9000, currency: 'EUR' } }],
  split: { method: 'equal', memberIds: ['m_a', 'm_b', 'm_c'] },
};

/** Esegue la CLI con dei file in memoria. Gli spazi non separabili di Intl diventano spazi normali. */
function cli(args: string[], files: Record<string, string> = {}): CliResult {
  const result = run(args, (path) => {
    const content = files[path];
    if (content === undefined) throw new Error(`file inesistente: ${path}`);
    return content;
  });
  const normalize = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');
  return { ...result, stdout: normalize(result.stdout), stderr: normalize(result.stderr) };
}

const ledger = (data: unknown) => ({ 'registro.json': JSON.stringify(data) });

beforeAll(() => {
  z.config(z.locales.it());
});

describe('uso della riga di comando', () => {
  it('mostra l’aiuto', () => {
    const result = cli(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Uso: spese <comando>');
  });

  it.each([
    [[], 'indica un comando'],
    [['salda', 'registro.json'], 'comando sconosciuto: "salda"'],
    [['saldi'], 'indica il file del registro'],
    [['saldi', 'a.json', 'b.json'], 'argomenti in più: b.json'],
    [['saldi', 'registro.json', '--boh'], 'opzione sconosciuta'],
    [['saldi', 'registro.json', '--json=si'], 'opzioni non valide'],
    [['saldi', 'registro.json', '--per-coppia'], '--per-coppia si usa solo con "trasferimenti"'],
  ])('%j → errore d’uso', (args, message) => {
    const result = cli(args);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(`Errore: ${message}.`);
  });
});

describe('lettura del registro', () => {
  it('file mancante', () => {
    expect(cli(['saldi', 'manca.json'])).toMatchObject({
      exitCode: 1,
      stderr: 'Impossibile leggere il file "manca.json".\n',
    });
  });

  it('accetta file UTF-8 con BOM, come quelli salvati da PowerShell 5.1', () => {
    const withBom = `\uFEFF${JSON.stringify({ expenses: [], settlements: [] })}`;
    expect(cli(['verifica', 'bom.json'], { 'bom.json': withBom }).exitCode).toBe(0);
  });

  it('JSON non valido', () => {
    expect(cli(['saldi', 'rotto.json'], { 'rotto.json': '{ non è json' })).toMatchObject({
      exitCode: 1,
      stderr: 'Il file "rotto.json" non contiene JSON valido.\n',
    });
  });

  it('formato non rispettato: indica il campo, in italiano', () => {
    const bad = {
      expenses: [{ ...lunch, total: { minor: 90.5, currency: 'EUR' } }],
      settlements: [],
    };
    const result = cli(['saldi', 'registro.json'], ledger(bad));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Il registro non rispetta il formato previsto:');
    expect(result.stderr).toContain('expenses.0.total.minor: Input non valido');
  });

  it.each([
    [
      'pagamenti che non tornano',
      { ...lunch, paidBy: [{ memberId: 'm_a', amount: { minor: 8000, currency: 'EUR' } }] },
      'La spesa "e_1" non è valida: i pagamenti sommano 80,00 € invece di 90,00 €.',
    ],
    [
      'percentuali che non tornano',
      {
        ...lunch,
        split: { method: 'percentage', percentages: [{ memberId: 'm_a', basisPoints: 9000 }] },
      },
      'La spesa "e_1" non è valida: le percentuali sommano 90% invece di 100%.',
    ],
    [
      'membro ripetuto',
      { ...lunch, split: { method: 'equal', memberIds: ['m_a', 'm_a'] } },
      'La spesa "e_1" non è valida: un membro compare due volte ("m_a").',
    ],
  ])('spesa non valida: %s', (_case, expense, message) => {
    const result = cli(
      ['verifica', 'registro.json'],
      ledger({ expenses: [expense], settlements: [] }),
    );
    expect(result).toMatchObject({ exitCode: 1, stderr: `${message}\n` });
  });

  it('rimborso non valido', () => {
    const settlement = {
      id: 's_1',
      from: 'm_a',
      to: 'm_a',
      amount: { minor: 100, currency: 'EUR' },
    };
    const result = cli(
      ['verifica', 'registro.json'],
      ledger({ expenses: [], settlements: [settlement] }),
    );
    expect(result.stderr).toBe(
      'Il rimborso "s_1" non è valido: chi dà e chi riceve sono la stessa persona.\n',
    );
  });
});

describe('comandi sull’esempio del weekend', () => {
  const files = { 'weekend.json': EXAMPLE };

  it('verifica', () => {
    expect(cli(['verifica', 'weekend.json'], files)).toEqual({
      stdout: 'Registro valido: 4 spese, 1 rimborso; valute: CHF, EUR.\n',
      stderr: '',
      exitCode: 0,
    });
  });

  it('saldi, con i nomi dei membri', () => {
    expect(cli(['saldi', 'weekend.json'], files).stdout).toBe(
      [
        'Saldi in CHF',
        '  Anna   -22,50 CHF  deve dare',
        '  Luca   -22,50 CHF  deve dare',
        '  Marco  +67,50 CHF  deve ricevere',
        '  Sara   -22,50 CHF  deve dare',
        '',
        'Saldi in EUR',
        '  Anna   +50,00 €  deve ricevere',
        '  Luca     0,00 €  in pari',
        '  Marco  -25,00 €  deve dare',
        '  Sara   -25,00 €  deve dare',
        '',
      ].join('\n'),
    );
  });

  it('trasferimenti semplificati', () => {
    expect(cli(['trasferimenti', 'weekend.json'], files).stdout).toBe(
      [
        'Trasferimenti suggeriti (semplificati):',
        '  Anna → Marco  22,50 CHF',
        '  Luca → Marco  22,50 CHF',
        '  Sara → Marco  22,50 CHF',
        '  Marco → Anna    25,00 €',
        '  Sara → Anna     25,00 €',
        '',
      ].join('\n'),
    );
  });

  it('trasferimenti per coppia', () => {
    expect(cli(['trasferimenti', 'weekend.json', '--per-coppia'], files).stdout).toBe(
      [
        'Trasferimenti suggeriti (per coppia):',
        '  Anna → Marco  22,50 CHF',
        '  Luca → Marco  22,50 CHF',
        '  Sara → Marco  22,50 CHF',
        '  Luca → Anna     30,00 €',
        '  Marco → Anna    10,00 €',
        '  Marco → Luca    15,00 €',
        '  Sara → Anna     10,00 €',
        '  Sara → Luca     15,00 €',
        '',
      ].join('\n'),
    );
  });

  it('uscita JSON per altri programmi', () => {
    const verify: unknown = JSON.parse(cli(['verifica', 'weekend.json', '--json'], files).stdout);
    expect(verify).toEqual({
      valid: true,
      expenses: 4,
      settlements: 1,
      currencies: ['CHF', 'EUR'],
    });
    const transfers: unknown = JSON.parse(
      cli(['trasferimenti', 'weekend.json', '--json'], files).stdout,
    );
    expect(transfers).toHaveLength(5);
    const balances: unknown = JSON.parse(cli(['saldi', 'weekend.json', '--json'], files).stdout);
    expect(balances).toHaveLength(2);
  });
});

describe('casi limite dell’uscita', () => {
  it('registro vuoto', () => {
    const empty = ledger({ expenses: [], settlements: [] });
    expect(cli(['verifica', 'registro.json'], empty).stdout).toBe(
      'Registro valido: 0 spese, 0 rimborsi.\n',
    );
    expect(cli(['saldi', 'registro.json'], empty).stdout).toBe('Nessuna spesa registrata.\n');
    expect(cli(['trasferimenti', 'registro.json'], empty).stdout).toBe(
      'Nessun trasferimento: i conti sono già in pari.\n',
    );
  });

  it('senza nomi usa gli id; valuta sconosciuta mostrata in unità minori', () => {
    const odd = {
      ...lunch,
      total: { minor: 900, currency: 'XYZ' },
      paidBy: [{ memberId: 'm_a', amount: { minor: 900, currency: 'XYZ' } }],
    };
    const output = cli(
      ['saldi', 'registro.json'],
      ledger({ expenses: [odd], settlements: [] }),
    ).stdout;
    expect(output).toContain('m_a   600 XYZ (unità minori)  deve ricevere');
    expect(output).toContain('m_b  -300 XYZ (unità minori)  deve dare');
  });
});
