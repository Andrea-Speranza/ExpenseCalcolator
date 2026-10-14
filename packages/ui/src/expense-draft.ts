import type {
  ExpenseAmounts,
  ExpenseView,
  MemberAmount,
  MemberView,
  Money,
  Result,
  Split,
} from '@expense/engine';
import type { Formatter } from '@expense/i18n';
import { type InputProblem, parseAmount, parsePercentage, parseWeight } from './amounts';

// Stato del form di una spesa: i valori sono i testi scritti dall'utente. Da qui si ottengono i dati del
// comando (AddExpense o UpdateExpense), oppure gli errori da mostrare accanto ai campi. Le regole di
// dominio (somme, totali) le verifica comunque l'engine. Gli errori sono codici: il testo lo sceglie la UI.

export type SplitMethod = Split['method'];
export type PayerMode = 'single' | 'multiple';
type MemberTexts = Readonly<Record<string, string>>;

/** Un problema in un campo del form: un valore non valido o un dato che manca. */
export type FormProblem =
  | InputProblem
  | { readonly code: 'descriptionRequired' }
  | { readonly code: 'dateRequired' }
  | { readonly code: 'payerRequired' }
  | { readonly code: 'paymentsRequired' }
  | { readonly code: 'participantsRequired' }
  | { readonly code: 'amountsRequired' }
  | { readonly code: 'percentagesRequired' }
  | { readonly code: 'sharesRequired' };
type MemberProblems = Readonly<Record<string, InputProblem>>;

export interface ExpenseDraft {
  readonly description: string;
  readonly amount: string;
  readonly date: string;
  /** Ora facoltativa (HH:MM); vuota se non indicata. */
  readonly time: string;
  readonly category: string;
  readonly notes: string;
  /** Un solo pagatore (tutto il totale) o più pagatori con il proprio importo. */
  readonly payerMode: PayerMode;
  readonly payer: string;
  readonly payments: MemberTexts;
  readonly method: SplitMethod;
  /** Parti uguali: chi partecipa. */
  readonly included: Readonly<Record<string, boolean>>;
  readonly exact: MemberTexts;
  readonly percentages: MemberTexts;
  readonly shares: MemberTexts;
}

export interface DraftErrors {
  readonly description?: FormProblem;
  readonly amount?: FormProblem;
  readonly date?: FormProblem;
  readonly payer?: FormProblem;
  readonly split?: FormProblem;
  /** Errori sugli importi dei singoli pagatori. */
  readonly payments?: MemberProblems;
  /** Errori sui valori dei singoli membri nella divisione. */
  readonly members?: MemberProblems;
}

export interface ExpenseFields {
  readonly description: string;
  readonly date: string;
  readonly time: string | null;
  readonly amounts: ExpenseAmounts;
  readonly category: string | null;
  readonly notes: string | null;
}

/** Form vuoto: paga l'utente (se fa parte del gruppo), si divide in parti uguali tra tutti. */
export function newDraft(
  members: readonly MemberView[],
  me: string | null,
  date: string,
): ExpenseDraft {
  const ids = members.map(({ memberId }) => memberId);
  return {
    description: '',
    amount: '',
    date,
    time: '',
    category: '',
    notes: '',
    payerMode: 'single',
    payer: me !== null && ids.includes(me) ? me : (ids[0] ?? ''),
    payments: {},
    method: 'equal',
    included: Object.fromEntries(ids.map((id) => [id, true])),
    exact: {},
    percentages: {},
    shares: Object.fromEntries(ids.map((id) => [id, '1'])),
  };
}

/** Form compilato con una spesa esistente, da modificare. */
export function draftFromExpense(expense: ExpenseView, format: Formatter): ExpenseDraft {
  const { total, paidBy, split } = expense.amounts;
  const [single] = paidBy;
  const singlePayer = paidBy.length === 1 && single?.amount.minor === total.minor;
  const participants = splitMembers(split);
  return {
    description: expense.description,
    amount: format.amountInput(total),
    date: expense.date,
    time: expense.time ?? '',
    category: expense.category ?? '',
    notes: expense.notes ?? '',
    payerMode: singlePayer ? 'single' : 'multiple',
    payer: single?.memberId ?? '',
    payments: singlePayer
      ? {}
      : Object.fromEntries(
          paidBy.map(({ memberId, amount }) => [memberId, format.amountInput(amount)]),
        ),
    method: split.method,
    included: Object.fromEntries(participants.map((id) => [id, true])),
    exact:
      split.method === 'exact'
        ? Object.fromEntries(
            split.amounts.map(({ memberId, amount }) => [memberId, format.amountInput(amount)]),
          )
        : {},
    percentages:
      split.method === 'percentage'
        ? Object.fromEntries(
            split.percentages.map(({ memberId, basisPoints }) => [
              memberId,
              format.percentageInput(basisPoints),
            ]),
          )
        : {},
    shares:
      split.method === 'shares'
        ? Object.fromEntries(
            split.weights.map(({ memberId, weight }) => [memberId, String(weight)]),
          )
        : Object.fromEntries(participants.map((id) => [id, '1'])),
  };
}

