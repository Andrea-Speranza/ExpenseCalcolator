import { createTranslator, type KeyOf, keysOf, type Language, type Translate } from '@expense/i18n';
import en from './locales/en.json';
import it from './locales/it.json';

// Testi della demo, separati da quelli dell'app e con le stesse regole (ADR 0010): dizionari JSON e chiavi
// tipizzate, `t(K.notice)`.

export const DEMO_DICTIONARIES = { it, en } as const;

export const K = keysOf(it);
export type DemoKey = KeyOf<typeof K>;

export function demoTranslator(language: Language): Translate<DemoKey> {
  return createTranslator<DemoKey>(DEMO_DICTIONARIES, language).t;
}
