import type { Engine } from '@expense/engine';
import { COMMANDS, type CommandSpec, NOUNS } from './commands';
import type { CliEnvironment } from './environment';
import { GLOBAL_OPTIONS, type OptionName, parseCommandLine, usedOptions } from './options';
import { type CliResult, done, failure, UsageError, usageError, UserError } from './result';

export type { CliResult } from './result';

const OPTION_HELP: Readonly<Record<OptionName, string>> = {
  dati: '--dati <cartella>        cartella dei dati (anche con la variabile SPESE_DATI)',
  json: '--json                   risultato in JSON, da usare in altri programmi',
  help: '-h, --help               mostra l’aiuto',
  io: '--io <nome>              il tuo nome: fai parte anche tu del gruppo',
  valuta: '--valuta <codice>        valuta ISO 4217 (es. EUR, USD, CHF)',
  pagato: '--pagato <chi>[=importo] chi ha pagato; ripetibile se hanno pagato in più',
  tra: '--tra <a,b,…>            parti uguali tra questi membri',
  importi: '--importi a=10,b=5,50    importo esatto per membro',
  percentuali: '--percentuali a=50,b=50  percentuale per membro',
  quote: '--quote a=2,b=1          quote intere per membro',
  importo: '--importo <importo>      nuovo totale',
  data: '--data <data>            AAAA-MM-GG o GG/MM/AAAA (predefinita: oggi)',
  ora: '--ora <HH:MM>            ora della spesa, facoltativa (es. 20:30)',
  descrizione: '--descrizione <testo>    nuova descrizione',
  categoria: '--categoria <testo>      categoria',
  note: '--note <testo>           note',
  'per-coppia': '--per-coppia             ognuno paga solo chi ha pagato per lui',
  lingua: '--lingua it|en           lingua',
  nome: '--nome <nome>            il tuo nome visualizzato',
};

const signature = ({ name, arguments: args }: CommandSpec): string =>
  [name, ...args.map((arg) => `<${arg}>`)].join(' ');

export const USAGE = [
  'Uso: spese <comando> [argomenti] [opzioni]',
  '',
  'Comandi:',
  ...COMMANDS.map((spec) => `  ${signature(spec).padEnd(42)} ${spec.summary}`),
  '',
  'Opzioni valide per tutti i comandi:',
  ...GLOBAL_OPTIONS.map((name) => `  ${OPTION_HELP[name]}`),
  '',
  'Aiuto su un comando: spese <comando> --help (es. spese spesa aggiungi --help)',
  '',
].join('\n');

function commandHelp(spec: CommandSpec): string {
  return [
    `Uso: spese ${signature(spec)}${spec.options.length > 0 ? ' [opzioni]' : ''}`,
    '',
    `${spec.summary.charAt(0).toUpperCase()}${spec.summary.slice(1)}.`,
    ...(spec.options.length > 0
      ? ['', 'Opzioni:', ...spec.options.map((name) => `  ${OPTION_HELP[name]}`)]
      : []),
    ...(spec.details === undefined ? [] : ['', ...spec.details]),
    '',
  ].join('\n');
}

/** Il comando indicato e i suoi argomenti, oppure il messaggio di errore da mostrare. */
function findCommand(
  positionals: readonly string[],
): { spec: CommandSpec; args: string[] } | string {
  const [first, second, ...rest] = positionals;
  if (first === undefined) return 'indica un comando';
  const twoWords = NOUNS.has(first);
  const name = twoWords ? `${first} ${second ?? ''}`.trim() : first;
  const spec = COMMANDS.find((command) => command.name === name);
  if (spec !== undefined)
    return { spec, args: twoWords ? rest : [second, ...rest].filter((arg) => arg !== undefined) };
  if (twoWords) {
    const verbs = COMMANDS.filter((command) => command.name.startsWith(`${first} `)).map(
      (command) => command.name.split(' ')[1],
    );
    return second === undefined
      ? `"${first}" richiede un'azione: ${verbs.join(', ')}`
      : `azione sconosciuta per "${first}": "${second}". Azioni: ${verbs.join(', ')}`;
  }
  return `comando sconosciuto: "${first}"`;
}

/**
 * Esegue la CLI senza toccare direttamente il terminale né il disco: tutto passa dall'ambiente. Restituisce
 * il testo da stampare e l'exit code: 0 = tutto bene, 1 = errore nei dati, 2 = comando usato in modo sbagliato.
 */
export async function run(args: readonly string[], env: CliEnvironment): Promise<CliResult> {
  const line = parseCommandLine(args);
  if (typeof line === 'string') return usageError(line, USAGE);
  const { values, positionals } = line;

  const found = findCommand(positionals);
  if (typeof found === 'string') {
    if (values.help === true && positionals.length === 0) return done(USAGE);
    return usageError(found, USAGE);
  }
  const { spec, args: commandArgs } = found;
  const help = commandHelp(spec);
  if (values.help === true) return done(help);

  const invalid = usedOptions(values).filter((name) => !spec.options.includes(name));
  if (invalid.length > 0) {
    return usageError(
      `${invalid.map((name) => `--${name}`).join(', ')} non vale per "${spec.name}"`,
      help,
    );
  }
  if (commandArgs.length < spec.arguments.length) {
    return usageError(`manca <${spec.arguments.slice(commandArgs.length).join('>, <')}>`, help);
  }
  if (commandArgs.length > spec.arguments.length) {
    return usageError(
      `argomenti in più: ${commandArgs.slice(spec.arguments.length).join(' ')}`,
      help,
    );
  }

  let opened: Promise<Engine> | undefined;
  const engine = async () => {
    opened ??= env.openEngine(values.dati);
    try {
      return await opened;
    } catch (error) {
      throw new UserError(
        `Impossibile aprire i dati salvati: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  try {
    return await spec.run({
      args: commandArgs,
      options: values,
      json: values.json === true,
      env,
      engine,
    });
  } catch (error) {
    if (error instanceof UserError) return failure(error.message);
    if (error instanceof UsageError) return usageError(error.message, help);
    throw error;
  }
}
