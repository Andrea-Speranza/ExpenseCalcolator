import type { ExpenseView, GroupView, MemberView, SettlementView } from '@expense/engine';
import type { Names } from './messages';

// Dati di un gruppo pronti per le schermate: nomi dei membri, elenchi ordinati.

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
