import type { ExpenseView, GroupView, Money } from '@expense/engine';
import { Badge } from '@expense/ui/components/ui/badge';
import { Button } from '@expense/ui/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@expense/ui/components/ui/empty';
import { ChevronRightIcon, PlusIcon, ReceiptIcon } from 'lucide-react';
import { formatDate, formatMoney } from '../format';
import { activeMembers, memberNames, nameOf, newestFirst } from '../group-data';
import type { Names } from '../messages';
import { routeHref } from '../router';

export function ExpensesTab({ group }: { readonly group: GroupView }) {
  const names = memberNames(group);
  const expenses = newestFirst(group.expenses.filter(({ deleted }) => !deleted));
  const deleted = newestFirst(group.expenses.filter((expense) => expense.deleted));
  const newExpense = routeHref({ page: 'expense', groupId: group.groupId, expenseId: null });

  if (activeMembers(group).length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Prima aggiungi chi partecipa</EmptyTitle>
          <EmptyDescription>Le spese si dividono tra i membri del gruppo.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <a href={routeHref({ page: 'group', groupId: group.groupId, tab: 'membri' })}>
              Aggiungi membri
            </a>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Totals expenses={expenses} />
        <Button asChild>
          <a href={newExpense}>
            <PlusIcon data-icon="inline-start" />
            Nuova spesa
          </a>
        </Button>
      </div>
      {expenses.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptIcon />
            </EmptyMedia>
            <EmptyTitle>Nessuna spesa</EmptyTitle>
            <EmptyDescription>Registra la prima spesa del gruppo.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ExpenseList group={group} expenses={expenses} names={names} />
      )}
      {deleted.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Eliminate</h2>
          <ExpenseList group={group} expenses={deleted} names={names} />
        </section>
      )}
    </div>
  );
}

/** Totale delle spese, per valuta. */
function Totals({ expenses }: { readonly expenses: readonly ExpenseView[] }) {
  const totals = new Map<string, number>();
  for (const { amounts } of expenses) {
    const { currency, minor } = amounts.total;
    totals.set(currency, (totals.get(currency) ?? 0) + minor);
  }
  const amounts: Money[] = [...totals].map(([currency, minor]) => ({ currency, minor }));
  return (
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">Totale spese</span>
      <span className="font-heading text-xl font-semibold tabular-nums">
        {amounts.length === 0 ? '—' : amounts.map((amount) => formatMoney(amount)).join(' · ')}
      </span>
    </div>
  );
}

function ExpenseList({
  group,
  expenses,
  names,
}: {
  readonly group: GroupView;
  readonly expenses: readonly ExpenseView[];
  readonly names: Names;
}) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {expenses.map((expense) => (
        <li key={expense.expenseId}>
          <a
            href={routeHref({
              page: 'expense',
              groupId: group.groupId,
              expenseId: expense.expenseId,
            })}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={
                  expense.deleted
                    ? 'truncate font-medium text-muted-foreground line-through'
                    : 'truncate font-medium'
                }
              >
                {expense.description}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {formatDate(expense.date)} · {payers(expense, names)}
              </span>
            </div>
            {expense.conflicts.length > 0 && <Badge variant="outline">Da controllare</Badge>}
            <span className="font-medium tabular-nums">{formatMoney(expense.amounts.total)}</span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function payers(expense: ExpenseView, names: Names): string {
  const ids = expense.amounts.paidBy.map(({ memberId }) => memberId);
  const [first] = ids;
  if (first === undefined) return 'nessun pagatore';
  return ids.length === 1
    ? `pagato da ${nameOf(names, first)}`
    : `pagato da ${ids.map((id) => nameOf(names, id)).join(', ')}`;
}
