# ExpenseCalcolator — Documento di pianificazione

> **Stato:** v0.6 (D1, D2, D5, D9 e D11 decise; setup della Fase 0 completato) · **Ultimo aggiornamento:** 2026-10-12
>
> Scopo: fissare architettura, decisioni tecniche e piano di lavoro **prima** di scrivere codice.
> Le voci marcate **[DA CONFERMARE — Dn]** sono raccomandazioni: si chiudono in §12 (dopo gli spike di §13)
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

```
 Shell            apps/web (PWA)          apps/native (Tauri 2: Windows, Android)
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

| Pacchetto    | Responsabilità                                                                                  | Può dipendere da                     | Dove gira            |
| ------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------- |
| `schema`     | Tipi di entità, eventi, comandi e query; validazione; JSON Schema; migrazioni                   | —                                    | ovunque              |
| `core`       | Calcolo: importi, divisioni, saldi, semplificazione dei debiti                                  | `schema` (solo tipi)                 | ovunque              |
| `sync`       | Orologio logico (HLC), merge dei log di eventi, proiezione eventi → stato, formato dei segmenti | `schema`                             | ovunque              |
| `engine`     | API pubblica (comandi, query, notifiche); definisce le porte                                    | `schema`, `core`, `sync`             | ovunque              |
| `adapters/*` | Implementazioni delle porte (IndexedDB, cartella, Google Drive)                                 | `engine` (solo interfacce), `schema` | dipende dall'adapter |
| `ui`         | Schermate e componenti                                                                          | `engine`, `schema`                   | browser / WebView    |
| `apps/*`     | Impacchettano la UI e collegano all'engine gli adapter giusti per la piattaforma                | `ui`, `adapters/*`                   | piattaforma          |

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
    "paidBy": [{ "memberId": "m_anna", "minor": 9000 }],
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

| Porta         | Scopo                                                  | Adapter previsti                                                       |
| ------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `LocalStore`  | Salvare e leggere eventi e stato in locale             | IndexedDB (vale su tutte le piattaforme, §8.10); in memoria per i test |
| `RemoteStore` | Elencare, leggere e creare file in una cartella remota | Cartella locale sincronizzata; Google Drive; in memoria per i test     |
| `Clock`       | Ora corrente                                           | Di sistema; finto per i test                                           |
| `IdGenerator` | Id univoci ordinabili (ULID o UUIDv7)                  | Di sistema; deterministico per i test                                  |

`RemoteStore` è volutamente minimo: `list(path)`, `read(path)`, `create(path, bytes)`. Non esiste "sovrascrivi"
(§8.3). Aggiungere un provider cloud vuol dire implementare queste tre operazioni. Login e token sono affare
interno di ciascun adapter.

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

| Piattaforma               | Shell                                  | Motore di rendering                             | Come servono le pagine locali                                                         |
| ------------------------- | -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Windows (poi macOS/Linux) | Tauri 2                                | WebView2 (Chromium, già presente in Windows 11) | Protocollo interno che legge i file dal pacchetto dell'app                            |
| Android                   | Tauri 2 (in alternativa Capacitor, D3) | Android System WebView (Chromium)               | Come sopra                                                                            |
| Web                       | PWA                                    | Browser                                         | Un Service Worker mette in cache tutta l'app alla prima visita e poi la serve offline |

- **Nessun webserver vero.** Le shell non aprono una porta su `localhost`. Registrano un protocollo interno
  (su Windows, Tauri usa `http://tauri.localhost`) che risponde leggendo i file dal pacchetto. L'effetto è
  quello del "webserver locale" che avevi in mente, ma senza porte aperte, conflitti, richieste del firewall o
  accessi da altre app.
- Di conseguenza la UI non dipende mai dalla rete: la rete serve solo a sincronizzare i dati.
- La versione web va comunque pubblicata come file statici da qualche parte, per esempio GitHub Pages o
  Cloudflare Pages: sono gratuiti e non richiedono backend né DB. Se non si vuole neanche questo, si rinuncia
  alla versione web e si resta sulle app installabili **[DA CONFERMARE — D7]**.

### 7.3 Perché Tauri e non Electron

- **Electron** è il più vicino a Spotify e Steam, perché incorpora un proprio Chromium. Però l'installer pesa
  oltre 100 MB e non supporta Android.
- **Tauri 2** usa la WebView del sistema operativo: installer di pochi MB e un solo progetto per desktop e
  mobile. Il lato nativo è in Rust, ma per noi si limita a configurazione e plugin (accesso al file system, deep link).
- **Capacitor** è più maturo su mobile e ha molti plugin, ad esempio per il login Google nativo, ma non copre
  il desktop. La scelta per Android si fa dopo lo spike S2 **[D3]**.

### 7.4 Framework UI: React + Vite — **deciso** ([ADR 0002](adr/0002-framework-ui-react.md))

Motivi principali:

- ha l'ecosistema più ampio per un'app che deve funzionare bene sia su touch sia su desktop;
- offre una via di fuga verso React Native, se un giorno la WebView non bastasse su mobile.

La UI legge lo stato tramite `engine.subscribe`, che in React si collega direttamente con
`useSyncExternalStore`. La libreria di componenti si sceglie in Fase 3 **[D8]**.

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

```
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

### 8.4 Conflitti logici (stessa spesa modificata da due persone) **[DA CONFERMARE — D6]**

- **Modifica contro modifica:** vince quella con il timestamp HLC più alto. È un last-writer-wins a livello di
  spesa; si può raffinare a livello di singolo campo.
- **Eliminazione contro modifica concorrente:** vince l'eliminazione. La spesa resta nello storico e si può ripristinare.
- Lo storico degli eventi si conserva sempre. La schermata "Attività" mostra chi ha modificato cosa e la UI
  segnala le modifiche concorrenti.

### 8.5 Algoritmo di sync

1. **Push:** gli eventi locali non ancora inviati vengono scritti in un nuovo segmento nella propria cartella.
2. **Pull:** si elencano le cartelle degli altri dispositivi e si scaricano solo i segmenti nuovi. Per ogni
   dispositivo basta ricordare l'ultimo numero di segmento letto.
3. **Merge:** i nuovi eventi vengono validati e aggiunti al log locale, lo stato viene ricalcolato e la UI viene avvisata.

La sync parte all'avvio, dopo ogni modifica (con un breve ritardo per raggruppare le modifiche), con il gesto
"trascina per aggiornare" e periodicamente quando c'è connessione. In caso di errori di rete riprova con
attese crescenti; nel frattempo l'app resta utilizzabile.

### 8.6 Provider (adapter `RemoteStore`)

In ordine di implementazione:

1. **Cartella locale sincronizzata (desktop).** L'app scrive in una cartella del disco che è già sincronizzata
   da Google Drive per desktop, OneDrive, Dropbox o Syncthing. Non servono API né login: il lavoro lo fa il
   client di sincronizzazione. È anche il modo più comodo per sviluppare e testare la sync. Sul web funziona
   solo nei browser basati su Chromium (File System Access API).
2. **Google Drive API (Android e web, poi anche desktop).** L'utente fa login OAuth e l'app legge e scrive
   direttamente nella cartella condivisa.
3. **In seguito:** OneDrive (Microsoft Graph) e Dropbox.
4. **Ripiego sempre disponibile:** esportare e importare il gruppo come file da mandare via WhatsApp o email.

Limite: tutti i membri che usano l'app su uno stesso gruppo devono usare lo stesso provider, cioè quello che
ospita la cartella. Chi non usa l'app resta un membro gestito dagli altri.

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

| Modalità       | Parametri                                                          | Esempio (90 € tra A, B, C)     |
| -------------- | ------------------------------------------------------------------ | ------------------------------ |
| Parti uguali   | Partecipanti                                                       | 30 / 30 / 30                   |
| Importi esatti | Importo per partecipante; la somma deve fare il totale             | 50 / 25 / 15                   |
| Percentuali    | Punti base (10000 = 100%)                                          | 50% / 30% / 20%                |
| Quote          | Pesi interi                                                        | 2 / 1 / 1 → 45 / 22,50 / 22,50 |
| _Più avanti_   | Aggiustamenti (+/− sulle parti uguali), voce per voce da scontrino | —                              |

Il modello supporta **più pagatori per spesa** fin dall'inizio (es. A paga 60, B paga 30), anche se la prima
UI ne gestirà uno solo.

### 9.3 Arrotondamento deterministico

10,00 € tra 3 persone non si divide esattamente. Si usa il **metodo del resto maggiore**:

1. Ognuno riceve la parte intera (3,33 €).
2. I centesimi avanzati (qui 1) vanno a chi ha il resto frazionario più alto.
3. A parità di resto, decide un ordine stabile. Per non penalizzare sempre la stessa persona, l'ordine ruota
   in base all'id della spesa.

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
- **Non semplificati:** debiti per ogni coppia di membri, ricavati dalle singole spese. È per chi preferisce
  vedere "chi deve a chi" senza intermediari.

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

```
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
│  │  ├─ local-indexeddb/        # LocalStore su IndexedDB
│  │  ├─ remote-folder/          # RemoteStore su cartella sincronizzata
│  │  └─ remote-gdrive/          # RemoteStore su Google Drive API
│  └─ ui/                        # SPA condivisa da tutte le shell
└─ apps/
   ├─ web/                       # shell PWA (manifest, service worker, deploy statico)
   └─ native/                    # shell Tauri 2 (Windows, Android; poi macOS/Linux/iOS)
```

---

## 11. Roadmap

### 11.1 Milestone

| Milestone                | Risultato                                                             | Fasi |
| ------------------------ | --------------------------------------------------------------------- | ---- |
| **M1** Core verificato   | Calcolo completo e testato, senza UI                                  | 0–1  |
| **M2** App locale        | Modalità locale: app usabile su un solo dispositivo (web/PWA)         | 2–3  |
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

**Fatto quando:** `pnpm check` passa in locale e D1, D2 e D5 sono registrate come ADR. La CI partirà
quando il repository verrà pubblicato su GitHub, cioè quando ci sarà qualcosa di visibile (Fase 3).

### 11.3 Fase 1 — Core di calcolo (`packages/core`)

- [ ] Tipo `Money` (importo e valuta) con le sue operazioni. Comprende la tabella delle valute ISO 4217 e
      l'errore `CurrencyMismatch` ([ADR 0004](adr/0004-valute.md)). La formattazione per l'utente sta nella UI.
- [ ] Algoritmo di ripartizione con il resto maggiore (§9.3).
- [ ] Modalità di divisione: parti uguali, importi esatti, percentuali, quote.
- [ ] Più pagatori per spesa.
- [ ] Calcolo dei saldi per valuta, comprese spese e rimborsi.
- [ ] Trasferimenti suggeriti, semplificati e per coppia.
- [ ] Errori di dominio tipizzati (es. somma degli importi ≠ totale, nessun partecipante).
- [ ] Test unitari, test property-based e primi test vector in `spec/test-vectors`.
- [ ] _(Opzionale)_ Mini CLI Node che usa il core, per dimostrare che funziona senza UI.
- [ ] In parallelo: spike S1 su Google Drive (§13.2), poi decisione D4.

**Fatto quando:**

- copertura ≥ 95%;
- gli invarianti di §9.7 sono verificati;
- zero dipendenze a runtime;
- il core compila senza tipi DOM o Node.

### 11.4 Fase 2 — Modelli, eventi, engine

- [ ] Entità ed eventi in `schema`, con esportazione del JSON Schema in `spec/schemas`.
- [ ] Busta degli eventi: id, tipo, versione, HLC, deviceId, autore.
- [ ] HLC e ordinamento deterministico.
- [ ] Proiezione eventi → stato, con le regole di conflitto di §8.4.
- [ ] Facade `engine`: comandi, query, `subscribe`, risultati come `Result`.
- [ ] Porte `LocalStore`, `RemoteStore`, `Clock`, `IdGenerator`, con implementazioni in memoria per i test.
- [ ] Adapter `local-indexeddb`.
- [ ] Profilo locale: impostazioni (valuta predefinita, lingua, nome) ed elenco dei gruppi ([ADR 0005](adr/0005-modalita-uso.md)).

**Fatto quando:** un test end-to-end senza UI fa questo percorso e ottiene gli stessi saldi:

1. crea un gruppo, i membri e le spese;
2. chiude il processo;
3. riapre i dati da IndexedDB.

### 11.5 Fase 3 — UI MVP (web/PWA, un solo dispositivo)

- [ ] Scegliere la libreria di componenti (D8), poi impostare la struttura di `ui`, il routing e il tema chiaro/scuro.
- [ ] Schermate:
  - elenco gruppi;
  - dettaglio gruppo con spese e saldi;
  - nuova o modifica spesa, con tutte le modalità di divisione;
  - membri;
  - registra rimborso;
  - attività;
  - impostazioni (valuta predefinita, lingua, nome).
- [ ] Testi in italiano, importi e date formattati con `Intl`.
- [ ] Valuta: le spese usano solo quella del gruppo, ma i saldi si mostrano già per valuta ([ADR 0004](adr/0004-valute.md)).
- [ ] PWA: manifest, service worker, funzionamento offline, richiesta di storage persistente.
- [ ] Test E2E dei percorsi principali con Playwright.
- [ ] Pubblicare il repository su GitHub, appena la UI mostra qualcosa di usabile, e verificare che la CI passi.
      Nello stesso momento si decide D7 (dove pubblicare la versione web).

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
- [ ] Adapter `remote-folder`: Tauri fs su desktop, File System Access API sul web con Chromium.
- [ ] Test di simulazione con più dispositivi e test di contratto per `RemoteStore`.
- [ ] Esportazione e importazione del gruppo come file (ripiego universale).
- [ ] Sync del profilo e passaggio di un gruppo da locale a personale ("salva nel cloud").

**Fatto quando:** due PC che condividono la stessa cartella sincronizzata (es. con Google Drive per desktop)
arrivano agli stessi saldi dopo modifiche offline fatte in contemporanea.

### 11.8 Fase 6 — Google Drive e condivisione

- [ ] Progetto Google Cloud e credenziali OAuth per web e Android.
- [ ] Login OAuth (PKCE) su web e Android.
- [ ] Adapter `remote-gdrive` (`list`/`read`/`create`), con gestione dei limiti di frequenza e dei tentativi.
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
- Provider OneDrive e Dropbox.
- iOS, macOS, Linux.
- Spese ricorrenti.

---

## 12. Decisioni aperte

| ID  | Decisione                                                               | Stato      | Scelta o raccomandazione                                                                           | Quando  |
| --- | ----------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- | ------- |
| D1  | Linguaggio del core e dell'intera app                                   | **Decisa** | TypeScript ([ADR 0001](adr/0001-linguaggio-typescript.md))                                         | —       |
| D2  | Framework UI                                                            | **Decisa** | React + Vite ([ADR 0002](adr/0002-framework-ui-react.md))                                          | —       |
| D3  | Shell per Android                                                       | Aperta     | Tauri 2; Capacitor se lo spike S2 trova problemi, soprattutto con il login Google                  | Dopo S2 |
| D4  | Primo provider cloud e relativo scope OAuth                             | Aperta     | Google Drive; scope scelto in base a S1                                                            | Dopo S1 |
| D5  | Libreria per schema e validazione                                       | **Decisa** | Zod 4 ([ADR 0003](adr/0003-schema-validazione-zod.md))                                             | —       |
| D6  | Regole di conflitto                                                     | Aperta     | Last-writer-wins per spesa; l'eliminazione vince sulla modifica concorrente                        | Fase 2  |
| D7  | Pubblicare la versione web? Dove?                                       | Aperta     | Sì, su hosting statico gratuito (GitHub Pages o Cloudflare Pages)                                  | Fase 3  |
| D8  | Libreria di componenti UI                                               | Aperta     | Confronto tra Ionic React (aspetto nativo Android/iOS) e componenti headless con un design proprio | Fase 3  |
| D9  | Gestione delle valute                                                   | **Decisa** | Valuta esplicita ovunque, conversione rimandata ([ADR 0004](adr/0004-valute.md))                   | —       |
| D10 | Dettagli della conversione (direzione del tasso, arrotondamento, fonte) | Aperta     | Vedi "Da decidere" in [ADR 0004](adr/0004-valute.md)                                               | Fase 7b |
| D11 | Modalità d'uso (locale, personale, condivisa) e profilo utente          | **Decisa** | Un solo meccanismo; cambia solo dove è pubblicato il log ([ADR 0005](adr/0005-modalita-uso.md))    | —       |

---

## 13. Rischi e spike

### 13.1 Rischi

| ID  | Rischio                                                                                                     | Probabilità | Impatto | Mitigazione                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------- | ------- | ------------------------------------------------------------------------------- |
| R1  | Con lo scope `drive.file` un membro non riesce a leggere i file creati dagli altri nella cartella condivisa | Media       | Alto    | Spike S1; alternative in §8.8                                                   |
| R2  | Login Google su Android con Tauri complicato                                                                | Media       | Medio   | Spike S2; ripiego su Capacitor, che ha plugin maturi                            |
| R3  | Lentezza o limiti dell'API con molti file piccoli                                                           | Media       | Medio   | Eventi raggruppati in segmenti, letture incrementali, snapshot                  |
| R4  | Membri con versioni diverse dell'app                                                                        | Alta        | Medio   | `formatVersion`, upcaster, sola lettura (§6.3)                                  |
| R5  | Conflitti risolti in modo poco intuitivo per l'utente                                                       | Bassa       | Medio   | Regole semplici, storico visibile, avviso nella UI                              |
| R6  | Orologi dei dispositivi non allineati                                                                       | Media       | Basso   | HLC: l'ordine non dipende solo dall'ora di sistema                              |
| R7  | Il browser cancella i dati locali (versione web)                                                            | Bassa       | Medio   | Storage persistente e copia nel cloud                                           |
| R8  | Differenze tra WebView, soprattutto su Android vecchi                                                       | Bassa       | Basso   | `minSdk` adeguato, WebView aggiornata dal Play Store, test su dispositivo reale |

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
- **ESLint** e **Prettier**; **dependency-cruiser** per far rispettare i confini tra pacchetti.
- **GitHub Actions** per la CI: lint, controllo dei tipi, test, build. È già configurata e si attiva quando
  il repository viene pubblicato (Fase 3).

**Convenzioni del repository:**

- **Nessuna build per i pacchetti interni.** Ogni pacchetto espone solo `src/index.ts` (campo `exports` del
  `package.json`); Vite e Vitest leggono direttamente il TypeScript.
- **Test in una cartella separata:** `packages/<pacchetto>/test/`, con file `*.test.ts`.
- **Due configurazioni TypeScript.** Il codice in `src/` si controlla con il `tsconfig.json` del pacchetto,
  che non ha né tipi DOM né tipi Node. I test si controllano con il `tsconfig.json` della radice, che include i
  tipi di Node.
- **Un solo comando di verifica.** `pnpm check` esegue in sequenza formattazione, lint, controllo dei tipi,
  confini e test. È lo stesso comando che usa la CI.

**Regole controllate automaticamente:**

| Regola                                                                                                     | Dove                                              | Strumento          |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------ |
| Niente API del browser o di Node in `schema`, `core`, `sync`, `engine`                                     | `tsconfig.base.json` (`lib: ES2022`, `types: []`) | TypeScript         |
| Niente `Date.now()`, `new Date()` o `Math.random()` negli stessi pacchetti                                 | `eslint.config.js`                                | ESLint             |
| Dipendenze solo verso il basso; dal core verso schema solo `import type`; niente moduli Node; niente cicli | `.dependency-cruiser.mjs`                         | dependency-cruiser |

**Livelli di test:**

| Livello           | Cosa verifica                                                                                                                                                                                | Dove                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Unitari           | Ogni funzione del core                                                                                                                                                                       | `packages/core`                    |
| Test vector       | Casi "input → output atteso" condivisi tra linguaggi                                                                                                                                         | `spec/test-vectors`                |
| Property-based    | Invarianti di §9.7, generando migliaia di casi casuali                                                                                                                                       | `packages/core`, `packages/sync`   |
| Simulazione sync  | N dispositivi virtuali, `RemoteStore` in memoria, ordini di arrivo casuali. Il risultato deve essere lo stesso stato a prescindere dall'ordine, e un evento ripetuto non deve avere effetto. | `packages/sync`, `packages/engine` |
| Contratto adapter | Ogni adapter `LocalStore`/`RemoteStore` passa la stessa suite di test                                                                                                                        | `packages/adapters/*`              |
| E2E               | Percorsi principali della UI                                                                                                                                                                 | `apps/web`                         |

---

## 15. Glossario

| Termine             | Significato                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Porta / Adapter** | Interfaccia richiesta dalla logica / sua implementazione concreta per una piattaforma o un servizio.                                                             |
| **Evento**          | Fatto immutabile ("spesa aggiunta", "membro rinominato"). Lo stato si ottiene applicando gli eventi in ordine.                                                   |
| **Proiezione**      | Lo stato corrente calcolato a partire dagli eventi.                                                                                                              |
| **Segmento**        | File immutabile che contiene un blocco di eventi scritti da un dispositivo.                                                                                      |
| **HLC**             | _Hybrid Logical Clock_: orologio che combina l'ora di sistema con un contatore logico, per ordinare gli eventi in modo coerente anche con orologi non allineati. |
| **Local-first**     | I dati vivono prima di tutto sul dispositivo; il cloud serve solo a condividerli.                                                                                |
| **Shell**           | L'app nativa (o la PWA) che contiene e mostra la UI web.                                                                                                         |
| **WebView**         | Componente del sistema operativo che mostra pagine web dentro un'app (WebView2 su Windows, System WebView su Android).                                           |
| **PWA**             | _Progressive Web App_: sito installabile che funziona offline grazie a un Service Worker.                                                                        |

---

## Riferimenti

- Tauri 2: <https://v2.tauri.app/>
- Capacitor: <https://capacitorjs.com/>
- Scope dell'API di Google Drive: <https://developers.google.com/workspace/drive/api/guides/api-specific-auth>
- Google Picker per app desktop e mobile: <https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker>
