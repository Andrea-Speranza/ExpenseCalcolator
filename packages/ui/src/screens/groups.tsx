import { type GroupSummary, timeOfHlc } from '@expense/engine';
import { describeError, describeFileError, describeImport } from '@expense/i18n';
import { Alert, AlertAction, AlertDescription } from '@expense/ui/components/ui/alert';
import { Badge } from '@expense/ui/components/ui/badge';
import { Button } from '@expense/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@expense/ui/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@expense/ui/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@expense/ui/components/ui/field';
import { Input } from '@expense/ui/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@expense/ui/components/ui/tabs';
import {
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  PlusIcon,
  UsersIcon,
} from 'lucide-react';
import { type SubmitEvent, useId, useState } from 'react';
import { CurrencySelect } from '../components/currency-select';
import { ErrorAlert } from '../components/error-alert';
import { PageHeader } from '../components/layout';
import { useCommand, useQuery } from '../engine/store';
import { type AccountsStatus, accountsStatus } from '../group-data';
import { K, useI18n } from '../i18n';
import { navigate, routeHref } from '../router';
import { ImportGroupButton, type ImportResult } from './import-group';

export function GroupsScreen({ archived }: { readonly archived: boolean }) {
  const { t } = useI18n();
  const groups = useQuery({ type: 'ListGroups' });
  const [imported, setImported] = useState<ImportResult | null>(null);
  // Dal più recente.
  const list = groups.ok ? [...groups.value].reverse() : [];
  const active = list.filter((group) => !group.archived);
  const archivedGroups = list.filter((group) => group.archived);
  const shown = archived ? archivedGroups : active;
  const importButton = <ImportGroupButton onResult={setImported} />;

  return (
    <>
      <PageHeader
        title={t(K.groups.title)}
        actions={
          list.length > 0 ? (
            <>
              {importButton}
              <CreateGroupDialog />
            </>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-6">
        <ErrorAlert error={groups.ok ? null : groups.error} />
        {imported !== null && <ImportOutcome result={imported} />}
        {list.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>{t(K.groups.empty.title)}</EmptyTitle>
              <EmptyDescription>{t(K.groups.empty.description)}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              {importButton}
              <CreateGroupDialog />
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <Tabs
              value={archived ? 'archived' : 'active'}
              onValueChange={(value) => {
                navigate(
                  { page: value === 'archived' ? 'archivedGroups' : 'groups' },
                  { replace: true },
                );
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="active">
                  {t(K.groups.tabs.active, { total: active.length })}
                </TabsTrigger>
                <TabsTrigger value="archived">
                  {t(K.groups.tabs.archived, { total: archivedGroups.length })}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {shown.length > 0 ? (
              <GroupList groups={shown} />
            ) : (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>
                    {t(archived ? K.groups.noArchived.title : K.groups.noActive.title)}
                  </EmptyTitle>
                  <EmptyDescription>
                    {t(archived ? K.groups.noArchived.description : K.groups.noActive.description)}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Esito dell'importazione; se il gruppo è nuovo su questo dispositivo, invita a dire chi sei. */
function ImportOutcome({ result }: { readonly result: ImportResult }) {
  const i18n = useI18n();
  const { t } = i18n;
  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertDescription>
          {result.error.code === 'StorageFailed'
            ? describeError(i18n, result.error)
            : describeFileError(i18n, result.error)}
        </AlertDescription>
      </Alert>
    );
  }
  const { added, groups } = result.value;
  const [group] = groups;
  const claim = added > 0 && group?.me === null;
  return (
    <Alert>
      <CircleCheckIcon />
      <AlertDescription>
        {describeImport(i18n, result.value)}
        {claim && ` ${t(K.groups.import.claimHint)}`}
      </AlertDescription>
      {group !== undefined && (
        <AlertAction>
          <Button size="sm" variant="outline" asChild>
            <a
              href={routeHref({
                page: 'group',
                groupId: group.groupId,
                tab: claim ? 'membri' : 'spese',
              })}
            >
              {t(K.common.open)}
            </a>
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

function GroupList({ groups }: { readonly groups: readonly GroupSummary[] }) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {groups.map((group) => (
        <GroupRow key={group.groupId} group={group} />
      ))}
    </ul>
  );
}

function GroupRow({ group }: { readonly group: GroupSummary }) {
  const { t, format } = useI18n();
  const balances = useQuery({ type: 'GetBalances', groupId: group.groupId });
  const status = balances.ok ? accountsStatus(balances.value, group.me) : null;
  const created = timeOfHlc(group.createdAt);
  const details = [
    ...(created === null ? [] : [t(K.groups.created, { day: format.moment(created).day })]),
    group.baseCurrency,
  ];
  return (
    <li>
      <a
        href={routeHref({ page: 'group', groupId: group.groupId, tab: 'spese' })}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium">{group.name}</span>
          <span className="text-xs text-muted-foreground">
            {details.join(t(K.common.separator))}
          </span>
        </span>
        {status !== null && <AccountsBadge status={status} />}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </a>
    </li>
  );
}

/** Etichetta colorata con lo stato dei conti e, se i conti sono aperti, la posizione di chi usa l'app. */
function AccountsBadge({ status }: { readonly status: AccountsStatus }) {
  const { t, format } = useI18n();
  switch (status.kind) {
    case 'empty':
      return <Badge variant="outline">{t(K.groups.status.empty)}</Badge>;
    case 'settled':
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <CircleCheckIcon data-icon="inline-start" />
          {t(K.groups.status.settled)}
        </Badge>
      );
    case 'open':
      return (
        <span className="flex flex-col items-end gap-1">
          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
            {t(K.groups.status.open)}
          </Badge>
          {status.mine.length > 0 && (
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {status.mine
                .map((amount) =>
                  amount.minor > 0
                    ? t(K.groups.status.owed, { amount: format.money(amount) })
                    : t(K.groups.status.owe, {
                        amount: format.money({ ...amount, minor: -amount.minor }),
                      }),
                )
                .join(t(K.common.separator))}
            </span>
          )}
        </span>
      );
  }
}

function CreateGroupDialog() {
  const { t } = useI18n();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          {t(K.groups.create.button)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <CreateGroupForm />
      </DialogContent>
    </Dialog>
  );
}

/** Si monta a ogni apertura della finestra: parte sempre dalle impostazioni attuali. */
function CreateGroupForm() {
  const { t } = useI18n();
  const settings = useQuery({ type: 'GetSettings' });
  const defaults = settings.ok ? settings.value : null;
  const [name, setName] = useState('');
  const [me, setMe] = useState(defaults?.displayName ?? '');
  const [currency, setCurrency] = useState<string>(defaults?.defaultCurrency ?? 'EUR');
  const command = useCommand();
  const id = useId();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = await command.run({
      type: 'CreateGroup',
      name,
      baseCurrency: currency,
      me: me.trim() === '' ? null : { name: me },
    });
    if (result.ok) navigate({ page: 'group', groupId: result.value.groupId, tab: 'membri' });
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t(K.groups.create.title)}</DialogTitle>
        <DialogDescription>{t(K.groups.create.description)}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t(K.groups.create.name)}</FieldLabel>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder={t(K.groups.create.namePlaceholder)}
            maxLength={80}
            required
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-me`}>{t(K.groups.create.me)}</FieldLabel>
          <Input
            id={`${id}-me`}
            value={me}
            onChange={(event) => {
              setMe(event.target.value);
            }}
            maxLength={60}
          />
          <FieldDescription>{t(K.groups.create.meHint)}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-currency`}>{t(K.groups.create.currency)}</FieldLabel>
          <CurrencySelect
            id={`${id}-currency`}
            className="w-full"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
            }}
          />
        </Field>
      </FieldGroup>
      <ErrorAlert error={command.error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t(K.common.cancel)}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={command.pending}>
          {t(K.groups.create.submit)}
        </Button>
      </DialogFooter>
    </form>
  );
}
