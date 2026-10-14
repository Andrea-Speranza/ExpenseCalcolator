import type { Language } from '@expense/i18n';
import { Alert, AlertDescription, AlertTitle } from '@expense/ui/components/ui/alert';
import { CircleAlertIcon } from 'lucide-react';
import { K, useI18n } from './i18n';
import { StaticI18nProvider } from './i18n/provider';

/** Mostrata dalle shell quando i dati salvati non si possono aprire (es. archivio del browser bloccato). */
export function StartupError({
  error,
  language,
}: {
  readonly error: unknown;
  /** Lingua del dispositivo: le impostazioni non si possono leggere. */
  readonly language: Language;
}) {
  return (
    <StaticI18nProvider language={language}>
      <StartupMessage error={error} />
    </StaticI18nProvider>
  );
}

function StartupMessage({ error }: { readonly error: unknown }) {
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl items-center px-4">
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>{t(K.startup.title)}</AlertTitle>
        <AlertDescription>
          <p>{t(K.startup.hint)}</p>
          <p className="font-mono text-xs">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </AlertDescription>
      </Alert>
    </main>
  );
}
