import type {
  CurrencyCode,
  ExpenseAmounts,
  ExpenseId,
  GroupEvent,
  GroupId,
  Hlc,
  MemberId,
  SettlementId,
  SettlementTransfer,
} from '@expense/schema';
import { type Conflict, type Field, initialField, overwrite, type Write } from './field';
import { orderEvents } from './log';

// Stato di un gruppo ricostruito dai suoi eventi (ADR 0007). Ogni dispositivo applica gli stessi eventi,
// nello stesso ordine e con le stesse regole, quindi arriva allo stesso stato senza bisogno di un server.

interface Entity {
  readonly createdBy: MemberId | null;
  readonly createdAt: Hlc;
  /** HLC dell'ultimo evento applicato: è il `base` da usare per modificarlo. */
  readonly version: Hlc;
  readonly conflicts: readonly Conflict[];
}

export interface MemberState extends Entity {
  readonly id: MemberId;
  readonly name: Field<string>;
  readonly archived: Field<boolean>;
}

export interface ExpenseState extends Entity {
  readonly id: ExpenseId;
  readonly description: Field<string>;
  readonly date: Field<string>;
  /** Ora del giorno (HH:MM), facoltativa. */
  readonly time: Field<string | null>;
  readonly amounts: Field<ExpenseAmounts>;
  readonly category: Field<string | null>;
  readonly notes: Field<string | null>;
  /** Campo a sé: le modifiche non lo toccano, quindi l'eliminazione vince (ADR 0007, punto 4). */
  readonly deleted: Field<boolean>;
}

export interface SettlementState extends Entity {
  readonly id: SettlementId;
  readonly transfer: Field<SettlementTransfer>;
  readonly date: Field<string>;
  readonly notes: Field<string | null>;
  readonly deleted: Field<boolean>;
}

export interface GroupState extends Entity {
  readonly id: GroupId;
  readonly name: Field<string>;
  readonly baseCurrency: Field<CurrencyCode>;
  readonly archived: Field<boolean>;
  readonly members: ReadonlyMap<MemberId, MemberState>;
  readonly expenses: ReadonlyMap<ExpenseId, ExpenseState>;
  readonly settlements: ReadonlyMap<SettlementId, SettlementState>;
}

export type RejectionReason =
  | 'wrongStream'
  | 'unauthorized'
  | 'groupNotCreated'
  | 'groupAlreadyCreated'
  | 'duplicateEntity'
  | 'unknownEntity';

/** Evento valido come formato ma non applicabile: si conserva, si ignora e si segnala. */
export interface RejectedEvent {
  readonly event: GroupEvent;
  readonly reason: RejectionReason;
}

export interface GroupProjection {
  readonly group: GroupState | null;
  readonly rejected: readonly RejectedEvent[];
}

/**
 * Permessi (ADR 0007, punto 7): dice se un evento è permesso, dato lo stato del gruppo nel punto in cui
 * l'evento si applica. Tutti i dispositivi usano la stessa politica, quindi decidono allo stesso modo.
 */
export type Policy = (group: GroupState | null, event: GroupEvent) => boolean;

/** Politica attuale: tutti possono tutto. Quella definitiva si sceglierà con D13. */
export const allowAll: Policy = () => true;

export function projectGroup(
  groupId: GroupId,
  events: Iterable<GroupEvent>,
  policy: Policy = allowAll,
): GroupProjection {
  let group: GroupState | null = null;
  const rejected: RejectedEvent[] = [];
  for (const event of orderEvents(events)) {
    const outcome: GroupState | RejectionReason =
      event.stream !== groupId ? 'wrongStream' : authorizeAndApply(group, event, policy);
    if (typeof outcome === 'string') rejected.push({ event, reason: outcome });
    else group = outcome;
  }
  return { group, rejected };
}

function authorizeAndApply(
  group: GroupState | null,
  event: GroupEvent,
  policy: Policy,
): GroupState | RejectionReason {
  if (!policy(group, event)) return 'unauthorized';
  if (event.type === 'GroupCreated') {
    if (group !== null) return 'groupAlreadyCreated';
    return {
      ...newEntity(event),
      id: event.stream,
      name: initialField(event.payload.name, event),
      baseCurrency: initialField(event.payload.baseCurrency, event),
      archived: initialField(false, event),
      members: new Map(),
      expenses: new Map(),
      settlements: new Map(),
    };
  }
  if (group === null) return 'groupNotCreated';
  const next = applyToGroup(group, event);
  return typeof next === 'string' ? next : { ...next, version: event.hlc };
}

