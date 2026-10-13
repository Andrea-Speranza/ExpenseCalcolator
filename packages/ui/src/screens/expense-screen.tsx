import type { ExpenseView, GroupView, MemberView } from '@expense/engine';
import { Alert, AlertAction, AlertDescription } from '@expense/ui/components/ui/alert';
import { Button } from '@expense/ui/components/ui/button';
import { Checkbox } from '@expense/ui/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@expense/ui/components/ui/field';
import { Input } from '@expense/ui/components/ui/input';
import { Label } from '@expense/ui/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@expense/ui/components/ui/native-select';
import { Tabs, TabsList, TabsTrigger } from '@expense/ui/components/ui/tabs';
import { Textarea } from '@expense/ui/components/ui/textarea';
import { CircleAlertIcon, Trash2Icon } from 'lucide-react';
import { type SubmitEvent, useId, useState } from 'react';
import { parseAmount } from '../amounts';
import { ConfirmDelete } from '../components/delete-entry';
import { ErrorAlert } from '../components/error-alert';
import { NotFound, PageHeader } from '../components/layout';
import { useCommand, useQuery } from '../engine/store';
import {
  type DraftErrors,
  draftFromExpense,
  type ExpenseDraft,
  expenseChanges,
  expenseMembers,
  exactProgress,
  newDraft,
  percentageProgress,
  readDraft,
  type SplitMethod,
} from '../expense-draft';
import { formatMoney, formatPercentage, today } from '../format';
import { activeMembers, memberNames } from '../group-data';
import { navigate, routeHref } from '../router';

/** Valore della scelta "Più persone" tra i pagatori: non può essere un id (ammette solo [A-Za-z0-9_-]). */
const MULTIPLE_PAYERS = '*';

const METHODS: readonly {
  readonly value: SplitMethod;
  readonly label: string;
  readonly hint: string;
}[] = [
  { value: 'equal', label: 'Uguale', hint: 'Ognuno paga la stessa parte.' },
  { value: 'exact', label: 'Importi', hint: 'Scrivi quanto spetta a ciascuno.' },
  { value: 'percentage', label: '%', hint: 'Scrivi la percentuale di ciascuno.' },
  { value: 'shares', label: 'Quote', hint: 'Chi ha 2 quote paga il doppio di chi ne ha 1.' },
];

function isSplitMethod(value: string): value is SplitMethod {
  return METHODS.some((method) => method.value === value);
}

export function ExpenseScreen({
  groupId,
  expenseId,
}: {
  readonly groupId: string;
  readonly expenseId: string | null;
}) {
  const result = useQuery({ type: 'GetGroup', groupId });
  if (!result.ok) return <NotFound message="Questo gruppo non esiste su questo dispositivo." />;
  const group = result.value;
  if (expenseId === null) return <ExpenseForm key="nuova" group={group} expense={null} />;
  const expense = group.expenses.find((entry) => entry.expenseId === expenseId);
  if (expense === undefined) return <NotFound message="Questa spesa non esiste." />;
  return <ExpenseForm key={expenseId} group={group} expense={expense} />;
}

