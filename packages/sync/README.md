# packages/sync — Eventi e sincronizzazione (logica pura)

Contiene la logica pura della sincronizzazione:

- orologio logico ibrido (HLC) e ordinamento deterministico degli eventi;
- merge dei log di più dispositivi (idempotente);
- proiezione eventi → stato, con le regole di conflitto;
- formato dei segmenti e del manifest `group.json`.

Non fa I/O: legge e scrive file solo tramite le porte dell'engine.

- **Dipende da:** `schema`.
- **Stato:** da implementare, Fasi 2 e 5.

Dettagli: [PLANNING §8](../../docs/PLANNING.md#8-dati-e-condivisione-senza-server).
