import { z } from 'zod';
import { MemberIdSchema } from './ids';
import { MemberAmountSchema } from './money';

// Modalità di divisione di una spesa (PLANNING §9.2). Lo schema controlla la forma dei dati;
// le regole che legano più campi (somme, membri ripetuti) le verifica il core.

/** Parti uguali tra i membri indicati. */
const EqualSplitSchema = z
  .object({
    method: z.literal('equal'),
    memberIds: z.array(MemberIdSchema).readonly(),
  })
  .readonly();

/** Importo esatto per ogni membro, nella valuta della spesa: la somma deve fare il totale. */
const ExactSplitSchema = z
  .object({
    method: z.literal('exact'),
    amounts: z.array(MemberAmountSchema).readonly(),
  })
  .readonly();

/** Percentuali in punti base (10000 = 100%): la somma deve fare 10000. */
const PercentageSplitSchema = z
  .object({
    method: z.literal('percentage'),
    percentages: z
      .array(
        z.object({ memberId: MemberIdSchema, basisPoints: z.int().min(0).max(10_000) }).readonly(),
      )
      .readonly(),
  })
  .readonly();

/** Quote intere (es. 2 / 1 / 1): ognuno paga in proporzione al proprio peso. */
const SharesSplitSchema = z
  .object({
    method: z.literal('shares'),
    weights: z
      .array(z.object({ memberId: MemberIdSchema, weight: z.int().min(0) }).readonly())
      .readonly(),
  })
  .readonly();

export const SplitSchema = z.discriminatedUnion('method', [
  EqualSplitSchema,
  ExactSplitSchema,
  PercentageSplitSchema,
  SharesSplitSchema,
]);
export type Split = z.infer<typeof SplitSchema>;
export type SplitMethod = Split['method'];
