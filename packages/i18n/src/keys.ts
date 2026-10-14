// Chiavi dei testi ricavate dal dizionario della lingua di base (ADR 0010). `keysOf(it)` restituisce un oggetto
// con la stessa forma del dizionario, in cui ogni testo è sostituito dal proprio percorso:
//   keysOf({ groups: { title: 'Gruppi' } }).groups.title === 'groups.title'
// Il codice usa queste proprietà invece di scrivere i percorsi a mano: una chiave sbagliata non compila.

/** Desinenze dei plurali di i18next (`people_one`, `people_other`): la chiave da usare è `people`. */
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type WithoutPlural<K extends string> = K extends `${infer Base}_${PluralSuffix}` ? Base : K;
const PLURAL_SUFFIX = /_(?:zero|one|two|few|many|other)$/;

/** Un dizionario: testi, oppure sezioni che contengono altri testi. */
export interface Resources {
  readonly [key: string]: string | Resources;
}

export type Keys<T, Prefix extends string = ''> = {
  readonly [K in keyof T & string as WithoutPlural<K>]: T[K] extends string
    ? `${Prefix}${WithoutPlural<K>}`
    : Keys<T[K], `${Prefix}${K}.`>;
};

/** Tutte le chiavi di un oggetto di chiavi, come unione di percorsi (es. `'groups.title' | …`). */
export type KeyOf<T> = T extends string ? T : { [K in keyof T]: KeyOf<T[K]> }[keyof T];

export function keysOf<T extends Resources>(resources: T): Keys<T> {
  return collect(resources, '') as Keys<T>;
}

function collect(resources: Resources, prefix: string): Record<string, unknown> {
  const keys: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(resources)) {
    const key = name.replace(PLURAL_SUFFIX, '');
    keys[key] = typeof value === 'string' ? `${prefix}${key}` : collect(value, `${prefix}${name}.`);
  }
  return keys;
}
