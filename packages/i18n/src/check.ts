import type { Resources } from './keys';

// Controllo dei dizionari, per i test: il compilatore verifica le chiavi usate nel codice, ma non può guardare
// dentro i file JSON delle altre lingue. Qui si confrontano con la lingua di base: stesse chiavi e stessi
// segnaposto `{{nome}}`. Le forme plurali possono variare da lingua a lingua, ma devono esserci tutte quelle
// richieste dalle regole della lingua (`Intl.PluralRules`).

const PLURAL = /^(.*)_(zero|one|two|few|many|other)$/;
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/** Differenze tra un dizionario e quello della lingua di base; vuoto se coincidono. */
export function dictionaryDifferences(
  base: Resources,
  other: Resources,
  otherLocale: string,
): string[] {
  const expected = flatten(base);
  const actual = flatten(other);
  const problems: string[] = [];
  const forms = new Intl.PluralRules(otherLocale).resolvedOptions().pluralCategories;

  for (const [key, entry] of expected) {
    const found = actual.get(key);
    if (found === undefined) {
      problems.push(`manca "${key}"`);
      continue;
    }
    if (entry.plural !== found.plural) {
      problems.push(`"${key}" ha il plurale in una lingua sola`);
      continue;
    }
    const missingForms = found.plural ? forms.filter((form) => !found.forms.has(form)) : [];
    if (missingForms.length > 0) {
      problems.push(`"${key}" non ha le forme ${missingForms.join(', ')}`);
    }
    if (!sameSet(entry.placeholders, found.placeholders)) {
      problems.push(
        `"${key}" ha segnaposto diversi: {${[...entry.placeholders].join(', ')}} invece di {${[...found.placeholders].join(', ')}}`,
      );
    }
  }
  for (const key of actual.keys()) {
    if (!expected.has(key)) problems.push(`"${key}" non esiste nella lingua di base`);
  }
  return problems;
}

interface Entry {
  readonly plural: boolean;
  readonly forms: Set<string>;
  readonly placeholders: Set<string>;
}

function flatten(resources: Resources, prefix = '', entries = new Map<string, Entry>()) {
  for (const [name, value] of Object.entries(resources)) {
    if (typeof value !== 'string') {
      flatten(value, `${prefix}${name}.`, entries);
      continue;
    }
    const match = PLURAL.exec(name);
    const key = `${prefix}${match?.[1] ?? name}`;
    const entry = entries.get(key) ?? {
      plural: match !== null,
      forms: new Set(),
      placeholders: new Set(),
    };
    if (match?.[2] !== undefined) entry.forms.add(match[2]);
    for (const [, placeholder] of value.matchAll(PLACEHOLDER)) {
      // Nei plurali `count` può mancare nella forma singolare ("1 modifica"): non conta come differenza.
      if (placeholder !== undefined && !(match !== null && placeholder === 'count')) {
        entry.placeholders.add(placeholder);
      }
    }
    entries.set(key, entry);
  }
  return entries;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}
