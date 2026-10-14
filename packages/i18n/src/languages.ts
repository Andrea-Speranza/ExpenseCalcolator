import type { Language } from '@expense/schema';

// Lingue dell'interfaccia (ADR 0010). Sono le stesse del profilo (`LanguageSchema`): un test lo verifica.

export type { Language };

export const LANGUAGES = ['it', 'en'] as const satisfies readonly Language[];

/** Lingua di riserva: se una traduzione manca, si mostra il testo italiano. */
export const BASE_LANGUAGE: Language = 'it';

/** Impostazioni regionali per `Intl`: formato di importi, date e ore. */
const LOCALES: Readonly<Record<Language, string>> = { it: 'it-IT', en: 'en-GB' };

export function localeOf(language: Language): string {
  return LOCALES[language];
}

/**
 * Lingua iniziale dalle preferenze del dispositivo (es. `navigator.languages`): la prima che l'app conosce,
 * altrimenti l'inglese, che è la lingua più comprensibile per chi non parla italiano.
 */
export function detectLanguage(preferences: readonly string[]): Language {
  for (const preference of preferences) {
    const code = preference.toLowerCase().split('-')[0];
    const known = LANGUAGES.find((language) => language === code);
    if (known !== undefined) return known;
  }
  return 'en';
}
