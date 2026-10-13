import { z } from 'zod';
import { MemberIdSchema } from './ids';
import { MemberAmountSchema, MoneySchema } from './money';
import { SplitSchema } from './split';

// Valori dei campi di gruppo, membri, spese e rimborsi. Gli eventi e i comandi li riusano, così le regole
// sono definite una volta sola. I testi arrivano già puliti (spazi iniziali e finali tolti dall'engine).

export const GroupNameSchema = z.string().min(1).max(80);
export const MemberNameSchema = z.string().min(1).max(60);
export const DescriptionSchema = z.string().min(1).max(200);
export const CategorySchema = z.string().min(1).max(60);
export const NotesSchema = z.string().min(1).max(2000);

/** Data di calendario della spesa o del rimborso (AAAA-MM-GG), senza ora né fuso orario. */
export const CalendarDateSchema = z.iso.date();

/**
 * Blocco "importi" di una spesa: totale, pagatori e divisione si modificano sempre insieme, perché devono
 * restare coerenti tra loro (ADR 0007).
 */
export const ExpenseAmountsSchema = z
  .object({
    total: MoneySchema,
    paidBy: z.array(MemberAmountSchema).readonly(),
    split: SplitSchema,
  })
  .readonly();
export type ExpenseAmounts = z.infer<typeof ExpenseAmountsSchema>;

/** Blocco "trasferimento" di un rimborso: chi dà, chi riceve e quanto. */
export const SettlementTransferSchema = z
  .object({
    from: MemberIdSchema,
    to: MemberIdSchema,
    amount: MoneySchema,
  })
  .readonly();
export type SettlementTransfer = z.infer<typeof SettlementTransferSchema>;

export const LanguageSchema = z.enum(['it', 'en']);
export type Language = z.infer<typeof LanguageSchema>;

/** Modalità di un gruppo (ADR 0005): dove è pubblicato il suo log. */
export const GroupModeSchema = z.enum(['local', 'personal', 'shared']);
export type GroupMode = z.infer<typeof GroupModeSchema>;
