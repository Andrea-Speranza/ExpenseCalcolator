import type {
  CalculationError,
  ExpenseError,
  InvalidAllocation,
  InvalidExpense,
  SettlementError,
} from '@expense/engine';
import { formatMoney, formatPercentage } from './format';

// Testi degli errori, in italiano. L'engine restituisce solo codici e dati (PLANNING §4.2): ogni
// interfaccia sceglie come mostrarli. Nei messaggi si usano gli id, così si trova subito il punto del
// file da correggere.

export function describeError(error: CalculationError): string {
  switch (error.code) {
    case 'InvalidInput':
      return [
        'Il registro non rispetta il formato previsto:',
        ...error.issues.map(
          ({ path, message }) => `  - ${path === '' ? '(intero file)' : path}: ${message}`,
        ),
      ].join('\n');
    case 'InvalidEntry':
      return error.entry === 'expense'
        ? `La spesa "${error.id}" non è valida: ${describeEntryError(error.error)}.`
        : `Il rimborso "${error.id}" non è valido: ${describeEntryError(error.error)}.`;
    case 'AmountOutOfRange':
      return 'Un importo supera il valore massimo gestibile.';
    case 'CurrencyMismatch':
      return `Valute diverse: attesa ${error.expected}, trovata ${error.actual}.`;
    case 'UnbalancedBalances':
      return `Errore interno: i saldi in ${error.currency} non sommano a zero.`;
  }
}

function describeEntryError(error: ExpenseError | SettlementError): string {
  switch (error.code) {
    case 'InvalidExpense':
      return describeInvalidExpense(error);
    case 'TotalMismatch':
      return `${error.field === 'paidBy' ? 'i pagamenti' : 'gli importi esatti'} sommano ${formatMoney(error.actual)} invece di ${formatMoney(error.expected)}`;
    case 'PercentagesMismatch':
      return `le percentuali sommano ${formatPercentage(error.actual)} invece di ${formatPercentage(error.expected)}`;
    case 'CurrencyMismatch':
      return `contiene un importo in ${error.actual} invece che in ${error.expected}`;
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

function describeInvalidExpense({ reason, memberId }: InvalidExpense): string {
  const member = memberId === undefined ? '' : ` ("${memberId}")`;
  switch (reason) {
    case 'nonPositiveTotal':
      return 'il totale deve essere maggiore di zero';
    case 'noPayers':
      return 'manca chi ha pagato';
    case 'nonPositivePayment':
      return `un pagamento è zero o negativo${member}`;
    case 'noParticipants':
      return 'non ci sono partecipanti';
    case 'duplicateMember':
      return `un membro compare due volte${member}`;
    case 'negativeAmount':
      return `un importo è negativo${member}`;
  }
}

function describeAllocation(reason: InvalidAllocation['reason']): string {
  switch (reason) {
    case 'noWeights':
      return 'non ci sono partecipanti';
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
