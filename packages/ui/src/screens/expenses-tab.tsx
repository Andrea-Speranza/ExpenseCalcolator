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
import { ToggleGroup, ToggleGroupItem } from '@expense/ui/components/ui/toggle-group';
import { PlusIcon, ReceiptIcon } from 'lucide-react';
import { useState } from 'react';
import { DeleteOrRestoreButton } from '../components/delete-entry';
import { ErrorAlert } from '../components/error-alert';
import { PaidBy } from '../components/paid-by';
import { SplitTags } from '../components/split-tags';
import { useCommand } from '../engine/store';
import { formatMoney, formatWhen, lastChange } from '../format';
import {
  activeMembers,
  type ExpenseFilter,
  matchesFilter,
  memberNames,
  newestFirst,
} from '../group-data';
import type { Names } from '../messages';
import { routeHref } from '../router';

const FILTERS: readonly { readonly value: ExpenseFilter; readonly label: string }[] = [
  { value: 'all', label: 'Tutte' },
  { value: 'paidByMe', label: 'Pagate da me' },
  { value: 'paidForMe', label: 'Pagate per me' },
];

function isFilter(value: string): value is ExpenseFilter {
  return FILTERS.some((filter) => filter.value === value);
}

export function ExpensesTab({ group }: { readonly group: GroupView }) {
  const [filter, setFilter] = useState<ExpenseFilter>('all');
  const names = memberNames(group);
  const visible = group.expenses.filter((expense) => matchesFilter(expense, filter, group.me));
  const expenses = newestFirst(visible.filter(({ deleted }) => !deleted));
  const deleted = newestFirst(visible.filter((expense) => expense.deleted));
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
        <Totals expenses={expenses} filter={filter} me={group.me} />
        <Button asChild>
          <a href={newExpense}>
            <PlusIcon data-icon="inline-start" />
            Nuova spesa
          </a>
        </Button>
      </div>
      {group.me !== null && group.expenses.length > 0 && (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(value) => {
            // Un nuovo clic sul filtro attivo lo deseleziona: si torna a "Tutte".
            setFilter(isFilter(value) ? value : 'all');
          }}
          aria-label="Filtra le spese"
          className="flex-wrap"
        >
          {FILTERS.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {expenses.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptIcon />
            </EmptyMedia>
            <EmptyTitle>
              {filter === 'all' ? 'Nessuna spesa' : 'Nessuna spesa con questo filtro'}
            </EmptyTitle>
            {filter === 'all' && (
              <EmptyDescription>Registra la prima spesa del gruppo.</EmptyDescription>
            )}
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

/** Totale delle spese mostrate, per valuta; con "Pagate da me", quanto ho pagato io. */
function Totals({
  expenses,
  filter,
  me,
}: {
  readonly expenses: readonly ExpenseView[];
  readonly filter: ExpenseFilter;
  readonly me: string | null;
}) {
  const totals = new Map<string, number>();
  const add = ({ currency, minor }: Money) => {
    totals.set(currency, (totals.get(currency) ?? 0) + minor);
  };
  for (const { amounts } of expenses) {
    if (filter === 'paidByMe') {
      for (const { memberId, amount } of amounts.paidBy) if (memberId === me) add(amount);
    } else {
      add(amounts.total);
    }
  }
  const amounts: Money[] = [...totals].map(([currency, minor]) => ({ currency, minor }));
  const label =
    filter === 'all'
      ? 'Totale spese'
      : filter === 'paidByMe'
        ? 'Hai pagato'
        : 'Totale di queste spese';
  return (
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">{label}</span>
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
        <ExpenseRow key={expense.expenseId} group={group} expense={expense} names={names} />
      ))}
    </ul>
  );
}

function ExpenseRow({
  group,
  expense,
  names,
}: {
  readonly group: GroupView;
  readonly expense: ExpenseView;
  readonly names: Names;
}) {
  const command = useCommand();
  const { groupId } = group;
  const { expenseId, deleted } = expense;
  return (
    <li className="flex flex-col gap-1 p-1">
      <div className="flex items-start gap-1">
        <a
          href={routeHref({ page: 'expense', groupId, expenseId })}
          className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
        >
          <span className="flex items-start justify-between gap-3">
            <span
              className={deleted ? 'font-medium text-muted-foreground line-through' : 'font-medium'}
            >
              {expense.description}
            </span>
            <span className="font-medium whitespace-nowrap tabular-nums">
              {formatMoney(expense.amounts.total)}
            </span>
          </span>
          <span className="text-sm text-muted-foreground">
            {formatWhen(expense.date, expense.time)} ·{' '}
            <PaidBy expense={expense} names={names} me={group.me} />
          </span>
          <SplitTags split={expense.amounts.split} names={names} me={group.me} />
          <span className="text-xs text-muted-foreground">{lastChange(expense)}</span>
          {expense.conflicts.length > 0 && (
            <Badge variant="outline">Modificata da più dispositivi: da controllare</Badge>
          )}
        </a>
        <div className="pt-1.5">
          <DeleteOrRestoreButton
            deleted={deleted}
            label={`la spesa «${expense.description}»`}
            texts={{
              title: `Eliminare «${expense.description}»?`,
              description:
                'Non conterà più nei saldi, che verranno ricalcolati. Resterà tra le spese eliminate, da dove potrai ripristinarla.',
            }}
            disabled={command.pending}
            onDelete={() => {
              void command.run({ type: 'DeleteExpense', groupId, expenseId });
            }}
            onRestore={() => {
              void command.run({ type: 'RestoreExpense', groupId, expenseId });
            }}
          />
        </div>
      </div>
      <ErrorAlert error={command.error} names={names} />
    </li>
  );
}
