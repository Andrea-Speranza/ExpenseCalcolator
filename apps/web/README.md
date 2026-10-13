# apps/web — Shell web

Collega la UI (`packages/ui`) all'engine con gli adapter del browser e la compila in file statici con Vite.

- **Dati:** IndexedDB (`adapters/local-indexeddb`), con orologio e id ULID di `adapters/system`.
- **Storage persistente:** all'avvio chiede al browser di non cancellare i dati quando lo spazio scarseggia.
  Il browser decide in base all'uso del sito; se rifiuta, l'app funziona lo stesso.
- **Copia di sicurezza:** dalle impostazioni di un gruppo si esporta un file (nella cartella dei download);
  con «Importa» nell'elenco dei gruppi lo si riapre qui, su un altro dispositivo o nella CLI.
- **Percorsi relativi:** la stessa build funziona dentro le app native (Fase 4) o da qualsiasi cartella.
- **Solo in locale:** per ora non si pubblica online ([ADR 0009](../../docs/adr/0009-distribuzione-locale.md)).
  Manifest e service worker (PWA) sono rimandati.

## Comandi (dalla radice del repository)

```sh
pnpm web            # sviluppo su http://localhost:5173, con aggiornamento a caldo
pnpm web:build      # build in apps/web/dist
pnpm web:preview    # build e anteprima della versione finale su http://localhost:4173
pnpm e2e            # test E2E: build, anteprima su localhost:4174 e Playwright
```

Il server ascolta solo su `localhost`: dagli altri dispositivi della rete non è raggiungibile.

I dati restano nel browser in cui si usa l'app. Ogni indirizzo ha il proprio archivio: `localhost:5173`
(sviluppo) e `localhost:4173` (anteprima) hanno dati separati, e non vedono quelli della CLI. Per spostare
un gruppo dall'uno all'altro si usano esporta e importa.

## Test E2E

In `e2e/`, con Playwright, sulla build vera in un browser vero:

- l'app funziona senza rete una volta aperta, e dopo la riapertura ritrova i dati in IndexedDB;
- un gruppo esportato si importa su un altro dispositivo (un secondo contesto del browser, con il proprio
  archivio), che arriva agli stessi saldi.

In locale su Windows usano Edge, già installato. Altrove, e nella CI, usano il Chromium di Playwright, da
installare una volta con `pnpm --filter @expense/web exec playwright install chromium`.

- **Stato:** Fase 3 completata.
