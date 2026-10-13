import type { GroupSummary } from '@expense/engine';
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
import { describeError, describeFileError, describeImport } from '../messages';
import { navigate, routeHref } from '../router';
import { ImportGroupButton, type ImportResult } from './import-group';

export function GroupsScreen() {
  const groups = useQuery({ type: 'ListGroups' });
  const [imported, setImported] = useState<ImportResult | null>(null);
  const list = groups.ok ? groups.value : [];
  const active = list.filter(({ archived }) => !archived);
  const archived = list.filter((group) => group.archived);
  const importButton = <ImportGroupButton onResult={setImported} />;

  return (
    <>
      <PageHeader
        title="Gruppi"
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
              <EmptyTitle>Nessun gruppo</EmptyTitle>
              <EmptyDescription>
                Crea un gruppo per una vacanza, la casa o una cena: aggiungi chi partecipa e
                registra le spese. I dati restano su questo dispositivo. Se qualcuno ti ha mandato
                un gruppo esportato, aprilo con «Importa».
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              {importButton}
              <CreateGroupDialog />
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {active.length > 0 && <GroupList groups={active} />}
            {archived.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Archiviati</h2>
                <GroupList groups={archived} />
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Esito dell'importazione; se il gruppo è nuovo su questo dispositivo, invita a dire chi sei. */
function ImportOutcome({ result }: { readonly result: ImportResult }) {
  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertDescription>
          {result.error.code === 'StorageFailed'
            ? describeError(result.error)
            : describeFileError(result.error)}
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
        {describeImport(result.value)}
        {claim && ' Apri il gruppo e, nella scheda Membri, scegli «Sono io» accanto al tuo nome.'}
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
              Apri
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
        <li key={group.groupId}>
          <a
            href={routeHref({ page: 'group', groupId: group.groupId, tab: 'spese' })}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
            <Badge variant="secondary">{group.baseCurrency}</Badge>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function CreateGroupDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          Nuovo gruppo
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
        <DialogTitle>Nuovo gruppo</DialogTitle>
        <DialogDescription>Dopo potrai aggiungere le altre persone.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>Nome del gruppo</FieldLabel>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder="Es. Vacanza in Sicilia"
            maxLength={80}
            required
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-me`}>Il tuo nome</FieldLabel>
          <Input
            id={`${id}-me`}
            value={me}
            onChange={(event) => {
              setMe(event.target.value);
            }}
            maxLength={60}
          />
          <FieldDescription>
            Lascialo vuoto se tieni i conti per altri senza partecipare alle spese.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-currency`}>Valuta</FieldLabel>
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
            Annulla
          </Button>
        </DialogClose>
        <Button type="submit" disabled={command.pending}>
          Crea gruppo
        </Button>
      </DialogFooter>
    </form>
  );
}
