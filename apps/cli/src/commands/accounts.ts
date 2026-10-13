import { calculateLedger, type LedgerReport } from '@expense/engine';
import {
  formatBalances,
  formatExcluded,
  formatSummary,
  formatTransfers,
  groupNames,
  memberNames,
} from '../format';
import { describeError } from '../messages';
import { findGroup } from '../resolve';
import { done, orFail, UserError } from '../result';
import { type CommandSpec, type Context, toJson } from './command';

// Conti: saldi e trasferimenti di un gruppo salvato, oppure di un registro letto da file.

async function balancesOf({ args: [reference = ''], engine }: Context) {
  const current = await engine();
  const group = findGroup(current, reference);
  const balances = orFail(
    current.query({ type: 'GetBalances', groupId: group.groupId }),
    describeError,
  );
  return { group, balances };
}

async function readLedger({
  args: [file = ''],
  env,
}: Context): Promise<{ data: unknown; report: LedgerReport }> {
  let text: string;
  try {
    text = await env.readFile(file);
  } catch {
    throw new UserError(`Impossibile leggere il file "${file}".`);
  }
  let data: unknown;
  try {
    // Molti programmi Windows (es. PowerShell 5.1) salvano in UTF-8 con BOM: JSON.parse non lo accetta.
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new UserError(`Il file "${file}" non contiene JSON valido.`);
  }
  const report = orFail(calculateLedger(data), (error) =>
    describeError(error, 'Il registro non rispetta il formato previsto:'),
  );
  return { data, report };
}

export const accountCommands: readonly CommandSpec[] = [
  {
    name: 'saldi',
    arguments: ['gruppo'],
    options: [],
    summary: 'saldo di ogni membro, per valuta',
    async run(context) {
      const { group, balances } = await balancesOf(context);
      if (context.json) return done(toJson(balances));
      return done(
        formatBalances(balances.balances, groupNames(group)) + formatExcluded(balances.excluded),
      );
    },
  },
  {
    name: 'trasferimenti',
    arguments: ['gruppo'],
    options: ['per-coppia'],
    summary: 'pagamenti suggeriti per pareggiare i conti',
    details: [
      'Con --per-coppia ognuno paga solo chi ha pagato per lui; altrimenti il minor numero di passaggi.',
    ],
    async run(context) {
      const { group, balances } = await balancesOf(context);
      const pairwise = context.options['per-coppia'] === true;
      const transfers = pairwise ? balances.pairwiseTransfers : balances.simplifiedTransfers;
      if (context.json) return done(toJson(transfers));
      return done(
        formatTransfers(transfers, groupNames(group), pairwise ? 'per coppia' : 'semplificati') +
          formatExcluded(balances.excluded),
      );
    },
  },
  {
    name: 'registro verifica',
    arguments: ['registro.json'],
    options: [],
    summary: 'controlla un registro letto da file (formato: apps/cli/README.md)',
    async run(context) {
      const { report } = await readLedger(context);
      if (!context.json) return done(formatSummary(report.ledger, report.balances));
      return done(
        toJson({
          valid: true,
          expenses: report.ledger.expenses.length,
          settlements: report.ledger.settlements.length,
          currencies: report.balances.map(({ currency }) => currency),
        }),
      );
    },
  },
  {
    name: 'registro saldi',
    arguments: ['registro.json'],
    options: [],
    summary: 'saldi di un registro letto da file',
    async run(context) {
      const { data, report } = await readLedger(context);
      return done(
        context.json ? toJson(report.balances) : formatBalances(report.balances, memberNames(data)),
      );
    },
  },
  {
    name: 'registro trasferimenti',
    arguments: ['registro.json'],
    options: ['per-coppia'],
    summary: 'trasferimenti suggeriti per un registro letto da file',
    async run(context) {
      const { data, report } = await readLedger(context);
      const pairwise = context.options['per-coppia'] === true;
      const transfers = pairwise ? report.pairwiseTransfers : report.simplifiedTransfers;
      if (context.json) return done(toJson(transfers));
      return done(
        formatTransfers(transfers, memberNames(data), pairwise ? 'per coppia' : 'semplificati'),
      );
    },
  },
];