function applyToGroup(
  group: GroupState,
  event: Exclude<GroupEvent, { readonly type: 'GroupCreated' }>,
): GroupState | RejectionReason {
  switch (event.type) {
    case 'GroupUpdated': {
      const { changes } = event.payload;
      const conflicts = [...group.conflicts];
      return {
        ...group,
        name: set(conflicts, group.name, changes.name, event, 'name'),
        baseCurrency: set(
          conflicts,
          group.baseCurrency,
          changes.baseCurrency,
          event,
          'baseCurrency',
        ),
        archived: set(conflicts, group.archived, changes.archived, event, 'archived'),
        conflicts,
      };
    }
    case 'MemberAdded': {
      const { memberId, name } = event.payload;
      if (group.members.has(memberId)) return 'duplicateEntity';
      const member: MemberState = {
        ...newEntity(event),
        id: memberId,
        name: initialField(name, event),
        archived: initialField(false, event),
      };
      return { ...group, members: new Map(group.members).set(memberId, member) };
    }
    case 'MemberUpdated': {
      const { memberId, changes } = event.payload;
      const member = group.members.get(memberId);
      if (member === undefined) return 'unknownEntity';
      const conflicts = [...member.conflicts];
      const next: MemberState = {
        ...member,
        name: set(conflicts, member.name, changes.name, event, 'name'),
        archived: set(conflicts, member.archived, changes.archived, event, 'archived'),
        conflicts,
        version: event.hlc,
      };
      return { ...group, members: new Map(group.members).set(memberId, next) };
    }
    case 'ExpenseAdded': {
      const { expenseId, description, date, time, amounts, category, notes } = event.payload;
      if (group.expenses.has(expenseId)) return 'duplicateEntity';
      const expense: ExpenseState = {
        ...newEntity(event),
        id: expenseId,
        description: initialField(description, event),
        date: initialField(date, event),
        time: initialField(time ?? null, event),
        amounts: initialField(amounts, event),
        category: initialField(category ?? null, event),
        notes: initialField(notes ?? null, event),
        deleted: initialField(false, event),
      };
      return { ...group, expenses: new Map(group.expenses).set(expenseId, expense) };
    }
    case 'ExpenseUpdated': {
      const { changes } = event.payload;
      return updateExpense(group, event.payload.expenseId, event, (expense, conflicts) => ({
        ...expense,
        description: set(conflicts, expense.description, changes.description, event, 'description'),
        date: set(conflicts, expense.date, changes.date, event, 'date'),
        time: set(conflicts, expense.time, changes.time, event, 'time'),
        amounts: set(conflicts, expense.amounts, changes.amounts, event, 'amounts'),
        category: set(conflicts, expense.category, changes.category, event, 'category'),
        notes: set(conflicts, expense.notes, changes.notes, event, 'notes'),
      }));
    }
    case 'ExpenseDeleted':
    case 'ExpenseRestored': {
      const deleted = event.type === 'ExpenseDeleted';
      return updateExpense(group, event.payload.expenseId, event, (expense, conflicts) => ({
        ...expense,
        deleted: set(conflicts, expense.deleted, deleted, event, 'deleted'),
      }));
    }
    case 'SettlementAdded': {
      const { settlementId, transfer, date, notes } = event.payload;
      if (group.settlements.has(settlementId)) return 'duplicateEntity';
      const settlement: SettlementState = {
        ...newEntity(event),
        id: settlementId,
        transfer: initialField(transfer, event),
        date: initialField(date, event),
        notes: initialField(notes ?? null, event),
        deleted: initialField(false, event),
      };
      return { ...group, settlements: new Map(group.settlements).set(settlementId, settlement) };
    }
    case 'SettlementUpdated': {
      const { changes } = event.payload;
      return updateSettlement(
        group,
        event.payload.settlementId,
        event,
        (settlement, conflicts) => ({
          ...settlement,
          transfer: set(conflicts, settlement.transfer, changes.transfer, event, 'transfer'),
          date: set(conflicts, settlement.date, changes.date, event, 'date'),
          notes: set(conflicts, settlement.notes, changes.notes, event, 'notes'),
        }),
      );
    }
    case 'SettlementDeleted':
    case 'SettlementRestored': {
      const deleted = event.type === 'SettlementDeleted';
      return updateSettlement(
        group,
        event.payload.settlementId,
        event,
        (settlement, conflicts) => ({
          ...settlement,
          deleted: set(conflicts, settlement.deleted, deleted, event, 'deleted'),
        }),
      );
    }
  }
}

function newEntity(write: Write): Entity {
  return { createdBy: write.actor, createdAt: write.hlc, version: write.hlc, conflicts: [] };
}

/** Scrive un campo se la modifica lo riguarda (`undefined` = campo non toccato), annotando i conflitti. */
function set<T>(
  conflicts: Conflict[],
  current: Field<T>,
  value: T | undefined,
  write: Write,
  name: string,
): Field<T> {
  if (value === undefined) return current;
  const { field, conflict } = overwrite(current, value, write, name);
  if (conflict !== undefined) conflicts.push(conflict);
  return field;
}

function updateExpense(
  group: GroupState,
  expenseId: ExpenseId,
  write: Write,
  update: (expense: ExpenseState, conflicts: Conflict[]) => ExpenseState,
): GroupState | RejectionReason {
  const expense = group.expenses.get(expenseId);
  if (expense === undefined) return 'unknownEntity';
  const conflicts = [...expense.conflicts];
  const next = { ...update(expense, conflicts), conflicts, version: write.hlc };
  return { ...group, expenses: new Map(group.expenses).set(expenseId, next) };
}

function updateSettlement(
  group: GroupState,
  settlementId: SettlementId,
  write: Write,
  update: (settlement: SettlementState, conflicts: Conflict[]) => SettlementState,
): GroupState | RejectionReason {
  const settlement = group.settlements.get(settlementId);
  if (settlement === undefined) return 'unknownEntity';
  const conflicts = [...settlement.conflicts];
  const next = { ...update(settlement, conflicts), conflicts, version: write.hlc };
  return { ...group, settlements: new Map(group.settlements).set(settlementId, next) };
}
