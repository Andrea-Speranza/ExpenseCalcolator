# 0002 — Framework UI: React + Vite

- **Stato:** accettata
- **Data:** 2026-10-12

## Contesto

Il linguaggio è TypeScript ([ADR 0001](0001-linguaggio-typescript.md)). La UI è una SPA statica servita dalla
PWA e dalle shell Tauri, e deve funzionare bene sia su schermi touch piccoli sia su desktop.

I candidati sono React, Svelte 5, Vue e Angular. Si conoscono tutti abbastanza bene da non pesare sulla scelta.

## Decisione

React con Vite, in TypeScript.

## Motivazioni

1. **Ecosistema per mobile e desktop.** Ha la scelta più ampia di librerie di componenti: sia con aspetto
   nativo Android/iOS (Ionic React) sia headless con un design proprio (es. Radix). Lo stesso vale per gesture,
   liste lunghe e form.
2. **Via di fuga nativa.** Se su mobile la WebView non bastasse, React Native riusa lo stesso `engine`, gli
   stessi pattern e le stesse conoscenze. Nessun altro framework web ha un equivalente altrettanto maturo.
3. **Integrazione con l'engine.** La UI legge lo stato tramite `engine.subscribe`, che in React si collega
   direttamente con `useSyncExternalStore`, senza librerie di state management in più.
4. **Strumenti maturi:**
   - Vite e vite-plugin-pwa per la build e la PWA;
   - Testing Library e Playwright per i test;
   - template ufficiali React sia per Tauri sia per Capacitor.

React pesa qualche decina di KB in più rispetto a Svelte. È una differenza irrilevante per un'app caricata da file locali.

## Conseguenze

- La UI non ha logica di dominio: chiama i comandi e le query di `engine` e si limita a mostrare i risultati.
- Restano da decidere in Fase 3 la libreria di componenti (D8) e il router.

**Aggiornamento (2026-10-13, Fase 3):**

- libreria di componenti: shadcn/ui con Tailwind CSS ([ADR 0008](0008-componenti-ui-shadcn.md));
- router: nessuna libreria, una navigazione con l'hash dell'indirizzo scritta in `packages/ui`;
- PWA (vite-plugin-pwa) rimandata, perché la web app per ora non si pubblica online
  ([ADR 0009](0009-distribuzione-locale.md)).

## Alternative considerate

| Framework | Perché no                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| Svelte 5  | Più leggero e con meno boilerplate, ma ha un ecosistema più piccolo e nessuna via di fuga nativa paragonabile |
| Vue       | Valido (esiste anche Ionic Vue), ma non offre vantaggi decisivi rispetto a React                              |
| Angular   | Più pesante e strutturato del necessario per un'app di queste dimensioni                                      |
| Blazor    | Escluso da [ADR 0001](0001-linguaggio-typescript.md)                                                          |
