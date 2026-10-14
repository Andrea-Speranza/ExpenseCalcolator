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
  Fino ad allora possono ricevere i dati tramite esporta/importa (CLI e web app) e, più avanti, tramite i canali di
  condivisione.

## Aggiornamento (2026-10-14): una demo da provare

La decisione resta: nessun servizio online per usare l'app. Si aggiunge solo una **demo** per farla provare,
con il link nel README:

- è una shell a parte, `apps/demo`, accanto a `apps/web` e `apps/native`: la stessa app, con i dati
  nel browser, dentro una cornice con un avviso e, finché non ci sono gruppi, il pulsante «Prova con un gruppo
  di esempio»;
- **l'app non sa di essere in una demo:** `packages/ui` e `apps/web` non cambiano. La cornice usa solo l'API
  pubblica dell'engine (crea il gruppo con i normali comandi, controlla con query e notifiche se ci sono gruppi)
  e l'indirizzo delle pagine. Testi e codice della demo stanno tutti in `apps/demo`;
- è pubblicata su **GitHub Pages** dal workflow `.github/workflows/demo.yml` a ogni push su `main`, solo quando
  il repository è pubblico; finché è privato il lavoro viene saltato;
- sono solo file statici, senza server e senza account: ogni visitatore ha i propri dati nel suo browser e
  nessuno vede quelli degli altri.

GitHub Pages è stato preferito a Cloudflare Pages, Netlify e Vercel perché sta nello stesso posto del codice,
non richiede altri account e si aggiorna da solo. Su CodeSandbox o StackBlitz la demo avvierebbe un server di
sviluppo per ogni visitatore: servono a provare il codice, non l'app.

## Possibilità future

- **Self-hosting sul proprio NAS**, raggiungibile con il tunnel Cloudflare già in uso. La web app resta sotto
  il proprio controllo e i dati restano comunque nei dispositivi (local-first).
- **Un hosting statico gratuito** (es. Cloudflare Pages), se un giorno servisse un link pubblico.

In entrambi i casi basterà pubblicare la stessa build: il codice non cambia.
