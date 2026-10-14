# apps/native — Shell Tauri 2

App nativa che mostra la build di `apps/web` in una finestra con la WebView del sistema. Le pagine si leggono
**dai file inclusi nell'app** tramite il protocollo interno di Tauri (`http://tauri.localhost`): nessun
webserver, nessuna porta aperta, nessuna rete ([PLANNING §7](../../docs/PLANNING.md#7-ui-pagine-web-locali-dentro-app-native),
[ADR 0009](../../docs/adr/0009-distribuzione-locale.md)). La scelta di Tauri è motivata in PLANNING §7.3.

| Target              | WebView                           | Stato                                            |
| ------------------- | --------------------------------- | ------------------------------------------------ |
| Windows             | WebView2                          | Funziona (spike S2, 2026-10-14)                  |
| Android             | Android System WebView            | Fase 4, in un ambiente di sviluppo dedicato (D3) |
| macOS / Linux / iOS | WKWebView / WebKitGTK / WKWebView | Fase 7                                           |

## Comandi (dalla radice del repository)

```sh
pnpm native          # sviluppo: finestra nativa collegata a `pnpm web` (aggiornamento a caldo)
pnpm native:build    # build di rilascio: eseguibile e installer in apps/native/src-tauri/target/release
pnpm native:check    # rustfmt e Clippy sul codice Rust (le regole ufficiali di Rust)
```

Prerequisiti su Windows: Rust (toolchain `stable-x86_64-pc-windows-msvc`) e gli strumenti C++ di Visual
Studio; WebView2 è già incluso in Windows 11. La prima build scarica le dipendenze Rust da crates.io e, per
l'installer, NSIS da GitHub; impiega qualche minuto, le successive molto meno.

## Com'è fatta

- `src-tauri/tauri.conf.json`: finestra, identificativo dell'app (`io.github.andreasperanza.expensecalcolator`,
  sarà anche il nome del pacchetto Android), installer NSIS, e una Content Security Policy che permette solo
  risorse dell'app (nessuno script o file da Internet).
- `src-tauri/src/lib.rs`: solo l'avvio di Tauri. Tutta la logica sta nella UI in TypeScript; anche le funzioni
  native che serviranno (file, deep link, QR) si useranno dai plugin ufficiali, che hanno un'API TypeScript.
- I dati stanno in IndexedDB, nel profilo WebView2 dell'app (`%LOCALAPPDATA%\io.github.andreasperanza.expensecalcolator`).

## Risultati dello spike S2 su Windows

Verificati pilotando l'app vera (porta di debug di WebView2 e Playwright):

- la UI si carica da `http://tauri.localhost/`, nella lingua del sistema, senza nessuna richiesta di rete;
- spese e gruppi restano dopo aver chiuso e riaperto l'app (IndexedDB persistente);
- «Esporta il gruppo» salva il file nella cartella Download, come nel browser; «Importa» legge il file scelto;
- installer NSIS di 2,1 MB (eseguibile di 8,6 MB).

Da fare: icone dell'app (oggi quelle predefinite di Tauri), firma dell'installer, aggiornamenti.
