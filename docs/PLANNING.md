# ExpenseCalcolator — Documento di pianificazione

> **Stato:** v0.9 (D1, D2, D5–D9 e D11 decise, D12 in parte; Fasi 0, 1 e 2 completate, Fase 3 in corso) · **Ultimo aggiornamento:** 2026-10-13
>
> Scopo: fissare architettura, decisioni tecniche e piano di lavoro **prima** di scrivere codice.
> Le voci marcate **(DA CONFERMARE — Dn)** sono raccomandazioni: si chiudono in §12 (dopo gli spike di §13)
> e si registrano come ADR in [`docs/adr/`](adr/).

## Indice

1. [Obiettivi e requisiti](#1-obiettivi-e-requisiti)
2. [Principi architetturali](#2-principi-architetturali)
3. [Architettura a strati](#3-architettura-a-strati)
4. [Core di calcolo cross-platform](#4-core-di-calcolo-cross-platform)
5. [Esposizione delle funzionalità (API)](#5-esposizione-delle-funzionalità-api)
6. [Modelli dati condivisi](#6-modelli-dati-condivisi)
7. [UI: pagine web locali dentro app native](#7-ui-pagine-web-locali-dentro-app-native)
8. [Dati e condivisione senza server](#8-dati-e-condivisione-senza-server)
9. [Specifica della logica di calcolo](#9-specifica-della-logica-di-calcolo)
10. [Struttura delle cartelle](#10-struttura-delle-cartelle)
11. [Roadmap](#11-roadmap)
12. [Decisioni aperte](#12-decisioni-aperte)
13. [Rischi e spike](#13-rischi-e-spike)
14. [Test e tooling](#14-test-e-tooling)
15. [Glossario](#15-glossario)

---

## 1. Obiettivi e requisiti

### 1.1 Obiettivo

App per gestire le spese di gruppo (stile Splitwise): registrare chi ha pagato cosa e come dividerlo,
calcolare chi deve quanto a chi. Deve funzionare su PC, web e Android **con lo stesso codice di calcolo**
e **senza un backend o un database da ospitare**.

### 1.2 Requisiti funzionali (MVP)

- **Gruppi:** creare, rinominare, archiviare.
- **Membri:** aggiungere, rinominare, archiviare. Un membro può non avere l'app (lo gestiscono gli altri).
- **Spese:** aggiungere, modificare, eliminare. Ogni spesa ha descrizione, data, importo, valuta, chi ha pagato,
  chi partecipa e la modalità di divisione (parti uguali, importi esatti, percentuali, quote).
- **Rimborsi:** registrare un pagamento tra due membri ("saldare").
- **Saldi:** saldo netto per membro e trasferimenti suggeriti, con o senza semplificazione dei debiti.
- **Attività:** storico delle modifiche (chi ha fatto cosa e quando).
- **Offline:** l'app funziona completamente senza connessione e sincronizza quando la connessione torna.
- **Tre modalità d'uso** ([ADR 0005](adr/0005-modalita-uso.md)). Un gruppo può passare da una all'altra senza conversioni:
  - **locale:** un dispositivo e nessun account;
  - **personale:** i propri dati e le impostazioni seguono l'utente sui suoi dispositivi;
  - **condivisa:** più persone sullo stesso gruppo.
- **Impostazioni personali:** valuta predefinita, lingua, nome visualizzato.

### 1.3 Requisiti non funzionali

| ID  | Requisito                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------ |
| NF1 | Il core di calcolo è separato da UI, persistenza e rete.                                                           |
| NF2 | Stesso codice e stesso linguaggio su Windows, web e Android (in seguito iOS/macOS/Linux), senza modifiche.         |
| NF3 | Determinismo: con gli stessi dati, ogni dispositivo ottiene lo stesso risultato al centesimo.                      |
| NF4 | Offline-first: UI e dati sempre disponibili in locale.                                                             |
| NF5 | Nessun DB centrale né servizio backend. La condivisione passa dallo storage cloud degli utenti (es. Google Drive). |
| NF6 | Formato dei dati versionato e leggibile da versioni diverse dell'app.                                              |
| NF7 | Importi mai in virgola mobile.                                                                                     |

### 1.4 Fuori scope (per ora)

Pagamenti reali e integrazioni bancarie, notifiche push, account o login proprietari.
iOS è rimandato, non escluso: l'architettura lo supporta.

---

## 2. Principi architetturali

- **Ports & adapters (architettura esagonale).** La logica dichiara delle interfacce ("porte") per ciò che le
  serve dall'esterno: storage, rete, orologio. Le implementazioni concrete ("adapter") stanno ai margini e si
  sostituiscono per piattaforma senza toccare la logica.
- **Dipendenze solo verso il basso.** UI → engine → core/sync → schema. Mai il contrario. La regola è verificata
  automaticamente in CI.
- **Logica pura.** `core` e `sync` non fanno I/O, non leggono l'ora e non generano id casuali: queste cose
  vengono passate dall'esterno. Per questo sono deterministici e facili da testare.
- **Local-first ed event sourcing.** Ogni modifica è un evento immutabile e lo stato si ricostruisce applicando
  gli eventi in ordine. Questo modello si presta bene alla sincronizzazione tramite file (§8).
- **Un solo linguaggio** dal calcolo alla UI.

---

## 3. Architettura a strati

```text
 Shell            apps/web (browser)      apps/native (Tauri 2: Windows, Android)
                      │                           │
                      └─────────────┬─────────────┘
                                    ▼
 Presentazione    ┌────────────────────────────────────┐
                  │ ui                                 │
                  │ schermate e componenti (SPA)       │
                  └─────────────────┬──────────────────┘
                                    ▼  usa solo l'API pubblica
 API pubblica     ┌────────────────────────────────────┐
                  │ engine                             │ ◄── adapters/* (implementano le porte):
                  │ comandi · query · notifiche        │     IndexedDB, cartella sincronizzata,
                  └────────┬───────────────────┬───────┘     Google Drive
                           ▼                   ▼
 Logica pura      ┌─────────────────┐  ┌───────────────┐
                  │ core            │  │ sync          │
                  │ calcolo spese   │  │ eventi, HLC,  │
                  │                 │  │ merge         │
                  └────────┬────────┘  └───────┬───────┘
                           ▼                   ▼
 Modelli dati     ┌────────────────────────────────────┐
                  │ schema                             │
                  │ tipi · validazione · JSON Schema   │
                  └────────────────────────────────────┘
```

| Pacchetto    | Responsabilità                                                                                      | Può dipendere da                     | Dove gira            |
| ------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------- |
| `schema`     | Tipi di entità, eventi, comandi e query; validazione; JSON Schema; migrazioni                       | —                                    | ovunque              |
| `core`       | Calcolo: importi, divisioni, saldi, semplificazione dei debiti                                      | `schema` (solo tipi)                 | ovunque              |
| `sync`       | Orologio logico (HLC), merge dei log di eventi, proiezione eventi → stato, formato dei segmenti     | `schema`                             | ovunque              |
| `engine`     | API pubblica (comandi, query, notifiche); definisce le porte                                        | `schema`, `core`, `sync`             | ovunque              |
| `adapters/*` | Implementazioni delle porte di piattaforma (es. salvataggio locale su IndexedDB)                    | `engine` (solo interfacce), `schema` | dipende dall'adapter |
| `channels/*` | Plugin di condivisione: file, cartella, peer-to-peer, cloud ([ADR 0006](adr/0006-canali-plugin.md)) | `engine` (solo la porta), `schema`   | dipende dal canale   |
| `ui`         | Schermate e componenti                                                                              | `engine`, `schema`                   | browser / WebView    |
| `apps/*`     | Impacchettano la UI e collegano all'engine gli adapter giusti per la piattaforma                    | `ui`, `adapters/*`                   | piattaforma          |

---

## 4. Core di calcolo cross-platform

### 4.1 Linguaggio: TypeScript — **deciso** ([ADR 0001](adr/0001-linguaggio-typescript.md))

La piattaforma comune a tutti i dispositivi è il motore web: il browser, WebView2 su Windows e System WebView
su Android (§7). Il linguaggio nativo di quel motore è JavaScript, quindi un core in TypeScript gira così
com'è ovunque: nessun runtime aggiuntivo, nessun bridge, stesso linguaggio della UI. Qualsiasi altro
linguaggio paga un costo di traduzione: un runtime da scaricare e un'interop per ogni API del browser.

| Opzione                                    | Pro                                                                                           | Contro                                                                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript (scelta)**                    | Gira nativamente in ogni browser/WebView e in Node; stesso linguaggio della UI; nessun bridge | Tipi solo a compile-time (si compensa con la validazione runtime ai confini, §6.1)                                                                                                    |
| Rust → WASM + binding nativi               | Prestazioni, tipi forti                                                                       | Due toolchain, bridge JS↔WASM: complessità sproporzionata per calcoli semplici                                                                                                        |
| Kotlin Multiplatform                       | Ottimo su Android nativo                                                                      | Target web meno maturo e poco naturale con una UI web                                                                                                                                 |
| C#/.NET (Blazor WASM + MAUI Blazor Hybrid) | Un solo linguaggio, stesso modello "UI web in app"                                            | Runtime .NET da scaricare sul web (nell'ordine dei MB), due modelli di hosting diversi (WebAssembly e MAUI), API del browser raggiungibili solo via interop. Scartata: vedi ADR 0001. |

### 4.2 Vincoli che rendono il core davvero portabile

- `tsconfig` con `lib: ["ES2022"]` e senza tipi DOM o Node: usare `window`, `document`, `fs` o `fetch` nel
  core diventa un errore di compilazione.
- Nessuna dipendenza a runtime (obiettivo zero; eventuali eccezioni vanno motivate).
- Niente `Date.now()`, `Math.random()` o `crypto.randomUUID()`: orologio e generatore di id arrivano dall'esterno.
- Solo moduli ESM, nessun effetto collaterale all'import.
- Gli errori di dominio sono valori di ritorno (`Result`), non eccezioni: qualsiasi chiamante li gestisce allo stesso modo.

---

## 5. Esposizione delle funzionalità (API)

### 5.1 Un solo punto d'ingresso: `engine`

La UI, e qualsiasi altro consumatore (test, CLI, worker), parla solo con la facade `engine`.
Non importa mai direttamente `core` o `sync`. Da `schema` può importare i tipi e gli schemi di validazione,
per esempio per i form ([ADR 0003](adr/0003-schema-validazione-zod.md)).

### 5.2 Comandi e query come messaggi serializzabili

Ogni operazione è un oggetto JSON puro:

- **Comandi** (scrivono): vengono validati, trasformati in evento, salvati in locale e accodati per la sync.
- **Query** (leggono): vengono calcolate sullo stato proiettato.
- **Notifiche**: `subscribe(listener)` avvisa la UI quando lo stato cambia, sia per un comando locale sia per
  dati arrivati dalla sync.

```jsonc
// Esempio illustrativo di comando
{
  "type": "AddExpense",
  "groupId": "g_01J...",
  "expense": {
    "description": "Cena",
    "amount": { "minor": 9000, "currency": "EUR" },
    "paidBy": [{ "memberId": "m_anna", "amount": { "minor": 9000, "currency": "EUR" } }],
    "split": { "method": "equal", "memberIds": ["m_anna", "m_luca", "m_sara"] }
  }
}
// Risposta
{ "ok": true, "value": { "expenseId": "e_01J..." } }
```

Dato che sono messaggi JSON, lo stesso contratto funziona senza modifiche all'engine:

- con chiamata diretta nello stesso thread (MVP);
- dentro un Web Worker, per non bloccare la UI, se mai servisse;
- attraverso un bridge, ad esempio da un widget Android nativo o da una CLI Node.

### 5.3 Catalogo MVP

| Area             | Comandi                                                                                     | Query                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Gruppi           | `CreateGroup`, `RenameGroup`, `ArchiveGroup`                                                | `ListGroups`, `GetGroup`                                    |
| Membri           | `AddMember`, `RenameMember`, `ArchiveMember`, `ClaimMember` ("io sono questo membro")       | `ListMembers`                                               |
| Spese            | `AddExpense`, `UpdateExpense`, `DeleteExpense`                                              | `ListExpenses` (con filtri), `GetExpense`                   |
| Rimborsi e saldi | `RecordSettlement`, `DeleteSettlement`                                                      | `GetBalances`, `GetSuggestedTransfers` (semplificati sì/no) |
| Condivisione     | `JoinGroup`, `SyncNow`                                                                      | `GetActivity`, `GetSyncStatus`                              |
| Profilo          | `UpdateSettings`, `PublishGroup` (locale → personale), `ShareGroup` (personale → condivisa) | `GetSettings`                                               |

### 5.4 Porte (ciò che l'engine chiede alla piattaforma)

| Porta         | Scopo                                                            | Adapter previsti                                                                                    |
| ------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `LocalStore`  | Salvare e leggere eventi e stato in locale                       | IndexedDB (vale su tutte le piattaforme, §8.10); in memoria per i test                              |
| `SyncChannel` | Trasportare segmenti di eventi verso altri dispositivi e persone | Plugin in `packages/channels/` (§8.6, [ADR 0006](adr/0006-canali-plugin.md)); in memoria per i test |
| `Clock`       | Ora corrente                                                     | Di sistema; finto per i test                                                                        |
| `IdGenerator` | Id univoci ordinabili (ULID o UUIDv7)                            | Di sistema; deterministico per i test                                                               |

`SyncChannel` è volutamente minima e non permette mai di sovrascrivere un file (§8.3). I canali "a deposito"
(cartella, cloud) elencano, leggono e creano file; quelli "a messaggi" (file condiviso, peer-to-peer) inviano
e ricevono pacchetti di segmenti. Il dettaglio si fissa con il primo canale reale. Login e token sono affare
interno di ciascun canale.

### 5.5 Versionamento dell'API

`engine` segue il versionamento semantico (semver). Tutto ciò che `engine` non esporta è interno e può cambiare liberamente.

---

## 6. Modelli dati condivisi

### 6.1 Unica fonte di verità: `packages/schema`

Entità, eventi, comandi, query e relativi risultati sono definiti **una sola volta**, con una libreria che
produce insieme i tipi TypeScript, la validazione runtime e il JSON Schema: Zod 4 — **deciso**
([ADR 0003](adr/0003-schema-validazione-zod.md)).

- Tutti i pacchetti TypeScript importano gli stessi tipi, quindi non c'è duplicazione.
- La validazione avviene ai confini: sull'input dei comandi (engine) e sui file letti dal cloud (sync).
  Il core riceve dati già validi e resta senza dipendenze.
- Il JSON Schema generato si salva in [`spec/schemas/`](../spec/schemas/). Se un giorno servisse un consumatore
  in un altro linguaggio (es. un'app Android nativa in Kotlin), i modelli si **generano** da lì con strumenti
  come quicktype, invece di riscriverli a mano.

### 6.2 Test vector indipendenti dal linguaggio

In [`spec/test-vectors/`](../spec/test-vectors/) ci sono casi JSON "input → output atteso": spese → saldi →
trasferimenti. Li usa la suite di test del core. Se un giorno il core venisse riscritto in un altro linguaggio,
gli stessi file ne verificherebbero la correttezza al centesimo.

### 6.3 Versionamento del formato

I file sul Drive vengono scritti da dispositivi con versioni diverse dell'app, quindi il formato è un contratto pubblico:

- `formatVersion` nel manifest del gruppo e `v` in ogni evento.
- Gli eventi già scritti non si modificano mai. Le evoluzioni passano da **upcaster**: funzioni che, in lettura,
  trasformano un evento v1 nel formato v2.
- I tipi di evento sconosciuti, scritti da un'app più recente, vengono conservati e ignorati, non scartati.
- Se un gruppo ha un `formatVersion` più alto di quello supportato, l'app lo apre in sola lettura e chiede di aggiornarsi.

### 6.4 Modello concettuale (MVP)

| Entità       | Campi principali                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Group`      | id, nome, valuta base, data di creazione, archiviato                                                                                                                                                      |
| `Member`     | id, nome visualizzato, archiviato. È una persona nel gruppo, non un account.                                                                                                                              |
| `Expense`    | id, descrizione, data, totale (`Money`), pagatori `[{memberId, importo}]`, divisione (modalità + parametri), categoria e note opzionali                                                                   |
| `Settlement` | id, da, a, importo, data                                                                                                                                                                                  |
| `Profile`    | Impostazioni (valuta predefinita, lingua, nome), gruppi con modalità e riferimento alla cartella, membro "io" per ogni gruppo. È personale e non si condivide mai ([ADR 0005](adr/0005-modalita-uso.md)). |
| Busta evento | id, groupId, tipo, versione `v`, payload, timestamp HLC, deviceId, membro autore                                                                                                                          |

Ogni importo (`Money`) porta con sé la propria valuta: totale, quote dei pagatori, importi esatti e rimborsi.
Il gruppo ha una valuta di riferimento ([ADR 0004](adr/0004-valute.md)).

Tre identità distinte:

- **Membro:** la persona all'interno del gruppo.
- **Dispositivo:** l'installazione dell'app che scrive gli eventi.
- **Account cloud:** chi ha i permessi sulla cartella.

Un dispositivo dichiara quale membro rappresenta con `ClaimMember`.

---

## 7. UI: pagine web locali dentro app native

### 7.1 Il modello Netflix/Spotify/Steam

I client desktop di Spotify e Steam usano CEF (Chromium Embedded Framework): una finestra nativa che contiene
un browser incorporato, con la UI scritta in HTML/CSS/JS. Spotify conserva la sua UI **in locale**, in archivi
`.spa` dentro la cartella dell'app. Netflix usa tecnologie web/React su molti dispositivi. L'idea di avere pagine
salvate in locale e renderizzate dall'app senza rete è quindi esattamente come funzionano questi client.

### 7.2 Come lo realizziamo

La UI è una SPA (single page application) compilata in file statici HTML/CSS/JS, in `packages/ui`.
Gli stessi file vengono impacchettati in ogni "shell":

| Piattaforma                  | Shell                                  | Motore di rendering                             | Come servono le pagine locali                                                                                                       |
| ---------------------------- | -------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Windows (poi macOS/Linux)    | Tauri 2                                | WebView2 (Chromium, già presente in Windows 11) | Protocollo interno che legge i file dal pacchetto dell'app                                                                          |
| Android                      | Tauri 2 (in alternativa Capacitor, D3) | Android System WebView (Chromium)               | Come sopra                                                                                                                          |
| Web (per ora solo in locale) | `apps/web` (Vite)                      | Browser                                         | Servite da `localhost` sul PC; una futura PWA le terrebbe in cache per l'uso offline ([ADR 0009](adr/0009-distribuzione-locale.md)) |

- **Nessun webserver vero.** Le shell non aprono una porta su `localhost`. Registrano un protocollo interno
  (su Windows, Tauri usa `http://tauri.localhost`) che risponde leggendo i file dal pacchetto. L'effetto è
  quello del "webserver locale" che avevi in mente, ma senza porte aperte, conflitti, richieste del firewall o
  accessi da altre app.
- Di conseguenza la UI non dipende mai dalla rete: la rete serve solo a sincronizzare i dati.
- Per ora la web app **non si pubblica online** ([ADR 0009](adr/0009-distribuzione-locale.md)): è inclusa
  nelle app native e nel browser del PC si usa in locale (`pnpm web`). In futuro potrà essere ospitata sul
  proprio NAS o su un hosting statico, senza cambiare codice.

### 7.3 Perché Tauri e non Electron

- **Electron** è il più vicino a Spotify e Steam, perché incorpora un proprio Chromium. Però l'installer pesa
  oltre 100 MB e non supporta Android.
- **Tauri 2** usa la WebView del sistema operativo: installer di pochi MB e un solo progetto per desktop e
  mobile. Il lato nativo è in Rust, ma per noi si limita a configurazione e plugin (accesso al file system, deep link).
- **Capacitor** è più maturo su mobile e ha molti plugin, ad esempio per il login Google nativo, ma non copre
  il desktop. La scelta per Android si fa dopo lo spike S2 **(D3)**.

### 7.4 Framework UI: React + Vite — **deciso** ([ADR 0002](adr/0002-framework-ui-react.md))

Motivi principali:

- ha l'ecosistema più ampio per un'app che deve funzionare bene sia su touch sia su desktop;
- offre una via di fuga verso React Native, se un giorno la WebView non bastasse su mobile.

La UI legge lo stato tramite `engine.subscribe`, che in React si collega direttamente con
`useSyncExternalStore`. I componenti sono quelli di shadcn/ui con Tailwind CSS
([ADR 0008](adr/0008-componenti-ui-shadcn.md)).

La navigazione non usa una libreria di routing: le pagine sono poche e gli indirizzi usano l'hash
(`#/gruppi/…`), che funziona allo stesso modo nel browser, da file locali e nelle WebView, senza configurare
un server ([ADR 0009](adr/0009-distribuzione-locale.md)).

Requisiti per la UI:

- layout responsive, pensato prima per il mobile;
- traduzioni (prima italiano, poi inglese);
- importi e date formattati con `Intl`;
- accessibilità di base.

---

## 8. Dati e condivisione senza server

### 8.1 Idea di fondo

- Ogni dispositivo ha **la copia completa** dei dati dei propri gruppi (local-first), quindi l'app funziona sempre offline.
- Un gruppo condiviso corrisponde a **una cartella** sullo storage cloud di un membro, ad esempio Google Drive.
  La cartella si condivide con gli altri tramite la normale condivisione del Drive. Non c'è nessun server
  nostro: permessi, spazio e disponibilità sono quelli del provider.
- Il problema da risolvere è la scrittura concorrente, per esempio due persone che aggiungono spese offline
  nello stesso momento. La soluzione è un **log di eventi per dispositivo**.

### 8.2 Struttura della cartella di un gruppo

```text
ExpenseCalcolator/               # cartella creata dall'app nel Drive dell'utente
├─ profile/                      # privata: impostazioni ed elenco dei gruppi (ADR 0005)
│  └─ events/<deviceId>/…
└─ groups/
   └─ <nome-gruppo>__<groupId>/  # se il gruppo è condiviso, si condivide questa cartella
      ├─ group.json              # manifest: groupId, formatVersion, data di creazione
      ├─ events/
      │  ├─ <deviceId-A>/
      │  │  ├─ 000001.json       # segmento: un blocco di eventi, mai modificato
      │  │  └─ 000002.json
      │  └─ <deviceId-B>/
      │     └─ 000001.json
      ├─ snapshots/              # (Fase 7) compattazione del log
      └─ attachments/            # (Fase 7) foto degli scontrini
```

I gruppi creati da altre persone non stanno qui: si trovano tra i file "condivisi con me" e il profilo ne
conserva il riferimento.

### 8.3 Quattro regole che eliminano i conflitti sui file

1. **Un solo scrittore per cartella.** Ogni dispositivo scrive solo in `events/<proprio deviceId>/`, quindi due
   dispositivi non scrivono mai lo stesso file.
2. **File immutabili.** Un segmento si crea e non si modifica più. Niente sovrascritture, quindi niente
   "copie in conflitto" create dai client di sincronizzazione.
3. **Idempotenza.** Ogni evento ha un id univoco: ricevere due volte lo stesso evento non ha effetti.
4. **Determinismo.** Ogni dispositivo ordina tutti gli eventi con lo stesso criterio e li applica con le stesse
   regole. Il criterio è un orologio logico ibrido (HLC), con spareggio su deviceId ed eventId. Così tutti
   arrivano allo stesso stato, anche se ricevono i file in ordine diverso.

### 8.4 Conflitti logici (stessa spesa modificata da due persone) — decisi in [ADR 0007](adr/0007-salvataggio-e-concorrenza.md)

- **Campi diversi:** vincono entrambe le modifiche. L'ultima modifica vince per singolo campo (descrizione,
  data, categoria, note) o per blocco coerente ("importi": totale, pagatori e divisione), non per l'intera spesa.
- **Stesso campo:** vince quella con il timestamp HLC più alto (last-writer-wins). Se il suo autore non aveva
  visto l'altra modifica, la spesa viene segnalata come modificata contemporaneamente, e il valore scartato
  resta nello storico.
- **Eliminazione contro modifica:** l'eliminazione è un campo a sé, che le modifiche non annullano. Vince
  l'eliminazione; la spesa resta nello storico e si può ripristinare con un'azione esplicita.
- **Impostazioni:** stesso meccanismo, una chiave per impostazione. Quelle del gruppo sono condivise, quelle del
  profilo restano personali.
- **Storico:** si conserva sempre. La schermata "Attività" mostra chi ha modificato cosa.

### 8.5 Algoritmo di sync

1. **Push:** gli eventi locali non ancora inviati vengono scritti in un nuovo segmento nella propria cartella.
2. **Pull:** si elencano le cartelle degli altri dispositivi e si scaricano solo i segmenti nuovi. Per ogni
   dispositivo basta ricordare l'ultimo numero di segmento letto.
3. **Merge:** i nuovi eventi vengono validati e aggiunti al log locale, lo stato viene ricalcolato e la UI viene avvisata.

La sync parte all'avvio, dopo ogni modifica (con un breve ritardo per raggruppare le modifiche), con il gesto
"trascina per aggiornare" e periodicamente quando c'è connessione. In caso di errori di rete riprova con
attese crescenti; nel frattempo l'app resta utilizzabile.

### 8.6 Canali di condivisione (plugin)

Ogni modo di condividere è un **plugin separato** in `packages/channels/`, che implementa la porta
`SyncChannel` dell'engine ([ADR 0006](adr/0006-canali-plugin.md)).

- **Cosa fanno:** trasportano soltanto segmenti di eventi. Merge, conflitti e permessi restano in `sync` ed
  `engine`, uguali per tutti i canali.
- **Indipendenza:** ogni canale si sviluppa e si aggiunge separatamente, e le shell includono quelli che
  vogliono. Senza nessun canale l'app funziona in modalità locale.
- **Più canali insieme:** un gruppo può usarne più d'uno.

| Canale                                               | Note                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `file` — file condiviso (WhatsApp, Telegram, email…) | Nessun account; manuale                                                                                 |
| `folder` — cartella sincronizzata                    | Nessun account; su desktop la sincronizzazione la fa il client cloud o Syncthing; sul web solo Chromium |
| `p2p` — peer-to-peer con link o QR                   | Nessun account; serve essere online nello stesso momento; prima serve uno spike                         |
| `gdrive`, `dropbox`, `onedrive`                      | Account cloud; automatici; vincoli in §8.8 e in [CONDIVISIONE.md](CONDIVISIONE.md)                      |

Il confronto completo è in [CONDIVISIONE.md](CONDIVISIONE.md). L'ordine di realizzazione è la decisione D12.

Limite dei canali cloud: tutti i membri che li usano su uno stesso gruppo devono avere un account presso lo
stesso provider, cioè quello che ospita la cartella. Chi non usa l'app resta un membro gestito dagli altri.

### 8.7 Flussi: creare un gruppo e unirsi

- **Creazione:** un gruppo nasce sempre in locale. Con "salva nel cloud" l'app crea la cartella sul Drive del
  creatore e ci carica gli eventi già presenti; con "condividi" il gruppo diventa condiviso
  ([ADR 0005](adr/0005-modalita-uso.md)).
- **Invito:** il creatore condivide la cartella con gli altri, dalla UI di Drive o dall'app tramite API. Poi
  manda un link d'invito o un QR che contiene il riferimento alla cartella.
- **Adesione:**
  1. L'invitato apre l'app e sceglie "Unisciti".
  2. Seleziona la cartella, dal link oppure dal selettore file del Drive.
  3. L'app scarica gli eventi.
  4. L'utente sceglie quale membro è ("io sono Luca").
  5. Da quel momento scrive nella propria sotto-cartella `events/<deviceId>/`.

### 8.8 Note su Google Drive (da verificare nello spike S1)

- Serve un progetto Google Cloud con credenziali OAuth: è gratuito e non richiede hosting.
- Lo scope consigliato è `drive.file`. Non è considerato sensibile: dà accesso solo ai file creati dall'app o
  scelti dall'utente.
- **Punto da verificare:** con `drive.file`, l'app di un membro riesce a leggere i segmenti creati dagli altri
  membri nella cartella condivisa? Se non ci riesce, le alternative sono:
  - (a) far selezionare la cartella con il Google Picker, se questo estende l'accesso al contenuto;
  - (b) usare lo scope `drive` completo lasciando l'app in modalità "testing". Si arriva fino a 100 utenti di
    test senza verifica da parte di Google, che basta per un uso tra amici;
  - (c) ripiegare sulla cartella locale sincronizzata.
- Limiti di frequenza dell'API: si mitigano raggruppando gli eventi in segmenti e, più avanti, con gli snapshot.

**Costi e vincoli (verificati il 2026-10-12)**

- **Drive API:** l'uso standard è gratuito. Dal 1° maggio 2026 i nuovi progetti hanno queste quote:
  - 1.000.000 di unità al minuto per progetto;
  - 325.000 di unità al minuto per utente;
  - una soglia giornaliera di 400.000.000 di unità per progetto.

  Ogni operazione consuma unità: un elenco ne costa 100, un download 200. Google ha annunciato che più
  avanti nel 2026, con almeno 90 giorni di preavviso, l'uso oltre la soglia verrà addebitato sul conto
  Google Cloud. Le tariffe non sono ancora pubbliche.

  La soglia vale per l'intero progetto, cioè per tutti gli utenti dell'app insieme. Una sync consuma circa
  1.000 unità (qualche elenco e qualche download). Con una ventina di sync al giorno per utente, la soglia si
  raggiunge solo oltre i diecimila utenti attivi al giorno.

- **Modalità "testing" della schermata di consenso OAuth:**
  - al massimo 100 utenti di test, indicati per email;
  - i token di accesso scadono dopo 7 giorni, quindi bisogna rifare il login ogni settimana.
- **Pubblicazione in produzione:**
  - con il solo scope `drive.file` (non sensibile), di norma non serve la verifica di Google; servono però
    una pagina di privacy policy e un dominio verificato (da confermare nello spike S1);
  - lo scope `drive` completo invece è "restricted": richiede una verifica di sicurezza annuale (CASA)
    presso un laboratorio esterno, dalle poche centinaia alle migliaia di dollari l'anno. È un motivo in
    più per far funzionare `drive.file` (spike S1).

### 8.9 Sicurezza e privacy

- Chi ha accesso alla cartella può leggere e scrivere: il modello di fiducia è quello di un gruppo di amici.
  Gli eventi letti vengono comunque validati; quelli non validi vengono ignorati e segnalati.
- I dati sono in chiaro presso il provider. Evoluzione prevista (Fase 7): cifratura end-to-end dei segmenti
  con una chiave di gruppo, condivisa tramite il link d'invito.
- Resilienza: ogni dispositivo ha la copia completa. Se la cartella viene cancellata, il gruppo si può
  ripubblicare da qualsiasi dispositivo.

### 8.10 Persistenza locale

- IndexedDB su tutte le piattaforme: la UI gira sempre in un browser o in una WebView, quindi lo stesso adapter
  vale ovunque.
- Sul web si richiede lo storage persistente (`navigator.storage.persist()`) per evitare che il browser cancelli i dati.
- In futuro, se i volumi crescessero, si può passare a SQLite tramite un plugin Tauri.

### 8.11 Permessi (in futuro, predisposti da subito)

Chi può modificare cosa si decide più avanti (D13). Le ipotesi sono due:

- ognuno modifica solo le proprie voci, e il creatore del gruppo può correggere tutto;
- ruoli amministratore e membro.

Il formato dei dati le permette già entrambe ([ADR 0007](adr/0007-salvataggio-e-concorrenza.md)):

- ogni evento registra l'autore (`actor`);
- ogni elemento registra chi l'ha creato;
- ogni dispositivo, applicando gli eventi, passa da una funzione `authorize(stato, evento)`.

Oggi quella funzione permette tutto. Domani applicherà la politica scelta nelle impostazioni del gruppo:
tutti i dispositivi applicano le stesse regole agli stessi eventi, quindi arrivano allo stesso risultato
anche senza un server.

Per renderla inviolabile anche contro un'app modificata serviranno firme digitali per dispositivo (Fase 7).

---

## 9. Specifica della logica di calcolo

### 9.1 Importi

- Gli importi sono interi in unità minori (centesimi): `{ minor: 1234, currency: "EUR" }` vale 12,34 €.
  Mai numeri decimali.
- I decimali di ogni valuta vengono dalla norma ISO 4217 (EUR 2, JPY 0, …), tramite una tabella interna al
  core. Non si usa `Intl`, i cui dati possono cambiare tra browser e versioni ([ADR 0004](adr/0004-valute.md)).
- Le operazioni avvengono solo tra importi della stessa valuta; altrimenti il risultato è l'errore `CurrencyMismatch`.
- Ogni operazione controlla `Number.isSafeInteger`.

### 9.2 Modalità di divisione

| Modalità       | `method`     | Parametri                                                                      | Esempio (90 € tra A, B, C)     |
| -------------- | ------------ | ------------------------------------------------------------------------------ | ------------------------------ |
| Parti uguali   | `equal`      | `memberIds`: i partecipanti                                                    | 30 / 30 / 30                   |
| Importi esatti | `exact`      | `amounts`: importo (con valuta) per partecipante; la somma deve fare il totale | 50 / 25 / 15                   |
| Percentuali    | `percentage` | `percentages`: punti base per partecipante (10000 = 100%)                      | 50% / 30% / 20%                |
| Quote          | `shares`     | `weights`: pesi interi per partecipante                                        | 2 / 1 / 1 → 45 / 22,50 / 22,50 |
| _Più avanti_   | —            | Aggiustamenti (+/− sulle parti uguali), voce per voce da scontrino             | —                              |

Il modello supporta **più pagatori per spesa** fin dall'inizio (es. A paga 60, B paga 30), anche se la prima
UI ne gestirà uno solo.

### 9.3 Arrotondamento deterministico

10,00 € tra 3 persone non si divide esattamente. Si usa il **metodo del resto maggiore**:

1. Ognuno riceve la parte intera (3,33 €).
2. I centesimi avanzati (qui 1) vanno a chi ha il resto frazionario più alto.
3. A parità di resto, decide un ordine stabile. Per non penalizzare sempre la stessa persona, l'ordine ruota
   in base all'id della spesa: parte dal partecipante in posizione `FNV-1a(id) mod n`, dove FNV-1a è l'hash
   standard a 32 bit e `n` il numero di partecipanti. È facile da riprodurre in qualsiasi linguaggio.

Il risultato è identico su ogni dispositivo e la somma delle parti è sempre uguale al totale.

### 9.4 Saldi

Per ogni membro e ogni valuta:
`saldo = pagato − dovuto + rimborsi inviati − rimborsi ricevuti`.

Un saldo positivo vuol dire che il membro deve ricevere, uno negativo che deve dare.
Invariante: la somma dei saldi di un gruppo è sempre 0.

### 9.5 Trasferimenti suggeriti

- **Semplificati (predefinito):** un algoritmo greedy abbina ripetutamente il debitore più grande con il
  creditore più grande. Servono al massimo n−1 trasferimenti. Non è sempre il numero minimo assoluto (trovarlo
  è un problema NP-difficile), ma nella pratica funziona molto bene. Gli spareggi sono deterministici.
- **Non semplificati:** ogni spesa si salda per conto suo (chi ha partecipato paga chi ha pagato), poi i
  debiti di ogni coppia di membri si compensano. Ognuno paga solo persone con cui ha condiviso delle spese:
  è per chi preferisce vedere "chi deve a chi" senza intermediari. Anche così i conti tornano al centesimo,
  pure con più pagatori.

L'ordine dei trasferimenti è fisso, così ogni dispositivo mostra lo stesso elenco. I semplificati seguono
l'ordine in cui l'algoritmo li produce, valuta per valuta; quelli per coppia sono ordinati per valuta, poi per
chi paga, poi per chi riceve.

### 9.6 Valute ([ADR 0004](adr/0004-valute.md))

- **Adesso:**
  - ogni importo ha la sua valuta;
  - il gruppo ha una valuta di riferimento;
  - saldi e trasferimenti si calcolano per valuta;
  - nell'MVP la UI propone solo la valuta del gruppo, ma il modello ne supporta già più di una.
- **Fase 7a:** più valute senza conversione. È solo lavoro di UI.
- **Fase 7b:** conversione nella valuta del gruppo. Il tasso viene **salvato nella spesa** al momento
  dell'inserimento, così il calcolo non dipende mai da servizi online e dà lo stesso risultato su ogni dispositivo.

Nessuno dei due passi richiede di migrare i dati già salvati.

### 9.7 Invarianti (verificati con test property-based)

- La somma delle parti è uguale al totale della spesa.
- La somma dei saldi è 0 per ogni valuta.
- Applicando i trasferimenti suggeriti, tutti i saldi vanno a 0.
- Ogni trasferimento suggerito è positivo e va da un debitore a un creditore.

---

## 10. Struttura delle cartelle

Già creata nel repository: ogni cartella contiene un `README.md` con responsabilità e regole di dipendenza.

```text
ExpenseCalcolator/
├─ README.md
├─ docs/
│  ├─ PLANNING.md                # questo documento
│  └─ adr/                       # registro delle decisioni architetturali
├─ spec/                         # contratti indipendenti dal linguaggio
│  ├─ schemas/                   # JSON Schema generati da packages/schema
│  └─ test-vectors/              # casi "input → output atteso" per il core
├─ packages/
│  ├─ schema/                    # modelli dati, eventi, validazione, migrazioni
│  ├─ core/                      # calcolo puro: importi, divisioni, saldi, debiti
│  ├─ sync/                      # HLC, log eventi, merge, proiezioni (puro)
│  ├─ engine/                    # API pubblica: comandi, query, notifiche, porte
│  ├─ adapters/
│  │  ├─ local-indexeddb/        # LocalStore su IndexedDB (web e app native)
│  │  ├─ local-file/             # LocalStore su file JSON (Node, CLI)
│  │  └─ system/                 # orologio di sistema e id ULID
│  ├─ testing/                   # suite di contratto delle porte, usate dai test
│  ├─ channels/                  # plugin di condivisione (ADR 0006)
│  │  ├─ folder/                 # cartella sincronizzata
│  │  └─ gdrive/                 # Google Drive (altri canali: file, p2p, dropbox, onedrive)
│  └─ ui/                        # SPA condivisa da tutte le shell (React, shadcn/ui)
└─ apps/
   ├─ cli/                       # riga di comando: l'app in modalità locale, senza grafica
   ├─ web/                       # shell web: UI + IndexedDB, build Vite (per ora solo in locale)
   └─ native/                    # shell Tauri 2 (Windows, Android; poi macOS/Linux/iOS)
```

---

## 11. Roadmap

### 11.1 Milestone

| Milestone                | Risultato                                                             | Fasi |
| ------------------------ | --------------------------------------------------------------------- | ---- |
| **M1** Core verificato   | Calcolo completo e testato, senza UI                                  | 0–1  |
| **M2** App locale        | Modalità locale: app usabile su un solo dispositivo (web, in locale)  | 2–3  |
| **M3** App installabili  | Windows e Android                                                     | 4    |
| **M4** Multi-dispositivo | Modalità personale: dati e profilo sincronizzati tramite una cartella | 5    |
| **M5** Gruppi condivisi  | Modalità condivisa: Google Drive, inviti, adesione                    | 6    |

Il modello a eventi viene progettato già in Fase 2, anche se la sync remota arriva in Fase 5. In questo modo
l'app diventa usabile presto senza dover rifare il modello dati dopo.

Gli spike (§13.2) non bloccano il core, quindi stanno fuori dalla Fase 0:

- **S1 (Google Drive)** si fa in parallelo alla Fase 1. È il rischio più alto (R1), quindi conviene saperne
  l'esito presto.
- **S2 (Tauri)**, ed eventualmente S3, si fa prima di iniziare la Fase 4.

### 11.2 Fase 0 — Fondamenta (completata)

- [x] Chiudere D1 (TypeScript), D2 (React + Vite) e D5 (Zod 4): ADR 0001, 0002 e 0003.
- [x] Inizializzare git, il monorepo pnpm, TypeScript strict, ESLint/Prettier e Vitest.
- [x] Definire le regole sui confini tra pacchetti (dependency-cruiser), verificate con violazioni di prova.
- [x] Preparare la CI su GitHub Actions (`pnpm check`).

**Fatto quando:** `pnpm check` passa in locale e D1, D2 e D5 sono registrate come ADR. La CI è partita con
la pubblicazione del repository su GitHub, dopo la Fase 2.

### 11.3 Fase 1 — Core di calcolo (`packages/core`) (completata, tranne lo spike S1)

- [x] Tipo `Money` (importo e valuta) con le sue operazioni. Comprende la tabella delle valute ISO 4217 e
      l'errore `CurrencyMismatch` ([ADR 0004](adr/0004-valute.md)). La formattazione per l'utente sta nella UI.
- [x] Algoritmo di ripartizione con il resto maggiore (§9.3).
- [x] Modalità di divisione: parti uguali, importi esatti, percentuali, quote.
- [x] Più pagatori per spesa.
- [x] Calcolo dei saldi per valuta, comprese spese e rimborsi.
- [x] Trasferimenti suggeriti, semplificati e per coppia.
- [x] Errori di dominio tipizzati (es. somma degli importi ≠ totale, nessun partecipante).
- [x] Test unitari, test property-based e primi test vector in `spec/test-vectors`.
- [x] CLI Node (`apps/cli`) che calcola saldi e trasferimenti da un file JSON. Passa dall'engine
      (`calculateLedger`) e dimostra che la logica funziona senza UI. Dopo la Fase 2 è diventata un'app
      completa in modalità locale: gruppi salvati su file (`adapters/local-file`), comandi per membri,
      spese, rimborsi e impostazioni, ed esporta/importa per passare un gruppo ad altri tramite file.
- [ ] In parallelo: spike S1 su Google Drive (§13.2), poi decisione D4.

**Fatto quando:**

- copertura ≥ 95%;
- gli invarianti di §9.7 sono verificati;
- zero dipendenze a runtime;
- il core compila senza tipi DOM o Node.

### 11.4 Fase 2 — Modelli, eventi, engine (completata)

- [x] Entità, eventi (gruppo e profilo) e comandi in `schema`.
- [x] Esportazione del JSON Schema in `spec/schemas` (`pnpm schemas`), con un test che la verifica.
- [x] Busta degli eventi: id, stream, tipo, versione, HLC, deviceId, autore (`actor`) e versione di partenza
      (`base`) ([ADR 0007](adr/0007-salvataggio-e-concorrenza.md)).
- [x] HLC e ordinamento deterministico.
- [x] Proiezione eventi → stato, con le regole di conflitto di §8.4: ultima modifica per campo o blocco,
      eliminazione come campo a sé, segnalazione delle modifiche contemporanee.
- [x] Funzione `authorize(stato, evento)`, per ora con la politica "tutti possono tutto" (§8.11).
- [x] Prima query senza stato dell'engine: `calculateLedger`, che valida un registro esterno e lo calcola
      (usata dalla CLI).
- [x] Facade `engine`: comandi, query, `subscribe`, risultati come `Result`; comandi eseguiti uno alla
      volta; `exportEvents` e `receiveEvents` come gancio per i canali.
- [x] Porte `LocalStore`, `Clock`, `IdGenerator`, con implementazioni in memoria per i test. La porta
      `SyncChannel` si definisce in Fase 5, con il primo canale.
- [x] Adapter `local-indexeddb` (con suite di contratto della porta) e `system` (orologio e id ULID).
- [x] Profilo locale: impostazioni (valuta predefinita, lingua, nome) ed elenco dei gruppi ([ADR 0005](adr/0005-modalita-uso.md)).
- [x] Simulazione con più dispositivi: modifiche e sincronizzazioni in ordine casuale convergono sempre.

**Fatto quando:** un test end-to-end senza UI fa questo percorso e ottiene gli stessi saldi (verificato in
`packages/adapters/local-indexeddb/test/end-to-end.test.ts`):

1. crea un gruppo, i membri e le spese;
2. chiude il processo;
3. riapre i dati da IndexedDB.

### 11.5 Fase 3 — UI MVP (web app locale, un solo dispositivo) (in corso)

- [x] Scegliere la libreria di componenti: shadcn/ui ([ADR 0008](adr/0008-componenti-ui-shadcn.md)).
- [x] Impostare la struttura di `ui` e `apps/web`, il routing (hash) e il tema chiaro/scuro (segue il sistema).
- Schermate:
  - [x] elenco gruppi e nuovo gruppo;
  - [x] dettaglio gruppo con spese, saldi e trasferimenti suggeriti;
  - [x] nuova o modifica spesa, con tutte le modalità di divisione e più pagatori; elimina e ripristina;
  - [x] membri: aggiungi, rinomina, archivia, «sono io»;
  - [x] registra rimborso, anche partendo da un trasferimento suggerito; elimina e ripristina;
  - [x] impostazioni (valuta predefinita, nome). La lingua arriverà con le traduzioni;
  - [ ] impostazioni del gruppo (nome, archiviazione);
  - [ ] attività (storico delle modifiche);
  - [ ] esporta e importa un gruppo come file, come nella CLI.
- [x] Testi in italiano, importi e date formattati con `Intl`.
- [x] Valuta: le spese usano solo quella del gruppo, ma i saldi si mostrano già per valuta ([ADR 0004](adr/0004-valute.md)).
- [x] Richiesta di storage persistente nel browser. Manifest e service worker (PWA) rimandati finché la web
      app non sarà pubblicata ([ADR 0009](adr/0009-distribuzione-locale.md)).
- [x] Test d'integrazione della UI con jsdom e Testing Library: l'app intera, con un engine in memoria.
- [ ] Test E2E dei percorsi principali con Playwright, in un browser vero.
- [x] Pubblicare il repository su GitHub (fatto dopo la Fase 2).
- [x] Decidere dove pubblicare la web app: per ora da nessuna parte, solo in locale
      ([ADR 0009](adr/0009-distribuzione-locale.md)).

**Fatto quando:** l'app si usa davvero per un gruppo su un solo dispositivo, anche in modalità aereo.

### 11.6 Fase 4 — Shell native (`apps/native`)

- [ ] Prima di iniziare: spike S2 (ed eventualmente S3, §13.2), poi decisione D3.
- [ ] Build Windows con Tauri 2: un installer che carica la UI dai file locali.
- [ ] Build Android: APK per i test, AAB per un eventuale store. Gestire tasto indietro, aree sicure dello schermo e tastiera.
- [ ] Verificare che IndexedDB resti persistente in WebView2 e nella WebView di Android.
- [ ] Icone, splash, nome dell'app, firma.

**Fatto quando:** la stessa build della UI gira su web, Windows e Android, senza modifiche al codice di `core`, `engine` o `ui`.

### 11.7 Fase 5 — Sync tramite cartella sincronizzata

- [ ] Formato della cartella del gruppo e dei segmenti (§8.2), manifest `group.json`.
- [ ] Algoritmo push/pull/merge (§8.5) e stato della sync visibile nella UI.
- [ ] Porta `SyncChannel` e suite di test di contratto per i canali ([ADR 0006](adr/0006-canali-plugin.md)).
- [ ] Canale `folder` (plugin): Tauri fs su desktop, File System Access API sul web con Chromium.
- [ ] Gli altri canali senza account (`file`, poi `p2p`) secondo l'ordine scelto in D12.
- [ ] Test di simulazione con più dispositivi, con un canale in memoria.
- [ ] Esportazione e importazione del gruppo come file (ripiego universale).
- [ ] Sync del profilo e passaggio di un gruppo da locale a personale ("salva nel cloud").

**Fatto quando:** due PC che condividono la stessa cartella sincronizzata (es. con Google Drive per desktop)
arrivano agli stessi saldi dopo modifiche offline fatte in contemporanea.

### 11.8 Fase 6 — Google Drive e condivisione

- [ ] Progetto Google Cloud e credenziali OAuth per web e Android.
- [ ] Login OAuth (PKCE) su web e Android.
- [ ] Canale `gdrive` (plugin), con gestione dei limiti di frequenza e dei tentativi.
- [ ] Flussi: crea gruppo condiviso, invita (link o QR), unisciti, "chi sei?".
- [ ] Passaggio di un gruppo da personale a condiviso ("condividi") e ritorno ("smetti di condividere").
- [ ] Esperienza utente per conflitti e attività (es. "modificato da Sara mentre lo modificavi anche tu").

**Fatto quando:** tre persone su tre dispositivi diversi (web, Windows, Android) gestiscono lo stesso gruppo
senza alcun server nostro.

### 11.9 Fase 7 — Evoluzioni (ordine da decidere)

- 7a — Più valute senza conversione (solo UI, [ADR 0004](adr/0004-valute.md)).
- 7b — Conversione nella valuta del gruppo, con tasso salvato nella spesa ([ADR 0004](adr/0004-valute.md)).
- Categorie, ricerca, filtri, statistiche.
- Foto degli scontrini (`attachments/`).
- Esportazione CSV e PDF.
- Snapshot e compattazione del log.
- Cifratura end-to-end dei segmenti.
- Permessi secondo la politica scelta in D13, e firme digitali per dispositivo che li rendono inviolabili (§8.11).
- Provider OneDrive e Dropbox.
- iOS, macOS, Linux.
- Spese ricorrenti.

---

## 12. Decisioni aperte

| ID  | Decisione                                                               | Stato           | Scelta o raccomandazione                                                                                                                                                                                                                   | Quando                                 |
| --- | ----------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| D1  | Linguaggio del core e dell'intera app                                   | **Decisa**      | TypeScript ([ADR 0001](adr/0001-linguaggio-typescript.md))                                                                                                                                                                                 | —                                      |
| D2  | Framework UI                                                            | **Decisa**      | React + Vite ([ADR 0002](adr/0002-framework-ui-react.md))                                                                                                                                                                                  | —                                      |
| D3  | Shell per Android                                                       | Aperta          | Tauri 2; Capacitor se lo spike S2 trova problemi, soprattutto con il login Google                                                                                                                                                          | Dopo S2                                |
| D4  | Primo provider cloud e relativo scope OAuth                             | Aperta          | Google Drive; scope scelto in base a S1                                                                                                                                                                                                    | Dopo S1                                |
| D5  | Libreria per schema e validazione                                       | **Decisa**      | Zod 4 ([ADR 0003](adr/0003-schema-validazione-zod.md))                                                                                                                                                                                     | —                                      |
| D6  | Regole di conflitto                                                     | **Decisa**      | Ultima modifica per campo o blocco, eliminazione che vince, modifiche contemporanee segnalate ([ADR 0007](adr/0007-salvataggio-e-concorrenza.md))                                                                                          | Inizio Fase 2                          |
| D7  | Pubblicare la versione web? Dove?                                       | **Decisa**      | Per ora no: inclusa nelle app native e usata in locale nel browser ([ADR 0009](adr/0009-distribuzione-locale.md))                                                                                                                          | —                                      |
| D8  | Libreria di componenti UI                                               | **Decisa**      | shadcn/ui con Tailwind CSS ([ADR 0008](adr/0008-componenti-ui-shadcn.md))                                                                                                                                                                  | —                                      |
| D9  | Gestione delle valute                                                   | **Decisa**      | Valuta esplicita ovunque, conversione rimandata ([ADR 0004](adr/0004-valute.md))                                                                                                                                                           | —                                      |
| D10 | Dettagli della conversione (direzione del tasso, arrotondamento, fonte) | Aperta          | Vedi "Da decidere" in [ADR 0004](adr/0004-valute.md)                                                                                                                                                                                       | Fase 7b                                |
| D11 | Modalità d'uso (locale, personale, condivisa) e profilo utente          | **Decisa**      | Un solo meccanismo; cambia solo dove è pubblicato il log ([ADR 0005](adr/0005-modalita-uso.md))                                                                                                                                            | —                                      |
| D12 | Canali di condivisione e loro ordine                                    | In parte decisa | Canali come plugin separati ([ADR 0006](adr/0006-canali-plugin.md)). Ordine ancora aperto: prima file condiviso e cartella sincronizzata (nessun account), poi peer-to-peer, infine un provider cloud ([CONDIVISIONE.md](CONDIVISIONE.md)) | Prima della Fase 5                     |
| D13 | Permessi: chi può modificare cosa                                       | Aperta          | Predisposti in ADR 0007, per ora "tutti possono tutto". Ipotesi: ognuno modifica le proprie voci e il creatore corregge tutto, oppure ruoli (§8.11)                                                                                        | Quando servirà, al più tardi in Fase 7 |

---

## 13. Rischi e spike

### 13.1 Rischi

| ID  | Rischio                                                                                                     | Probabilità | Impatto | Mitigazione                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| R1  | Con lo scope `drive.file` un membro non riesce a leggere i file creati dagli altri nella cartella condivisa | Media       | Alto    | Spike S1; alternative in §8.8                                                                                 |
| R2  | Login Google su Android con Tauri complicato                                                                | Media       | Medio   | Spike S2; ripiego su Capacitor, che ha plugin maturi                                                          |
| R3  | Lentezza o limiti dell'API con molti file piccoli                                                           | Media       | Medio   | Eventi raggruppati in segmenti, letture incrementali, snapshot                                                |
| R4  | Membri con versioni diverse dell'app                                                                        | Alta        | Medio   | `formatVersion`, upcaster, sola lettura (§6.3)                                                                |
| R5  | Conflitti risolti in modo poco intuitivo per l'utente                                                       | Bassa       | Medio   | Regole semplici, storico visibile, avviso nella UI                                                            |
| R6  | Orologi dei dispositivi non allineati                                                                       | Media       | Basso   | HLC: l'ordine non dipende solo dall'ora di sistema                                                            |
| R7  | Il browser cancella i dati locali (versione web)                                                            | Bassa       | Medio   | Storage persistente e copia nel cloud                                                                         |
| R8  | Differenze tra WebView, soprattutto su Android vecchi                                                       | Bassa       | Basso   | `minSdk` adeguato, WebView aggiornata dal Play Store, test su dispositivo reale                               |
| R9  | Costi della Drive API se l'app avesse moltissimi utenti (nuovo modello di Google del 2026, §8.8)            | Bassa       | Medio   | Segmenti e snapshot per ridurre le chiamate; provider alternativi (cartella sincronizzata, OneDrive, Dropbox) |
| R10 | Senza la verifica di Google, login da rifare ogni 7 giorni e massimo 100 utenti                             | Alta        | Basso   | Accettabile per uso personale; per un'app pubblica basta lo scope `drive.file`, che non richiede la verifica  |

### 13.2 Spike (prototipi usa-e-getta con tempo limitato)

**S1 — Google Drive condiviso** (massimo 2 giorni)

- **Domanda:** l'utente A condivide una cartella con B e C. Con lo scope `drive.file`, sul web e su Android,
  B riesce a leggere i segmenti creati da A e da C? Cambia qualcosa se B seleziona la cartella con il Google Picker?
- **Risultato atteso:** una tabella scope × piattaforma con cosa funziona; da lì si decide D4.

**S2 — Tauri 2 su Windows e Android** (massimo 3 giorni)

- **Domanda:** una SPA minima caricata dai file locali funziona offline?
- **Da verificare inoltre:**
  - IndexedDB resta persistente dopo il riavvio dell'app;
  - il login OAuth Google su Android funziona tramite redirect o deep link;
  - quanto pesano gli installer.
- **Risultato atteso:** decisione D3.

**S3 — Capacitor su Android** (massimo 1 giorno, solo se S2 fallisce)

- Stesse verifiche di S2, solo per Android.

---

## 14. Test e tooling

**Strumenti:**

- Monorepo con **pnpm workspaces**, **TypeScript 6** in modalità strict. Non usiamo la 7 perché
  typescript-eslint non la supporta ancora: da rivalutare quando la supporterà.
- **Vite** per la build, **Vitest** per i test, **fast-check** per i test property-based, **Playwright** per i test E2E.
- **Zod 4** per modelli dati, validazione e generazione del JSON Schema (ADR 0003).
- **ESLint** con il set raccomandato del plugin ufficiale di ogni linguaggio in uso:

  | Linguaggio                 | Regole                                                                                                                                     |
  | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
  | JavaScript e TypeScript    | `@eslint/js` e typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, più `switch-exhaustiveness-check`                           |
  | React                      | `eslint-plugin-react-hooks` (regole ufficiali, comprese quelle del React Compiler) e `eslint-plugin-react-refresh` (modello React di Vite) |
  | Test                       | `@vitest/eslint-plugin`                                                                                                                    |
  | JSON e JSONC               | `@eslint/json`                                                                                                                             |
  | Markdown (dialetto GitHub) | `@eslint/markdown`, che verifica anche i link interni ai documenti                                                                         |

  YAML (configurazione della CI e del workspace) è solo formattato e validato sintatticamente da Prettier.

- **TypeScript** con i controlli di `@tsconfig/strictest`, la configurazione base più rigorosa della community.
- **Prettier** per la formattazione; **dependency-cruiser** per far rispettare i confini tra pacchetti.
- **GitHub Actions** per la CI: a ogni push su `main` e a ogni pull request esegue `pnpm check`
  (formattazione, lint, tipi, confini tra pacchetti, test con copertura).

**Convenzioni del repository:**

- **Nessuna build per i pacchetti interni.** Ogni pacchetto espone solo `src/index.ts` (campo `exports` del
  `package.json`); Vite e Vitest leggono direttamente il TypeScript. `packages/ui` espone in più gli stili e,
  per percorso, i componenti di shadcn/ui (`@expense/ui/components/ui/button`).
- **Test in una cartella separata:** `packages/<pacchetto>/test/`, con file `*.test.ts` (`*.test.tsx` per
  React).
- **Due configurazioni TypeScript.** Il codice in `src/` si controlla con il `tsconfig.json` del pacchetto,
  che ha solo i tipi della sua piattaforma: nessuno per `schema`, `core`, `sync` ed `engine`, DOM per UI e
  web, Node per la CLI. I test si controllano con il `tsconfig.json` della radice, che include i tipi di Node
  e DOM.
- **Un solo comando di verifica.** `pnpm check` esegue in sequenza formattazione, lint, controllo dei tipi,
  confini e test. È lo stesso comando che usa la CI.

**Regole controllate automaticamente:**

| Regola                                                                                                     | Dove                                              | Strumento          |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------ |
| Niente API del browser o di Node in `schema`, `core`, `sync`, `engine`                                     | `tsconfig.base.json` (`lib: ES2022`, `types: []`) | TypeScript         |
| Niente `Date.now()`, `new Date()` o `Math.random()` negli stessi pacchetti                                 | `eslint.config.js`                                | ESLint             |
| Tipi espliciti in ingresso e in uscita per le funzioni esportate dagli stessi pacchetti                    | `eslint.config.js`                                | ESLint             |
| Dipendenze solo verso il basso; dal core verso schema solo `import type`; niente moduli Node; niente cicli | `.dependency-cruiser.mjs`                         | dependency-cruiser |

**Livelli di test:**

| Livello                    | Cosa verifica                                                                                                                                                                         | Dove                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Unitari                    | Ogni funzione del core                                                                                                                                                                | `packages/core`                              |
| Test vector                | Casi "input → output atteso" condivisi tra linguaggi                                                                                                                                  | `spec/test-vectors`                          |
| Property-based             | Invarianti di §9.7, generando migliaia di casi casuali                                                                                                                                | `packages/core`, `packages/sync`             |
| Simulazione sync           | N dispositivi virtuali, canale in memoria, ordini di arrivo casuali. Il risultato deve essere lo stesso stato a prescindere dall'ordine, e un evento ripetuto non deve avere effetto. | `packages/sync`, `packages/engine`           |
| Contratto adapter e canali | Ogni adapter `LocalStore` e ogni canale `SyncChannel` passa la stessa suite di test della sua porta                                                                                   | `packages/adapters/*`, `packages/channels/*` |
| UI                         | Logica dei form (importi, divisioni, errori per campo) e l'app intera usata come farebbe una persona: jsdom e Testing Library, con un engine in memoria                               | `packages/ui`                                |
| E2E                        | Percorsi principali della UI in un browser vero, con IndexedDB (Playwright)                                                                                                           | `apps/web`                                   |

---

## 15. Glossario

| Termine              | Significato                                                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Porta / Adapter**  | Interfaccia richiesta dalla logica / sua implementazione concreta per una piattaforma o un servizio.                                                             |
| **Canale**           | Plugin che trasporta segmenti di eventi tra dispositivi: file condiviso, cartella sincronizzata, peer-to-peer, cloud.                                            |
| **Autore (`actor`)** | Il membro che ha fatto una modifica, registrato in ogni evento: serve allo storico e ai permessi futuri.                                                         |
| **Evento**           | Fatto immutabile ("spesa aggiunta", "membro rinominato"). Lo stato si ottiene applicando gli eventi in ordine.                                                   |
| **Proiezione**       | Lo stato corrente calcolato a partire dagli eventi.                                                                                                              |
| **Segmento**         | File immutabile che contiene un blocco di eventi scritti da un dispositivo.                                                                                      |
| **HLC**              | _Hybrid Logical Clock_: orologio che combina l'ora di sistema con un contatore logico, per ordinare gli eventi in modo coerente anche con orologi non allineati. |
| **Local-first**      | I dati vivono prima di tutto sul dispositivo; il cloud serve solo a condividerli.                                                                                |
| **Shell**            | L'app nativa (o la web app nel browser) che contiene e mostra la UI web.                                                                                         |
| **WebView**          | Componente del sistema operativo che mostra pagine web dentro un'app (WebView2 su Windows, System WebView su Android).                                           |
| **PWA**              | _Progressive Web App_: sito installabile che funziona offline grazie a un Service Worker.                                                                        |

---

## Riferimenti

- Tauri 2: <https://v2.tauri.app/>
- Capacitor: <https://capacitorjs.com/>
- Scope dell'API di Google Drive: <https://developers.google.com/workspace/drive/api/guides/api-specific-auth>
- Google Picker per app desktop e mobile: <https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker>
