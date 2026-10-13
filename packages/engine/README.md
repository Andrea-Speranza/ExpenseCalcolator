# packages/engine — API pubblica

È l'unico punto d'ingresso per la UI e per qualsiasi altro consumatore (CLI, test, worker).

```ts
const engine = await openEngine({ store, clock, ids });
const { groupId } = unwrap(
  await engine.execute({ type: 'CreateGroup', name: 'Weekend', me: { name: 'Anna' } }),
);
const balances = engine.query({ type: 'GetBalances', groupId });
const stop = engine.subscribe(() => aggiornaLaSchermata());
```

- **Comandi** (`execute`): messaggi JSON validati con gli schemi, controllati con le regole del core,
  trasformati in eventi con autore, orologio (HLC) e versione di partenza, salvati insieme all'orologio. Lo
  stato si aggiorna solo se il salvataggio riesce. I comandi si eseguono uno alla volta.
- **Query** (`query`): `ListGroups`, `GetGroup`, `GetBalances`, `GetSettings`. Restituiscono viste JSON (array,
  non Map), quindi passano anche attraverso un worker o un bridge nativo.
- **Notifiche** (`subscribe`): dopo ogni comando o evento ricevuto.
- **Scambio di eventi** (`exportEvents`, `receiveEvents`): il gancio per i canali di condivisione
  ([ADR 0006](../../docs/adr/0006-canali-plugin.md)). Scarta i doppioni, conserva gli eventi di tipi
  sconosciuti e aggiorna l'orologio dopo aver visto eventi altrui.
- **Porte:** `LocalStore`, `Clock`, `IdGenerator`, con implementazioni in memoria (`createMemoryStore`,
  `createManualClock`, `createSequentialIds`). Quelle reali stanno in [packages/adapters](../adapters/).
- **Senza stato:** `calculateLedger` calcola saldi e trasferimenti da un registro esterno (lo usa la CLI).

Errori: sempre `Result` con un `code` (`InvalidInput`, `NotFound`, `NoChanges`, `StorageFailed` e gli errori
di dominio del core). L'unica eccezione è `openEngine`, che rifiuta la promessa se il salvataggio locale non
è leggibile.

- **Dipende da:** `schema`, `core`, `sync`.
- **Stato:** Fase 2 completata.

Dettagli: [PLANNING §5](../../docs/PLANNING.md#5-esposizione-delle-funzionalità-api) e
[ADR 0007](../../docs/adr/0007-salvataggio-e-concorrenza.md).
