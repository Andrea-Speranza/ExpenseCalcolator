# 0010 — Localizzazione: dizionari JSON, chiavi tipizzate, i18next

- **Stato:** accettata
- **Data:** 2026-10-14

## Contesto

I testi dell'interfaccia erano scritti direttamente nei componenti, solo in italiano. Servono più lingue (prima
italiano e inglese) senza perdere i controlli del compilatore. In particolare non si vogliono chiavi scritte a
mano come stringhe (`t('groups.title')`): un errore di battitura non verrebbe notato.

## Decisione

Una via di mezzo tra i18next e i dizionari tipizzati:

1. **I testi stanno in file JSON**, uno per lingua (`it.json`, `en.json`), nel formato standard di i18next:
   segnaposto `{{nome}}` e plurali con le desinenze `_one`/`_other`.
2. **Le chiavi si ricavano dal dizionario italiano.** `keysOf(it)` restituisce un oggetto con la stessa forma,
   in cui ogni testo è sostituito dal proprio percorso: `K.groups.title` vale `'groups.title'`. Il codice usa
   solo queste proprietà (`t(K.groups.title)`), come un enum: autocompletamento, rinomina sicura, e una chiave
   inesistente non compila.
3. **A runtime traduce i18next**: plurali con `Intl.PluralRules`, segnaposto, ritorno all'italiano se manca
   una traduzione. I dizionari sono inclusi nell'app, quindi è pronto subito e funziona offline.
4. **Un test confronta le lingue.** Il compilatore non può controllare cosa c'è dentro un JSON: un test
   verifica che l'inglese abbia le stesse chiavi e gli stessi segnaposto dell'italiano, e tutte le forme
   plurali richieste dalla lingua.
5. **I messaggi tra componenti non sono testi.** L'engine restituisce codici e dati; ora lo fa anche la logica
   della UI (errori dei form, parte di ciascuno in una spesa). Il testo si compone solo al momento di mostrarlo,
   con uno `switch` completo sui codici: un codice nuovo senza testo non compila.
6. **Il lint vieta i testi scritti nel codice**: testo nel JSX, attributi come `aria-label` e `placeholder`, e
   `t()` chiamato con una stringa invece che con una chiave di `K`.
7. **Pacchetto condiviso `@expense/i18n`**: lingue, chiavi, traduttore, formattazione con `Intl` e i testi
   comuni a UI e CLI (errori dell'engine, esito dell'importazione). UI e CLI aggiungono i propri dizionari.
8. **Lingua:** quella scelta nelle impostazioni del profilo; finché non c'è, quella del dispositivo, se l'app
   la conosce, altrimenti l'inglese.

## Conseguenze

- **Vantaggi:**
  - nessuna chiave scritta a mano: errori di battitura impossibili;
  - formato JSON standard, leggibile dagli strumenti di traduzione;
  - plurali e segnaposto gestiti da una libreria diffusa.
- **Costi:**
  - una dipendenza in più (i18next, nessuna dipendenza sua);
  - i segnaposto delle lingue diverse dall'italiano li controlla un test, non il compilatore;
  - le chiavi che finiscono con `_one`, `_other` e simili sono riservate ai plurali.

Restano da fare: la CLI, che oggi resta in italiano, e i messaggi di validazione di Zod, che la UI non mostra
più (indica solo i campi non validi).

## Alternative considerate

| Alternativa                            | Perché no                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| i18next con le chiavi tipizzate        | Le chiavi restano stringhe nel codice (`t('groups.title')`)                          |
| Dizionari solo in TypeScript           | Controllo totale anche dei parametri, ma niente JSON per gli strumenti di traduzione |
| Paraglide (funzioni generate dai JSON) | Un passo di compilazione in più e codice generato da tenere allineato                |
