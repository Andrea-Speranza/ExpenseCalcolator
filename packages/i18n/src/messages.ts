import type {
  CommandError,
  ExpenseError,
  ImportSummary,
  InvalidAllocation,
  InvalidExchangeFile,
  InvalidExpense,
  QueryError,
  SettlementError,
  StorageFailed,
} from '@expense/engine';
import type { Formatter } from './format';
import { type KeyOf, keysOf } from './keys';
import en from './locales/en.json';
import it from './locales/it.json';
import type { Translate } from './translator';

// Testi condivisi da UI e CLI: errori dell'engine ed esiti dell'importazione. L'engine restituisce solo codici e
// dati (PLANNING §4.2); qui diventano frasi nella lingua scelta. Ogni `switch` copre tutti i codici: se l'engine
// ne aggiunge uno, la compilazione si ferma finché non ha il suo testo.

/** Dizionari condivisi: UI e CLI li uniscono ai propri. */
export const SHARED_DICTIONARIES = { it, en } as const;

/** Chiavi dei testi condivisi (es. `SHARED.errors.noChanges`). */
export const SHARED = keysOf(it);
export type SharedKey = KeyOf<typeof SHARED>;

/** Ciò che serve per comporre un testo: traduzione e formattazione nella stessa lingua. */
export interface Localized<Key extends string = SharedKey> {
  readonly t: Translate<Key>;
  readonly format: Formatter;
}

/** Nomi dei membri per id, per nominarli negli errori. */
export type Names = ReadonlyMap<string, string>;

const NO_NAMES: Names = new Map();

export function describeError(
  { t, format }: Localized,
  error: CommandError | QueryError,
  names: Names = NO_NAMES,
): string {
  const reason = (entry: ExpenseError | SettlementError) =>
    describeEntryError({ t, format }, entry, names);
  switch (error.code) {
    case 'InvalidInput': {
      const fields = error.issues.map(({ path }) =>
        path === '' ? t(SHARED.errors.wholeInput) : path,
      );
      return t(SHARED.errors.invalidInput, { fields: [...new Set(fields)].join(', ') });
    }
    case 'NotFound':
      return t(SHARED.errors.notFound[error.entity]);
    case 'NoChanges':
      return t(SHARED.errors.noChanges);
    case 'StorageFailed':
      return describeStorageFailed({ t, format }, error);
    case 'InvalidEntry':
      return t(SHARED.errors.invalidEntry[error.entry], { reason: reason(error.error) });
    case 'UnbalancedBalances':
      return t(SHARED.errors.unbalanced, { currency: error.currency });
    case 'InvalidExpense':
    case 'TotalMismatch':
    case 'PercentagesMismatch':
    case 'CurrencyMismatch':
    case 'InvalidAllocation':
    case 'AmountOutOfRange':
    case 'InvalidSettlement':
      return t(SHARED.errors.sentence, { reason: capitalize(reason(error)) });
  }
}

export function describeStorageFailed({ t }: Localized, error: StorageFailed): string {
  return t(SHARED.errors.storageFailed, { message: error.message });
}

/** Esito dell'importazione di un file di scambio. */
export function describeImport(
  { t }: Localized,
  { added, invalid, groups }: ImportSummary,
): string {
  const names = groups.map(({ name }) => t(SHARED.exchange.groupName, { name })).join(', ');
  const result =
    added === 0
      ? t(SHARED.exchange.nothingNew)
      : names === ''
        ? t(SHARED.exchange.imported, { count: added })
        : t(SHARED.exchange.importedIn, { count: added, groups: names });
  return invalid === 0 ? result : `${result} ${t(SHARED.exchange.discarded, { count: invalid })}`;
}

export function describeFileError({ t }: Localized, { reason }: InvalidExchangeFile): string {
  switch (reason) {
    case 'notJson':
    case 'notExchangeFile':
      return t(SHARED.exchange.notExchangeFile);
    case 'newerVersion':
      return t(SHARED.exchange.newerVersion);
  }
}

function describeEntryError(
  { t, format }: Localized,
  error: ExpenseError | SettlementError,
  names: Names,
): string {
  const { reason } = SHARED.errors;
  switch (error.code) {
    case 'InvalidExpense':
      return describeInvalidExpense({ t, format }, error, names);
    case 'TotalMismatch':
      return t(error.field === 'paidBy' ? reason.payments : reason.amounts, {
        actual: format.money(error.actual),
        expected: format.money(error.expected),
      });
    case 'PercentagesMismatch':
      return t(reason.percentages, {
        actual: format.percentage(error.actual),
        expected: format.percentage(error.expected),
      });
    case 'CurrencyMismatch':
      return t(reason.currency, { actual: error.actual, expected: error.expected });
    case 'InvalidAllocation':
      return describeAllocation({ t, format }, error.reason);
    case 'AmountOutOfRange':
      return t(reason.outOfRange);
    case 'InvalidSettlement':
      return t(error.reason === 'sameMember' ? reason.sameMember : reason.nonPositiveSettlement);
  }
}

function describeInvalidExpense(
  { t }: Localized,
  { reason: code, memberId }: InvalidExpense,
  names: Names,
): string {
  const { reason } = SHARED.errors;
  const text = (() => {
    switch (code) {
      case 'nonPositiveTotal':
        return t(reason.nonPositiveTotal);
      case 'noPayers':
        return t(reason.noPayers);
      case 'nonPositivePayment':
        return t(reason.nonPositivePayment);
      case 'noParticipants':
        return t(reason.noParticipants);
      case 'duplicateMember':
        return t(reason.duplicateMember);
      case 'negativeAmount':
        return t(reason.negativeAmount);
    }
  })();
  if (memberId === undefined) return text;
  return t(SHARED.errors.member, { reason: text, name: names.get(memberId) ?? memberId });
}

function describeAllocation({ t }: Localized, code: InvalidAllocation['reason']): string {
  const { reason } = SHARED.errors;
  switch (code) {
    case 'noWeights':
      return t(reason.noParticipants);
    case 'negativeWeight':
      return t(reason.negativeWeight);
    case 'nonIntegerWeight':
      return t(reason.nonIntegerWeight);
    case 'zeroTotalWeight':
      return t(reason.zeroTotalWeight);
    case 'invalidRotation':
      return t(reason.invalidRotation);
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
