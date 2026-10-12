import { z } from 'zod';

/**
 * Codice valuta ISO 4217: tre lettere maiuscole (es. "EUR").
 * Lo schema controlla solo il formato; se la valuta è conosciuta lo decide il core, così i dati scritti da
 * una versione più recente dell'app con una valuta nuova restano leggibili.
 */
export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/**
 * Importo in unità minori intere (centesimi per l'euro), sempre accompagnato dalla sua valuta (ADR 0004).
 * Mai numeri decimali: 12,34 € si salva come { minor: 1234, currency: "EUR" }.
 */
export const MoneySchema = z
  .object({
    minor: z.int(),
    currency: CurrencyCodeSchema,
  })
  .readonly();
export type Money = z.infer<typeof MoneySchema>;
