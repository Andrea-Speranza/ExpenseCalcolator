import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { testCli } from './helpers';

// "spese registro …": calcoli su un registro letto da file, senza toccare i dati salvati.

const EXAMPLE = readFileSync(join(import.meta.dirname, '../examples/weekend.json'), 'utf8');

const lunch = {
  id: 'e_1',
  total: { minor: 9000, currency: 'EUR' },
  paidBy: [{ memberId: 'm_a', amount: { minor: 9000, currency: 'EUR' } }],
  split: { method: 'equal', memberIds: ['m_a', 'm_b', 'm_c'] },
};

/** CLI con un solo file, "registro.json", con il contenuto indicato. */
const withLedger = (data: unknown) => testCli(new Map([['registro.json', JSON.stringify(data)]]));

describe('lettura del registro', () => {
  it('file mancante', async () => {
    const cli = await testCli();
    expect(await cli('registro', 'saldi', 'manca.json')).toMatchObject({
      exitCode: 1,
      stderr: 'Impossibile leggere il file "manca.json".\n',
    });
  });

  it('accetta file UTF-8 con BOM, come quelli salvati da PowerShell 5.1', async () => {
    const withBom = `\uFEFF${JSON.stringify({ expenses: [], settlements: [] })}`;
    const cli = await testCli(new Map([['bom.json', withBom]]));
    expect((await cli('registro', 'verifica', 'bom.json')).exitCode).toBe(0);
  });

  it('JSON non valido', async () => {
    const cli = await testCli(new Map([['rotto.json', '{ non è json']]));
    expect(await cli('registro', 'saldi', 'rotto.json')).toMatchObject({
      exitCode: 1,
      stderr: 'Il file "rotto.json" non contiene JSON valido.\n',
    });
  });

  it('formato non rispettato: indica il campo, in italiano', async () => {
    const cli = await withLedger({
      expenses: [{ ...lunch, total: { minor: 90.5, currency: 'EUR' } }],
      settlements: [],
    });
    const result = await cli('registro', 'saldi', 'registro.json');
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
  ])('spesa non valida: %s', async (_case, expense, message) => {
    const cli = await withLedger({ expenses: [expense], settlements: [] });
    expect(await cli('registro', 'verifica', 'registro.json')).toMatchObject({
      exitCode: 1,
      stderr: `${message}\n`,
    });
  });

  it('rimborso non valido', async () => {
    const settlement = {
      id: 's_1',
      from: 'm_a',
      to: 'm_a',
      amount: { minor: 100, currency: 'EUR' },
    };
    const cli = await withLedger({ expenses: [], settlements: [settlement] });
    expect((await cli('registro', 'verifica', 'registro.json')).stderr).toBe(
      'Il rimborso "s_1" non è valido: chi dà e chi riceve sono la stessa persona.\n',
    );
  });
});

describe('comandi sull’esempio del weekend', () => {
  const example = () => testCli(new Map([['weekend.json', EXAMPLE]]));

  it('verifica', async () => {
    const cli = await example();
    expect(await cli('registro', 'verifica', 'weekend.json')).toEqual({
      stdout: 'Registro valido: 4 spese, 1 rimborso; valute: CHF, EUR.\n',
      stderr: '',
      exitCode: 0,
    });
  });

  it('saldi, con i nomi dei membri', async () => {
    const cli = await example();
    expect((await cli('registro', 'saldi', 'weekend.json')).stdout).toBe(
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

  it('trasferimenti semplificati', async () => {
    const cli = await example();
    expect((await cli('registro', 'trasferimenti', 'weekend.json')).stdout).toBe(
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

  it('trasferimenti per coppia', async () => {
    const cli = await example();
    expect((await cli('registro', 'trasferimenti', 'weekend.json', '--per-coppia')).stdout).toBe(
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

  it('uscita JSON per altri programmi', async () => {
    const cli = await example();
    const verify: unknown = JSON.parse(
      (await cli('registro', 'verifica', 'weekend.json', '--json')).stdout,
    );
    expect(verify).toEqual({
      valid: true,
      expenses: 4,
      settlements: 1,
      currencies: ['CHF', 'EUR'],
    });
    const transfers: unknown = JSON.parse(
      (await cli('registro', 'trasferimenti', 'weekend.json', '--json')).stdout,
    );
    expect(transfers).toHaveLength(5);
    const balances: unknown = JSON.parse(
      (await cli('registro', 'saldi', 'weekend.json', '--json')).stdout,
    );
    expect(balances).toHaveLength(2);
  });
});

describe('casi limite dell’uscita', () => {
  it('registro vuoto', async () => {
    const cli = await withLedger({ expenses: [], settlements: [] });
    expect((await cli('registro', 'verifica', 'registro.json')).stdout).toBe(
      'Registro valido: 0 spese, 0 rimborsi.\n',
    );
    expect((await cli('registro', 'saldi', 'registro.json')).stdout).toBe(
      'Nessuna spesa registrata.\n',
    );
    expect((await cli('registro', 'trasferimenti', 'registro.json')).stdout).toBe(
      'Nessun trasferimento: i conti sono già in pari.\n',
    );
  });

  it('senza nomi usa gli id; valuta sconosciuta mostrata in unità minori', async () => {
    const odd = {
      ...lunch,
      total: { minor: 900, currency: 'XYZ' },
      paidBy: [{ memberId: 'm_a', amount: { minor: 900, currency: 'XYZ' } }],
    };
    const cli = await withLedger({ expenses: [odd], settlements: [] });
    const output = (await cli('registro', 'saldi', 'registro.json')).stdout;
    expect(output).toContain('m_a   600 XYZ (unità minori)  deve ricevere');
    expect(output).toContain('m_b  -300 XYZ (unità minori)  deve dare');
  });
});
