import type { GroupView } from '@expense/engine';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli';
import { testCli, weekend } from './helpers';

describe('uso della riga di comando', () => {
  it('mostra l’aiuto generale e quello di un comando', async () => {
    const cli = await testCli();
    const general = await cli('--help');
    expect(general.exitCode).toBe(0);
    expect(general.stdout).toContain('Uso: spese <comando>');
    expect(general.stdout).toContain('spesa aggiungi <gruppo> <descrizione> <importo>');
    const command = await cli('spesa', 'aggiungi', '--help');
    expect(command.stdout).toContain('Esempio: spese spesa aggiungi Weekend');
    expect(command.stdout).toContain('--percentuali a=50,b=50');
  });

  it.each([
    [[], 'indica un comando'],
    [['salda'], 'comando sconosciuto: "salda"'],
    [['spesa'], '"spesa" richiede un\'azione: aggiungi, modifica, elimina, ripristina'],
    [['spesa', 'boh'], 'azione sconosciuta per "spesa": "boh"'],
    [['saldi'], 'manca <gruppo>'],
    [['saldi', 'A', 'B'], 'argomenti in più: B'],
    [['saldi', 'Weekend', '--per-coppia'], '--per-coppia non vale per "saldi"'],
    [['saldi', 'Weekend', '--boh'], 'opzione sconosciuta'],
    [['saldi', 'Weekend', '--data'], 'valore di un’opzione mancante o non valido'],
    [
      ['spesa', 'aggiungi', 'Weekend', 'X', '10', '--tra', 'Anna', '--quote', 'Anna=1'],
      'usa una sola tra --tra, --importi, --percentuali e --quote',
    ],
  ])('%j → errore d’uso', async (args, message) => {
    const cli = await weekend();
    const result = await cli(...args);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(`Errore: ${message}.`);
  });

  it('segnala dati salvati che non si riescono ad aprire', async () => {
    const result = await run(['gruppi'], {
      readFile: () => Promise.reject(new Error('no')),
      writeFile: () => Promise.resolve(),
      openEngine: () => Promise.reject(new Error('disco rotto')),
      today: () => '2026-10-13',
    });
    expect(result).toMatchObject({
      exitCode: 1,
      stderr: 'Impossibile aprire i dati salvati: disco rotto\n',
    });
  });
});

