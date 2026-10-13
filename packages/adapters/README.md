# packages/adapters — Implementazioni delle porte di piattaforma

Implementano le porte che l'engine chiede alla piattaforma, esclusa la condivisione: i canali di condivisione
sono plugin a parte, in [packages/channels](../channels/) ([ADR 0006](../../docs/adr/0006-canali-plugin.md)).

| Adapter                             | Porte                  | Piattaforme                     | Usato da        |
| ----------------------------------- | ---------------------- | ------------------------------- | --------------- |
| [local-indexeddb](local-indexeddb/) | `LocalStore`           | Browser e WebView               | Web, app native |
| [local-file](local-file/)           | `LocalStore`           | Node                            | CLI             |
| [system](system/)                   | `Clock`, `IdGenerator` | Tutte (browser, WebView e Node) | Tutte le shell  |

Ogni adapter dipende solo dalle interfacce delle porte (`engine`) e dai tipi (`schema`), e deve passare la
suite di test di contratto della sua porta ([packages/testing](../testing/)).
