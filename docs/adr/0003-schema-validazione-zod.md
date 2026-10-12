# 0003 — Schema e validazione: Zod 4

- **Stato:** accettata
- **Data:** 2026-10-12

## Contesto

`packages/schema` è l'unica fonte di verità per entità, eventi, comandi e query
([PLANNING §6](../PLANNING.md#6-modelli-dati-condivisi)). La libreria scelta deve fornire tre cose:

- i tipi TypeScript;
- la validazione a runtime ai confini del sistema: i comandi in ingresso e i file letti dal cloud, che
  possono essere stati scritti da altri dispositivi o da versioni diverse dell'app;
- l'esportazione del JSON Schema in `spec/schemas/`.

I candidati considerati sono Zod 4, Valibot e TypeBox.

## Decisione

Zod 4.

## Motivazioni

1. **Fa tutto da sola.** Tipi inferiti, validazione e JSON Schema nativo (`z.toJSONSchema`), senza plugin esterni.
2. **Gli stessi schemi servono anche alla UI.** I form, per esempio "nuova spesa", si validano con gli stessi
   schemi usati dall'engine, grazie agli adattatori per le librerie di form React.
3. **È la più diffusa.** Ha più documentazione, più esempi e più integrazioni delle alternative.
4. **Il peso è sotto controllo.** Se il bundle diventasse un problema, esiste la variante `zod/mini`, che ha la
   stessa semantica e un'API più adatta al tree-shaking.

## Regole d'uso

- **Gli schemi descrivono solo la forma dei dati.** Gli schemi esportati non usano `transform`, perché non si
  può rappresentare in JSON Schema. Le migrazioni degli eventi (upcaster) sono funzioni separate dentro `schema`.
- **Il core importa solo i tipi** (`import type`), quindi resta senza dipendenze a runtime
  ([PLANNING §4.2](../PLANNING.md#42-vincoli-che-rendono-il-core-davvero-portabile)).
- **La validazione avviene solo ai confini:** in `engine` per i comandi in ingresso e in `sync` per gli
  eventi letti dal cloud. Mai dentro il core.
- **Il JSON Schema in `spec/schemas/` è generato, non scritto a mano.** La CI fallisce se i file non sono aggiornati.

## Conseguenze

- **Vantaggio:** una sola definizione serve per tipi, validazione, JSON Schema e form.
- **Costo accettato:** `schema`, `engine`, `sync` e `ui` hanno una dipendenza esterna. Il core no.

## Alternative considerate

| Libreria | Perché no                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Valibot  | Più leggera e modulare, ma il JSON Schema richiede un pacchetto separato e l'ecosistema è più piccolo                          |
| TypeBox  | Nasce da JSON Schema, quindi è ottima per `spec/`, ma l'API è più verbosa e le integrazioni con i form React sono meno diffuse |
