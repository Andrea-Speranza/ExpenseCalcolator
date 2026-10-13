# packages/testing — Strumenti di test condivisi

Suite di test di contratto delle porte dell'engine: ogni implementazione di una porta deve superare la stessa
suite (PLANNING §14).

| Suite                        | Porta        | Usata da                                                                              |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| `describeLocalStoreContract` | `LocalStore` | `adapters/local-indexeddb`, `adapters/local-file`, salvataggio in memoria dell'engine |

Si usa solo nei test, mai nel codice dell'app.
