import {
  exportGroupFile,
  type GroupView,
  type NotFound,
  serializeExchangeFile,
} from '@expense/engine';
import { Button } from '@expense/ui/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@expense/ui/components/ui/field';
import { Input } from '@expense/ui/components/ui/input';
import { ArchiveIcon, ArchiveRestoreIcon, DownloadIcon } from 'lucide-react';
import { type ReactNode, type SubmitEvent, useId, useState } from 'react';
import { ErrorAlert } from '../components/error-alert';
import { NotFound as NotFoundPage, PageHeader } from '../components/layout';
import { downloadTextFile, exportFileName } from '../download';
import { useCommand, useEngine, useQuery } from '../engine/store';
import { currencyLabel } from '../format';
import { routeHref } from '../router';

export function GroupSettingsScreen({ groupId }: { readonly groupId: string }) {
  const result = useQuery({ type: 'GetGroup', groupId });
  if (!result.ok) return <NotFoundPage message="Questo gruppo non esiste su questo dispositivo." />;
  const group = result.value;
  return (
    <>
      <PageHeader
        back={{ href: routeHref({ page: 'group', groupId, tab: 'spese' }), label: group.name }}
        title="Impostazioni del gruppo"
      />
      <div className="flex flex-col gap-10">
        <RenameGroupForm group={group} />
        <ExportGroup group={group} />
        <ArchiveGroup group={group} />
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function RenameGroupForm({ group }: { readonly group: GroupView }) {
  const [name, setName] = useState(group.name);
  const [saved, setSaved] = useState(false);
  const command = useCommand();
  const id = useId();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (name.trim() === group.name) {
      setSaved(true);
      return;
    }
    const result = await command.run({
      type: 'UpdateGroup',
      groupId: group.groupId,
      base: group.version,
      changes: { name },
    });
    setSaved(result.ok);
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Nome del gruppo</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            maxLength={80}
            required
          />
          <Button type="submit" disabled={command.pending}>
            Salva
          </Button>
        </div>
        <FieldDescription>
          Valuta: {currencyLabel(group.baseCurrency)}. Non si può cambiare: le spese registrate sono
          in questa valuta.
        </FieldDescription>
      </Field>
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          Nome salvato.
        </p>
      )}
      <ErrorAlert error={command.error} />
    </form>
  );
}

function ExportGroup({ group }: { readonly group: GroupView }) {
  const engine = useEngine();
  const [error, setError] = useState<NotFound | null>(null);
  return (
    <Section
      title="Esporta"
      description="Salva un file con tutto il gruppo: spese, rimborsi, membri e modifiche. Serve come copia di sicurezza, o per passare il gruppo a un altro dispositivo o a un’altra persona, che lo apre con «Importa» nell’elenco dei gruppi. Importarlo più volte non crea doppioni: arrivano solo le novità."
    >
      <Button
        variant="outline"
        className="w-fit"
        onClick={() => {
          const file = exportGroupFile(engine, group.groupId);
          setError(file.ok ? null : file.error);
          if (file.ok)
            downloadTextFile(exportFileName(group.name), serializeExchangeFile(file.value));
        }}
      >
        <DownloadIcon data-icon="inline-start" />
        Esporta il gruppo
      </Button>
      <ErrorAlert error={error} />
    </Section>
  );
}

function ArchiveGroup({ group }: { readonly group: GroupView }) {
  const command = useCommand();
  return (
    <Section
      title="Archivio"
      description={
        group.archived
          ? 'Il gruppo è archiviato: resta consultabile e modificabile, in fondo all’elenco dei gruppi.'
          : 'Quando il gruppo è concluso puoi archiviarlo: resta consultabile, in fondo all’elenco dei gruppi.'
      }
    >
      <Button
        variant="outline"
        className="w-fit"
        disabled={command.pending}
        onClick={() => {
          void command.run({
            type: 'UpdateGroup',
            groupId: group.groupId,
            base: group.version,
            changes: { archived: !group.archived },
          });
        }}
      >
        {group.archived ? (
          <ArchiveRestoreIcon data-icon="inline-start" />
        ) : (
          <ArchiveIcon data-icon="inline-start" />
        )}
        {group.archived ? 'Togli dall’archivio' : 'Archivia il gruppo'}
      </Button>
      <ErrorAlert error={command.error} />
    </Section>
  );
}
