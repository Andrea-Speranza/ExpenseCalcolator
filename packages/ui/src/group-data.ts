import type {
  BalancesView,
  ExpenseView,
  GroupView,
  MemberView,
  Money,
  SettlementView,
  Split,
} from '@expense/engine';
import type { Names } from '@expense/i18n';

// Dati di un gruppo pronti per le schermate: nomi dei membri, partecipanti, filtri, elenchi ordinati.

export function memberNames(group: GroupView): Names {
  return new Map(group.members.map(({ memberId, name }) => [memberId, name]));
}

/** Nome del membro; l'id se il membro non c'è più (dati scritti da un'app difettosa). */
export function nameOf(names: Names, memberId: string): string {
  return names.get(memberId) ?? memberId;
}

export function activeMembers(group: GroupView): MemberView[] {
  return group.members.filter(({ archived }) => !archived);
}

/**
 * Dalla più recente: per data, poi per ora (le spese senza ora vengono dopo quelle con l'ora, nello stesso
 * giorno), poi per ordine di inserimento.
 */
export function newestFirst<T extends ExpenseView | SettlementView>(entries: readonly T[]): T[] {
  const time = (entry: T) => ('time' in entry ? (entry.time ?? '') : '');
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (time(a) !== time(b)) return time(a) < time(b) ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/** La parte di ciascuno quando non è uguale per tutti: un importo, una percentuale o delle quote. */
export type ParticipantShare =
  | { readonly kind: 'amount'; readonly amount: Money }
  | { readonly kind: 'percentage'; readonly basisPoints: number }
  | { readonly kind: 'shares'; readonly weight: number };

export interface Participant {
  readonly memberId: string;
  readonly share: ParticipantShare | null;
}

/** Le persone tra cui è divisa una spesa, nell'ordine in cui sono state indicate. */
export function participants(split: Split): Participant[] {
  switch (split.method) {
    case 'equal':
      return split.memberIds.map((memberId) => ({ memberId, share: null }));
    case 'exact':
      return split.amounts.map(({ memberId, amount }) => ({
        memberId,
        share: { kind: 'amount', amount },
      }));
    case 'percentage':
      return split.percentages.map(({ memberId, basisPoints }) => ({
        memberId,
        share: { kind: 'percentage', basisPoints },
      }));
    case 'shares':
      return split.weights.map(({ memberId, weight }) => ({
        memberId,
        share: { kind: 'shares', weight },
      }));
  }
}

/** Filtri dell'elenco delle spese, dal punto di vista di chi usa l'app. */
export type ExpenseFilter = 'all' | 'paidByMe' | 'paidForMe';

/**
 * `paidByMe`: le spese che ho pagato io (anche insieme ad altri). `paidForMe`: quelle in cui qualcun altro ha
 * pagato anche per me, cioè partecipo alla divisione e tra i pagatori c'è un'altra persona.
 */
export function matchesFilter(
  expense: ExpenseView,
  filter: ExpenseFilter,
  me: string | null,
): boolean {
  if (filter === 'all') return true;
  if (me === null) return false;
  const { paidBy, split } = expense.amounts;
  if (filter === 'paidByMe') return paidBy.some(({ memberId }) => memberId === me);
  return (
    participants(split).some(({ memberId }) => memberId === me) &&
    paidBy.some(({ memberId }) => memberId !== me)
  );
}

/** Stato dei conti di un gruppo, per l'elenco dei gruppi. */
export type AccountsStatus =
  /** Nessuna spesa né rimborso (o tutti eliminati). */
  | { readonly kind: 'empty' }
  /** Tutti i saldi sono a zero: nessuno deve niente a nessuno. */
  | { readonly kind: 'settled' }
  /** Qualcuno deve ancora dare o ricevere; `mine` è il saldo di chi usa l'app, se non è zero. */
  | { readonly kind: 'open'; readonly mine: readonly Money[] };

export function accountsStatus(view: BalancesView, me: string | null): AccountsStatus {
  if (view.balances.length === 0) return { kind: 'empty' };
  const amounts = view.balances.flatMap(({ balances }) => balances);
  if (amounts.every(({ amount }) => amount.minor === 0)) return { kind: 'settled' };
  return {
    kind: 'open',
    mine: amounts
      .filter(({ memberId, amount }) => memberId === me && amount.minor !== 0)
      .map(({ amount }) => amount),
  };
}
