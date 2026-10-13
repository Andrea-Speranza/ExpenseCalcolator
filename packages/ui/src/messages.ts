import type {
  CommandError,
  ExpenseError,
  ImportSummary,
  InvalidAllocation,
  InvalidExchangeFile,
  InvalidExpense,
  QueryError,
  SettlementError,
} from '@expense/engine';
import { formatMoney, formatPercentage } from './format';

// Testi degli errori dell'engine, in italiano. L'engine restituisce solo codici e dati (PLANNING §4.2): la UI
// sceglie come mostrarli. `names` traduce gli id dei membri nei loro nomi.

export type Names = ReadonlyMap<string, string>;

const NO_NAMES: Names = new Map();

const ENTITIES = {
  group: 'Il gruppo',
  member: 'Il membro',
  expense: 'La spesa',
  settlement: 'Il rimborso',
} as const;

export function describeError(error: CommandError | QueryError, names: Names = NO_NAMES): string {
  switch (error.code) {
    case 'InvalidInput':
      return [
        'Alcuni dati non sono validi:',
        ...error.issues.map(({ path, message }) => (path === '' ? message : `${path}: ${message}`)),
      ].join(' ');
    case 'NotFound':
      return `${ENTITIES[error.entity]} non esiste più (forse è stato rimosso su un altro dispositivo).`;
    case 'NoChanges':
      return 'Non hai cambiato nulla.';
    case 'StorageFailed':
      return `Salvataggio non riuscito: ${error.message}`;
    case 'InvalidEntry':
      return `${error.entry === 'expense' ? 'Una spesa' : 'Un rimborso'} non è valido e non è stato contato: ${describeEntryError(error.error, names)}.`;
    case 'UnbalancedBalances':
      return `Errore interno: i saldi in ${error.currency} non sommano a zero.`;
    case 'InvalidExpense':
    case 'TotalMismatch':
    case 'PercentagesMismatch':
    case 'CurrencyMismatch':
    case 'InvalidAllocation':
    case 'AmountOutOfRange':
    case 'InvalidSettlement':
      return `${capitalize(describeEntryError(error, names))}.`;
  }
}

/** Esito dell'importazione di un file di scambio. */
export function describeImport({ added, invalid, groups }: ImportSummary): string {
  const names = groups.map(({ name }) => `«${name}»`).join(', ');
  const where = names === '' ? '' : ` in ${names}`;
  const result =
    added === 0
      ? 'Nessuna novità: queste modifiche erano già presenti.'
      : added === 1
        ? `Importata 1 modifica${where}.`
        : `Importate ${String(added)} modifiche${where}.`;
  if (invalid === 0) return result;
  return `${result} ${invalid === 1 ? 'Scartata 1 voce non valida' : `Scartate ${String(invalid)} voci non valide`}.`;
}

export function describeFileError({ reason }: InvalidExchangeFile): string {
  switch (reason) {
    case 'notJson':
    case 'notExchangeFile':
      return 'Questo file non è un gruppo esportato da questa app.';
    case 'newerVersion':
      return 'Il file è stato esportato da una versione più recente dell’app: aggiornala per importarlo.';
  }
}

function describeEntryError(error: ExpenseError | SettlementError, names: Names): string {
  switch (error.code) {
    case 'InvalidExpense':
      return describeInvalidExpense(error, names);
    case 'TotalMismatch':
      return `${error.field === 'paidBy' ? 'i pagamenti' : 'gli importi'} sommano ${formatMoney(error.actual)} invece di ${formatMoney(error.expected)}`;
    case 'PercentagesMismatch':
      return `le percentuali sommano ${formatPercentage(error.actual)} invece di ${formatPercentage(error.expected)}`;
    case 'CurrencyMismatch':
      return `c’è un importo in ${error.actual} invece che in ${error.expected}`;
    case 'InvalidAllocation':
      return describeAllocation(error.reason);
    case 'AmountOutOfRange':
      return 'un importo supera il valore massimo gestibile';
    case 'InvalidSettlement':
      return error.reason === 'sameMember'
        ? 'chi dà e chi riceve sono la stessa persona'
        : 'l’importo deve essere maggiore di zero';
  }
}

function describeInvalidExpense({ reason, memberId }: InvalidExpense, names: Names): string {
  const member = memberId === undefined ? '' : ` (${names.get(memberId) ?? memberId})`;
  switch (reason) {
    case 'nonPositiveTotal':
      return 'il totale deve essere maggiore di zero';
    case 'noPayers':
      return 'manca chi ha pagato';
    case 'nonPositivePayment':
      return `un pagamento è zero o negativo${member}`;
    case 'noParticipants':
      return 'scegli almeno una persona tra cui dividere';
    case 'duplicateMember':
      return `un membro compare due volte${member}`;
    case 'negativeAmount':
      return `un importo è negativo${member}`;
  }
}

function describeAllocation(reason: InvalidAllocation['reason']): string {
  switch (reason) {
    case 'noWeights':
      return 'scegli almeno una persona tra cui dividere';
    case 'negativeWeight':
      return 'una quota o una percentuale è negativa';
    case 'nonIntegerWeight':
      return 'una quota o una percentuale non è un numero intero';
    case 'zeroTotalWeight':
      return 'tutte le quote sono zero';
    case 'invalidRotation':
      return 'errore interno nella ripartizione';
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
