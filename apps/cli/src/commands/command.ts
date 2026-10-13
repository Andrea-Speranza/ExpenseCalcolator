import type { Engine } from '@expense/engine';
import type { CliEnvironment } from '../environment';
import type { OptionName, Values } from '../options';
import type { CliResult } from '../result';

/** Ciò che un comando riceve: argomenti già contati, opzioni già verificate, ambiente ed engine. */
export interface Context {
  readonly args: readonly string[];
  readonly options: Values;
  readonly json: boolean;
  readonly env: CliEnvironment;
  /** Apre i dati salvati solo se il comando ne ha bisogno. */
  readonly engine: () => Promise<Engine>;
}

export interface CommandSpec {
  /** Parole del comando, es. "spesa aggiungi". */
  readonly name: string;
  /** Argomenti obbligatori, nell'ordine (es. ["gruppo", "nome"]). */
  readonly arguments: readonly string[];
  readonly options: readonly OptionName[];
  readonly summary: string;
  /** Righe aggiuntive per l'aiuto del comando (esempi, note). */
  readonly details?: readonly string[];
  readonly run: (context: Context) => Promise<CliResult>;
}

/** JSON leggibile per l'opzione --json. */
export const toJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
