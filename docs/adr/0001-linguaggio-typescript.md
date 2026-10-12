# 0001 — Linguaggio: TypeScript per tutto il progetto

- **Stato:** accettata
- **Data:** 2026-10-12

## Contesto

La logica di calcolo deve girare identica su web, Windows e Android, e in seguito su iOS, macOS e Linux.
La UI sarà fatta di pagine web servite in locale dentro una shell (Tauri o PWA, vedi
[PLANNING §7](../PLANNING.md#7-ui-pagine-web-locali-dentro-app-native)).

Si conoscono bene sia TypeScript sia C#, quindi la scelta dipende solo da quale si adatta meglio allo scopo.
I candidati concreti sono due:

- TypeScript;
- C#/.NET, con Blazor WebAssembly sul web e MAUI Blazor Hybrid sulle app.

## Decisione

TypeScript per tutti i pacchetti: `schema`, `core`, `sync`, `engine`, gli adapter e la UI.

## Motivazioni

1. **La piattaforma comune è il motore web.** Browser, WebView2 su Windows e System WebView su Android hanno
   in comune un solo linguaggio nativo: JavaScript. TypeScript ci gira senza runtime aggiuntivi. Qualsiasi
   altro linguaggio paga un costo di traduzione: un runtime da scaricare e un'interop per ogni API del browser.
2. **Lo stesso pacchetto ovunque.** La stessa build di file statici finisce nella PWA, in Tauri su Windows e
   in Tauri su Android. Blazor invece richiede due modelli di hosting: WebAssembly sul web ed esecuzione nativa
   con MAUI. I due modelli si comportano in modo diverso e hanno due pipeline di build separate.
3. **Peso della versione web.** Blazor WebAssembly scarica il runtime .NET al primo avvio, nell'ordine dei
   megabyte. Un'app TypeScript di queste dimensioni sta in qualche centinaio di KB. Su un telefono con rete
   scarsa la differenza si sente.
4. **API della piattaforma.** IndexedDB, Service Worker, File System Access e Google Identity Services sono
   tutte API JavaScript. Da Blazor si raggiungono solo con JS interop, quindi buona parte dell'integrazione
   sarebbe comunque scritta in JavaScript.
5. **Un solo adapter di storage.** IndexedDB funziona ovunque. Con MAUI la scelta naturale sarebbe SQLite
   nativo sulle app più IndexedDB sul web: due adapter da mantenere e da tenere allineati.
6. **Ecosistema local-first.** Librerie per sync e CRDT (Automerge, Yjs), test property-based (fast-check),
   PWA (vite-plugin-pwa) e test E2E (Playwright) nascono per JavaScript e TypeScript.
7. **Via di fuga.** Se un giorno la WebView non bastasse su mobile, il core TypeScript gira anche in React
   Native senza modifiche.

Il vantaggio tipico di C# per i soldi, il tipo `decimal`, qui non conta: gli importi sono interi in centesimi
([PLANNING §9.1](../PLANNING.md#91-importi)). Il fatto che TypeScript controlli i tipi solo in compilazione si
compensa con la modalità `strict` e con la validazione runtime ai confini (D5).

## Conseguenze

- **Vantaggi:**
  - un solo linguaggio;
  - una sola toolchain (Node + pnpm);
  - un solo bundle della UI per tutte le piattaforme.
- **Codice nativo:** il lato nativo di Tauri è in Rust, ma ci limitiamo a configurazione e plugin esistenti.
  Se servisse codice nativo su misura, andrebbe scritto in Rust (oppure in Kotlin, se su Android si passa a Capacitor).
- **Disciplina sui numeri:** in JavaScript `number` è un double. Gli importi devono essere sempre interi e
  controllati con `Number.isSafeInteger`, come già previsto in [PLANNING §9.1](../PLANNING.md#91-importi).

## Alternative considerate

- **C#/.NET (Blazor WebAssembly + MAUI Blazor Hybrid):** coerente con l'idea di "UI web dentro l'app", ma
  scartata per i punti 2–5. Sarebbe la scelta giusta se servissero librerie .NET o un'integrazione nativa
  pesante su Windows.
- **Rust → WASM, Kotlin Multiplatform:** vedi [PLANNING §4](../PLANNING.md#4-core-di-calcolo-cross-platform).
