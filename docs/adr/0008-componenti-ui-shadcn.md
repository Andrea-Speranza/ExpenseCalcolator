# 0008 — Componenti UI: shadcn/ui con Tailwind CSS

- **Stato:** accettata
- **Data:** 2026-10-13
- **Chiude:** D8

## Contesto

La UI (React, [ADR 0002](0002-framework-ui-react.md)) deve funzionare bene sia al tocco su Android sia con
mouse e tastiera su Windows, e avere lo stesso aspetto ovunque, come i client di Spotify e Steam.

## Decisione

shadcn/ui, con Tailwind CSS 4.

- I componenti (pulsanti, finestre, campi, schede…) sono copiati nel repository, in `packages/ui`, e non
  installati come libreria. Si possono modificare liberamente e non cambiano da soli con un aggiornamento.
- Sono costruiti su Radix, quindi sono accessibili: tastiera, lettori di schermo, focus.
- Lo stile è definito da variabili CSS (colori, raggi): un tema chiaro e uno scuro, da adattare in seguito
  all'identità dell'app.

### Come è impostato

- **Generazione:** stile "nova", colore base neutro, icone Lucide, font Geist incluso nel pacchetto (niente
  CDN: funziona offline). I componenti si aggiungono con la CLI di shadcn e non si correggono a mano, così si
  possono aggiornare rigenerandoli. ESLint disattiva per quella cartella solo le regole che lo stile di shadcn
  non segue per scelta; TypeScript li controlla in modalità strict come il resto del codice.
- **Import con il nome del pacchetto** (`@expense/ui/components/ui/button`), come nei monorepo ufficiali di
  shadcn, invece dell'alias `@/`. Funziona in TypeScript, Vite, Vitest e dependency-cruiser senza
  configurazione nelle app che usano la UI.
- **Elenchi a scelta con il `<select>` nativo** (componente `native-select`): su Android e Windows apre il
  selettore del sistema, più comodo al tocco.
- **Tema scuro che segue il sistema operativo**, solo con CSS (`prefers-color-scheme`), senza script e senza
  lampeggi all'avvio. Una scelta manuale nelle impostazioni si potrà aggiungere in seguito.

## Conseguenze

- **Vantaggi:**
  - aspetto proprio e uguale su web, Windows e Android;
  - nessun legame con l'aspetto nativo di una piattaforma.
- **Costi:**
  - i gesti tipici del telefono (pannelli dal basso, scorrimenti) vanno aggiunti a mano dove servono;
  - i componenti copiati vanno aggiornati a mano, se si vuole.

## Alternative considerate

| Alternativa                                 | Perché no                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| Ionic React                                 | Aspetto nativo su Android e iOS, ma su desktop sembra un'app per telefono |
| Libreria di componenti installata (es. MUI) | Più pesante e con uno stile riconoscibile, difficile da rendere "nostro"  |
