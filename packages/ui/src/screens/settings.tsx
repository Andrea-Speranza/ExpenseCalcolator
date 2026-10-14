import type { SettingsView } from '@expense/engine';
import { type Language, LANGUAGES } from '@expense/i18n';
import { Button } from '@expense/ui/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@expense/ui/components/ui/field';
import { Input } from '@expense/ui/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@expense/ui/components/ui/native-select';
import { type SubmitEvent, useId, useState } from 'react';
import { CurrencySelect } from '../components/currency-select';
import { ErrorAlert } from '../components/error-alert';
import { PageHeader } from '../components/layout';
import { useCommand, useEngine, useQuery } from '../engine/store';
import { K, useI18n } from '../i18n';
import { routeHref } from '../router';

export function SettingsScreen({ version }: { readonly version: string }) {
  const { t } = useI18n();
  const settings = useQuery({ type: 'GetSettings' });
  return (
    <>
      <PageHeader
        back={{ href: routeHref({ page: 'groups' }), label: t(K.common.groups) }}
        title={t(K.settings.title)}
      />
      {settings.ok ? (
        <SettingsForm settings={settings.value} />
      ) : (
        <ErrorAlert error={settings.error} />
      )}
      <DeviceInfo version={version} />
    </>
  );
}

function isLanguage(value: string): value is Language {
  return LANGUAGES.some((language) => language === value);
}

function SettingsForm({ settings }: { readonly settings: SettingsView }) {
  const { t, language: current } = useI18n();
  const [displayName, setDisplayName] = useState(settings.displayName ?? '');
  const [currency, setCurrency] = useState<string>(settings.defaultCurrency);
  // Finché l'utente non sceglie, si propone la lingua che l'app sta già usando (quella del dispositivo).
  const [language, setLanguage] = useState<Language>(settings.language ?? current);
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
        ...(language === settings.language ? {} : { language }),
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
          <FieldLabel htmlFor={`${id}-name`}>{t(K.settings.name)}</FieldLabel>
          <Input
            id={`${id}-name`}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            maxLength={60}
          />
          <FieldDescription>{t(K.settings.nameHint)}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-currency`}>{t(K.settings.currency)}</FieldLabel>
          <CurrencySelect
            id={`${id}-currency`}
            className="w-full"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
            }}
          />
          <FieldDescription>{t(K.settings.currencyHint)}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-language`}>{t(K.settings.language)}</FieldLabel>
          <NativeSelect
            id={`${id}-language`}
            className="w-full"
            value={language}
            onChange={(event) => {
              if (isLanguage(event.target.value)) setLanguage(event.target.value);
            }}
          >
            {LANGUAGES.map((option) => (
              <NativeSelectOption key={option} value={option} lang={option}>
                {t(K.settings.languages[option])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {settings.language === null && (
            <FieldDescription>{t(K.settings.languageHint)}</FieldDescription>
          )}
        </Field>
      </FieldGroup>
      <ErrorAlert error={command.error?.code === 'NoChanges' ? null : command.error} />
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span role="status" className="text-sm text-muted-foreground">
            {t(K.settings.saved)}
          </span>
        )}
        <Button type="submit" disabled={command.pending}>
          {t(K.common.save)}
        </Button>
      </div>
    </form>
  );
}

function DeviceInfo({ version }: { readonly version: string }) {
  const { t } = useI18n();
  const engine = useEngine();
  return (
    <section className="mt-10 flex flex-col gap-2 border-t pt-6 text-sm text-muted-foreground">
      <h2 className="font-medium text-foreground">{t(K.settings.data.title)}</h2>
      <p>{t(K.settings.data.local)}</p>
      <p>
        {t(K.settings.data.device)} <code className="font-mono text-xs">{engine.deviceId}</code>
      </p>
      <p>
        {t(K.settings.data.version)} <code className="font-mono text-xs">{version}</code>
      </p>
    </section>
  );
}
