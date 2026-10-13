# adapters/local-indexeddb — LocalStore su IndexedDB

Salva in locale gli eventi e l'identità del dispositivo (con lo stato del suo orologio), **nella stessa
transazione** ([ADR 0007](../../../docs/adr/0007-salvataggio-e-concorrenza.md), punto 9). Usa lo stesso
codice su web, Windows (WebView2) e Android (System WebView).

```ts
const store = await openIndexedDbStore();
const engine = await openEngine({ store, clock: createSystemClock(), ids: createUlidGenerator() });
```

- **Test:** la suite di contratto della porta `LocalStore` (eseguita anche sul salvataggio in memoria) e un
  test end-to-end che crea un gruppo, chiude, riapre e ritrova gli stessi saldi. IndexedDB è simulato con
  `fake-indexeddb`.
- **Da fare nella shell web:** chiedere lo storage persistente (`navigator.storage.persist()`), così il
  browser non cancella i dati (PLANNING §8.10).

Dettagli: [PLANNING §8.10](../../../docs/PLANNING.md#810-persistenza-locale).
