import { type ExpenseView, type GroupView, type SettlementView, timeOfHlc } from '@expense/engine';
import { Badge } from '@expense/ui/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@expense/ui/components/ui/empty';
import { ToggleGroup, ToggleGroupItem } from '@expense/ui/components/ui/toggle-group';
import { ArrowRightLeftIcon, ReceiptIcon } from 'lucide-react';
import { useState } from 'react';
import { PaidBy } from '../components/paid-by';
import {
  formatDate,
  formatLongDate,
  formatMoment,
  formatMoney,
  formatWhen,
  today,
} from '../format';
import { memberNames, nameOf } from '../group-data';
import type { Names } from '../messages';
import { routeHref } from '../router';

// Storico del gruppo: spese e rimborsi in un solo elenco, nell'ordine in cui sono stati inseriti, con giorno
// e ora. Serve a ricostruire cosa è stato fatto e quando. (Lo storico di ogni singola modifica arriverà con la
// sincronizzazione, Fase 5.)

type Kind = 'all' | 'expenses' | 'settlements';

const KINDS: readonly { readonly value: Kind; readonly label: string }[] = [
  { value: 'all', label: 'Tutto' },
  { value: 'expenses', label: 'Spese' },
  { value: 'settlements', label: 'Rimborsi' },
];

type Entry =
  | { readonly kind: 'expense'; readonly id: string; readonly view: ExpenseView }
  | { readonly kind: 'settlement'; readonly id: string; readonly view: SettlementView };

interface Day {
  /** AAAA-MM-GG nel fuso orario del dispositivo; vuoto se l'ora di inserimento non è nota. */
  readonly day: string;
  readonly entries: Entry[];
}

export function HistoryTab({ group }: { readonly group: GroupView }) {
  const [kind, setKind] = useState<Kind>('all');
  const names = memberNames(group);
  const entries: Entry[] = [
    ...(kind === 'settlements'
      ? []
      : group.expenses.map((view) => ({ kind: 'expense' as const, id: view.expenseId, view }))),
    ...(kind === 'expenses'
      ? []
      : group.settlements.map((view) => ({
          kind: 'settlement' as const,
          id: view.settlementId,
          view,
        }))),
  ].sort((a, b) => (a.view.createdAt < b.view.createdAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-6">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={kind}
        onValueChange={(value) => {
          setKind(KINDS.find((option) => option.value === value)?.value ?? 'all');
        }}
        aria-label="Cosa mostrare"
      >
        {KINDS.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {entries.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Ancora niente</EmptyTitle>
            <EmptyDescription>Qui compariranno spese e rimborsi, dal più recente.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        byDay(entries).map(({ day, entries: dayEntries }) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground first-letter:uppercase">
              {day === '' ? 'Data di inserimento sconosciuta' : formatLongDate(day)}
            </h2>
            <ul className="flex flex-col divide-y rounded-xl border">
              {dayEntries.map((entry) => (
                <HistoryRow key={entry.id} group={group} entry={entry} names={names} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** Raggruppa per giorno di inserimento, mantenendo l'ordine (dal più recente). */
function byDay(entries: readonly Entry[]): Day[] {
  const days: Day[] = [];
  for (const entry of entries) {
    const time = timeOfHlc(entry.view.createdAt);
    const day = time === null ? '' : today(new Date(time));
    const last = days.at(-1);
    if (last?.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}

function HistoryRow({
  group,
  entry,
  names,
}: {
  readonly group: GroupView;
  readonly entry: Entry;
  readonly names: Names;
}) {
  const { view } = entry;
  const created = timeOfHlc(view.createdAt);
  const updated = timeOfHlc(view.version);
  const modified =
    updated !== null && view.version !== view.createdAt ? formatMoment(updated) : null;
  const female = entry.kind === 'expense';
  const content = (
    <>
      <span className="w-11 shrink-0 pt-0.5 text-sm text-muted-foreground tabular-nums">
        {created === null ? '' : formatMoment(created).time}
      </span>
      {entry.kind === 'expense' ? (
        <ReceiptIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-label="Spesa" />
      ) : (
        <ArrowRightLeftIcon
          className="mt-1 size-4 shrink-0 text-muted-foreground"
          aria-label="Rimborso"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-start justify-between gap-3">
          <span className={view.deleted ? 'text-muted-foreground line-through' : undefined}>
            {entry.kind === 'expense'
              ? entry.view.description
              : `${nameOf(names, entry.view.transfer.from)} → ${nameOf(names, entry.view.transfer.to)}`}
          </span>
          <span className="font-medium whitespace-nowrap tabular-nums">
            {formatMoney(
              entry.kind === 'expense' ? entry.view.amounts.total : entry.view.transfer.amount,
            )}
          </span>
        </span>
        <span className="text-sm text-muted-foreground">
          {entry.kind === 'expense' ? (
            <>
              Spesa del {formatWhen(entry.view.date, entry.view.time)} ·{' '}
              <PaidBy expense={entry.view} names={names} me={group.me} />
            </>
          ) : (
            `Rimborso del ${formatDate(entry.view.date)}`
          )}
        </span>
        {(modified !== null || view.deleted) && (
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {view.deleted && <Badge variant="outline">{female ? 'Eliminata' : 'Eliminato'}</Badge>}
            {modified !== null &&
              `${female ? 'Modificata' : 'Modificato'} il ${modified.day} alle ${modified.time}`}
          </span>
        )}
      </span>
    </>
  );
  return (
    <li>
      {entry.kind === 'expense' ? (
        <a
          href={routeHref({ page: 'expense', groupId: group.groupId, expenseId: entry.id })}
          className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
        >
          {content}
        </a>
      ) : (
        <div className="flex gap-3 px-4 py-3">{content}</div>
      )}
    </li>
  );
}
