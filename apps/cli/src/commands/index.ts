import { accountCommands } from './accounts';
import type { CommandSpec } from './command';
import { expenseCommands } from './expenses';
import { groupCommands } from './groups';
import { settingsCommands } from './settings';

/** Tutti i comandi, nell'ordine in cui compaiono nell'aiuto. */
export const COMMANDS: readonly CommandSpec[] = [
  ...groupCommands,
  ...expenseCommands,
  ...accountCommands,
  ...settingsCommands,
];

/** Comandi composti da due parole: la prima è l'argomento, la seconda l'azione (es. "spesa aggiungi"). */
export const NOUNS: ReadonlySet<string> = new Set(
  COMMANDS.map(({ name }) => name.split(' ')).flatMap(([noun, verb]) =>
    verb === undefined || noun === undefined ? [] : [noun],
  ),
);

export type { CommandSpec, Context } from './command';
