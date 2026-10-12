import {
  type CurrencyBalances,
  decimalsOf,
  type Ledger,
  type Money,
  toDecimalString,
  type Transfer,
} from '@expense/engine';
import { z } from 'zod';

const LOCALE = 'it-IT';

export type Names = ReadonlyMap<string, string>;

// Il file del registro può indicare i nomi dei membri (campo facoltativo `members`): servono solo a
// mostrare i risultati, il calcolo usa gli id.
const MembersSchema = z.object({
  members: z.array(z.object({ id: z.string(), name: z.string().min(1) })).optional(),
});

export function memberNames(data: unknown): Names {
  const parsed = MembersSchema.safeParse(data);
  const members = parsed.success ? (parsed.data.members ?? []) : [];
  return new Map(members.map(({ id, name }) => [id, name]));
}

const nameOf = (names: Names, id: string): string => names.get(id) ?? id;

/**
 * Importo nel formato italiano (es. "1.234,50 €"). Intl riceve il valore come testo decimale esatto,
 * quindi non c'è perdita di precisione nemmeno con importi molto grandi.
 */
export function formatMoney(amount: Money, signed = false): string {
  const decimal = toDecimalString(amount);
  const decimals = decimalsOf(amount.currency);
  if (!decimal.ok || !decimals.ok)
    return `${String(amount.minor)} ${amount.currency} (unità minori)`;
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

function status(minor: number): string {
  if (minor > 0) return 'deve ricevere';
  if (minor < 0) return 'deve dare';
  return 'in pari';
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

/** Tabella con rientro: la prima colonna allineata a sinistra, la seconda (importi) a destra. */
function table(rows: readonly (readonly string[])[]): string {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  const lines = rows.map((row) =>
    row
      .map((cell, index) =>
        index === 1 ? cell.padStart(widths[index] ?? 0) : cell.padEnd(widths[index] ?? 0),
      )
      .join('  ')
      .trimEnd(),
  );
  return lines.map((line) => `  ${line}\n`).join('');
}
