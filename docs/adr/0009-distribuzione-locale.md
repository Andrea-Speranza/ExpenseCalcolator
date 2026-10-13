# 0009 — Distribuzione della web app: solo locale, nessun hosting online

- **Stato:** accettata
- **Data:** 2026-10-13
- **Chiude:** D7

## Contesto

La UI è una web app (file statici HTML/CSS/JS). Il piano prevedeva di pubblicarla anche online, su un
hosting statico. Per ora si preferisce non dipendere da servizi online.

## Decisione

**Nessun hosting online.** La stessa build della web app si usa in due modi, entrambi locali:

1. **Dentro le app native** (Tauri per Windows e Android, Fase 4). I file della web app sono inclusi
   nell'installazione e l'app li mostra dal disco, senza server né connessione (PLANNING §7.2). È il modello
   di Spotify e Steam.
2. **Nel browser del PC**, in locale: `pnpm web` avvia la web app su `localhost` durante lo sviluppo, e
   `pnpm web:preview` mostra la build finale. Il server ascolta solo su `localhost`, quindi non è
   raggiungibile dagli altri dispositivi della rete.

La build usa percorsi relativi e la navigazione con l'hash dell'indirizzo (`#/gruppi/…`): gli stessi file
funzionano dentro le app native, da una cartella qualsiasi o su un server, senza configurazione.

Il funzionamento offline nel browser tramite service worker (PWA) è rimandato, perché senza un indirizzo
online non serve. Le app native funzionano offline comunque.

## Conseguenze

- **Vantaggi:** nessun servizio esterno, nessun costo, nessun dato o file dell'app su server altrui.
- **Costo:** gli altri non possono aprire l'app da un link: per usarla devono installare l'app nativa.
  Fino ad allora possono ricevere i dati tramite esporta/importa (CLI) e, più avanti, tramite i canali di
  condivisione.

## Possibilità future

- **Self-hosting sul proprio NAS**, raggiungibile con il tunnel Cloudflare già in uso. La web app resta sotto
  il proprio controllo e i dati restano comunque nei dispositivi (local-first).
- **Un hosting statico gratuito** (es. Cloudflare Pages), se un giorno servisse un link pubblico.

In entrambi i casi basterà pubblicare la stessa build: il codice non cambia.
