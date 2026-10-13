import {
  type BalancesView,
  type Conflict,
  type CurrencyBalances,
  decimalsOf,
  type ExpenseView,
  type GroupSummary,
  type GroupView,
  type Ledger,
  type Money,
  type SettingsView,
  type SettlementView,
  toDecimalString,
  type Transfer,
} from '@expense/engine';
import { z } from 'zod';

const LOCALE = 'it-IT';

/** Codice breve di un elemento: gli ultimi 6 caratteri dell'id (la parte casuale degli ULID). */
export const shortCode = (id: string): string => id.slice(-6).toLowerCase();

export type Names = ReadonlyMap<string, string>;

// Il file di un registro può indicare i nomi dei membri (campo facoltativo `members`): servono solo a
// mostrare i risultati, il calcolo usa gli id.
const MembersSchema = z.object({
  members: z.array(z.object({ id: z.string(), name: z.string().min(1) })).optional(),
});

export function memberNames(data: unknown): Names {
  const parsed = MembersSchema.safeParse(data);
  const members = parsed.success ? (parsed.data.members ?? []) : [];
  return new Map(members.map(({ id, name }) => [id, name]));
}

export function groupNames(group: GroupView): Names {
  return new Map(group.members.map(({ memberId, name }) => [memberId, name]));
}

const nameOf = (names: Names, id: string): string => names.get(id) ?? id;

/**
 * Importo nel formato italiano (es. "1.234,50 €"). Intl riceve il valore come testo decimale esatto,
 * quindi non c'è perdita di precisione nemmeno con importi molto grandi.
 */
export function formatMoney(amount: Money, signed = false): string {
  const decimal = toDecimalString(amount);
  const decimals = decimalsOf(amount.currency);
  if (!decimal.ok || !decimals.ok) {
    return `${String(amount.minor)} ${amount.currency} (unità minori)`;
  }
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: decimals.value,
    maximumFractionDigits: decimals.value,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(decimal.value as `${number}`);
}

/** Percentuale da punti base (es. 9000 → "90%"). */
export function formatPercentage(basisPoints: number): string {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(basisPoints / 100)}%`;
}

/** Data di calendario "2026-10-12" → "12/10/2026". */
export function formatDate(date: string): string {
  const [year = '', month = '', day = ''] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function formatSummary(
  { expenses, settlements }: Ledger,
  balances: readonly CurrencyBalances[],
): string {
  const counts = `${plural(expenses.length, 'spesa', 'spese')}, ${plural(settlements.length, 'rimborso', 'rimborsi')}`;
  const currencies = balances.map(({ currency }) => currency);
  const suffix = currencies.length > 0 ? `; valute: ${currencies.join(', ')}` : '';
  return `Registro valido: ${counts}${suffix}.\n`;
}

export function formatBalances(balances: readonly CurrencyBalances[], names: Names): string {
  if (balances.length === 0) return 'Nessuna spesa registrata.\n';
  return balances
    .map(({ currency, balances: members }) => {
      const rows = members.map(({ memberId, amount }) => [
        nameOf(names, memberId),
        formatMoney(amount, true),
        status(amount.minor),
      ]);
      return `Saldi in ${currency}\n${table(rows)}`;
    })
    .join('\n');
}

export function formatTransfers(
  transfers: readonly Transfer[],
  names: Names,
  mode: 'semplificati' | 'per coppia',
): string {
  if (transfers.length === 0) return 'Nessun trasferimento: i conti sono già in pari.\n';
  const rows = transfers.map(({ from, to, amount }) => [
    `${nameOf(names, from)} → ${nameOf(names, to)}`,
    formatMoney(amount),
  ]);
  return `Trasferimenti suggeriti (${mode}):\n${table(rows)}`;
}

/** Spese o rimborsi esclusi dai saldi perché non validi (es. scritti da un'app difettosa). */
export function formatExcluded(excluded: BalancesView['excluded']): string {
  if (excluded.length === 0) return '';
  const list = excluded.map(
    ({ entry, id }) => `${entry === 'expense' ? 'spesa' : 'rimborso'} #${shortCode(id)}`,
  );
  return `\nAttenzione: esclusi dal calcolo perché non validi: ${list.join(', ')}.\n`;
}

export function formatGroups(
  groups: readonly GroupSummary[],
  names: ReadonlyMap<string, string>,
): string {
  if (groups.length === 0) {
    return 'Nessun gruppo. Creane uno con: spese gruppo crea <nome> --io <il tuo nome>\n';
  }
  const rows = groups.map((group) => [
    group.name,
    group.baseCurrency,
    [
      group.me === null ? '' : `io: ${names.get(group.groupId) ?? group.me}`,
      group.archived ? '(archiviato)' : '',
    ]
      .filter((part) => part !== '')
      .join(' '),
  ]);
  return `Gruppi\n${table(rows, new Set())}`;
}

