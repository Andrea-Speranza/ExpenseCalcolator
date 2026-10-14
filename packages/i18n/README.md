# packages/i18n — Lingue, testi e formati

Localizzazione condivisa da UI e CLI ([ADR 0010](../../docs/adr/0010-localizzazione.md)).

```ts
import { createFormatter, createTranslator, keysOf } from '@expense/i18n';
import it from './it.json';
import en from './en.json';

const K = keysOf(it); // K.groups.title === 'groups.title'
const { t, locale } = createTranslator({ it, en }, 'en');
t(K.groups.created, { day: '13 Oct 2026' }); // "Created on 13 Oct 2026"
createFormatter(locale).money({ minor: 12050, currency: 'EUR' }); // "€120.50"
```

- **Lingue** (`LANGUAGES`, `detectLanguage`, `localeOf`): italiano e inglese, le stesse del profilo. La lingua
  iniziale è la prima delle preferenze del dispositivo che l'app conosce, altrimenti l'inglese.
- **Chiavi** (`keysOf`, `KeyOf`): ricavate dal dizionario italiano, senza le desinenze dei plurali. Nel codice
  si scrive `t(K.sezione.testo)`, mai il percorso a mano: il lint lo impedisce.
- **Traduttore** (`createTranslator`): i18next con i dizionari già caricati; segnaposto `{{nome}}`, plurali con
  `count` (`_one`, `_other`), ritorno all'italiano se manca un testo.
- **Formattazione** (`createFormatter`): importi da testo decimale esatto, percentuali, date, ore e nomi delle
  valute con `Intl`, nella lingua scelta.
- **Testi condivisi** (`SHARED`, `describeError`, `describeImport`, `describeFileError`): errori dell'engine ed
  esito dell'importazione di un file, con uno `switch` completo su ogni codice.
- **Controllo dei dizionari** (`dictionaryDifferences`): per i test, confronta una lingua con l'italiano
  (chiavi, segnaposto, forme plurali).

Per aggiungere un testo: si scrive in `it.json` e `en.json` (o nei dizionari della UI), poi si usa la chiave
da `K`. Se manca nell'inglese, il test dei dizionari fallisce.

- **Dipende da:** `engine` (tipi di errori e importi), `schema` (tipo delle lingue), i18next.
- **Usato da:** `ui`; la CLI lo userà quando passerà alle traduzioni.
