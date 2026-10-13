# adapters/local-file — LocalStore su file (Node)

Salvataggio locale per Node, usato dalla CLI. Eventi e identità del dispositivo stanno in un unico file,
`dati.json`, nella cartella indicata.

- **Scrittura atomica:** si scrive su un file temporaneo e poi lo si rinomina al posto del precedente, così il
  file non resta mai scritto a metà ([ADR 0007](../../../docs/adr/0007-salvataggio-e-concorrenza.md), punto 9).
- **Più finestre aperte:** prima di scrivere si rilegge il file e si uniscono gli eventi aggiunti nel
  frattempo da un'altra istanza. Resta solo una finestra di pochi millisecondi in cui due scritture davvero
  simultanee possono sovrapporsi: per la CLI è accettabile.
- **Test:** la suite di contratto della porta `LocalStore` ([packages/testing](../../testing/)) e i casi
  specifici del file.

Usa le API del file system di Node: non è adatto a browser e WebView, dove si usa
[local-indexeddb](../local-indexeddb/).
