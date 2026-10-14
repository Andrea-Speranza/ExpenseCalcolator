import {
  computeBalances,
  type CurrencyBalances,
  type ExpenseError,
  type ExpenseInput,
  ok,
  pairwiseTransfers,
  type Result,
  type SettlementError,
  type SettlementInput,
  simplifiedTransfers,
  splitExpense,
  type Transfer,
  validateSettlement,
} from '@expense/core';
import type {
  CurrencyCode,
  ExpenseAmounts,
  ExpenseId,
  GroupId,
  GroupMode,
  Hlc,
  Language,
  MemberId,
  SettlementId,
  SettlementTransfer,
} from '@expense/schema';
import type {
  Conflict,
  ExpenseState,
  GroupProjection,
  GroupState,
  LinkedGroup,
  MemberState,
  ProfileState,
  SettlementState,
} from '@expense/sync';
import type { QueryError } from './errors';

// Viste: i dati che l'engine restituisce alle query. Solo oggetti e array JSON, così passano anche
// attraverso un worker o un bridge nativo (PLANNING §5.2).

interface EntityView {
  readonly createdBy: MemberId | null;
  readonly createdAt: Hlc;
  /** Da passare come `base` quando si modifica l'elemento (ADR 0007). */
  readonly version: Hlc;
  readonly conflicts: readonly Conflict[];
}

export interface MemberView extends EntityView {
  readonly memberId: MemberId;
  readonly name: string;
  readonly archived: boolean;
}

export interface ExpenseView extends EntityView {
  readonly expenseId: ExpenseId;
  readonly description: string;
  readonly date: string;
  /** Ora del giorno (HH:MM), se indicata. */
  readonly time: string | null;
  readonly amounts: ExpenseAmounts;
  readonly category: string | null;
  readonly notes: string | null;
  readonly deleted: boolean;
}

export interface SettlementView extends EntityView {
  readonly settlementId: SettlementId;
  readonly transfer: SettlementTransfer;
  readonly date: string;
  readonly notes: string | null;
  readonly deleted: boolean;
}

export interface GroupSummary {
  readonly groupId: GroupId;
  readonly name: string;
  readonly baseCurrency: CurrencyCode;
  readonly archived: boolean;
  readonly mode: GroupMode;
  /** Il membro che rappresenta l'utente in questo gruppo; null se non ne fa parte. */
  readonly me: MemberId | null;
  /** Quando è stato creato il gruppo (l'ora si legge con `timeOfHlc`). */
  readonly createdAt: Hlc;
}

export interface GroupView extends GroupSummary, EntityView {
  readonly members: readonly MemberView[];
  readonly expenses: readonly ExpenseView[];
  readonly settlements: readonly SettlementView[];
  /** Eventi validi ma non applicabili (es. non permessi): si conservano e si segnalano. */
  readonly rejectedEvents: number;
}

/** Spesa o rimborso escluso dal calcolo perché non valido (es. scritto da un'app difettosa). */
export interface ExcludedEntry {
  readonly entry: 'expense' | 'settlement';
  readonly id: string;
  readonly error: ExpenseError | SettlementError;
}

export interface BalancesView {
  readonly balances: readonly CurrencyBalances[];
  readonly simplifiedTransfers: readonly Transfer[];
  readonly pairwiseTransfers: readonly Transfer[];
  readonly excluded: readonly ExcludedEntry[];
}

export interface SettingsView {
  readonly defaultCurrency: CurrencyCode;
  /** Lingua scelta dall'utente; null finché non la sceglie (l'app segue quella del dispositivo, ADR 0010). */
  readonly language: Language | null;
  readonly displayName: string | null;
}

/** Valori usati finché l'utente non sceglie diversamente. */
export const DEFAULT_SETTINGS = { defaultCurrency: 'EUR' } as const;

export function settingsView(profile: ProfileState): SettingsView {
  const { defaultCurrency, language, displayName } = profile.settings;
  return {
    defaultCurrency: defaultCurrency?.value ?? DEFAULT_SETTINGS.defaultCurrency,
    language: language?.value ?? null,
    displayName: displayName?.value ?? null,
  };
}

export function groupSummary(group: GroupState, link: LinkedGroup | undefined): GroupSummary {
  return {
    groupId: group.id,
    name: group.name.value,
    baseCurrency: group.baseCurrency.value,
    archived: group.archived.value,
    mode: link?.mode?.value ?? 'local',
    me: link?.me?.value ?? null,
    createdAt: group.createdAt,
  };
}

export function groupView(
  projection: GroupProjection & { readonly group: GroupState },
  link: LinkedGroup | undefined,
): GroupView {
  const { group, rejected } = projection;
  return {
    ...groupSummary(group, link),
    ...entityView(group),
    members: [...group.members.values()].map(memberView),
    expenses: [...group.expenses.values()].map(expenseView),
    settlements: [...group.settlements.values()].map(settlementView),
    rejectedEvents: rejected.length,
  };
}

/**
 * Saldi e trasferimenti del gruppo, escluse spese e rimborsi eliminati. Una voce non valida non blocca il
 * gruppo: si esclude dal calcolo e si segnala (`excluded`).
 */
export function balancesView(group: GroupState): Result<BalancesView, QueryError> {
  const expenses: ExpenseInput[] = [];
  const settlements: SettlementInput[] = [];
  const excluded: ExcludedEntry[] = [];

  for (const expense of group.expenses.values()) {
    if (expense.deleted.value) continue;
    const input: ExpenseInput = { id: expense.id, ...expense.amounts.value };
    const check = splitExpense(input);
    if (check.ok) expenses.push(input);
    else excluded.push({ entry: 'expense', id: expense.id, error: check.error });
  }
  for (const settlement of group.settlements.values()) {
    if (settlement.deleted.value) continue;
    const input: SettlementInput = { id: settlement.id, ...settlement.transfer.value };
    const check = validateSettlement(input);
    if (check.ok) settlements.push(input);
    else excluded.push({ entry: 'settlement', id: settlement.id, error: check.error });
  }

  const ledger = { expenses, settlements };
  const balances = computeBalances(ledger);
  if (!balances.ok) return balances;
  const simplified = simplifiedTransfers(balances.value);
  if (!simplified.ok) return simplified;
  const pairwise = pairwiseTransfers(ledger);
  if (!pairwise.ok) return pairwise;
  return ok({
    balances: balances.value,
    simplifiedTransfers: simplified.value,
    pairwiseTransfers: pairwise.value,
    excluded,
  });
}

function entityView({ createdBy, createdAt, version, conflicts }: EntityView): EntityView {
  return { createdBy, createdAt, version, conflicts };
}

function memberView(member: MemberState): MemberView {
  return {
    ...entityView(member),
    memberId: member.id,
    name: member.name.value,
    archived: member.archived.value,
  };
}

function expenseView(expense: ExpenseState): ExpenseView {
  return {
    ...entityView(expense),
    expenseId: expense.id,
    description: expense.description.value,
    date: expense.date.value,
    time: expense.time.value,
    amounts: expense.amounts.value,
    category: expense.category.value,
    notes: expense.notes.value,
    deleted: expense.deleted.value,
  };
}

function settlementView(settlement: SettlementState): SettlementView {
  return {
    ...entityView(settlement),
    settlementId: settlement.id,
    transfer: settlement.transfer.value,
    date: settlement.date.value,
    notes: settlement.notes.value,
    deleted: settlement.deleted.value,
  };
}
