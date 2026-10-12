# packages/schema — Modelli dati condivisi

È l'unica fonte di verità per:

- entità: `Group`, `Member`, `Expense`, `Settlement`, `Money`;
- busta e tipi degli eventi;
- comandi, query e relativi risultati;
- validazione runtime e upcaster (migrazioni degli eventi in lettura).

Esporta i tipi TypeScript e genera il JSON Schema in [`spec/schemas/`](../../spec/schemas/).
Libreria: Zod 4 ([ADR 0003](../../docs/adr/0003-schema-validazione-zod.md)). Gli schemi descrivono solo la
forma dei dati; le migrazioni sono funzioni separate.

- **Dipende da:** nessun altro pacchetto del progetto.
- **Usato da:** tutti gli altri pacchetti.
- **Stato:** da implementare, Fase 2. I tipi base servono già in Fase 1.

Dettagli: [PLANNING §6](../../docs/PLANNING.md#6-modelli-dati-condivisi).
