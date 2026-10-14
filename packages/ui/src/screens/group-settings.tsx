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
import { downloadTextFile, safeFileName } from '../download';
import { useCommand, useEngine, useQuery } from '../engine/store';
import { K, useI18n } from '../i18n';
import { routeHref } from '../router';

export function GroupSettingsScreen({ groupId }: { readonly groupId: string }) {
  const { t } = useI18n();
  const result = useQuery({ type: 'GetGroup', groupId });
  if (!result.ok) return <NotFoundPage message={t(K.common.groupNotHere)} />;
  const group = result.value;
  return (
    <>
      <PageHeader
        back={{ href: routeHref({ page: 'group', groupId, tab: 'spese' }), label: group.name }}
        title={t(K.groupSettings.title)}
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
  const { t, format } = useI18n();
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
        <FieldLabel htmlFor={`${id}-name`}>{t(K.groupSettings.name)}</FieldLabel>
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
            {t(K.common.save)}
          </Button>
        </div>
        <FieldDescription>
          {t(K.groupSettings.currency, { currency: format.currency(group.baseCurrency) })}
        </FieldDescription>
      </Field>
      {saved && (
        <p role="status" className="text-sm text-muted-foreground">
          {t(K.groupSettings.saved)}
        </p>
      )}
      <ErrorAlert error={command.error} />
    </form>
  );
}

function ExportGroup({ group }: { readonly group: GroupView }) {
  const { t } = useI18n();
  const engine = useEngine();
  const [error, setError] = useState<NotFound | null>(null);
  return (
    <Section
      title={t(K.groupSettings.export.title)}
      description={t(K.groupSettings.export.description)}
    >
      <Button
        variant="outline"
        className="w-fit"
        onClick={() => {
          const file = exportGroupFile(engine, group.groupId);
          setError(file.ok ? null : file.error);
          if (!file.ok) return;
          const safe = safeFileName(group.name);
          const name = t(K.groupSettings.export.fileName, {
            name: safe === '' ? t(K.groupSettings.export.fallbackName) : safe,
          });
          downloadTextFile(name, serializeExchangeFile(file.value));
        }}
      >
        <DownloadIcon data-icon="inline-start" />
        {t(K.groupSettings.export.button)}
      </Button>
      <ErrorAlert error={error} />
    </Section>
  );
}

function ArchiveGroup({ group }: { readonly group: GroupView }) {
  const { t } = useI18n();
  const command = useCommand();
  return (
    <Section
      title={t(K.groupSettings.archive.title)}
      description={t(
        group.archived ? K.groupSettings.archive.isArchived : K.groupSettings.archive.canArchive,
      )}
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
        {t(group.archived ? K.groupSettings.archive.unarchive : K.groupSettings.archive.archive)}
      </Button>
      <ErrorAlert error={command.error} />
    </Section>
  );
}