/** Dati della spesa dal form, nell'ordine dei membri indicato; oppure gli errori per campo. */
export function readDraft(
  draft: ExpenseDraft,
  members: readonly MemberView[],
  currency: string,
): Result<ExpenseFields, DraftErrors> {
  const errors: { -readonly [K in keyof DraftErrors]: DraftErrors[K] } = {};
  const description = draft.description.trim();
  if (description === '') errors.description = { code: 'descriptionRequired' };
  if (draft.date === '') errors.date = { code: 'dateRequired' };

  const total = parseAmount(draft.amount, currency);
  if (!total.ok) errors.amount = total.error;

  const payers = readPayers(draft, members, currency, total.ok ? total.value : null);
  if (!payers.ok) Object.assign(errors, payers.error);
  const split = readSplit(draft, members, currency);
  if (!split.ok) Object.assign(errors, split.error);

  if (!total.ok || !payers.ok || !split.ok || Object.keys(errors).length > 0) {
    return { ok: false, error: errors };
  }
  const optional = (text: string) => (text.trim() === '' ? null : text.trim());
  return {
    ok: true,
    value: {
      description,
      date: draft.date,
      time: draft.time === '' ? null : draft.time,
      amounts: { total: total.value, paidBy: payers.value, split: split.value },
      category: optional(draft.category),
      notes: optional(draft.notes),
    },
  };
}

export interface ExpenseChanges {
  readonly description?: string;
  readonly date?: string;
  readonly time?: string | null;
  readonly amounts?: ExpenseAmounts;
  readonly category?: string | null;
  readonly notes?: string | null;
}

/** Solo i campi cambiati, per UpdateExpense; null se non è cambiato nulla. */
export function expenseChanges(expense: ExpenseView, fields: ExpenseFields): ExpenseChanges | null {
  const changes: { -readonly [K in keyof ExpenseChanges]: ExpenseChanges[K] } = {};
  if (fields.description !== expense.description) changes.description = fields.description;
  if (fields.date !== expense.date) changes.date = fields.date;
  if (fields.time !== expense.time) changes.time = fields.time;
  if (canonical(fields.amounts) !== canonical(expense.amounts)) changes.amounts = fields.amounts;
  if (fields.category !== expense.category) changes.category = fields.category;
  if (fields.notes !== expense.notes) changes.notes = fields.notes;
  return Object.keys(changes).length === 0 ? null : changes;
}

/** Membri che compaiono in una spesa, come pagatori o nella divisione. */
export function expenseMembers({ paidBy, split }: ExpenseAmounts): string[] {
  return [...paidBy.map(({ memberId }) => memberId), ...splitMembers(split)];
}

/** Importi esatti: quanto è già assegnato rispetto al totale (null se qualche valore non è valido). */
export function exactProgress(
  draft: ExpenseDraft,
  members: readonly MemberView[],
  currency: string,
): { readonly assigned: Money; readonly total: Money } | null {
  const total = parseAmount(draft.amount, currency);
  const values = readMemberValues(draft.exact, members, (text) => parseAmount(text, currency));
  if (!total.ok || !values.ok) return null;
  const minor = values.value.reduce((sum, [, amount]) => sum + amount.minor, 0);
  return { assigned: { minor, currency }, total: total.value };
}

/** Percentuali: somma in punti base (null se qualche valore non è valido). */
export function percentageProgress(
  draft: ExpenseDraft,
  members: readonly MemberView[],
): number | null {
  const values = readMemberValues(draft.percentages, members, parsePercentage);
  return values.ok ? values.value.reduce((sum, [, basisPoints]) => sum + basisPoints, 0) : null;
}

function readPayers(
  draft: ExpenseDraft,
  members: readonly MemberView[],
  currency: string,
  total: Money | null,
): Result<MemberAmount[], DraftErrors> {
  if (draft.payerMode === 'single') {
    if (draft.payer === '') return { ok: false, error: { payer: { code: 'payerRequired' } } };
    return { ok: true, value: total === null ? [] : [{ memberId: draft.payer, amount: total }] };
  }
  const values = readMemberValues(draft.payments, members, (text) => parseAmount(text, currency));
  if (!values.ok) return { ok: false, error: { payments: values.error } };
  if (values.value.length === 0) {
    return { ok: false, error: { payer: { code: 'paymentsRequired' } } };
  }
  return { ok: true, value: values.value.map(([memberId, amount]) => ({ memberId, amount })) };
}

