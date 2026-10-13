# Architecture Decision Records (ADR)

Un file per decisione, con nome `NNNN-titolo-breve.md` (es. `0001-linguaggio-typescript.md`).
Un ADR accettato non si modifica: se la decisione cambia, se ne scrive uno nuovo che lo sostituisce.

## Template

```markdown
# NNNN — Titolo

- **Stato:** proposta | accettata | sostituita da NNNN
- **Data:** AAAA-MM-GG

## Contesto

Quale problema stiamo risolvendo e quali vincoli ci sono.

## Decisione

Cosa abbiamo deciso.

## Conseguenze

Cosa diventa più facile, cosa più difficile, cosa resta da fare.

## Alternative considerate

Le opzioni scartate e il motivo.
```

## Registro

| ADR                                       | Titolo                                             | Stato     |
| ----------------------------------------- | -------------------------------------------------- | --------- |
| [0001](0001-linguaggio-typescript.md)     | Linguaggio: TypeScript per tutto il progetto       | Accettata |
| [0002](0002-framework-ui-react.md)        | Framework UI: React + Vite                         | Accettata |
| [0003](0003-schema-validazione-zod.md)    | Schema e validazione: Zod 4                        | Accettata |
| [0004](0004-valute.md)                    | Valute: esplicite da subito, conversione rimandata | Accettata |
| [0005](0005-modalita-uso.md)              | Tre modalità d'uso: locale, personale, condivisa   | Accettata |
| [0006](0006-canali-plugin.md)             | Canali di condivisione come plugin                 | Accettata |
| [0007](0007-salvataggio-e-concorrenza.md) | Salvataggio dei dati e modifiche contemporanee     | Proposta  |

Le altre decisioni da registrare sono quelle aperte in [PLANNING.md §12](../PLANNING.md#12-decisioni-aperte).
