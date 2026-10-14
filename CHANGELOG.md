# Changelog

Le novità di ogni versione dell'app, dalla più recente. Il formato segue
[Keep a Changelog](https://keepachangelog.com/it/1.1.0/) e i numeri di versione seguono
[SemVer](https://semver.org/lang/it/); come si rilascia è descritto in
[ADR 0011](docs/adr/0011-versioni-e-rilasci.md).

Le novità si scrivono man mano sotto «Non rilasciato», divise in **Aggiunto**, **Modificato**, **Corretto** e
**Rimosso**. Al rilascio, `pnpm release <versione>` sposta la sezione sotto il nuovo numero.

## [Non rilasciato]

## [0.1.0-alpha.1] - 2026-10-14

Prima versione di prova.

### Aggiunto

- App per Windows 10 e 11 (installer), web app nel browser e riga di comando, tutte con i dati solo sul
  dispositivo: nessun account, nessun server.
- Gruppi con le persone che partecipano e l'indicazione di chi usa l'app; elenco dei gruppi con lo stato dei
  conti (aperti o in pari) e archivio di quelli conclusi.
- Spese con uno o più pagatori, divise in parti uguali, per importi, per percentuali o per quote, con data e
  ora facoltativa.
- Saldi, trasferimenti suggeriti per pareggiare (con meno passaggi o per coppia) e rimborsi.
- Storico di spese e rimborsi, filtri «pagate da me» e «pagate per me», eliminazione e ripristino.
- Esportazione di un gruppo su file e importazione su un altro dispositivo o nella riga di comando.
- Interfaccia in italiano e in inglese: all'inizio nella lingua del dispositivo, poi a scelta nelle
  impostazioni, dove si vede anche la versione dell'app.

[Non rilasciato]: https://github.com/Andrea-Speranza/ExpenseCalcolator/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/Andrea-Speranza/ExpenseCalcolator/releases/tag/v0.1.0-alpha.1
