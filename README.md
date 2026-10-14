# ExpenseCalcolator

Gestione delle spese di gruppo, stile Splitwise. L'app è:

- **local-first:** i dati vivono sul dispositivo e l'app funziona offline;
- **multipiattaforma:** web, Windows, Android;
- **senza backend:** la condivisione passa dallo storage cloud degli utenti (es. Google Drive).

> **Stato:** Fasi 1 (logica di calcolo), 2 (eventi, salvataggio, engine) e 3 (UI) completate: la web app
> funziona in locale nel browser (`pnpm web`). Fase 4 in corso: l'app per Windows (Tauri) funziona
> (`pnpm native`); Android verrà dopo, in un ambiente di sviluppo dedicato.
> Tutto parte da [docs/PLANNING.md](docs/PLANNING.md); com'è costruito il sistema oggi è in
> [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).

## Cosa si può fare oggi

Su un solo dispositivo, senza account né rete, dalla web app (`pnpm web`) o dalla riga di comando
(`pnpm cli`):

- usare l'app in italiano o in inglese (all'inizio nella lingua del dispositivo);
- creare gruppi, aggiungere le persone e indicare chi sei;
- registrare spese con uno o più pagatori, divise in parti uguali, per importi, percentuali o quote, con data e
  ora facoltativa;
- vedere saldi e trasferimenti suggeriti, registrare i rimborsi;
- ritrovare tutto nello storico, filtrare le spese pagate da te o per te, eliminare e ripristinare;
- vedere nell'elenco dei gruppi quali hanno conti aperti e quali sono in pari, e archiviare quelli conclusi;
- esportare un gruppo su file e importarlo su un altro dispositivo o nella CLI (copia di sicurezza o passaggio
  ad altri).

La sincronizzazione automatica tra dispositivi e la condivisione arrivano con le Fasi 5 e 6.

## Guida: installazione e avvio su Windows

I comandi vanno eseguiti in PowerShell. Dopo aver installato un programma, chiudi e riapri il terminale: solo
così vede i nuovi comandi.

### 1. Programmi necessari

| Programma                          | Serve per                       | Installazione                                                     |
| ---------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| Git                                | scaricare il codice             | `winget install --id Git.Git -e`                                  |
| Node.js 22 o più recente (≥ 22.13) | tutto il progetto               | `winget install --id OpenJS.NodeJS.LTS -e`                        |
| pnpm 10                            | dipendenze e comandi            | `npm install -g pnpm@10`                                          |
| Rust (toolchain MSVC)              | solo l'app per Windows          | `winget install --id Rustlang.Rustup -e`                          |
| Strumenti C++ di Visual Studio     | solo l'app per Windows (linker) | vedi sotto                                                        |
| WebView2                           | solo l'app per Windows          | già incluso in Windows 11; su Windows 10 si installa da Microsoft |
| Microsoft Edge                     | solo i test E2E                 | già incluso in Windows                                            |

Per gli strumenti C++, se Visual Studio 2022 è già installato basta il carico di lavoro **«Sviluppo di
applicazioni desktop con C++»** (dal Visual Studio Installer). Altrimenti si installano solo i Build Tools:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Verifica (ogni comando deve mostrare una versione):

```powershell
git --version
node --version      # v22.13 o più recente
pnpm --version      # 10.x
rustc --version     # solo per l'app per Windows
cargo --version
```

