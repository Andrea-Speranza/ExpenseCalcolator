# 0007 — Salvataggio dei dati e modifiche contemporanee

- **Stato:** proposta
- **Data:** 2026-10-13
- **Chiude, se accettata:** D6 (regole di conflitto). **Prepara:** D13 (permessi)

## Contesto

Dati di gruppo e impostazioni personali vengono modificati da più dispositivi e, nei gruppi condivisi, da più
persone, anche offline e nello stesso momento. Nessun server fa da arbitro: ogni dispositivo deve arrivare
da solo allo stesso risultato degli altri.

In futuro serviranno anche regole su chi può modificare cosa. Le idee sul tavolo sono due:

- ognuno modifica solo le proprie spese, e il creatore del gruppo può correggere tutto;
- ruoli, con amministratori e membri.

La scelta è rimandata, ma il formato dei dati deve già permetterle, perché gli eventi salvati non si
cambiano più ([PLANNING §6.3](../PLANNING.md#63-versionamento-del-formato)).

## Proposta

### 1. Tutto è un evento

Gruppo, membri, spese, rimborsi e anche le impostazioni personali (il profilo,
[ADR 0005](0005-modalita-uso.md)) si salvano come eventi. Stesso formato, stesso salvataggio, stessa
sincronizzazione, stesse regole sui conflitti.

### 2. La busta di ogni evento

| Campo       | Contenuto                                                                   | A cosa serve                                  |
| ----------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| `id`        | Identificativo univoco ordinabile (ULID o UUIDv7)                           | Riconoscere ed eliminare i doppioni           |
| `stream`    | Il gruppo o il profilo a cui appartiene                                     | Tenere separati i log                         |
| `type`, `v` | Tipo di evento e versione del suo schema                                    | Leggere eventi di versioni diverse dell'app   |
| `hlc`       | Orologio logico ibrido: ora, contatore e dispositivo                        | Lo stesso ordine su ogni dispositivo          |
| `deviceId`  | Il dispositivo che l'ha scritto                                             | File per dispositivo e sincronizzazione       |
| `actor`     | Il membro che ha fatto la modifica                                          | Storico "chi ha fatto cosa" e permessi futuri |
| `base`      | Solo per le modifiche: la versione dell'elemento che l'autore aveva davanti | Accorgersi delle modifiche contemporanee      |
| `payload`   | I dati dell'evento                                                          | —                                             |

```json
{
  "id": "01JA8Z5XK3M7Q8R2T4V6W8Y0A1",
  "stream": "g_weekend",
  "type": "ExpenseUpdated",
  "v": 1,
  "hlc": "…",
  "deviceId": "d_telefono_luca",
  "actor": "m_luca",
  "base": "…",
  "payload": { "expenseId": "e_cena", "changes": { "description": "Cena al rifugio" } }
}
```

### 3. Le modifiche valgono per gruppi di campi, non per l'intera spesa

Una spesa ha due tipi di campi:

- **campi indipendenti:** descrizione, data, categoria, note;
- **un blocco "importi":** totale, pagatori e divisione. Si modifica sempre tutto insieme, perché deve restare
  coerente (gli importi devono sommare al totale).

Per ogni campo o blocco vince la modifica con l'orologio (HLC) più alto, cioè la più recente
(last-writer-wins). Così, se Anna corregge la descrizione mentre Luca corregge l'importo, si tengono entrambe le
modifiche. Si perde qualcosa solo se due persone cambiano lo stesso campo, e anche in quel caso resta nello
storico (punto 5).

### 4. Eliminazione

"Eliminata sì/no" è un campo a sé. Una modifica arrivata dopo non fa "risorgere" la spesa: per ripristinarla
serve un'azione esplicita. In pratica l'eliminazione vince sulle modifiche contemporanee, come previsto da D6,
e la spesa eliminata resta nello storico.

### 5. Modifiche contemporanee visibili

Può succedere che una modifica sovrascriva un valore che il suo autore non aveva visto: il suo `base` è più
vecchio dell'ultima modifica fatta da un altro membro. In quel caso l'elemento viene segnalato come "modificato
contemporaneamente da Anna e Luca", e il valore scartato resta nello storico e si può recuperare.

### 6. Impostazioni

Usano lo stesso meccanismo, con una chiave per impostazione. Anche qui vince la modifica più recente.

- **Impostazioni del gruppo** (nome, valuta di riferimento, in futuro la politica dei permessi): sono campi del
  gruppo e tutti i membri le condividono.
- **Impostazioni personali** (valuta predefinita, lingua, nome visualizzato): stanno nel profilo e non si
  condividono con nessuno.

### 7. Permessi: predisposti, non attivi

Mentre applica gli eventi in ordine, ogni dispositivo chiede a una funzione `authorize(stato, evento)` se
l'evento è permesso. Se non lo è, lo ignora e lo segnala. Tutti i dispositivi applicano le stesse regole agli
stessi eventi, quindi arrivano allo stesso risultato senza bisogno di un server.

- **Oggi** la regola è "tutti possono tutto".
- **In futuro** la politica sarà un'impostazione del gruppo (D13). Per esempio:
  - ognuno modifica solo le proprie voci, e il creatore del gruppo può correggere tutto;
  - ruoli amministratore e membro, assegnati con appositi eventi.

I dati che servono esistono già da subito:

- l'autore di ogni evento (`actor`);
- chi ha creato ogni elemento;
- chi ha creato il gruppo.

Un cambio di permessi vale dal suo punto nell'ordine degli eventi in poi: le modifiche fatte prima restano
valide.

### 8. Un limite da conoscere

Senza firme, `actor` è dichiarato dal dispositivo stesso. Un membro con un'app modificata potrebbe quindi
fingersi un altro. Per un gruppo di amici è accettabile. Per rendere i permessi inviolabili si aggiungerà una
firma digitale per dispositivo (Ed25519 tramite Web Crypto): la busta potrà ricevere un campo `sig` senza
cambiare il resto (Fase 7).

### 9. Salvataggio locale

- In IndexedDB si salvano gli eventi e lo stato calcolato, che fa da cache.
- Se arriva un evento "nel passato" (con HLC più vecchio dell'ultimo applicato), lo stato si ricalcola da
  capo. Per un gruppo di spese è questione di millisecondi.
- L'orologio del dispositivo si salva nella stessa transazione degli eventi, così due schede aperte non
  producono mai lo stesso valore.

## Conseguenze

- **Vantaggi:**
  - nessuna modifica persa quando si cambiano campi diversi;
  - storico completo, con ripristino;
  - permessi aggiungibili in seguito senza cambiare il formato dei dati;
  - impostazioni e dati usano un solo meccanismo.
- **Costi:**
  - più eventi e più logica nel calcolo dello stato rispetto a salvare solo l'ultima versione;
  - sullo stesso campo vince una sola delle due modifiche, ma l'altra resta nello storico e viene segnalata.

## Alternative considerate

| Alternativa                                        | Perché no                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Salvare solo lo stato attuale (un file per gruppo) | Le modifiche contemporanee si sovrascrivono e non c'è storico                                                                                                                  |
| Last-writer-wins sull'intera spesa                 | Perde modifiche indipendenti, per esempio descrizione e importo cambiati da due persone                                                                                        |
| CRDT generici (Automerge, Yjs)                     | Formati poco leggibili e difficili da validare o riprodurre in altri linguaggi; per dati strutturati come le spese, regole esplicite per campo sono più semplici e prevedibili |
