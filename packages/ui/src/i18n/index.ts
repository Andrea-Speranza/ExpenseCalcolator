import {
  createFormatter,
  createTranslator,
  type Formatter,
  type KeyOf,
  keysOf,
  type Language,
  SHARED_DICTIONARIES,
  type SharedKey,
  type Translate,
} from '@expense/i18n';
import { createContext, useContext } from 'react';
import en from './en.json';
import it from './it.json';

// Testi della UI (ADR 0010). I dizionari sono in it.json ed en.json; nel codice si usano solo le chiavi di `K`,
// ricavate dal dizionario italiano: `t(K.groups.title)`. Una chiave sbagliata non compila; un test verifica che
// l'inglese abbia gli stessi testi e gli stessi segnaposto. I testi condivisi con la CLI (errori dell'engine,
// importazione) sono in @expense/i18n, con le chiavi `SHARED`.

/** Dizionari completi della UI: testi propri più quelli condivisi. */
export const UI_DICTIONARIES = {
  it: { ...SHARED_DICTIONARIES.it, ...it },
  en: { ...SHARED_DICTIONARIES.en, ...en },
} as const;

/** Dizionari propri della UI, per i test di confronto tra lingue. */
export const UI_ONLY_DICTIONARIES = { it, en } as const;

/** Chiavi dei testi della UI (es. `K.groups.title`). */
export const K = keysOf(it);
export type UiKey = KeyOf<typeof K>;

/** Lingua attiva: traduzione e formattazione di importi e date. */
export interface UiI18n {
  readonly language: Language;
  readonly t: Translate<UiKey | SharedKey>;
  readonly format: Formatter;
}

export function createUiI18n(language: Language): UiI18n {
  const { t, locale } = createTranslator<UiKey | SharedKey>(UI_DICTIONARIES, language);
  return { language, t, format: createFormatter(locale) };
}

export const I18nContext = createContext<UiI18n | null>(null);

export function useI18n(): UiI18n {
  const i18n = useContext(I18nContext);
  if (i18n === null) throw new Error('Manca I18nProvider sopra questo componente.');
  return i18n;
}
