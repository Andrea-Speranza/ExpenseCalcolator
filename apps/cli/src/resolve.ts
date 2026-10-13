import type {
  Engine,
  ExpenseView,
  GroupSummary,
  GroupView,
  MemberView,
  SettlementView,
} from '@expense/engine';
import { shortCode } from './format';
import { describeError } from './messages';
import { orFail, UserError } from './result';

// Riferimenti scritti dall'utente: gruppi e membri per nome (anche solo una parte, se basta a
// distinguerlo), spese per descrizione o per codice breve, rimborsi per codice breve. Maiuscole e minuscole
// non contano. L'id completo funziona sempre.

const same = (a: string, b: string): boolean =>
  a.toLocaleLowerCase('it') === b.toLocaleLowerCase('it');

const contains = (name: string, part: string): boolean =>
  part.trim() !== '' && name.toLocaleLowerCase('it').includes(part.trim().toLocaleLowerCase('it'));

interface Candidate<T> {
  readonly item: T;
  readonly id: string;
  readonly name?: string;
}

function pick<T>(candidates: readonly Candidate<T>[], reference: string, kind: string): T {
  const exact = candidates.find(({ id }) => id === reference);
  if (exact !== undefined) return exact.item;

  const exactName = candidates.filter(({ name }) => name !== undefined && same(name, reference));
  // Se nessun nome è identico, basta che la parola scritta compaia in un solo nome ("montagna").
  const byName =
    exactName.length > 0
      ? exactName
      : candidates.filter(({ name }) => name !== undefined && contains(name, reference));
  if (byName.length === 1 && byName[0] !== undefined) return byName[0].item;

  const code = reference.replace(/^#/, '').toLowerCase();
  const byCode =
    byName.length === 0 && code.length >= 4
      ? candidates.filter(({ id }) => id.toLowerCase().endsWith(code))
      : [];
  if (byCode.length === 1 && byCode[0] !== undefined) return byCode[0].item;

  const matches = byName.length > 1 ? byName : byCode;
  if (matches.length > 1) {
    throw new UserError(
      `"${reference}" corrisponde a più di un ${kind}: ${matches.map(label).join(', ')}. Usa il codice.`,
    );
  }
  const available = candidates.map(label).join(', ');
  throw new UserError(
    `${capitalize(kind)} non trovato: "${reference}".${available === '' ? '' : ` Disponibili: ${available}.`}`,
  );
}

function label({ id, name }: Candidate<unknown>): string {
  return name === undefined ? `#${shortCode(id)}` : `${name} (#${shortCode(id)})`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function findGroup(engine: Engine, reference: string): GroupView {
  const groups = orFail(engine.query({ type: 'ListGroups' }), describeError);
  const { groupId } = pick<GroupSummary>(
    groups.map((group) => ({ item: group, id: group.groupId, name: group.name })),
    reference,
    'gruppo',
  );
  return orFail(engine.query({ type: 'GetGroup', groupId }), describeError);
}

/** Membro per nome o id; "io" indica il membro che rappresenta l'utente, se è stato indicato. */
export function findMember(group: GroupView, reference: string): MemberView {
  if (same(reference, 'io')) {
    const me = group.members.find(({ memberId }) => memberId === group.me);
    if (me === undefined) {
      throw new UserError(
        `In «${group.name}» non hai indicato chi sei: usa "spese gruppo io <gruppo> <membro>".`,
      );
    }
    return me;
  }
  return pick(
    group.members.map((member) => ({ item: member, id: member.memberId, name: member.name })),
    reference,
    'membro',
  );
}

export function findExpense(group: GroupView, reference: string): ExpenseView {
  return pick(
    group.expenses.map((expense) => ({
      item: expense,
      id: expense.expenseId,
      name: expense.description,
    })),
    reference,
    'spesa',
  );
}

export function findSettlement(group: GroupView, reference: string): SettlementView {
  return pick(
    group.settlements.map((settlement) => ({ item: settlement, id: settlement.settlementId })),
    reference,
    'rimborso',
  );
}
