import type { Engine } from '@expense/engine';
import type { Language } from '@expense/i18n';
import { Button } from '@expense/ui/components/ui/button';
import { FlaskConicalIcon, SparklesIcon } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { demoTranslator, K } from './i18n';
import { createSampleGroup } from './sample-group';

// Cornice della demo intorno all'app: un avviso in cima e, finché non ci sono gruppi, il pulsante che crea il
// gruppo di esempio. L'app non sa di essere in una demo: la cornice usa solo l'API pubblica dell'engine
// (query e notifiche) e l'indirizzo delle pagine.

export function DemoFrame({
  engine,
  defaultLanguage,
  children,
}: {
  readonly engine: Engine;
  /** Lingua del dispositivo, finché l'utente non ne sceglie una nelle impostazioni (come fa l'app). */
  readonly defaultLanguage: Language;
  readonly children: ReactNode;
}) {
  const subscribe = useCallback((listener: () => void) => engine.subscribe(listener), [engine]);
  const language = useSyncExternalStore(subscribe, () => {
    const settings = engine.query({ type: 'GetSettings' });
    return (settings.ok ? settings.value.language : null) ?? defaultLanguage;
  });
  const noGroups = useSyncExternalStore(subscribe, () => {
    const groups = engine.query({ type: 'ListGroups' });
    return groups.ok && groups.value.length === 0;
  });
  const t = useMemo(() => demoTranslator(language), [language]);
  const [pending, setPending] = useState(false);

  return (
    <>
      <aside
        role="note"
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-muted px-4 py-2 text-center text-xs text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <FlaskConicalIcon className="size-3.5 shrink-0" aria-hidden="true" />
          {t(K.notice)}
        </span>
        {noGroups && (
          <Button
            size="sm"
            variant="outline"
            className="text-foreground"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void createSampleGroup(engine, t)
                .then((result) => {
                  // L'indirizzo della pagina del gruppo, lo stesso dei link dell'app.
                  if (result.ok)
                    window.location.hash = `#/gruppi/${encodeURIComponent(result.value)}`;
                })
                .finally(() => {
                  setPending(false);
                });
            }}
          >
            <SparklesIcon data-icon="inline-start" />
            {t(K.sampleButton)}
          </Button>
        )}
      </aside>
      {children}
    </>
  );
}
