import { parseArgs } from 'node:util';
import { calculateLedger, type LedgerReport } from '@expense/engine';
import { formatBalances, formatSummary, formatTransfers, memberNames, type Names } from './format';
import { describeError } from './messages';

export interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** Legge il file indicato dall'utente; lancia un'eccezione se non ci riesce. */
export type ReadFile = (path: string) => string;

const COMMANDS = ['verifica', 'saldi', 'trasferimenti'] as const;
type Command = (typeof COMMANDS)[number];

const OPTIONS = {
  'per-coppia': { type: 'boolean' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

export const USAGE = `Uso: spese <comando> <registro.json> [opzioni]

Comandi:
  verifica        controlla che il registro sia valido
  saldi           saldo di ogni membro, per valuta
  trasferimenti   pagamenti suggeriti per pareggiare i conti

Opzioni:
  --per-coppia    con "trasferimenti": ognuno paga solo chi ha pagato per lui
  --json          risultato in JSON, da usare in altri programmi
  -h, --help      mostra questo aiuto

Formato del registro: apps/cli/README.md
`;

/**
 * Esegue la CLI senza toccare il terminale né il disco (il file si legge con `readFile`): restituisce
 * il testo da stampare e l'exit code. 0 = tutto bene, 1 = registro non leggibile o non valido,
 * 2 = comando usato in modo sbagliato.
 */
export function run(args: readonly string[], readFile: ReadFile): CliResult {
  const parsed = parseCommandLine(args);
  if (typeof parsed === 'string') return usageError(parsed);
  const { values, positionals } = parsed;
  if (values.help === true) return { stdout: USAGE, stderr: '', exitCode: 0 };

  const [command, file, ...extra] = positionals;
  if (command === undefined) return usageError('indica un comando');
  if (!isCommand(command)) return usageError(`comando sconosciuto: "${command}"`);
  if (file === undefined) return usageError('indica il file del registro');
  if (extra.length > 0) return usageError(`argomenti in più: ${extra.join(' ')}`);
  const pairwise = values['per-coppia'] === true;
  if (pairwise && command !== 'trasferimenti') {
    return usageError('--per-coppia si usa solo con "trasferimenti"');
  }

  const loaded = loadJson(file, readFile);
  if (!loaded.ok) return failure(loaded.message);
  const report = calculateLedger(loaded.data);
  if (!report.ok) return failure(describeError(report.error));

  const json = values.json === true;
  const output = json
    ? `${JSON.stringify(jsonOutput(command, report.value, pairwise), null, 2)}\n`
    : textOutput(command, report.value, memberNames(loaded.data), pairwise);
  return { stdout: output, stderr: '', exitCode: 0 };
}

function parseCommandLine(args: readonly string[]) {
  try {
    return parseArgs({ args: [...args], options: OPTIONS, allowPositionals: true });
  } catch (error) {
    const unknownOption =
      error instanceof Error && 'code' in error && error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION';
    return unknownOption ? 'opzione sconosciuta' : 'opzioni non valide';
  }
}

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

function loadJson(
  file: string,
  readFile: ReadFile,
):
  { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly message: string } {
  let text: string;
  try {
    text = readFile(file);
  } catch {
    return { ok: false, message: `Impossibile leggere il file "${file}".` };
  }
  try {
    // Molti programmi Windows (es. PowerShell 5.1) salvano in UTF-8 con BOM: JSON.parse non lo accetta.
    return { ok: true, data: JSON.parse(text.replace(/^\uFEFF/, '')) };
  } catch {
    return { ok: false, message: `Il file "${file}" non contiene JSON valido.` };
  }
}

function textOutput(
  command: Command,
  report: LedgerReport,
  names: Names,
  pairwise: boolean,
): string {
  switch (command) {
    case 'verifica':
      return formatSummary(report.ledger, report.balances);
    case 'saldi':
      return formatBalances(report.balances, names);
    case 'trasferimenti':
      return pairwise
        ? formatTransfers(report.pairwiseTransfers, names, 'per coppia')
        : formatTransfers(report.simplifiedTransfers, names, 'semplificati');
  }
}

function jsonOutput(command: Command, report: LedgerReport, pairwise: boolean): unknown {
  switch (command) {
    case 'verifica':
      return {
        valid: true,
        expenses: report.ledger.expenses.length,
        settlements: report.ledger.settlements.length,
        currencies: report.balances.map(({ currency }) => currency),
      };
    case 'saldi':
      return report.balances;
    case 'trasferimenti':
      return pairwise ? report.pairwiseTransfers : report.simplifiedTransfers;
  }
}

function usageError(message: string): CliResult {
  return { stdout: '', stderr: `Errore: ${message}.\n\n${USAGE}`, exitCode: 2 };
}

function failure(message: string): CliResult {
  return { stdout: '', stderr: `${message}\n`, exitCode: 1 };
}
