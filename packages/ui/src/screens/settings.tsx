import type { SettingsView } from '@expense/engine';
import { Button } from '@expense/ui/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@expense/ui/components/ui/field';
import { Input } from '@expense/ui/components/ui/input';
import { type SubmitEvent, useId, useState } from 'react';
import { CurrencySelect } from '../components/currency-select';
import { ErrorAlert } from '../components/error-alert';
import { PageHeader } from '../components/layout';
import { useCommand, useEngine, useQuery } from '../engine/store';
import { routeHref } from '../router';

export function SettingsScreen() {
  const settings = useQuery({ type: 'GetSettings' });
  return (
    <>
      <PageHeader
        back={{ href: routeHref({ page: 'groups' }), label: 'Gruppi' }}
        title="Impostazioni"
      />
      {settings.ok ? (
        <SettingsForm settings={settings.value} />
      ) : (
        <ErrorAlert error={settings.error} />
      )}
      <DeviceInfo />
    </>
  );
}

function SettingsForm({ settings }: { readonly settings: SettingsView }) {
  const [displayName, setDisplayName] = useState(settings.displayName ?? '');
  const [currency, setCurrency] = useState<string>(settings.defaultCurrency);
  const [saved, setSaved] = useState(false);
  const command = useCommand();
  const id = useId();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const name = displayName.trim();
    const result = await command.run({
      type: 'UpdateSettings',
      changes: {
        ...(currency === settings.defaultCurrency ? {} : { defaultCurrency: currency }),
        ...(name === '' || name === settings.displayName ? {} : { displayName: name }),
      },
    });
    setSaved(result.ok || result.error.code === 'NoChanges');
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void submit(event);
      }}
      onChange={() => {
        setSaved(false);
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>Il tuo nome</FieldLabel>
          <Input
            id={`${id}-name`}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            maxLength={60}
          />
          <FieldDescription>Proposto quando crei un nuovo gruppo.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-currency`}>Valuta predefinita</FieldLabel>
          <CurrencySelect
            id={`${id}-currency`}
            className="w-full"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
            }}
          />
          <FieldDescription>Proposta per i nuovi gruppi.</FieldDescription>
        </Field>
      </FieldGroup>
      <ErrorAlert error={command.error?.code === 'NoChanges' ? null : command.error} />
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span role="status" className="text-sm text-muted-foreground">
            Impostazioni salvate.
          </span>
        )}
        <Button type="submit" disabled={command.pending}>
          Salva
        </Button>
      </div>
    </form>
  );
}

function DeviceInfo() {
  const engine = useEngine();
  return (
    <section className="mt-10 flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground">
      <h2 className="font-medium text-foreground">Dati</h2>
      <p>
        I gruppi sono salvati solo su questo dispositivo, nel browser. Non vengono inviati a nessun
        server.
      </p>
      <p>
        Codice del dispositivo: <code className="font-mono text-xs">{engine.deviceId}</code>
      </p>
    </section>
  );
}