function ExpenseForm({
  group,
  expense,
}: {
  readonly group: GroupView;
  readonly expense: ExpenseView | null;
}) {
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    expense === null
      ? newDraft(activeMembers(group), group.me, today())
      : draftFromExpense(expense),
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const command = useCommand();
  const id = useId();
  const names = memberNames(group);
  const { groupId } = group;
  const currency = expense?.amounts.total.currency ?? group.baseCurrency;
  // Nel form: chi è attivo e chi compare già nella spesa, anche se nel frattempo è stato archiviato.
  const involved = new Set(expense === null ? [] : expenseMembers(expense.amounts));
  const members = group.members.filter(
    ({ memberId, archived }) => !archived || involved.has(memberId),
  );
  const back = { page: 'group', groupId, tab: 'spese' } as const;

  function update(changes: Partial<ExpenseDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const read = readDraft(draft, members, currency);
    if (!read.ok) {
      setErrors(read.error);
      return;
    }
    setErrors({});
    const { description, date, amounts, category, notes } = read.value;
    if (expense === null) {
      const added = await command.run({
        type: 'AddExpense',
        groupId,
        description,
        date,
        amounts,
        ...(category === null ? {} : { category }),
        ...(notes === null ? {} : { notes }),
      });
      if (added.ok) navigate(back);
      return;
    }
    const changes = expenseChanges(expense, read.value);
    if (changes === null) {
      navigate(back);
      return;
    }
    const updated = await command.run({
      type: 'UpdateExpense',
      groupId,
      expenseId: expense.expenseId,
      base: expense.version,
      changes,
    });
    if (updated.ok) navigate(back);
  }

  async function remove(expenseId: string) {
    const deleted = await command.run({ type: 'DeleteExpense', groupId, expenseId });
    if (deleted.ok) navigate(back);
  }

  return (
    <>
      <PageHeader
        back={{ href: routeHref(back), label: group.name }}
        title={expense === null ? 'Nuova spesa' : 'Modifica spesa'}
      />
      <div className="flex flex-col gap-4">
        {expense?.deleted === true && (
          <Alert>
            <CircleAlertIcon />
            <AlertDescription>Questa spesa è eliminata: non conta nei saldi.</AlertDescription>
            <AlertAction>
              <Button
                size="sm"
                variant="outline"
                disabled={command.pending}
                onClick={() => {
                  void command.run({
                    type: 'RestoreExpense',
                    groupId,
                    expenseId: expense.expenseId,
                  });
                }}
              >
                Ripristina
              </Button>
            </AlertAction>
          </Alert>
        )}
        {expense !== null && expense.conflicts.length > 0 && (
          <Alert>
            <CircleAlertIcon />
            <AlertDescription>
              Questa spesa è stata modificata da più dispositivi nello stesso momento: controlla che
              i dati siano giusti e salva.
            </AlertDescription>
          </Alert>
        )}
        <form
          className="flex flex-col gap-8"
          onSubmit={(event) => {
            void submit(event);
          }}
          noValidate
        >
          <FieldGroup>
            <Field data-invalid={errors.description !== undefined}>
              <FieldLabel htmlFor={`${id}-description`}>Descrizione</FieldLabel>
              <Input
                id={`${id}-description`}
                value={draft.description}
                onChange={(event) => {
                  update({ description: event.target.value });
                }}
                placeholder="Es. Cena al ristorante"
                maxLength={200}
                aria-invalid={errors.description !== undefined}
                autoFocus={expense === null}
              />
              <FieldError>{errors.description}</FieldError>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={errors.amount !== undefined}>
                <FieldLabel htmlFor={`${id}-amount`}>Importo ({currency})</FieldLabel>
                <Input
                  id={`${id}-amount`}
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(event) => {
                    update({ amount: event.target.value });
                  }}
                  placeholder="0,00"
                  aria-invalid={errors.amount !== undefined}
                />
                <FieldError>{errors.amount}</FieldError>
              </Field>
              <Field data-invalid={errors.date !== undefined}>
                <FieldLabel htmlFor={`${id}-date`}>Data</FieldLabel>
                <Input
                  id={`${id}-date`}
                  type="date"
                  value={draft.date}
                  onChange={(event) => {
                    update({ date: event.target.value });
                  }}
                  aria-invalid={errors.date !== undefined}
                />
                <FieldError>{errors.date}</FieldError>
              </Field>
            </div>
          </FieldGroup>

          <Payers
            id={id}
            draft={draft}
            members={members}
            errors={errors}
            currency={currency}
            update={update}
          />
          <SplitEditor
            draft={draft}
            members={members}
            errors={errors}
            currency={currency}
            update={update}
          />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-category`}>Categoria (facoltativa)</FieldLabel>
              <Input
                id={`${id}-category`}
                value={draft.category}
                onChange={(event) => {
                  update({ category: event.target.value });
                }}
                placeholder="Es. Cibo, Trasporti"
                maxLength={60}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-notes`}>Note (facoltative)</FieldLabel>
              <Textarea
                id={`${id}-notes`}
                value={draft.notes}
                onChange={(event) => {
                  update({ notes: event.target.value });
                }}
                maxLength={2000}
              />
            </Field>
          </FieldGroup>

          <ErrorAlert error={command.error} names={names} />
          <div className="flex flex-wrap-reverse items-center gap-3">
            {expense !== null && !expense.deleted && (
              <ConfirmDelete
                texts={{
                  title: `Eliminare «${expense.description}»?`,
                  description:
                    'Non conterà più nei saldi, che verranno ricalcolati. Resterà tra le spese eliminate, da dove potrai ripristinarla.',
                }}
                onConfirm={() => {
                  void remove(expense.expenseId);
                }}
              >
                <Button type="button" variant="destructive" disabled={command.pending}>
                  <Trash2Icon data-icon="inline-start" />
                  Elimina
                </Button>
              </ConfirmDelete>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" asChild>
                <a href={routeHref(back)}>Annulla</a>
              </Button>
              <Button type="submit" disabled={command.pending}>
                Salva
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

interface SectionProps {
  readonly draft: ExpenseDraft;
  readonly members: readonly MemberView[];
  readonly errors: DraftErrors;
  readonly currency: string;
  readonly update: (changes: Partial<ExpenseDraft>) => void;
}

function Payers({
  id,
  draft,
  members,
  errors,
  currency,
  update,
}: SectionProps & { readonly id: string }) {
  return (
    <FieldSet>
      <Field data-invalid={errors.payer !== undefined}>
        <FieldLabel htmlFor={`${id}-payer`}>Chi ha pagato</FieldLabel>
        <NativeSelect
          id={`${id}-payer`}
          className="w-full"
          value={draft.payerMode === 'multiple' ? MULTIPLE_PAYERS : draft.payer}
          onChange={(event) => {
            const { value } = event.target;
            update(
              value === MULTIPLE_PAYERS
                ? { payerMode: 'multiple' }
                : { payerMode: 'single', payer: value },
            );
          }}
          aria-invalid={errors.payer !== undefined}
        >
          {draft.payer === '' && <NativeSelectOption value="">Scegli…</NativeSelectOption>}
          {members.map(({ memberId, name }) => (
            <NativeSelectOption key={memberId} value={memberId}>
              {name}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value={MULTIPLE_PAYERS}>Più persone…</NativeSelectOption>
        </NativeSelect>
        <FieldError>{errors.payer}</FieldError>
      </Field>
      {draft.payerMode === 'multiple' && (
        <MemberInputs
          members={members}
          values={draft.payments}
          errors={errors.payments}
          suffix={currency}
          inputMode="decimal"
          onChange={(memberId, value) => {
            update({ payments: { ...draft.payments, [memberId]: value } });
          }}
        />
      )}
    </FieldSet>
  );
}

function SplitEditor({ draft, members, errors, currency, update }: SectionProps) {
  const method = METHODS.find(({ value }) => value === draft.method);
  return (
    <FieldSet>
      <FieldLegend>Come dividere</FieldLegend>
      <Tabs
        value={draft.method}
        onValueChange={(value) => {
          if (isSplitMethod(value)) update({ method: value });
        }}
      >
        <TabsList className="w-full">
          {METHODS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {method !== undefined && <FieldDescription>{method.hint}</FieldDescription>}
      {draft.method === 'equal' ? (
        <EqualSplit draft={draft} members={members} currency={currency} update={update} />
      ) : (
        <MemberInputs
          members={members}
          values={
            draft.method === 'exact'
              ? draft.exact
              : draft.method === 'percentage'
                ? draft.percentages
                : draft.shares
          }
          errors={errors.members}
          suffix={
            draft.method === 'exact' ? currency : draft.method === 'percentage' ? '%' : 'quote'
          }
          inputMode={draft.method === 'shares' ? 'numeric' : 'decimal'}
          onChange={(memberId, value) => {
            if (draft.method === 'exact') update({ exact: { ...draft.exact, [memberId]: value } });
            else if (draft.method === 'percentage')
              update({ percentages: { ...draft.percentages, [memberId]: value } });
            else update({ shares: { ...draft.shares, [memberId]: value } });
          }}
        />
      )}
      <SplitProgress draft={draft} members={members} currency={currency} />
      {errors.split !== undefined && <FieldError>{errors.split}</FieldError>}
    </FieldSet>
  );
}

function EqualSplit({ draft, members, currency, update }: Omit<SectionProps, 'errors'>) {
  const id = useId();
  const total = parseAmount(draft.amount, currency);
  const count = members.filter(({ memberId }) => draft.included[memberId] === true).length;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y rounded-xl border">
        {members.map(({ memberId, name }) => (
          <li key={memberId} className="flex items-center gap-3 px-4 py-3">
            <Checkbox
              id={`${id}-${memberId}`}
              checked={draft.included[memberId] === true}
              onCheckedChange={(checked) => {
                update({ included: { ...draft.included, [memberId]: checked === true } });
              }}
            />
            <Label htmlFor={`${id}-${memberId}`} className="flex-1">
              {name}
            </Label>
          </li>
        ))}
      </ul>
      {total.ok && count > 0 && (
        <p className="text-sm text-muted-foreground">
          Circa {formatMoney({ minor: Math.round(total.value.minor / count), currency })} a testa.
        </p>
      )}
    </div>
  );
}

function MemberInputs({
  members,
  values,
  errors,
  suffix,
  inputMode,
  onChange,
}: {
  readonly members: readonly MemberView[];
  readonly values: Readonly<Record<string, string>>;
  readonly errors: Readonly<Record<string, string>> | undefined;
  readonly suffix: string;
  readonly inputMode: 'decimal' | 'numeric';
  readonly onChange: (memberId: string, value: string) => void;
}) {
  const id = useId();
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {members.map(({ memberId, name }) => {
        const error = errors?.[memberId];
        return (
          <li key={memberId} className="flex flex-col gap-1 px-4 py-2">
            <div className="flex items-center gap-3">
              <Label htmlFor={`${id}-${memberId}`} className="min-w-0 flex-1 truncate">
                {name}
              </Label>
              <Input
                id={`${id}-${memberId}`}
                className="w-28 text-right"
                inputMode={inputMode}
                value={values[memberId] ?? ''}
                onChange={(event) => {
                  onChange(memberId, event.target.value);
                }}
                aria-invalid={error !== undefined}
              />
              <span className="w-10 text-sm text-muted-foreground">{suffix}</span>
            </div>
            {error !== undefined && <p className="text-sm text-destructive">{error}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** Quanto manca (o avanza) rispetto al totale o al 100%, mentre si scrivono gli importi. */
function SplitProgress({
  draft,
  members,
  currency,
}: {
  readonly draft: ExpenseDraft;
  readonly members: readonly MemberView[];
  readonly currency: string;
}) {
  let text: string | null = null;
  if (draft.method === 'exact') {
    const progress = exactProgress(draft, members, currency);
    if (progress !== null) {
      const missing = progress.total.minor - progress.assigned.minor;
      const amount = formatMoney({ minor: Math.abs(missing), currency });
      text =
        missing === 0
          ? 'Totale raggiunto.'
          : missing > 0
            ? `Mancano ${amount}.`
            : `${amount} in più del totale.`;
    }
  } else if (draft.method === 'percentage') {
    const sum = percentageProgress(draft, members);
    if (sum !== null) {
      const missing = 10_000 - sum;
      text =
        missing === 0
          ? 'Totale: 100%.'
          : missing > 0
            ? `Manca ${formatPercentage(missing)}.`
            : `${formatPercentage(-missing)} oltre il 100%.`;
    }
  }
  return text === null ? null : <p className="text-sm text-muted-foreground">{text}</p>;
}
