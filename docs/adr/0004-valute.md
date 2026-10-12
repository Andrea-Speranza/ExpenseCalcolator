# 0004 — Valute: esplicite da subito, conversione rimandata

- **Stato:** accettata
- **Data:** 2026-10-12
- **Integrata da:** [ADR 0005](0005-modalita-uso.md), per la valuta proposta dalla UI (punto 7)

## Contesto

Le spese di gruppo nascono spesso in viaggio, quindi in valute diverse. Calcolare i saldi convertendo con i
tassi di cambio è interessante, ma non è una priorità: prima va capito quanto costa.

I dati scritti sul Drive sono un contratto permanente. Gli eventi sono immutabili e vengono letti da versioni
diverse dell'app ([PLANNING §6.3](../PLANNING.md#63-versionamento-del-formato)). Tutto ciò che il formato non
prevede fin dall'inizio va gestito dopo con migrazioni e nuove versioni del formato.

## Decisione

**Adesso (Fasi 1–3): valuta esplicita ovunque, nessuna conversione.**

1. **Ogni importo ha la sua valuta.** È un `Money = { minor, currency }`: totale della spesa, quote dei
   pagatori, importi esatti, rimborsi. Non esiste una "valuta implicita del gruppo".
2. **Il gruppo ha una valuta di riferimento** (`baseCurrency`), scelta alla creazione.
3. **Una spesa usa una sola valuta.** Pagatori e importi esatti sono nella stessa valuta del totale; un
   rimborso ha la propria.
4. **Il core ha la sua tabella delle valute** ISO 4217 (codice → numero di decimali) e non la ricava da
   `Intl`. I dati di `Intl` possono cambiare tra browser e versioni, mentre il calcolo deve essere identico su
   ogni dispositivo (NF3). `Intl` serve solo alla UI per formattare.
5. **Saldi e trasferimenti si calcolano per valuta.** Con una sola valuta il risultato ha una sola voce, quindi
   non servono casi speciali.
6. **Il core non mescola mai valute.** Un'operazione tra valute diverse restituisce l'errore `CurrencyMismatch`.
7. **Nell'MVP la UI propone solo la valuta del gruppo.** È un limite dell'interfaccia, non del modello.

**Dopo (Fase 7): due passi indipendenti.**

- **7a — Più valute senza conversione.** Si toglie il limite della UI: una spesa può essere in qualsiasi
  valuta e i saldi si mostrano per valuta ("Luca deve 20 € e 15 $"). Il core lo supporta già, quindi è solo
  lavoro di UI.
- **7b — Conversione nella valuta del gruppo**, con queste linee guida già fissate:
  - **Il tasso si salva nella spesa** al momento dell'inserimento, in un campo opzionale (es. `fx: { rate, date, source }`).
    Non si scarica mai durante il calcolo: dispositivi diversi otterrebbero tassi diversi e quindi saldi diversi.
  - **Il tasso non è mai un numero in virgola mobile.** Si salva come stringa decimale (es. `"1.0835"`) e si
    converte con `BigInt`, con una regola di arrotondamento esplicita.
  - **Si converte il totale una sola volta.** L'importo convertito si divide poi con le stesse proporzioni della
    divisione originale, con il metodo del resto maggiore, così la somma delle quote resta esatta.
  - **Fonte del tasso:** l'inserimento manuale è sempre possibile, anche offline. Con la rete, l'app può
    proporre un tasso preso da una fonte pubblica gratuita, come i tassi di riferimento della BCE.
    Nessun backend nostro.
  - **Compatibilità:** il nuovo campo alza il `formatVersion` del gruppo. Le app non aggiornate passano in sola
    lettura, quindi non possono riscrivere una spesa perdendo il tasso.

## Impatto

| Area             | Adesso                                                      | 7a — più valute                         | 7b — conversione                                          |
| ---------------- | ----------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| `schema`         | `Money` con valuta, `baseCurrency` del gruppo               | Nessuno                                 | Campo opzionale `fx`, nuovo `formatVersion`               |
| `core`           | Tabella valute, saldi per valuta, errore `CurrencyMismatch` | Nessuno                                 | Conversione e arrotondamento                              |
| UI               | Valuta fissa del gruppo                                     | Scelta della valuta, saldi su più righe | Campo del tasso, doppio importo, proposta del tasso       |
| Dati già salvati | —                                                           | Nessuna migrazione                      | Nessuna migrazione: le spese senza `fx` restano come sono |

Il costo di adesso è minimo: qualche ora dentro la Fase 1. Rimandare anche questa parte costerebbe molto di più,
perché aggiungere la valuta in seguito vorrebbe dire migrare tutti gli eventi già salvati sui Drive degli utenti.

## Da decidere quando si farà la 7b

- Direzione del tasso (quante unità della valuta del gruppo vale 1 unità della valuta della spesa, o il contrario).
- Regola di arrotondamento della conversione.
- Quale tasso usare: quello del giorno della spesa o quello del giorno di inserimento.
- In che valuta si registrano i rimborsi quando c'è la conversione.
- Cosa succede se si cambia la valuta del gruppo.

## Alternative considerate

| Alternativa                          | Perché no                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Una sola valuta implicita per gruppo | Più semplice oggi, ma aggiungere le valute in seguito richiederebbe di migrare tutti gli eventi già salvati |
| Conversione subito, già nell'MVP     | Aggiunge scelte (fonte dei tassi, arrotondamenti, UI) che rallentano l'MVP senza servire al primo utilizzo  |
