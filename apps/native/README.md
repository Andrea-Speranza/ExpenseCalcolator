# apps/native — Shell Tauri 2

App nativa che impacchetta la build di `packages/ui` e la serve **dai file locali** tramite il protocollo
interno di Tauri. Non usa un webserver né la rete.

| Target              | WebView                           | Stato                                                |
| ------------------- | --------------------------------- | ---------------------------------------------------- |
| Windows             | WebView2                          | Fase 4                                               |
| Android             | Android System WebView            | Fase 4 (Tauri o Capacitor in base allo spike S2, D3) |
| macOS / Linux / iOS | WKWebView / WebKitGTK / WKWebView | Fase 7                                               |

Collega all'engine gli adapter della piattaforma, ad esempio `remote-folder` tramite il plugin fs di Tauri.

Dettagli: [PLANNING §7](../../docs/PLANNING.md#7-ui-pagine-web-locali-dentro-app-native).
