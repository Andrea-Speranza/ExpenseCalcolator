import i18next from 'i18next';
import type { Resources } from './keys';
import { BASE_LANGUAGE, type Language, localeOf } from './languages';

// Traduzione con i18next: segnaposto `{{nome}}`, plurali con `count` (`_one`, `_other`, …) e lingua di riserva.
// I dizionari arrivano già caricati (nessuna rete), quindi il traduttore è pronto subito.

/** Valori da inserire nei segnaposto; `count` sceglie anche la forma plurale. */
export type Params = Readonly<Record<string, string | number>>;

/** Funzione di traduzione che accetta solo le chiavi indicate (di solito prese da `keysOf`). */
export type Translate<Key extends string = string> = (key: Key, params?: Params) => string;

export interface Translator<Key extends string = string> {
  readonly language: Language;
  /** Impostazioni regionali per `Intl` (es. "it-IT"). */
  readonly locale: string;
  readonly t: Translate<Key>;
}

export function createTranslator<Key extends string>(
  dictionaries: Readonly<Record<Language, Resources>>,
  language: Language,
): Translator<Key> {
  const instance = i18next.createInstance();
  void instance.init({
    lng: language,
    fallbackLng: BASE_LANGUAGE,
    resources: {
      it: { translation: dictionaries.it },
      en: { translation: dictionaries.en },
    },
    initAsync: false,
    // React e il terminale mostrano il testo così com'è: nessun escape HTML.
    interpolation: { escapeValue: false },
  });
  return {
    language,
    locale: localeOf(language),
    t: (key, params) => instance.t(key, params ?? {}),
  };
}
