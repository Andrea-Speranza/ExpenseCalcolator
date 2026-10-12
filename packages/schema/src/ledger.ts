import { z } from 'zod';
import { ExpenseIdSchema, MemberIdSchema, SettlementIdSchema } from './ids';
import { MemberAmountSchema, MoneySchema } from './money';
import { SplitSchema } from './split';

// Registro di calcolo: i dati di spese e rimborsi che servono a saldi e trasferimenti.
// Le spese salvate avranno anche descrizione, data, ecc. (Fase 2): estenderanno questi schemi.
// I campi non previsti vengono ignorati, così un file può contenere anche informazioni in più.

/** Spesa: totale, chi ha pagato quanto e come si divide. */
export const LedgerExpenseSchema = z
  .object({
    id: ExpenseIdSchema,
    total: MoneySchema,
    paidBy: z.array(MemberAmountSchema).readonly(),
    split: SplitSchema,
  })
  .readonly();
export type LedgerExpense = z.infer<typeof LedgerExpenseSchema>;

/** Rimborso: `from` dà a `to` l'importo indicato. */
export const SettlementSchema = z
  .object({
    id: SettlementIdSchema,
    from: MemberIdSchema,
    to: MemberIdSchema,
    amount: MoneySchema,
  })
  .readonly();
export type Settlement = z.infer<typeof SettlementSchema>;

export const LedgerSchema = z
  .object({
    expenses: z.array(LedgerExpenseSchema).readonly(),
    settlements: z.array(SettlementSchema).readonly(),
  })
  .readonly();
export type Ledger = z.infer<typeof LedgerSchema>;
