# spec — Contratti indipendenti dal linguaggio

Qui stanno i contratti che non dipendono da TypeScript. Servono a verificare o rigenerare un'implementazione
in qualsiasi linguaggio.

- **[schemas/](schemas/)**: JSON Schema di entità, eventi e file del gruppo. Sono **generati** da
  `packages/schema` e non vanno modificati a mano. Servono per generare modelli in altri linguaggi
  (es. con quicktype) e per documentare il formato dei file sul Drive.
- **[test-vectors/](test-vectors/)**: casi "input → output atteso" per la logica di calcolo. Li usa la suite di
  test di `packages/core`.

Formato proposto per un test vector (da definire in Fase 1):

```json
{
  "name": "tre amici, 10 € in parti uguali con resto",
  "input": {
    "members": ["m_a", "m_b", "m_c"],
    "expenses": [
      {
        "id": "e_1",
        "amount": { "minor": 1000, "currency": "EUR" },
        "paidBy": [{ "memberId": "m_a", "minor": 1000 }],
        "split": { "method": "equal", "memberIds": ["m_a", "m_b", "m_c"] }
      }
    ],
    "settlements": []
  },
  "expected": {
    "shares": { "e_1": { "m_a": 334, "m_b": 333, "m_c": 333 } },
    "balances": { "EUR": { "m_a": 666, "m_b": -333, "m_c": -333 } },
    "transfers": [
      { "from": "m_b", "to": "m_a", "minor": 333, "currency": "EUR" },
      { "from": "m_c", "to": "m_a", "minor": 333, "currency": "EUR" }
    ]
  }
}
```

Nota: a chi va il centesimo avanzato dipende dalla regola di rotazione di
[PLANNING §9.3](../docs/PLANNING.md#93-arrotondamento-deterministico). L'esempio sopra è solo illustrativo.
