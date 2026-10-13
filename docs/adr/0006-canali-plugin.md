# 0006 — Canali di condivisione come plugin

- **Stato:** accettata
- **Data:** 2026-10-13
- **Collegata a:** [CONDIVISIONE.md](../CONDIVISIONE.md), decisione D12

## Contesto

Ci sono molti modi per condividere i dati: file inviato a mano, cartella sincronizzata, peer-to-peer, Dropbox,
Google Drive, OneDrive ([CONDIVISIONE.md](../CONDIVISIONE.md)). Hanno complessità, costi e vincoli diversi, e
nessuno è indispensabile all'inizio. Si vogliono poter sviluppare separatamente e aggiungere in momenti diversi.

## Decisione

1. **Un pacchetto per canale.** Ogni canale di condivisione sta in `packages/channels/<nome>` e implementa
   un'unica porta definita dall'engine (`SyncChannel`).
2. **I canali trasportano soltanto.** Spostano segmenti di eventi immutabili e basta. Fondere gli eventi,
   ordinarli, risolvere i conflitti e verificare i permessi resta compito di `sync` ed `engine`, uguale per
   tutti ([ADR 0007](0007-salvataggio-e-concorrenza.md)). Così un canale non può far comportare i dati in
   modo diverso dagli altri.
3. **Le shell scelgono i canali.** Web, native e CLI decidono quali canali includere e li registrano
   all'avvio. L'engine funziona anche senza nessun canale: è la modalità locale.
4. **Più canali insieme.** Un gruppo può usarne più d'uno, per esempio file condiviso e cartella
   sincronizzata: gli eventi doppi vengono scartati.
5. **Canali indipendenti.** Un canale dipende solo dalla porta (`engine`) e dai tipi (`schema`), mai da un
   altro canale né direttamente da `core` o `sync`. Lo verifica dependency-cruiser.
6. **Plugin inclusi alla compilazione.** "Plugin" vuol dire moduli indipendenti e intercambiabili, non codice
   scaricato da Internet dopo l'installazione. Questo è più semplice e più sicuro, e gli store mobili
   limitano il codice scaricato a runtime.

## Contratto (bozza, da fissare in Fase 5 con il primo canale reale)

Ogni canale dichiara chi è e come funziona: se è automatico, se serve un account, su quali piattaforme gira.

Lo scambio si basa su ciò che ciascuno conosce: per ogni dispositivo, l'ultimo segmento ricevuto (un
"vettore di versione"). I canali hanno due forme:

| Forma      | Canali                                           | Operazioni                                                |
| ---------- | ------------------------------------------------ | --------------------------------------------------------- |
| A deposito | Cartella sincronizzata, Drive, Dropbox, OneDrive | Elencare, leggere e creare file in una cartella condivisa |
| A messaggi | File condiviso, peer-to-peer                     | Inviare un pacchetto di segmenti, riceverne uno           |

## Conseguenze

- **Vantaggi:**
  - i canali si sviluppano, si testano e si rilasciano separatamente;
  - aggiungerne uno non tocca i dati né gli altri canali;
  - si può partire senza nessun canale.
- **Costo:** la porta deve coprire due forme diverse (deposito e messaggi). Per questo il suo dettaglio si
  fissa costruendo il primo canale reale, non prima.

## Alternative considerate

| Alternativa                             | Perché no                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Un unico pacchetto con tutti i provider | Accoppia i provider tra loro e porta le dipendenze di tutti in ogni build                       |
| Plugin caricati a runtime               | Più complessi e meno sicuri; gli store mobili limitano il codice scaricato dopo l'installazione |
