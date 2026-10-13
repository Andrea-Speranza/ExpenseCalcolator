# apps/web — Shell web

Collega la UI (`packages/ui`) all'engine con gli adapter del browser e la compila in file statici con Vite.

- **Dati:** IndexedDB (`adapters/local-indexeddb`), con orologio e id ULID di `adapters/system`.
- **Storage persistente:** all'avvio chiede al browser di non cancellare i dati quando lo spazio scarseggia.
  Il browser decide in base all'uso del sito; se rifiuta, l'app funziona lo stesso.
- **Percorsi relativi:** la stessa build funziona dentro le app native (Fase 4) o da qualsiasi cartella.
- **Solo in locale:** per ora non si pubblica online ([ADR 0009](../../docs/adr/0009-distribuzione-locale.md)).
  Manifest e service worker (PWA) sono rimandati.

## Comandi (dalla radice del repository)

```sh
pnpm web            # sviluppo su http://localhost:5173, con aggiornamento a caldo
pnpm web:build      # build in apps/web/dist
pnpm web:preview    # build e anteprima della versione finale su http://localhost:4173
```

Il server ascolta solo su `localhost`: dagli altri dispositivi della rete non è raggiungibile.

I dati restano nel browser in cui si usa l'app. Ogni indirizzo ha il proprio archivio: `localhost:5173`
(sviluppo) e `localhost:4173` (anteprima) hanno dati separati, e non vedono quelli della CLI.

- **Stato:** Fase 3 in corso.
