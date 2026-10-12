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

| ADR                                    | Titolo                                       | Stato     |
| -------------------------------------- | -------------------------------------------- | --------- |
| [0001](0001-linguaggio-typescript.md)  | Linguaggio: TypeScript per tutto il progetto | Accettata |
| [0002](0002-framework-ui-react.md)     | Framework UI: React + Vite                   | Accettata |
| [0003](0003-schema-validazione-zod.md) | Schema e validazione: Zod 4                  | Accettata |

Le altre decisioni da registrare sono quelle aperte in [PLANNING.md §12](../PLANNING.md#12-decisioni-aperte).
