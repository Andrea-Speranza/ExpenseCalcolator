# 0005 — Tre modalità d'uso: locale, personale, condivisa

- **Stato:** accettata
- **Data:** 2026-10-12
- **Integra:** [ADR 0004](0004-valute.md), punto 7 (valuta proposta dalla UI)

## Contesto

L'app deve funzionare in tre situazioni, sempre senza un database centrale:

1. **Locale:** offline, su un solo dispositivo. Una persona inserisce tutti i membri e tutti i pagamenti e
   l'app fa i conti.
2. **Personale:** online, per salvare dati e configurazioni e ritrovarli sugli altri propri dispositivi.
3. **Condivisa:** più persone sullo stesso gruppo. Chi crea il gruppo condivide i dati e gli altri partecipano.

## Decisione

**Un solo meccanismo per tutte e tre.** Un gruppo è sempre lo stesso oggetto: un log di eventi, con un file per
dispositivo (PLANNING §8). Tra una modalità e l'altra cambia solo **dove** il log è pubblicato e **chi** può scriverci.

| Modalità  | Dove stanno i dati                                        | Chi scrive                        | Account cloud     |
| --------- | --------------------------------------------------------- | --------------------------------- | ----------------- |
| Locale    | Solo sul dispositivo (IndexedDB)                          | Un dispositivo                    | Non serve         |
| Personale | Cartella privata nel Drive dell'utente                    | I dispositivi dello stesso utente | Il proprio        |
| Condivisa | Cartella del gruppo, condivisa con gli altri partecipanti | I dispositivi di tutti            | Ognuno il proprio |

### Passaggi tra modalità

I passaggi non richiedono conversioni, perché il formato dei dati è lo stesso:

- **Da locale a personale ("salva nel cloud"):** l'app carica nella cartella i segmenti di eventi che ha già in
  locale.
- **Da personale a condivisa ("condividi"):** si condivide la cartella del gruppo con gli altri partecipanti.
- **Indietro ("smetti di condividere"):** si toglie la condivisione. Ogni dispositivo conserva la propria copia completa.

### Profilo utente (concetto nuovo)

Il profilo contiene:

- le **impostazioni**: valuta predefinita, lingua, nome visualizzato;
- l'**elenco dei gruppi**, con la modalità di ciascuno e il riferimento alla sua cartella;
- per ogni gruppo, **quale membro sono io** ("in questo gruppo io sono Luca").

Il profilo usa lo stesso meccanismo dei gruppi: un log di eventi per dispositivo, in cui per ogni impostazione
vince la modifica più recente. Dove vive dipende dalla modalità:

- **in modalità locale** resta solo sul dispositivo;
- **altrimenti** sta nella cartella privata dell'utente e lo segue su tutti i suoi dispositivi.

Il profilo non viene mai condiviso con altre persone.

### Struttura sul Drive dell'utente

```
ExpenseCalcolator/            # cartella creata dall'app nel Drive dell'utente
├─ profile/                   # privata: impostazioni, elenco dei gruppi, "chi sono io"
│  └─ events/<deviceId>/…
└─ groups/
   ├─ <nome>__<groupId>/      # gruppo personale: nessuna condivisione
   └─ <nome>__<groupId>/      # gruppo condiviso: questa cartella è condivisa con gli altri
```

I gruppi creati da altre persone non stanno in questa cartella: compaiono tra i file "condivisi con me" del
Drive. Il profilo ne conserva il riferimento.

### "Condividere il file dei dati"

L'unità condivisa è una **cartella**, non un singolo file. Con un solo file, due persone che salvano nello
stesso momento si sovrascriverebbero. Con un file per dispositivo questo non può succedere (PLANNING §8.3).
Per l'utente non cambia nulla: condivide "il gruppo".

### Valuta predefinita (integra ADR 0004, punto 7)

La valuta si salva sempre in ogni importo: spese, quote dei pagatori, rimborsi. La UI la propone così:

- **nuovo gruppo:** la valuta predefinita nelle impostazioni dell'utente;
- **nuova spesa o nuovo rimborso:** la valuta del gruppo.

## Fattibilità

| Elemento                                | Stato                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Core di calcolo                         | Nessun cambiamento                                                            |
| Eventi e log per dispositivo            | Già previsti: valgono per tutte e tre le modalità                             |
| Modalità locale                         | Già prevista (local-first)                                                    |
| Modalità condivisa                      | Già prevista (PLANNING §8)                                                    |
| Profilo utente e impostazioni           | Nuovo, ma riusa lo stesso meccanismo dei gruppi                               |
| Passaggi locale → personale → condivisa | Nuovi, ma semplici: caricare segmenti già presenti o condividere una cartella |

La fattibilità è alta. Il lavoro nuovo si concentra nelle Fasi 2, 5 e 6, mentre la Fase 1 (calcolo) non cambia.

## Limiti

- **Modalità personale:** su ogni dispositivo bisogna accedere allo stesso account cloud.
- **Modalità condivisa:** tutti i partecipanti devono usare lo stesso provider, quello che ospita la cartella
  (PLANNING §8.6).
- **Modalità locale:** se si perde il dispositivo si perdono i dati. Per questo ci sono l'esportazione su file
  e il passaggio alla modalità personale.
- **Accesso ai gruppi altrui:** leggere un gruppo creato da un'altra persona dipende dall'esito dello spike S1
  (scope di Google Drive). La cartella personale invece è creata dall'app, quindi basta lo scope `drive.file`.

## Alternative considerate

| Alternativa                                                       | Perché no                                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Un singolo file condiviso per gruppo                              | Le scritture contemporanee si sovrascrivono a vicenda o generano "copie in conflitto"        |
| Impostazioni salvate solo sul dispositivo                         | Non seguono l'utente sui suoi dispositivi, e la modalità personale lo richiede               |
| Cartella nascosta dell'app per i dati personali (`appDataFolder`) | Non si può condividere: passare un gruppo da personale a condiviso richiederebbe di copiarlo |
