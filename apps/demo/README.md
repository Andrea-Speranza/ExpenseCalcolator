# apps/demo — Shell della demo

La demo pubblicata su GitHub Pages ([ADR 0009](../../docs/adr/0009-distribuzione-locale.md)): la stessa app di
`apps/web`, con i dati nel browser di chi la prova (IndexedDB), dentro una cornice che aggiunge:

- un avviso in cima: i dati restano solo in quel browser, nessun account, nessun server;
- finché non ci sono gruppi, il pulsante «Prova con un gruppo di esempio», che crea «Weekend al lago» (tre
  persone, quattro spese divise in modi diversi, un rimborso) e lo apre.

**L'app non sa di essere in una demo.** `packages/ui` e `apps/web` non hanno codice per la demo: la cornice
([demo-frame.tsx](src/demo-frame.tsx)) sta intorno a `<App>` e usa solo ciò che è pubblico:

- l'API dell'engine: i comandi per creare il gruppo ([sample-group.ts](src/sample-group.ts)), le query e le
  notifiche per sapere se ci sono gruppi e quale lingua è scelta nelle impostazioni;
- l'indirizzo delle pagine (`#/gruppi/<id>`) per aprire il gruppo creato.

I testi della demo sono in `src/locales/` (italiano e inglese), con le chiavi tipizzate come nella UI
([ADR 0010](../../docs/adr/0010-localizzazione.md)).

## Comandi (dalla radice del repository)

```sh
pnpm demo           # sviluppo su http://localhost:5174, con aggiornamento a caldo
pnpm demo:build     # build in apps/demo/dist (è ciò che pubblica il workflow)
pnpm demo:preview   # build e anteprima su http://localhost:4175
```

Porte diverse da quelle della web app: ognuna ha il proprio archivio nel browser, quindi i gruppi creati nella
demo non si mescolano con quelli veri.

## Pubblicazione

Il workflow [demo.yml](../../.github/workflows/demo.yml) compila la demo e la pubblica a ogni push su `main`,
o a mano dalla scheda Actions. Parte solo quando il repository è pubblico; per attivarlo basta, una volta,
Settings → Pages → Source: **GitHub Actions**. L'indirizzo è
<https://andrea-speranza.github.io/ExpenseCalcolator/>.
