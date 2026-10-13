import { z } from 'zod';

// File di scambio di un gruppo (il canale "file", ADR 0006): gli eventi del gruppo così come sono salvati, da
// passare a un altro dispositivo o a un'altra persona (WhatsApp, email, chiavetta…). Lo scrivono e lo leggono
// tutte le app (CLI, web, native); importarlo più volte non crea doppioni.

export const EXCHANGE_FILE_FORMAT = 'expense-calcolator/eventi';

export const ExchangeFileSchema = z
  .object({
    format: z.literal(EXCHANGE_FILE_FORMAT),
    /** Versione del formato del file, non degli eventi (che hanno la propria `v`). */
    version: z.int().min(1),
    /** Nome del gruppo al momento dell'esportazione: serve solo a riconoscere il file. */
    group: z.string(),
    events: z
      .array(z.unknown())
      .readonly()
      .describe(
        'Eventi salvati (stored-event.schema.json). Si validano uno per uno all’importazione: quelli non validi si scartano.',
      ),
  })
  .readonly();
export type ExchangeFile = z.infer<typeof ExchangeFileSchema>;
