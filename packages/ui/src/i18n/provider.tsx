import type { Language } from '@expense/i18n';
import { type ReactNode, useEffect, useMemo } from 'react';
import { useQuery } from '../engine/store';
import { createUiI18n, I18nContext } from './index';

/**
 * Lingua dell'app: quella scelta nelle impostazioni o, finché non c'è, quella proposta dalla shell (di solito
 * la lingua del dispositivo). Cambia subito quando l'utente la sceglie.
 */
export function I18nProvider({
  fallback,
  children,
}: {
  readonly fallback: Language;
  readonly children: ReactNode;
}) {
  const settings = useQuery({ type: 'GetSettings' });
  const language = (settings.ok ? settings.value.language : null) ?? fallback;
  const i18n = useMemo(() => createUiI18n(language), [language]);
  useEffect(() => {
    // Per i lettori di schermo e la sillabazione: la pagina dichiara la lingua in cui è scritta.
    document.documentElement.lang = language;
  }, [language]);
  return <I18nContext value={i18n}>{children}</I18nContext>;
}

/** Per ciò che sta fuori dall'engine (es. errore all'avvio): solo la lingua indicata. */
export function StaticI18nProvider({
  language,
  children,
}: {
  readonly language: Language;
  readonly children: ReactNode;
}) {
  const i18n = useMemo(() => createUiI18n(language), [language]);
  return <I18nContext value={i18n}>{children}</I18nContext>;
}
