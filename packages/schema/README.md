# packages/schema — Modelli dati condivisi

È l'unica fonte di verità per la forma dei dati:

- importi e valute (`Money`, `MemberAmount`), modalità di divisione (`Split`), campi di spese e rimborsi;
- identificativi (gruppo, membro, spesa, rimborso, profilo, dispositivo, evento);
- busta degli eventi (con HLC, autore e versione di partenza) e tipi di evento di gruppo e profilo
  ([ADR 0007](../../docs/adr/0007-salvataggio-e-concorrenza.md));
- comandi e query dell'engine;
- registro di calcolo (`Ledger`), usato dalla CLI e dai test vector.

Libreria: Zod 4 ([ADR 0003](../../docs/adr/0003-schema-validazione-zod.md)). Gli schemi dei dati salvati
descrivono solo la forma; le future migrazioni (upcaster) saranno funzioni separate. Gli eventi di tipi
sconosciuti si leggono con `StoredEventSchema`, così si conservano anche se scritti da app più recenti.

Il JSON Schema in [`spec/schemas/`](../../spec/schemas/) si genera da qui con `pnpm schemas`; un test
fallisce se non è aggiornato.

- **Dipende da:** nessun altro pacchetto del progetto.
- **Usato da:** tutti gli altri pacchetti (il core solo per i tipi).
- **Stato:** Fase 2 completata.

Dettagli: [PLANNING §6](../../docs/PLANNING.md#6-modelli-dati-condivisi).
