# spec — Contratti indipendenti dal linguaggio

Qui stanno i contratti che non dipendono da TypeScript. Servono a verificare o rigenerare un'implementazione
in qualsiasi linguaggio.

- **[schemas/](schemas/)**: JSON Schema dei dati, **generati** da `packages/schema` con `pnpm schemas` e mai
  modificati a mano (un test verifica che siano aggiornati). Servono a documentare il formato dei dati
  salvati e scambiati, e a generare modelli in altri linguaggi (es. con quicktype):

  | File                        | Contenuto                                                         |
  | --------------------------- | ----------------------------------------------------------------- |
  | `stored-event.schema.json`  | Busta di un evento qualsiasi, anche di tipi sconosciuti           |
  | `group-event.schema.json`   | Eventi di un gruppo: gruppo, membri, spese, rimborsi              |
  | `profile-event.schema.json` | Eventi del profilo personale: impostazioni, gruppi, "chi sono io" |
  | `ledger.schema.json`        | Registro di spese e rimborsi (CLI e test vector)                  |
  | `command.schema.json`       | Comandi dell'engine, per chi lo usa da un altro linguaggio        |

- **[test-vectors/](test-vectors/)**: casi "input → output atteso" per la logica di calcolo, calcolati a mano.
  Li esegue la suite di test di `packages/core` (`test/vectors.test.ts`); un'altra implementazione del core
  è corretta se li supera tutti.

## Formato dei test vector

Ogni file `.json` contiene un caso. Gli importi sono sempre interi in unità minori, con la loro valuta.

```json
{
  "name": "Parti uguali, un solo pagatore",
  "description": "Anna paga 90 € per tre: ognuno deve 30 €.",
  "input": {
    "expenses": [
      {
        "id": "e_1",
        "total": { "minor": 9000, "currency": "EUR" },
        "paidBy": [{ "memberId": "m_a", "amount": { "minor": 9000, "currency": "EUR" } }],
        "split": { "method": "equal", "memberIds": ["m_a", "m_b", "m_c"] }
      }
    ],
    "settlements": []
  },
  "expected": {
    "owed": { "e_1": { "m_a": 3000, "m_b": 3000, "m_c": 3000 } },
    "balances": { "EUR": { "m_a": 6000, "m_b": -3000, "m_c": -3000 } },
    "simplifiedTransfers": [
      { "from": "m_b", "to": "m_a", "amount": { "minor": 3000, "currency": "EUR" } },
      { "from": "m_c", "to": "m_a", "amount": { "minor": 3000, "currency": "EUR" } }
    ],
    "pairwiseTransfers": [
      { "from": "m_b", "to": "m_a", "amount": { "minor": 3000, "currency": "EUR" } },
      { "from": "m_c", "to": "m_a", "amount": { "minor": 3000, "currency": "EUR" } }
    ]
  }
}
```

| Campo                          | Contenuto                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `input.expenses`               | Spese: totale, chi ha pagato (`paidBy`) e divisione (`split`, modalità di [PLANNING §9.2](../docs/PLANNING.md#92-modalità-di-divisione)) |
| `input.settlements`            | Rimborsi: `from` dà a `to` l'importo `amount`                                                                                            |
| `expected.owed`                | Per ogni spesa, quanto deve ciascun partecipante                                                                                         |
| `expected.balances`            | Per ogni valuta, il saldo di ogni membro che compare nel registro, anche se è zero. Positivo: deve ricevere; negativo: deve dare         |
| `expected.simplifiedTransfers` | Trasferimenti semplificati, nell'ordine esatto previsto ([PLANNING §9.5](../docs/PLANNING.md#95-trasferimenti-suggeriti))                |
| `expected.pairwiseTransfers`   | Trasferimenti per coppia, ordinati per valuta, chi paga e chi riceve                                                                     |

## Regole da conoscere per riprodurre i risultati

- **Resto maggiore e rotazione:** il centesimo avanzato va a chi ha il resto più alto; a parità, si parte dal
  partecipante in posizione `FNV-1a(id della spesa) mod n`. FNV-1a è l'hash standard a 32 bit, calcolato sui
  byte UTF-8 dell'id (gli id sono ASCII). Esempi: `"e_1"` → `0x3c072b94` (mod 3 = 0), `"e_3"` → `0x3e072eba`
  (mod 3 = 1). Vedi [PLANNING §9.3](../docs/PLANNING.md#93-arrotondamento-deterministico).
- **Spareggi tra membri:** a parità di importo precede il membro con l'id minore, confrontando i caratteri
  per codice e non secondo la lingua.
