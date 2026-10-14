// API pubblica di @expense/i18n (ADR 0010): lingue, chiavi tipizzate ricavate dai dizionari JSON, traduttore
// (i18next), formattazione con Intl e testi condivisi da UI e CLI.
export { dictionaryDifferences } from './check';
export { createFormatter } from './format';
export type { Formatter } from './format';
export { keysOf } from './keys';
export type { KeyOf, Keys, Resources } from './keys';
export { BASE_LANGUAGE, detectLanguage, LANGUAGES, localeOf } from './languages';
export type { Language } from './languages';
export {
  describeError,
  describeFileError,
  describeImport,
  describeStorageFailed,
  SHARED,
  SHARED_DICTIONARIES,
} from './messages';
export type { Localized, Names, SharedKey } from './messages';
export { createTranslator } from './translator';
export type { Params, Translate, Translator } from './translator';
