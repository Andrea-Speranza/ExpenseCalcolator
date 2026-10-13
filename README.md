# ExpenseCalcolator

Gestione delle spese di gruppo, stile Splitwise. L'app è:

- **local-first:** i dati vivono sul dispositivo e l'app funziona offline;
- **multipiattaforma:** web, Windows, Android;
- **senza backend:** la condivisione passa dallo storage cloud degli utenti (es. Google Drive).

> **Stato:** Fasi 1 (logica di calcolo) e 2 (eventi, salvataggio, engine) completate; prossima la Fase 3 (UI).
> Tutto parte da [docs/PLANNING.md](docs/PLANNING.md).

## Sviluppo

Prerequisiti: Node.js ≥ 22.13 e pnpm 10. La versione di pnpm è fissata nel campo `packageManager`.

```sh
pnpm install          # installa le dipendenze di tutto il workspace
pnpm check            # formattazione, lint, tipi, confini tra pacchetti e test (lo stesso comando della CI)
pnpm test:watch       # test in modalità watch
pnpm coverage         # test con copertura
pnpm format           # formatta tutti i file
pnpm cli saldi apps/cli/examples/weekend.json   # prova la riga di comando (vedi apps/cli/README.md)
pnpm schemas          # rigenera i JSON Schema in spec/schemas dopo aver cambiato packages/schema
```

I singoli controlli si possono lanciare anche separatamente: `pnpm lint`, `pnpm typecheck`, `pnpm deps`, `pnpm test`.

## Struttura

| Cartella                                | Contenuto                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [docs/](docs/)                          | Pianificazione, decisioni architetturali (ADR), [alternative per la condivisione](docs/CONDIVISIONE.md) |
| [spec/](spec/)                          | Contratti indipendenti dal linguaggio: JSON Schema e test vector                                        |
| [packages/schema](packages/schema/)     | Modelli dati ed eventi condivisi                                                                        |
| [packages/core](packages/core/)         | Logica di calcolo pura                                                                                  |
| [packages/sync](packages/sync/)         | Log di eventi, orologio logico, merge                                                                   |
| [packages/engine](packages/engine/)     | API pubblica usata dalla UI                                                                             |
| [packages/adapters](packages/adapters/) | Porte di piattaforma: salvataggio locale (IndexedDB), orologio e id                                     |
| [packages/channels](packages/channels/) | Canali di condivisione, ognuno un plugin separato: file, cartella, peer-to-peer, cloud                  |
| [packages/ui](packages/ui/)             | Interfaccia (SPA)                                                                                       |
| [apps/cli](apps/cli/)                   | Riga di comando: saldi e trasferimenti da un file JSON                                                  |
| [apps/web](apps/web/)                   | Shell web (PWA)                                                                                         |
| [apps/native](apps/native/)             | Shell nativa (Tauri 2: Windows, Android)                                                                |

Regola d'oro: le dipendenze vanno solo verso il basso, `ui → engine → core/sync → schema`.