Rust deve usare la toolchain per Windows con MSVC: `rustup default stable-x86_64-pc-windows-msvc` (è già
quella predefinita dell'installer).

### 2. Codice e dipendenze

```powershell
git clone https://github.com/Andrea-Speranza/ExpenseCalcolator.git
cd ExpenseCalcolator
pnpm install        # scarica le dipendenze di tutto il progetto
pnpm check          # facoltativo: verifica che tutto funzioni (formattazione, lint, tipi, test, build)
```

### 3. Web app

```powershell
pnpm web            # sviluppo: apri http://localhost:5173 (si aggiorna da sola quando cambi il codice)
pnpm web:preview    # versione finale: apri http://localhost:4173
pnpm e2e            # facoltativo: test E2E in Edge
```

Per fermarla: `Ctrl+C` nel terminale. Il server ascolta solo sul tuo PC, non è raggiungibile dalla rete.

### 4. App per Windows

```powershell
pnpm native         # sviluppo: apre la finestra dell'app collegata a `pnpm web`
pnpm native:build   # build di rilascio con l'installer
pnpm native:check   # facoltativo: controlli sul codice Rust (rustfmt e Clippy)
```

La prima volta `pnpm native` e `pnpm native:build` scaricano e compilano le dipendenze Rust (circa 5 minuti,
serve la rete); `native:build` scarica anche NSIS per creare l'installer. Le volte successive sono molto più
veloci.

Al termine di `pnpm native:build` trovi:

- **l'installer:** `apps\native\src-tauri\target\release\bundle\nsis\Spese di gruppo_0.1.0_x64-setup.exe`;
- **l'eseguibile**, avviabile anche senza installare:
  `apps\native\src-tauri\target\release\expense-calcolator.exe`.

**Installazione:** apri l'installer e segui la procedura. L'installer non è ancora firmato, quindi Windows può
mostrare «Windows ha protetto il PC»: scegli **Ulteriori informazioni → Esegui comunque**. Al termine l'app
«Spese di gruppo» è nel menu Start. Si disinstalla da **Impostazioni → App → App installate**.

### Dove stanno i dati

Ogni modo di usare l'app ha i propri dati, separati dagli altri. Per spostare un gruppo usa **Esporta** e
**Importa** (impostazioni del gruppo ed elenco dei gruppi).

| Dove                         | Cartella o archivio                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Web app                      | IndexedDB del browser, distinto per indirizzo (`localhost:5173` e `localhost:4173` separati) |
| App per Windows              | `%LOCALAPPDATA%\io.github.andreasperanza.expensecalcolator`                                  |
| Riga di comando (`pnpm cli`) | `%APPDATA%\ExpenseCalcolator\dati.json`                                                      |

### Problemi comuni

- **`pnpm`, `cargo` o `rustc` non trovati:** chiudi e riapri il terminale (o VS Code) dopo l'installazione.
- **`link.exe not found` o errori del linker durante la build:** mancano gli strumenti C++ di Visual Studio
  (punto 1).
- **`pnpm native` non apre la finestra:** la porta 5173 è occupata, per esempio da un altro `pnpm web`.
  Chiudilo e riprova.
- **Errori di rete alla prima build:** servono crates.io (dipendenze Rust) e GitHub (NSIS). Le build successive
  funzionano offline.

## Sviluppo

Prerequisiti: Node.js ≥ 22.13 e pnpm 10 (vedi la guida sopra). La versione di pnpm è fissata nel campo
`packageManager`.

```sh
pnpm install          # installa le dipendenze di tutto il workspace
pnpm check            # formattazione, lint, tipi, confini tra pacchetti, test e build (lo stesso comando della CI)
pnpm e2e              # test E2E della web app in un browser vero (Playwright; in locale usa Edge)
pnpm test:watch       # test in modalità watch
pnpm coverage         # test con copertura
pnpm format           # formatta tutti i file
pnpm web              # la web app su http://localhost:5173, con i dati nel browser (vedi apps/web/README.md)
pnpm web:preview      # build e anteprima della versione finale
pnpm native           # l'app per Windows (Tauri) in sviluppo; native:build crea l'installer (vedi apps/native/README.md)
pnpm cli --help       # la riga di comando: gruppi e spese salvati in locale (vedi apps/cli/README.md)
pnpm schemas          # rigenera i JSON Schema in spec/schemas dopo aver cambiato packages/schema
pnpm deps:graph       # rigenera il grafico delle dipendenze in docs/ARCHITETTURA.md
```

I singoli controlli si possono lanciare anche separatamente: `pnpm lint`, `pnpm typecheck`, `pnpm deps`, `pnpm test`.

## Struttura

| Cartella                                | Contenuto                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [docs/](docs/)                          | Pianificazione, [architettura](docs/ARCHITETTURA.md), decisioni (ADR), [alternative per la condivisione](docs/CONDIVISIONE.md) |
| [spec/](spec/)                          | Contratti indipendenti dal linguaggio: JSON Schema e test vector                                                               |
| [packages/schema](packages/schema/)     | Modelli dati ed eventi condivisi                                                                                               |
| [packages/core](packages/core/)         | Logica di calcolo pura                                                                                                         |
| [packages/sync](packages/sync/)         | Log di eventi, orologio logico, merge                                                                                          |
| [packages/engine](packages/engine/)     | API pubblica usata dalla UI                                                                                                    |
| [packages/i18n](packages/i18n/)         | Lingue, testi condivisi e formati di importi e date (italiano e inglese)                                                       |
| [packages/adapters](packages/adapters/) | Porte di piattaforma: salvataggio locale (IndexedDB, file JSON), orologio e id                                                 |
| [packages/channels](packages/channels/) | Canali di condivisione, ognuno un plugin separato: file, cartella, peer-to-peer, cloud                                         |
| [packages/ui](packages/ui/)             | Interfaccia (SPA in React con shadcn/ui), uguale in tutte le shell                                                             |
| [apps/cli](apps/cli/)                   | Riga di comando: l'app in modalità locale, senza grafica                                                                       |
| [apps/web](apps/web/)                   | Shell web: la UI con i dati nel browser (per ora solo in locale)                                                               |
| [apps/native](apps/native/)             | Shell nativa (Tauri 2: Windows, Android)                                                                                       |

Regola d'oro: le dipendenze vanno solo verso il basso, `ui → engine → core/sync → schema`.