export function formatGroup(group: GroupView): string {
  const names = groupNames(group);
  const me = group.me === null ? '' : ` · io: ${nameOf(names, group.me)}`;
  const archived = group.archived ? ' · archiviato' : '';
  const active = group.members
    .filter(({ archived: isArchived }) => !isArchived)
    .map(({ name }) => name);
  const inactive = group.members
    .filter(({ archived: isArchived }) => isArchived)
    .map(({ name }) => name);
  const lines = [
    `${group.name} · ${group.baseCurrency}${me}${archived}`,
    `Membri: ${active.length > 0 ? active.join(', ') : 'nessuno'}${inactive.length > 0 ? ` (archiviati: ${inactive.join(', ')})` : ''}`,
    '',
    `Spese (${String(group.expenses.length)})`,
    group.expenses.length > 0
      ? table(
          group.expenses.map((expense) => expenseRow(expense, names)),
          new Set([3]),
        )
      : '  nessuna\n',
    `Rimborsi (${String(group.settlements.length)})`,
    group.settlements.length > 0
      ? table(
          group.settlements.map((settlement) => settlementRow(settlement, names)),
          new Set([3]),
        )
      : '  nessuno\n',
  ];
  const conflicts = groupConflicts(group, names);
  if (conflicts.length > 0)
    lines.push('Modifiche contemporanee', ...conflicts.map((line) => `  ${line}`), '');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function formatSettings(settings: SettingsView): string {
  return [
    `Valuta predefinita: ${settings.defaultCurrency}`,
    `Lingua: ${settings.language === 'it' ? 'italiano' : 'inglese'}`,
    `Nome: ${settings.displayName ?? '(non indicato)'}`,
    '',
  ].join('\n');
}

/** Come si divide una spesa, in poche parole. */
export function describeSplit(split: ExpenseView['amounts']['split'], names: Names): string {
  switch (split.method) {
    case 'equal':
      return `tra ${split.memberIds.map((id) => nameOf(names, id)).join(', ')}`;
    case 'exact':
      return `importi esatti: ${split.amounts.map(({ memberId, amount }) => `${nameOf(names, memberId)} ${formatMoney(amount)}`).join(', ')}`;
    case 'percentage':
      return `percentuali: ${split.percentages.map(({ memberId, basisPoints }) => `${nameOf(names, memberId)} ${formatPercentage(basisPoints)}`).join(', ')}`;
    case 'shares':
      return `quote: ${split.weights.map(({ memberId, weight }) => `${nameOf(names, memberId)} ${String(weight)}`).join(', ')}`;
  }
}

export function describePayers(paidBy: ExpenseView['amounts']['paidBy'], names: Names): string {
  const [single] = paidBy;
  if (paidBy.length === 1 && single !== undefined)
    return `pagato da ${nameOf(names, single.memberId)}`;
  return `pagato da ${paidBy.map(({ memberId, amount }) => `${nameOf(names, memberId)} (${formatMoney(amount)})`).join(', ')}`;
}

function expenseRow(expense: ExpenseView, names: Names): string[] {
  return [
    `#${shortCode(expense.expenseId)}`,
    expense.time === null
      ? formatDate(expense.date)
      : `${formatDate(expense.date)} ${expense.time}`,
    expense.deleted ? `${expense.description} [eliminata]` : expense.description,
    formatMoney(expense.amounts.total),
    describePayers(expense.amounts.paidBy, names),
    describeSplit(expense.amounts.split, names),
  ];
}

function settlementRow(settlement: SettlementView, names: Names): string[] {
  const { from, to, amount } = settlement.transfer;
  return [
    `#${shortCode(settlement.settlementId)}`,
    formatDate(settlement.date),
    `${nameOf(names, from)} → ${nameOf(names, to)}${settlement.deleted ? ' [eliminato]' : ''}`,
    formatMoney(amount),
  ];
}

const FIELDS: Readonly<Record<string, string>> = {
  description: 'descrizione',
  date: 'data',
  time: 'ora',
  amounts: 'importi',
  category: 'categoria',
  notes: 'note',
  deleted: 'eliminazione',
  transfer: 'trasferimento',
  name: 'nome',
  baseCurrency: 'valuta',
  archived: 'archiviazione',
};

function groupConflicts(group: GroupView, names: Names): string[] {
  const describe = (where: string, conflict: Conflict) => {
    const field = FIELDS[conflict.field] ?? conflict.field;
    const who = (id: string | null) => (id === null ? 'qualcuno' : nameOf(names, id));
    return `${where}: ${field} cambiato da ${who(conflict.by)} senza vedere la modifica di ${who(conflict.overwrittenBy)}`;
  };
  return [
    ...group.conflicts.map((conflict) => describe('gruppo', conflict)),
    ...group.members.flatMap((member) =>
      member.conflicts.map((conflict) => describe(`membro ${member.name}`, conflict)),
    ),
    ...group.expenses.flatMap((expense) =>
      expense.conflicts.map((conflict) =>
        describe(`spesa #${shortCode(expense.expenseId)} «${expense.description}»`, conflict),
      ),
    ),
    ...group.settlements.flatMap((settlement) =>
      settlement.conflicts.map((conflict) =>
        describe(`rimborso #${shortCode(settlement.settlementId)}`, conflict),
      ),
    ),
  ];
}

function status(minor: number): string {
  if (minor > 0) return 'deve ricevere';
  if (minor < 0) return 'deve dare';
  return 'in pari';
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

/** Tabella con rientro; le colonne indicate (di solito gli importi) sono allineate a destra. */
function table(
  rows: readonly (readonly string[])[],
  rightAligned: ReadonlySet<number> = new Set([1]),
): string {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  const lines = rows.map((row) =>
    row
      .map((cell, index) =>
        rightAligned.has(index)
          ? cell.padStart(widths[index] ?? 0)
          : cell.padEnd(widths[index] ?? 0),
      )
      .join('  ')
      .trimEnd(),
  );
  return lines.map((line) => `  ${line}\n`).join('');
}
