# 0011 — Versioni e rilasci: SemVer in alfa, GitHub Releases con l'installer per Windows

- **Stato:** accettata
- **Data:** 2026-10-14

## Contesto

L'app per Windows (Fase 4) si compilava solo in locale, sempre con la versione `0.1.0`. Per farla provare
serve un modo ripetibile per numerare le versioni, scrivere cosa cambia e pubblicare l'installer, senza servizi
oltre a GitHub, dove sta già il codice. Il progetto è ancora in sviluppo: per ora le versioni restano alfa.

## Decisione

**Numeri di versione.** Si usa [SemVer](https://semver.org/lang/it/) con il suffisso `alpha.N`:
`0.1.0-alpha.1`, `0.1.0-alpha.2`, …

- Lo `0.x` dice già che niente è stabile; `alpha.N` cresce a ogni rilascio.
- Il numero centrale sale quando si chiude una fase (es. `0.2.0-alpha.1` con la sincronizzazione della Fase 5).
- Il passaggio a `beta` o a `1.0.0` si decide più avanti.

**Un solo numero.** Il numero sta nel `version` del `package.json` principale:

- Tauri lo legge da lì (`"version": "../../../package.json"` in `tauri.conf.json`): nome dell'installer,
  dettagli del file `.exe`;
- web app, demo e app per Windows lo mostrano nelle impostazioni: la shell lo legge dal `package.json` durante
  la build e lo passa all'app (`<App version={…} />`), come fa con l'engine;
- Cargo vuole il numero scritto in `Cargo.toml` (e in `Cargo.lock`): lo aggiorna lo script di rilascio, e
  `pnpm check` segnala se le copie non coincidono (`pnpm release:check`).

I pacchetti interni (`packages/*`) restano a `0.0.0`: non si pubblicano da soli, la versione è dell'app.

**Novità.** Si scrivono man mano in [CHANGELOG.md](../../CHANGELOG.md) (formato
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/)), sotto «Non rilasciato».

**Rilascio.**

1. `pnpm release 0.1.0-alpha.2` (con `--dry-run` per provare): controlla di essere su `main` senza modifiche in
   sospeso e che il numero venga dopo quello attuale; aggiorna `package.json`, `Cargo.toml` e `Cargo.lock`;
   sposta «Non rilasciato» sotto il nuovo numero con la data; fa il commit `Rilascio 0.1.0-alpha.2` e il tag
   `v0.1.0-alpha.2`. Tutto in locale.
2. `git push --follow-tags` pubblica commit e tag.
3. Il workflow [release.yml](../../.github/workflows/release.yml), su una macchina Windows di GitHub,
   verifica che il tag corrisponda al numero, esegue `pnpm check` e `pnpm native:check`, compila l'app e crea
   la **GitHub Release**:
   - segnata come **pre-release** se il numero ha un suffisso (`-alpha.N`);
   - con l'installer `spese-di-gruppo-<versione>-windows-x64-setup.exe` e `SHA256SUMS.txt` per verificarlo;
   - con le note prese dalla sezione del CHANGELOG, più le istruzioni per installare.

Il workflow usa solo `gh`, già presente sulle macchine di GitHub: nessuna action di terze parti per la release.

## Conseguenze

- **Vantaggi:** ogni versione ha un numero, delle note e un installer scaricabile, tutto su GitHub; il
  rilascio è un comando più un push; i controlli girano anche sul commit rilasciato.
- **Installer non firmato:** Windows SmartScreen avvisa al primo avvio («Ulteriori informazioni» → «Esegui
  comunque»). Lo dicono il README e le note di ogni rilascio. La firma resta tra i punti aperti della Fase 4.
- **Aggiornamenti a mano:** si scarica e si apre il nuovo installer, che sostituisce la versione installata e
  mantiene i dati.
- **Link nel README:** punta alla pagina delle Releases, perché `releases/latest` esclude le pre-release.

## Da decidere più avanti

- **Firma dell'installer:** [SignPath Foundation](https://signpath.org/) (gratuita per i progetti open
  source) o Azure Artifact Signing (a pagamento).
- **Aggiornamento automatico** con il plugin updater di Tauri: richiede una chiave per firmare gli
  aggiornamenti e un file con l'ultima versione, che si può pubblicare nella release stessa.
- **Android:** Tauri ricava il `versionCode` da major, minor e patch (`major × 1.000.000 + minor × 1.000 +
patch`), quindi `0.1.0-alpha.1` e `0.1.0-alpha.2` avrebbero lo stesso codice e Android rifiuterebbe
  l'aggiornamento. Si sistema con la build Android (es. `versionCode` esplicito o incrementato a ogni build).
