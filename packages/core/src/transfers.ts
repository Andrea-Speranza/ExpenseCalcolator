import type { CurrencyCode, MemberAmount, MemberId, Money } from '@expense/schema';
import type { AmountOutOfRange, CurrencyMismatch, LedgerError, UnbalancedBalances } from './errors';
import { type CurrencyBalances, type LedgerInput, ledgerEffects } from './ledger';
import { compareStrings } from './order';
import { err, ok, type Result } from './result';

/** Pagamento suggerito per pareggiare i conti: `from` dà a `to` l'importo indicato. */
export interface Transfer {
  readonly from: MemberId;
  readonly to: MemberId;
  readonly amount: Money;
}

interface Position {
  readonly memberId: MemberId;
  remaining: number;
}

/** Debito netto tra due membri in una valuta: positivo se `first` deve a `second`. */
interface PairDebt {
  readonly currency: CurrencyCode;
  readonly first: MemberId;
  readonly second: MemberId;
  minor: number;
}

/**
 * Trasferimenti semplificati (PLANNING §9.5): per ogni valuta, il debitore più grande paga il creditore
 * più grande, finché i saldi non sono a zero. Al massimo n − 1 trasferimenti per valuta.
 * A parità di importo vince il membro con l'id minore, quindi il risultato è lo stesso ovunque.
 */
export function simplifiedTransfers(
  balances: readonly CurrencyBalances[],
): Result<readonly Transfer[], UnbalancedBalances | CurrencyMismatch | AmountOutOfRange> {
  const transfers: Transfer[] = [];
  for (const { currency, balances: members } of balances) {
    let sum = 0n;
    for (const { amount } of members) {
      if (amount.currency !== currency) {
        return err({ code: 'CurrencyMismatch', expected: currency, actual: amount.currency });
      }
      if (!Number.isSafeInteger(amount.minor)) return err({ code: 'AmountOutOfRange' });
      sum += BigInt(amount.minor);
    }
    if (sum !== 0n) return err({ code: 'UnbalancedBalances', currency });
    transfers.push(...settle(members, currency));
  }
  return ok(transfers);
}

/**
 * Trasferimenti non semplificati (PLANNING §9.5): ogni spesa si salda per conto suo (chi ha partecipato
 * paga chi ha pagato), poi i debiti di ogni coppia di membri si compensano. Ognuno paga solo persone con
 * cui ha condiviso delle spese. Ordinati per valuta, poi per chi paga, poi per chi riceve.
 */
export function pairwiseTransfers(ledger: LedgerInput): Result<readonly Transfer[], LedgerError> {
  const effects = ledgerEffects(ledger);
  if (!effects.ok) return effects;

  const debts = new Map<string, PairDebt>();
  for (const { currency, nets } of effects.value) {
    for (const transfer of settle(nets, currency)) {
      if (!addDebt(debts, transfer)) return err({ code: 'AmountOutOfRange' });
    }
  }

  return ok(
    [...debts.values()]
      .filter(({ minor }) => minor !== 0)
      .map(toTransfer)
      .sort(
        (a, b) =>
          compareStrings(a.amount.currency, b.amount.currency) ||
          compareStrings(a.from, b.from) ||
          compareStrings(a.to, b.to),
      ),
  );
}

/** Abbina debitori e creditori di una valuta. Richiede che gli importi sommino a zero. */
function settle(nets: readonly MemberAmount[], currency: CurrencyCode): Transfer[] {
  const debtors = nets
    .filter(({ amount }) => amount.minor < 0)
    .map(({ memberId, amount }) => ({ memberId, remaining: 0 - amount.minor }));
  const creditors = nets
    .filter(({ amount }) => amount.minor > 0)
    .map(({ memberId, amount }) => ({ memberId, remaining: amount.minor }));

  const transfers: Transfer[] = [];
  for (;;) {
    const debtor = largest(debtors);
    const creditor = largest(creditors);
    if (debtor === undefined || creditor === undefined) return transfers;
    const minor = Math.min(debtor.remaining, creditor.remaining);
    transfers.push({ from: debtor.memberId, to: creditor.memberId, amount: { minor, currency } });
    debtor.remaining -= minor;
    creditor.remaining -= minor;
  }
}

/** La posizione aperta più grande; a parità di importo, quella del membro con l'id minore. */
function largest(positions: readonly Position[]): Position | undefined {
  let best: Position | undefined;
  for (const position of positions) {
    if (position.remaining === 0) continue;
    if (
      best === undefined ||
      position.remaining > best.remaining ||
      (position.remaining === best.remaining && position.memberId < best.memberId)
    ) {
      best = position;
    }
  }
  return best;
}

function addDebt(debts: Map<string, PairDebt>, { from, to, amount }: Transfer): boolean {
  const forward = from < to;
  const [first, second] = forward ? [from, to] : [to, from];
  const key = JSON.stringify([amount.currency, first, second]);
  const debt = debts.get(key) ?? { currency: amount.currency, first, second, minor: 0 };
  debt.minor += forward ? amount.minor : 0 - amount.minor;
  debts.set(key, debt);
  return Number.isSafeInteger(debt.minor);
}

function toTransfer({ currency, first, second, minor }: PairDebt): Transfer {
  return minor > 0
    ? { from: first, to: second, amount: { minor, currency } }
    : { from: second, to: first, amount: { minor: 0 - minor, currency } };
}
