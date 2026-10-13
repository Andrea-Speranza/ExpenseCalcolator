# packages/adapters — Implementazioni delle porte di piattaforma

Implementano le porte che l'engine chiede alla piattaforma, esclusa la condivisione: i canali di condivisione
sono plugin a parte, in [packages/channels](../channels/) ([ADR 0006](../../docs/adr/0006-canali-plugin.md)).

| Adapter                             | Porta        | Piattaforme               | Fase |
| ----------------------------------- | ------------ | ------------------------- | ---- |
| [local-indexeddb](local-indexeddb/) | `LocalStore` | Tutte (browser e WebView) | 2    |

Ogni adapter dipende solo dalle interfacce delle porte (`engine`) e dai tipi (`schema`), e deve passare la
suite di test di contratto della sua porta.
