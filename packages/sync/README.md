# packages/sync — Eventi e concorrenza (logica pura)

Contiene la logica che permette a più dispositivi e più persone di modificare gli stessi dati senza un server
([ADR 0007](../../docs/adr/0007-salvataggio-e-concorrenza.md)):

| Funzione                | Cosa fa                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tickHlc`, `observeHlc` | Orologio logico ibrido (HLC): ogni nuovo evento viene dopo tutti quelli già generati o visti, anche con orologi non allineati                                          |
| `orderEvents`           | Ordine canonico degli eventi, senza doppioni: uguale su ogni dispositivo                                                                                               |
| `projectGroup`          | Stato del gruppo: ultima modifica per campo o blocco, eliminazione come campo a sé, modifiche contemporanee segnalate, permessi tramite una `Policy` (oggi `allowAll`) |
| `projectProfile`        | Stato del profilo: impostazioni, gruppi collegati, "chi sono io"                                                                                                       |

Lo stato non dipende dall'ordine in cui arrivano gli eventi né dai doppioni: è verificato con test
property-based.

Non fa I/O né legge l'ora: l'ora arriva dall'engine. In Fase 5 qui si aggiungerà il formato dei segmenti
scambiati dai canali.

- **Dipende da:** `schema`.
- **Stato:** Fase 2 completata.

Dettagli: [PLANNING §8](../../docs/PLANNING.md#8-dati-e-condivisione-senza-server).