describe('un weekend tra amici', () => {
  it('spese in tutte le modalità, saldi e trasferimenti', async () => {
    const cli = await weekend();
    expect((await cli('gruppi')).stdout).toBe('Gruppi\n  Weekend  EUR  io: Anna\n');

    const cena = await cli('spesa', 'aggiungi', 'weekend', 'Cena', '90');
    expect(cena.stdout).toMatch(
      /^Spesa «Cena» aggiunta \(#.{6}\): 90,00 €, pagato da Anna, tra Anna, Luca, Sara\.\n$/,
    );
    await cli(
      'spesa',
      'aggiungi',
      'Weekend',
      'Benzina',
      '60',
      '--pagato',
      'Luca',
      '--tra',
      'Anna,Luca',
    );
    await cli(
      'spesa',
      'aggiungi',
      'Weekend',
      'Funivia',
      '90',
      '--valuta',
      'chf',
      '--pagato',
      'Sara',
      '--percentuali',
      'Anna=33,33,Luca=33,33,Sara=33,34',
    );

    expect((await cli('saldi', 'Weekend')).stdout).toBe(
      [
        'Saldi in CHF',
        '  Anna  -30,00 CHF  deve dare',
        '  Luca  -30,00 CHF  deve dare',
        '  Sara  +60,00 CHF  deve ricevere',
        '',
        'Saldi in EUR',
        '  Anna  +30,00 €  deve ricevere',
        '  Luca    0,00 €  in pari',
        '  Sara  -30,00 €  deve dare',
        '',
      ].join('\n'),
    );
    expect((await cli('trasferimenti', 'Weekend')).stdout).toBe(
      [
        'Trasferimenti suggeriti (semplificati):',
        '  Anna → Sara  30,00 CHF',
        '  Luca → Sara  30,00 CHF',
        '  Sara → Anna    30,00 €',
        '',
      ].join('\n'),
    );
  });

  it('più pagatori con decimali, importi esatti e quote', async () => {
    const cli = await weekend();
    const result = await cli(
      'spesa',
      'aggiungi',
      'Weekend',
      'Spesa',
      '90',
      '--pagato',
      'Anna=60,50',
      '--pagato',
      'Luca=29,50',
      '--importi',
      'Anna=40;Luca=30;Sara=20',
    );
    expect(result.stdout).toContain(
      'pagato da Anna (60,50 €), Luca (29,50 €), importi esatti: Anna 40,00 €, Luca 30,00 €, Sara 20,00 €.',
    );
    const quote = await cli(
      'spesa',
      'aggiungi',
      'Weekend',
      'Cena',
      '40',
      '--quote',
      'Anna=2,Luca=1,Sara=1',
      '--pagato',
      'io',
    );
    expect(quote.stdout).toContain('pagato da Anna, quote: Anna 2, Luca 1, Sara 1.');
  });

  it('l’ora della spesa è facoltativa: si indica, si cambia e si toglie', async () => {
    const cli = await weekend();
    await cli('spesa', 'aggiungi', 'Weekend', 'Cena', '90', '--ora', '20.30');
    expect((await cli('gruppo', 'mostra', 'Weekend')).stdout).toContain('13/10/2026 20:30');

    await cli('spesa', 'modifica', 'Weekend', 'Cena', '--ora', '9:05');
    expect((await cli('gruppo', 'mostra', 'Weekend')).stdout).toContain('13/10/2026 09:05');

    await cli('spesa', 'modifica', 'Weekend', 'Cena', '--ora', '');
    expect((await cli('gruppo', 'mostra', 'Weekend')).stdout).not.toContain('09:05');

    expect((await cli('spesa', 'modifica', 'Weekend', 'Cena', '--ora', '25:00')).stderr).toBe(
      '"25:00" non è un\'ora valida (esempi: 20:30, 9.05).\n',
    );
  });

  it('modifica, elimina e ripristina spese; registra ed elimina rimborsi', async () => {
    const cli = await weekend();
    await cli('spesa', 'aggiungi', 'Weekend', 'Cena', '90');
    await cli(
      'spesa',
      'aggiungi',
      'Weekend',
      'Benzina',
      '60',
      '--pagato',
      'Luca',
      '--tra',
      'Anna,Luca',
    );

    // Un solo pagatore: il nuovo totale passa a lui; la divisione resta in parti uguali tra tutti.
    expect(
      (await cli('spesa', 'modifica', 'Weekend', 'cena', '--importo', '120', '--categoria', 'Cibo'))
        .stdout,
    ).toBe('Spesa «Cena» modificata.\n');
    expect((await cli('saldi', 'Weekend')).stdout).toContain('Anna  +50,00 €  deve ricevere');

    expect((await cli('spesa', 'elimina', 'Weekend', 'Benzina')).stdout).toBe(
      'Spesa «Benzina» eliminata (si può ripristinare).\n',
    );
    expect((await cli('gruppo', 'mostra', 'Weekend')).stdout).toContain('Benzina [eliminata]');
    expect((await cli('spesa', 'ripristina', 'Weekend', 'Benzina')).stdout).toBe(
      'Spesa «Benzina» ripristinata.\n',
    );

    const settled = await cli(
      'rimborso',
      'aggiungi',
      'Weekend',
      'Sara',
      'Anna',
      '40',
      '--data',
      '14/10/2026',
    );
    expect(settled.stdout).toMatch(/^Rimborso registrato \(#.{6}\): Sara → Anna, 40,00 €\.\n$/);
    expect((await cli('trasferimenti', 'Weekend')).stdout).toBe(
      'Trasferimenti suggeriti (semplificati):\n  Luca → Anna  10,00 €\n',
    );

    const group = JSON.parse(
      (await cli('gruppo', 'mostra', 'Weekend', '--json')).stdout,
    ) as GroupView;
    const settlement = group.settlements[0];
    expect(settlement?.date).toBe('2026-10-14');
    const code = `#${settlement?.settlementId.slice(-6) ?? ''}`;
    expect((await cli('rimborso', 'elimina', 'Weekend', code)).stdout).toBe(
      `Rimborso ${code} eliminato (si può ripristinare).\n`,
    );
    expect((await cli('trasferimenti', 'Weekend')).stdout).toContain('Sara → Anna');
    expect((await cli('rimborso', 'ripristina', 'Weekend', code)).exitCode).toBe(0);
  });

  it('gruppo e membri: mostra, rinomina, archivia, "chi sono io"', async () => {
    const cli = await weekend();
    await cli(
      'spesa',
      'aggiungi',
      'Weekend',
      'Cena',
      '90',
      '--data',
      '2026-10-12',
      '--note',
      'Rifugio',
    );
    const shown = (await cli('gruppo', 'mostra', 'Weekend')).stdout;
    expect(shown).toContain('Weekend · EUR · io: Anna');
    expect(shown).toContain('Membri: Anna, Luca, Sara');
    expect(shown).toMatch(
      /#.{6} {2}12\/10\/2026 {2}Cena {2}90,00 € {2}pagato da Anna {2}tra Anna, Luca, Sara/,
    );

    expect((await cli('gruppo', 'rinomina', 'Weekend', 'Montagna')).stdout).toBe(
      'Gruppo rinominato in «Montagna».\n',
    );
    expect((await cli('membro', 'rinomina', 'Montagna', 'Luca', 'Luca B.')).stdout).toBe(
      'Luca ora si chiama Luca B..\n',
    );
    expect((await cli('membro', 'archivia', 'Montagna', 'Sara')).stdout).toBe(
      'Sara archiviato in «Montagna».\n',
    );
    expect((await cli('gruppo', 'mostra', 'Montagna')).stdout).toContain(
      'Membri: Anna, Luca B. (archiviati: Sara)',
    );
    expect((await cli('membro', 'riattiva', 'Montagna', 'Sara')).exitCode).toBe(0);
    expect((await cli('gruppo', 'archivia', 'Montagna')).stdout).toBe(
      'Gruppo «Montagna» archiviato.\n',
    );
    expect((await cli('gruppi')).stdout).toBe('Gruppi\n  Montagna  EUR  io: Anna (archiviato)\n');
    expect((await cli('gruppo', 'riattiva', 'Montagna')).exitCode).toBe(0);

    expect((await cli('gruppo', 'io', 'Montagna', 'Luca B.')).stdout).toBe(
      'In «Montagna» tu sei Luca B..\n',
    );
    expect((await cli('gruppo', 'io', 'Montagna', 'nessuno')).stdout).toBe(
      'In «Montagna» non sei un membro.\n',
    );
  });

  it('segnala modifiche contemporanee in "gruppo mostra"', async () => {
    const cli = await weekend();
    await cli('spesa', 'aggiungi', 'Weekend', 'Cena', '90');
    const group = JSON.parse(
      (await cli('gruppo', 'mostra', 'Weekend', '--json')).stdout,
    ) as GroupView;
    const expense = group.expenses[0];
    if (expense === undefined) throw new Error('spesa mancante');
    // Due modifiche alla descrizione fatte partendo dalla stessa versione, come da due dispositivi.
    await cli.engine.execute({
      type: 'UpdateExpense',
      groupId: group.groupId,
      expenseId: expense.expenseId,
      base: expense.version,
      changes: { description: 'Cena A' },
    });
    await cli.engine.execute({
      type: 'UpdateExpense',
      groupId: group.groupId,
      expenseId: expense.expenseId,
      base: expense.version,
      changes: { description: 'Cena B' },
    });
    const shown = (await cli('gruppo', 'mostra', 'Weekend')).stdout;
    expect(shown).toContain('Modifiche contemporanee');
    expect(shown).toContain(
      '«Cena B»: descrizione cambiato da Anna senza vedere la modifica di Anna',
    );
  });
});

describe('errori nei dati', () => {
  it.each([
    [
      ['spesa', 'aggiungi', 'Weekend', 'X', '12,345'],
      '"12,345" ha troppi decimali: in EUR se ne usano al massimo 2.',
    ],
    [
      ['spesa', 'aggiungi', 'Weekend', 'X', 'abc'],
      '"abc" non è un importo valido (esempi: 12, 12,50, 12.50).',
    ],
    [
      ['spesa', 'aggiungi', 'Weekend', 'X', '10', '--valuta', 'xyz'],
      'Valuta sconosciuta: "XYZ". Usa un codice ISO 4217, per esempio EUR.',
    ],
    [
      ['spesa', 'aggiungi', 'Weekend', 'X', '10', '--percentuali', 'Anna=50,Luca=40'],
      'Le percentuali sommano 90% invece di 100%.',
    ],
    [
      ['spesa', 'aggiungi', 'Weekend', 'X', '10', '--quote', 'Anna=1,5'],
      '"1,5" non è una quota valida: usa un numero intero.',
    ],
    [
      ['spesa', 'aggiungi', 'Weekend', 'X', '10', '--data', 'ieri'],
      '"ieri" non è una data valida (esempi: 2026-10-12, 12/10/2026).',
    ],
    [
      ['rimborso', 'aggiungi', 'Weekend', 'Anna', 'Anna', '10'],
      'Chi dà e chi riceve sono la stessa persona.',
    ],
  ])('%j', async (args, message) => {
    const cli = await weekend();
    expect(await cli(...args)).toMatchObject({ exitCode: 1, stderr: `${message}\n` });
  });

  it('gruppi e membri inesistenti o ambigui', async () => {
    const cli = await weekend();
    expect((await cli('gruppo', 'mostra', 'Vacanza')).stderr).toMatch(
      /^Gruppo non trovato: "Vacanza"\. Disponibili: Weekend \(#.{6}\)\.\n$/,
    );
    expect(
      (await cli('spesa', 'aggiungi', 'Weekend', 'X', '10', '--pagato', 'Zoe')).stderr,
    ).toContain('Membro non trovato: "Zoe". Disponibili: Anna');
    expect((await cli('membro', 'aggiungi', 'Weekend', 'anna')).stderr).toBe(
      "In «Weekend» c'è già anna: usa un nome diverso.\n",
    );
    expect((await cli('gruppo', 'crea', 'weekend')).stderr).toBe(
      'Esiste già un gruppo «weekend»: scegli un altro nome.\n',
    );
    // Un omonimo può comunque arrivare da un altro dispositivo: la CLI chiede di distinguerlo.
    const groups = cli.engine.query({ type: 'ListGroups' });
    const groupId = groups.ok ? (groups.value[0]?.groupId ?? '') : '';
    await cli.engine.execute({ type: 'AddMember', groupId, name: 'anna' });
    expect(
      (await cli('spesa', 'aggiungi', 'Weekend', 'X', '10', '--pagato', 'Anna')).stderr,
    ).toContain('"Anna" corrisponde a più di un membro');
  });

  it('senza "io" bisogna dire chi ha pagato', async () => {
    const cli = await testCli();
    expect((await cli('gruppo', 'crea', 'Ufficio')).stdout).toBe(
      'Gruppo «Ufficio» creato (EUR).\n',
    );
    await cli('membro', 'aggiungi', 'Ufficio', 'Marco');
    const missing = await cli('spesa', 'aggiungi', 'Ufficio', 'Pranzo', '10');
    expect(missing.exitCode).toBe(2);
    expect(missing.stderr).toContain('indica chi ha pagato con --pagato <membro>');
    expect(
      (await cli('spesa', 'aggiungi', 'Ufficio', 'Pranzo', '10', '--pagato', 'io')).stderr,
    ).toContain('non hai indicato chi sei');
  });
});

describe('impostazioni', () => {
  it('mostra e cambia le impostazioni; la valuta vale per i nuovi gruppi', async () => {
    const cli = await testCli();
    expect((await cli('impostazioni')).stdout).toBe(
      'Valuta predefinita: EUR\nLingua: italiano\nNome: (non indicato)\n',
    );
    expect((await cli('impostazioni', '--valuta', 'chf', '--nome', 'Anna')).stdout).toBe(
      'Valuta predefinita: CHF\nLingua: italiano\nNome: Anna\n',
    );
    expect((await cli('gruppo', 'crea', 'Svizzera', '--io', 'Anna')).stdout).toBe(
      'Gruppo «Svizzera» creato (CHF, io: Anna).\n',
    );
    expect((await cli('impostazioni', '--lingua', 'fr')).stderr).toBe(
      'Lingua non disponibile: "fr". Scegli tra it ed en.\n',
    );
  });
});

describe('esporta e importa tra due dispositivi', () => {
  it('il gruppo passa da un dispositivo all’altro, e le novità tornano indietro', async () => {
    const anna = await weekend();
    await anna('spesa', 'aggiungi', 'Weekend', 'Cena', '90');
    expect((await anna('esporta', 'Weekend', 'weekend.spese.json')).stdout).toMatch(
      /^Gruppo «Weekend» esportato in "weekend\.spese\.json" \(\d+ modifiche\)\.\n$/,
    );

    const luca = await testCli(anna.files, 'y');
    const imported = await luca('importa', 'weekend.spese.json');
    expect(imported.stdout).toMatch(
      /^Importate \d+ modifiche in «Weekend»\.\nPer indicare chi sei nel gruppo/,
    );
    expect((await luca('importa', 'weekend.spese.json')).stdout).toBe(
      'Nessuna novità: queste modifiche erano già presenti.\n',
    );
    expect((await luca('saldi', 'Weekend')).stdout).toBe((await anna('saldi', 'Weekend')).stdout);

    expect((await luca('gruppo', 'io', 'Weekend', 'Luca')).stdout).toBe(
      'In «Weekend» tu sei Luca.\n',
    );
    await luca('spesa', 'aggiungi', 'Weekend', 'Benzina', '60');
    await luca('esporta', 'Weekend', 'weekend.spese.json');
    await anna('importa', 'weekend.spese.json');
    expect((await anna('saldi', 'Weekend')).stdout).toBe((await luca('saldi', 'Weekend')).stdout);
    expect((await anna('gruppo', 'mostra', 'Weekend')).stdout).toContain('Benzina');
  });

  it('rifiuta file che non sono esportazioni dell’app', async () => {
    const cli = await testCli(
      new Map([
        ['altro.json', '{"ciao": 1}'],
        ['rotto.json', '{'],
        [
          'futuro.json',
          '{"format": "expense-calcolator/eventi", "version": 2, "group": "X", "events": []}',
        ],
      ]),
    );
    expect((await cli('importa', 'altro.json')).stderr).toBe(
      '"altro.json" non è un file esportato da questa app.\n',
    );
    expect((await cli('importa', 'rotto.json')).stderr).toBe(
      'Impossibile leggere "rotto.json" come file esportato.\n',
    );
    expect((await cli('importa', 'futuro.json')).stderr).toBe(
      '"futuro.json" è stato esportato da una versione più recente dell\'app: aggiornala per importarlo.\n',
    );
    expect((await cli('importa', 'manca.json')).stderr).toBe(
      'Impossibile leggere "manca.json" come file esportato.\n',
    );
  });
});

describe('riferimenti per nome', () => {
  it('basta una parte del nome, se corrisponde a un solo gruppo o membro', async () => {
    const cli = await testCli();
    await cli('gruppo', 'crea', 'Weekend in montagna', '--io', 'Anna');
    await cli('gruppo', 'crea', 'Weekend al mare', '--io', 'Anna');
    expect((await cli('membro', 'aggiungi', 'montagna', 'Luca Bianchi')).stdout).toBe(
      'Luca Bianchi aggiunto a «Weekend in montagna».\n',
    );
    expect(
      (await cli('spesa', 'aggiungi', 'montagna', 'Cena', '10', '--pagato', 'luca')).stdout,
    ).toContain('pagato da Luca Bianchi');
    expect((await cli('saldi', 'weekend')).stderr).toContain(
      '"weekend" corrisponde a più di un gruppo',
    );
  });
});
