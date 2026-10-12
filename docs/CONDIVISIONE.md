# Condivisione dei dati: alternative a confronto

> **Stato:** analisi, raccomandazione da confermare (decisione D12 in [PLANNING §12](PLANNING.md#12-decisioni-aperte)).
> **Informazioni verificate il:** 2026-10-12. Le regole dei servizi cloud cambiano spesso: vanno ricontrollate prima di implementare.

## Obiettivo

Condividere un gruppo di spese tra più persone, e i propri dati tra i propri dispositivi, **senza un database
centrale né un servizio da ospitare** ([ADR 0005](adr/0005-modalita-uso.md)). Questo documento confronta i modi
per farlo e cerca quelli più semplici da configurare e da usare.

## Un punto di partenza importante

L'architettura rende le soluzioni intercambiabili. I dati di un gruppo sono un log di eventi, e ogni
dispositivo scrive solo file propri, che non si modificano mai (PLANNING §8.3). Fondere eventi arrivati da
qualsiasi parte è sempre sicuro:

- gli eventi doppi vengono ignorati;
- l'ordine di arrivo non conta.

Qualsiasi canale che sappia **trasportare questi file** va quindi bene, e se ne possono usare più d'uno
insieme. Si può cominciare dal più semplice e aggiungere gli altri dopo, senza cambiare il formato dei dati.

## Confronto

| Soluzione                                  | Configurazione per lo sviluppatore     | Cosa serve agli utenti                                    | Automatica                     | Limite principale                                                           |
| ------------------------------------------ | -------------------------------------- | --------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| File condiviso (WhatsApp, Telegram, email) | Nessuna                                | Niente                                                    | No, si invia a mano            | Se qualcuno non invia, gli altri non vedono le sue spese                    |
| Cartella sincronizzata                     | Nessuna                                | Il programma del cloud sul PC; su Android l'app Syncthing | Sì                             | Scomoda su Android                                                          |
| Peer-to-peer (link o QR)                   | Minima, nessun account                 | Niente                                                    | Sì, quando si è online insieme | Serve essere connessi nello stesso momento                                  |
| Dropbox                                    | Registrazione dell'app su Dropbox      | Account Dropbox                                           | Sì                             | Per condividere cartelle l'app deve accedere a tutto il Dropbox dell'utente |
| Google Drive                               | Progetto Google Cloud e consenso OAuth | Account Google                                            | Sì                             | In modalità di prova il login scade ogni 7 giorni                           |
| OneDrive                                   | Registrazione dell'app su Microsoft    | Account Microsoft                                         | Sì                             | Non è chiaro se la cartella dell'app si possa condividere                   |

## Le soluzioni nel dettaglio

### File condiviso

Un pulsante "Invia aggiornamenti" apre la condivisione del telefono o del PC (WhatsApp, Telegram, email…).
Chi riceve il file lo apre con l'app e le spese si uniscono da sole.

- **Pro:**
  - zero configurazione, nessun account;
  - funziona offline;
  - ricevere più volte lo stesso file non crea doppioni.
- **Contro:** è manuale. Se qualcuno dimentica di inviare, gli altri non vedono le sue spese.
- **Tecnica:**
  - condivisione di sistema: Web Share API su web, plugin di condivisione per Tauri/Capacitor;
  - associazione del tipo di file all'app, perché "apri con" la avvii;
  - si invia l'intero gruppo: è il modo più semplice, e il merge scarta ciò che c'è già.
- **Stato:** già prevista come ripiego (PLANNING §8.6). Può diventare la prima modalità condivisa vera.

### Cartella sincronizzata

L'app scrive in una cartella già sincronizzata da Google Drive per desktop, OneDrive, Dropbox o Syncthing.
Della sincronizzazione si occupa il loro programma.

- **Pro:** zero configurazione e nessuna API. È anche il modo più comodo per sviluppare e testare la sync.
- **Contro:**
  - su Android i client cloud non tengono una copia vera delle cartelle; serve un'app come Syncthing;
  - sul web funziona solo con i browser basati su Chromium (File System Access API).
- **Stato:** già prevista (Fase 5).

### Peer-to-peer con link o QR

Ci si unisce al gruppo con un link o un QR, e i dispositivi si scambiano i dati direttamente. I dati sono
cifrati da un capo all'altro (WebRTC). Librerie come
[Trystero](https://github.com/dmotz/trystero) usano infrastrutture pubbliche gratuite (tracker BitTorrent,
relay Nostr, broker MQTT) solo per far "incontrare" i dispositivi: i dati non passano da lì.

- **Pro:**
  - nessun account, nessun costo, nessun server nostro;
  - gli aggiornamenti si propagano a catena: chi li riceve li passa agli altri;
  - quando tutti sono online insieme, per esempio in vacanza, è ideale.
- **Contro:**
  - tra persone che aprono l'app in giorni diversi i dati arrivano solo alla prima occasione in cui due di
    loro sono connessi insieme;
  - alcune reti mobili o aziendali bloccano le connessioni dirette, e lì servirebbe un server di inoltro (TURN);
  - dipende da servizi pubblici che non controlliamo e che possono cambiare;
  - i relay Nostr non garantiscono la conservazione né la cancellazione dei dati: vanno usati solo per
    l'incontro, mai come archivio.
- **Stato:** nuova. Prima di adottarla serve uno spike: affidabilità della connessione, reti mobili, Android.

### Dropbox

- **Pro rispetto a Google:**
  - fino a 500 utenti senza approvazione; oltre i 50 utenti ci sono due settimane per chiedere la
    produzione, con una revisione gratuita su marchio e condizioni d'uso;
  - il login non scade ogni settimana (refresh token con PKCE, senza segreto nell'app);
  - nessuna verifica di sicurezza a pagamento.
- **Contro:**
  - la cartella riservata all'app ("App folder") **non si può condividere**, né lei né le sue sottocartelle.
    Per i gruppi condivisi l'app dovrebbe chiedere l'accesso a tutto il Dropbox dell'utente ("Full Dropbox"),
    un permesso molto più invasivo;
  - meno persone hanno un account Dropbox rispetto a uno Google.

### Google Drive

Costi, quote e vincoli sono descritti in [PLANNING §8.8](PLANNING.md#88-note-su-google-drive-da-verificare-nello-spike-s1).
In sintesi:

- **costi:** gratuito per il nostro uso;
- **modalità di prova:** al massimo 100 utenti, login da rifare ogni 7 giorni;
- **permesso ristretto `drive.file`:** da verificare che basti a leggere i file creati dagli altri membri
  (spike S1);
- **permesso completo `drive`:** richiede una verifica di sicurezza annuale a pagamento.

### OneDrive

- **Pro:** account Microsoft diffusi; esiste una cartella riservata all'app per gli account personali
  (permesso `Files.ReadWrite.AppFolder`, ancora in anteprima).
- **Contro:** la documentazione non chiarisce se quella cartella si possa condividere come cartella; si
  possono condividere i singoli file al suo interno. Servirebbe uno spike.

### Escluse

Servizi di sincronizzazione già pronti (es. Jazz, Evolu, il server di sync di Automerge): sono comodi da
integrare, ma restano un servizio centrale, anche se gestito da altri. Vanno contro l'obiettivo.

## Raccomandazione (da confermare)

1. **Prima condivisione senza account:** file condiviso più cartella sincronizzata su desktop. Zero
   configurazione per tutti, e copre anche il passaggio dei dati tra i propri dispositivi.
2. **Poi il peer-to-peer con link o QR**, dopo uno spike, come modalità automatica senza account.
3. **Un provider cloud** (Google o Dropbox) solo se serve una sincronizzazione sempre attiva o un backup
   automatico, e dopo lo spike S1.

Così la parte più complessa e con più vincoli, cioè account e API cloud, diventa facoltativa e arriva per ultima.

## Da verificare

- Peer-to-peer: affidabilità di WebRTC su reti mobili, comportamento su Android in Tauri e Capacitor, quanto
  si può contare sui servizi pubblici per l'incontro.
- Google Drive: se il permesso `drive.file` basta a leggere i file degli altri membri (spike S1).
- OneDrive: se la cartella dell'app si può condividere con altri utenti.
- File condiviso: apertura dei file con "apri con" su Android e Windows, nelle shell Tauri o Capacitor.

## Fonti

- [Dropbox — DBX Platform developer guide](https://www.dropbox.com/developers/reference/developer-guide)
- [Dropbox forum — limite di utenti in sviluppo](https://www.dropboxforum.com/discussions/101000014/does-a-dropbox-app-have-a-limit-on-development-users/846671)
- [Dropbox forum — refresh token con PKCE](https://www.dropboxforum.com/t5/Dropbox-API-Support-Feedback/Non-expiring-token-kept-on-changing/m-p/585127)
- [Dropbox forum — condivisione delle sottocartelle della cartella dell'app](https://www.dropboxforum.com/discussions/101000014/share-sub-folders-of-app-folder/253472)
- [Dropbox forum — impossibile condividere la cartella dell'app](https://www.dropboxforum.com/t5/Dropbox-API-Support-Feedback/Unable-to-share-app-folder/m-p/221668)
- [Microsoft — OneDrive permissions reference](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference)
- [Microsoft Graph — App folder](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder)
- [Google Drive API — Usage limits](https://developers.google.com/workspace/drive/api/guides/limits)
- [Trystero (GitHub)](https://github.com/dmotz/trystero)
- [Building on Nostr: Real Engineering Challenges](https://verygood.ventures/blog/building-on-nostr-real-engineering-challenges.md)