function readSplit(
  draft: ExpenseDraft,
  members: readonly MemberView[],
  currency: string,
): Result<Split, DraftErrors> {
  switch (draft.method) {
    case 'equal': {
      const memberIds = members
        .map(({ memberId }) => memberId)
        .filter((memberId) => draft.included[memberId] === true);
      if (memberIds.length === 0) {
        return { ok: false, error: { split: { code: 'participantsRequired' } } };
      }
      return { ok: true, value: { method: 'equal', memberIds } };
    }
    case 'exact': {
      const values = readMemberValues(draft.exact, members, (text) => parseAmount(text, currency));
      if (!values.ok) return { ok: false, error: { members: values.error } };
      if (values.value.length === 0) {
        return { ok: false, error: { split: { code: 'amountsRequired' } } };
      }
      return {
        ok: true,
        value: {
          method: 'exact',
          amounts: values.value.map(([memberId, amount]) => ({ memberId, amount })),
        },
      };
    }
    case 'percentage': {
      const values = readMemberValues(draft.percentages, members, parsePercentage);
      if (!values.ok) return { ok: false, error: { members: values.error } };
      if (values.value.length === 0) {
        return { ok: false, error: { split: { code: 'percentagesRequired' } } };
      }
      return {
        ok: true,
        value: {
          method: 'percentage',
          percentages: values.value.map(([memberId, basisPoints]) => ({ memberId, basisPoints })),
        },
      };
    }
    case 'shares': {
      const values = readMemberValues(draft.shares, members, parseWeight);
      if (!values.ok) return { ok: false, error: { members: values.error } };
      const weights = values.value.filter(([, weight]) => weight > 0);
      if (weights.length === 0) return { ok: false, error: { split: { code: 'sharesRequired' } } };
      return {
        ok: true,
        value: {
          method: 'shares',
          weights: weights.map(([memberId, weight]) => ({ memberId, weight })),
        },
      };
    }
  }
}

/** Valori scritti per ogni membro: i campi vuoti si saltano, quelli non validi diventano errori. */
function readMemberValues<T>(
  texts: MemberTexts,
  members: readonly MemberView[],
  parse: (text: string) => Result<T, InputProblem>,
): Result<[string, T][], MemberProblems> {
  const values: [string, T][] = [];
  const errors: Record<string, InputProblem> = {};
  for (const { memberId } of members) {
    const text = texts[memberId]?.trim() ?? '';
    if (text === '') continue;
    const parsed = parse(text);
    if (parsed.ok) values.push([memberId, parsed.value]);
    else errors[memberId] = parsed.error;
  }
  return Object.keys(errors).length > 0
    ? { ok: false, error: errors }
    : { ok: true, value: values };
}

/**
 * Forma confrontabile degli importi: l'ordine dei membri non conta (il form li elenca nell'ordine del
 * gruppo, la spesa salvata in quello in cui sono stati scritti).
 */
function canonical({ total, paidBy, split }: ExpenseAmounts): string {
  const byMember = <T extends { readonly memberId: string }>(entries: readonly T[]): T[] =>
    [...entries].sort((a, b) => (a.memberId < b.memberId ? -1 : 1));
  const money = ({ minor, currency }: Money) => ({ minor, currency });
  const sortedSplit = (): unknown => {
    switch (split.method) {
      case 'equal':
        return { method: split.method, memberIds: [...split.memberIds].sort() };
      case 'exact':
        return {
          method: split.method,
          amounts: byMember(split.amounts).map(({ memberId, amount }) => [memberId, money(amount)]),
        };
      case 'percentage':
        return {
          method: split.method,
          percentages: byMember(split.percentages).map(({ memberId, basisPoints }) => [
            memberId,
            basisPoints,
          ]),
        };
      case 'shares':
        return {
          method: split.method,
          weights: byMember(split.weights).map(({ memberId, weight }) => [memberId, weight]),
        };
    }
  };
  return JSON.stringify({
    total: money(total),
    paidBy: byMember(paidBy).map(({ memberId, amount }) => [memberId, money(amount)]),
    split: sortedSplit(),
  });
}

function splitMembers(split: Split): string[] {
  switch (split.method) {
    case 'equal':
      return [...split.memberIds];
    case 'exact':
      return split.amounts.map(({ memberId }) => memberId);
    case 'percentage':
      return split.percentages.map(({ memberId }) => memberId);
    case 'shares':
      return split.weights.map(({ memberId }) => memberId);
  }
}
