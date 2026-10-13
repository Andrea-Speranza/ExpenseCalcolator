import { parseArgs } from 'node:util';

// Tutte le opzioni della CLI. Si analizzano in un solo passaggio; poi ogni comando accetta solo le sue.

export const OPTIONS = {
  dati: { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  io: { type: 'string' },
  valuta: { type: 'string' },
  pagato: { type: 'string', multiple: true },
  tra: { type: 'string' },
  importi: { type: 'string' },
  percentuali: { type: 'string' },
  quote: { type: 'string' },
  importo: { type: 'string' },
  data: { type: 'string' },
  ora: { type: 'string' },
  descrizione: { type: 'string' },
  categoria: { type: 'string' },
  note: { type: 'string' },
  'per-coppia': { type: 'boolean' },
  lingua: { type: 'string' },
  nome: { type: 'string' },
} as const;

export type OptionName = keyof typeof OPTIONS;

/** Opzioni valide per ogni comando. */
export const GLOBAL_OPTIONS: readonly OptionName[] = ['dati', 'json', 'help'];

function parse(args: readonly string[]) {
  return parseArgs({ args: [...args], options: OPTIONS, allowPositionals: true });
}

export type Values = ReturnType<typeof parse>['values'];

export interface CommandLine {
  readonly values: Values;
  readonly positionals: readonly string[];
}

/** Analizza la riga di comando; in caso di errore restituisce il messaggio da mostrare. */
export function parseCommandLine(args: readonly string[]): CommandLine | string {
  try {
    return parse(args);
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      if (error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') return 'opzione sconosciuta';
      if (error.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE')
        return 'valore di un’opzione mancante o non valido';
    }
    return 'opzioni non valide';
  }
}

/** Le opzioni effettivamente usate, tranne quelle globali. */
export function usedOptions(values: Values): OptionName[] {
  return (Object.keys(values) as OptionName[]).filter(
    (name) => values[name] !== undefined && !GLOBAL_OPTIONS.includes(name),
  );
}
