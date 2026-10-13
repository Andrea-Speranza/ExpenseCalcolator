import type { ExpenseView, GroupView, MemberView, SettlementView, Split } from '@expense/engine';
import { formatMoney, formatPercentage } from './format';
import type { Names } from './messages';

// Dati di un gruppo pronti per le schermate: nomi dei membri, partecipanti, filtri, elenchi ordinati.

export function memberNames(group: GroupView): Names {
  return new Map(group.members.map(({ memberId, name }) => [memberId, name]));
}

export function nameOf(names: Names, memberId: string): string {
  return names.get(memberId) ?? 'membro sconosciuto';
}

export function activeMembers(group: GroupView): MemberView[] {
  return group.members.filter(({ archived }) => !archived);
}

/** Dalla più recente: per data, poi per ordine di inserimento. */
export function newestFirst<T extends ExpenseView | SettlementView>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export interface Participant {
  readonly memberId: string;
  /** La parte di ciascuno quando non è uguale per tutti (es. "20,00 €", "25%", "2 quote"). */
  readonly detail: string | null;
}

/** Le persone tra cui è divisa una spesa, nell'ordine in cui sono state indicate. */
export function participants(split: Split): Participant[] {
  switch (split.method) {
    case 'equal':
      return split.memberIds.map((memberId) => ({ memberId, detail: null }));
    case 'exact':
      return split.amounts.map(({ memberId, amount }) => ({
        memberId,
        detail: formatMoney(amount),
      }));
    case 'percentage':
      return split.percentages.map(({ memberId, basisPoints }) => ({
        memberId,
        detail: formatPercentage(basisPoints),
      }));
    case 'shares':
      return split.weights.map(({ memberId, weight }) => ({
        memberId,
        detail: weight === 1 ? '1 quota' : `${String(weight)} quote`,
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
