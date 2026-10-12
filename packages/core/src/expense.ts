import type {
  CurrencyCode,
  ExpenseId,
  MemberAmount,
  MemberId,
  Money,
  Split,
} from '@expense/schema';
import { allocate } from './allocate';
import type { ExpenseError, InvalidExpense } from './errors';
import { stableHash } from './hash';
import { compareStrings } from './order';
import { err, ok, type Result } from './result';

/** 100% espresso in punti base. */
const FULL_PERCENTAGE = 10_000;

/** Dati di una spesa che servono al calcolo. Le spese salvate hanno anche descrizione, data, ecc. */
export interface ExpenseInput {
  readonly id: ExpenseId;
  readonly total: Money;
  readonly paidBy: readonly MemberAmount[];
  readonly split: Split;
}

/** Chi ha pagato quanto e quanto spetta a ciascuno, nella valuta della spesa. */
export interface ExpenseBreakdown {
  readonly paid: readonly MemberAmount[];
  readonly owed: readonly MemberAmount[];
}

interface Weighted {
  readonly memberId: MemberId;
  readonly weight: number;
}

/**
 * Verifica una spesa e calcola quanto spetta a ciascuno (PLANNING §9.2–9.3).
 * Le quote proporzionali si calcolano con il metodo del resto maggiore; lo spareggio ruota in base
 * all'id della spesa, così il centesimo in più non tocca sempre alla stessa persona.
 */
export function splitExpense(expense: ExpenseInput): Result<ExpenseBreakdown, ExpenseError> {
  const { total } = expense;
  if (!Number.isSafeInteger(total.minor)) return err({ code: 'AmountOutOfRange' });
  if (total.minor <= 0) return err(invalid('nonPositiveTotal'));

  const paid = checkAmounts('paidBy', total, expense.paidBy);
  if (!paid.ok) return paid;
  const owed = owedShares(expense);
  if (!owed.ok) return owed;
  return ok({ paid: paid.value, owed: owed.value });
}

/** Effetto netto della spesa per ogni membro (pagato − dovuto), ordinato per membro. */
export function expenseNets(
  breakdown: ExpenseBreakdown,
  currency: CurrencyCode,
): readonly MemberAmount[] {
  const nets = new Map<MemberId, number>();
  for (const { memberId, amount } of breakdown.paid) {
    nets.set(memberId, (nets.get(memberId) ?? 0) + amount.minor);
  }
  for (const { memberId, amount } of breakdown.owed) {
    nets.set(memberId, (nets.get(memberId) ?? 0) - amount.minor);
  }
  return [...nets.entries()]
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([memberId, minor]) => ({ memberId, amount: { minor, currency } }));
}

function owedShares({
  id,
  total,
  split,
}: ExpenseInput): Result<readonly MemberAmount[], ExpenseError> {
  switch (split.method) {
    case 'equal':
      return allocateAmong(
        total,
        split.memberIds.map((memberId) => ({ memberId, weight: 1 })),
        id,
      );
    case 'exact':
      return checkAmounts('amounts', total, split.amounts);
    case 'percentage': {
      const shares = allocateAmong(
        total,
        split.percentages.map(({ memberId, basisPoints }) => ({ memberId, weight: basisPoints })),
        id,
      );
      if (!shares.ok) return shares;
      const sum = split.percentages.reduce((acc, { basisPoints }) => acc + basisPoints, 0);
      if (sum !== FULL_PERCENTAGE) {
        return err({
          code: 'TotalMismatch',
          field: 'percentages',
          expected: FULL_PERCENTAGE,
          actual: sum,
        });
      }
      return shares;
    }
    case 'shares':
      return allocateAmong(total, split.weights, id);
  }
}

function allocateAmong(
  total: Money,
  entries: readonly Weighted[],
  expenseId: ExpenseId,
): Result<readonly MemberAmount[], ExpenseError> {
  if (entries.length === 0) return err(invalid('noParticipants'));
  const duplicate = findDuplicate(entries.map(({ memberId }) => memberId));
  if (duplicate !== undefined) return err(invalid('duplicateMember', duplicate));

  const shares = allocate(
    total.minor,
    entries.map(({ weight }) => weight),
    stableHash(expenseId),
  );
  if (!shares.ok) return shares;
  return ok(
    entries.map(({ memberId }, index) => ({
      memberId,
      amount: { minor: shares.value[index] ?? 0, currency: total.currency },
    })),
  );
}

/**
 * Controlla un elenco di importi per membro che deve sommare al totale: i pagatori (importi positivi)
 * o la divisione per importi esatti (importi non negativi).
 */
function checkAmounts(
  field: 'paidBy' | 'amounts',
  total: Money,
  entries: readonly MemberAmount[],
): Result<readonly MemberAmount[], ExpenseError> {
  if (entries.length === 0) return err(invalid(field === 'paidBy' ? 'noPayers' : 'noParticipants'));
  const duplicate = findDuplicate(entries.map(({ memberId }) => memberId));
  if (duplicate !== undefined) return err(invalid('duplicateMember', duplicate));

  let sum = 0n;
  for (const { memberId, amount } of entries) {
    if (amount.currency !== total.currency) {
      return err({ code: 'CurrencyMismatch', expected: total.currency, actual: amount.currency });
    }
    if (!Number.isSafeInteger(amount.minor)) return err({ code: 'AmountOutOfRange' });
    if (field === 'paidBy' && amount.minor <= 0) {
      return err(invalid('nonPositivePayment', memberId));
    }
    if (amount.minor < 0) return err(invalid('negativeAmount', memberId));
    sum += BigInt(amount.minor);
  }

  if (sum !== BigInt(total.minor)) {
    return err({ code: 'TotalMismatch', field, expected: total.minor, actual: Number(sum) });
  }
  return ok(entries);
}

function invalid(reason: InvalidExpense['reason'], memberId?: MemberId): InvalidExpense {
  return memberId === undefined
    ? { code: 'InvalidExpense', reason }
    : { code: 'InvalidExpense', reason, memberId };
}

function findDuplicate(ids: readonly MemberId[]): MemberId | undefined {
  const seen = new Set<MemberId>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return undefined;
}
