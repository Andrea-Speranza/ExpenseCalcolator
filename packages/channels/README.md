# packages/channels — Canali di condivisione (plugin)

Ogni canale è un pacchetto separato che **trasporta segmenti di eventi** tra dispositivi e persone
([ADR 0006](../../docs/adr/0006-canali-plugin.md)). Fondere gli eventi, risolvere i conflitti e verificare i
permessi non è compito dei canali: lo fanno `sync` ed `engine`, allo stesso modo per tutti
([ADR 0007](../../docs/adr/0007-salvataggio-e-concorrenza.md)).

Le shell (web, native, CLI) scelgono quali canali includere e li registrano all'avvio. Senza nessun canale
l'app funziona in modalità locale.

| Canale                                               | Forma      | Account   | Stato            |
| ---------------------------------------------------- | ---------- | --------- | ---------------- |
| `file` — file condiviso (WhatsApp, Telegram, email…) | A messaggi | No        | Da creare        |
| [`folder`](folder/) — cartella sincronizzata         | A deposito | No        | Fase 5           |
| `p2p` — peer-to-peer con link o QR                   | A messaggi | No        | Dopo uno spike   |
| `dropbox`                                            | A deposito | Dropbox   | Da valutare      |
| [`gdrive`](gdrive/) — Google Drive                   | A deposito | Google    | Dopo lo spike S1 |
| `onedrive`                                           | A deposito | Microsoft | Da valutare      |

Il confronto completo è in [docs/CONDIVISIONE.md](../../docs/CONDIVISIONE.md); l'ordine di realizzazione è la
decisione aperta D12.

**Regole:**

- un canale dipende solo dalla porta `SyncChannel` (`engine`) e dai tipi (`schema`), mai da un altro canale né
  direttamente da `core` o `sync`;
- ogni canale deve passare la stessa suite di test di contratto della porta.
