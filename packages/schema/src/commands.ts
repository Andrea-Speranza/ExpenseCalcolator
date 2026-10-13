import { z } from 'zod';
import {
  CalendarDateSchema,
  ExpenseAmountsSchema,
  LanguageSchema,
  SettlementTransferSchema,
} from './fields';
import { HlcSchema } from './events';
import { ExpenseIdSchema, GroupIdSchema, MemberIdSchema, SettlementIdSchema } from './ids';
import { CurrencyCodeSchema } from './money';

// Comandi (scrivono) e query (leggono): i messaggi JSON con cui UI, CLI e altri consumatori parlano con
// l'engine (PLANNING §5.2). I testi arrivano dall'utente, quindi qui si tolgono gli spazi iniziali e finali.
// Non sono dati salvati: non servono nel JSON Schema.

const text = (max: number) => z.string().trim().min(1).max(max);
const groupName = text(80);
const memberName = text(60);
const description = text(200);
const category = text(60);
const notes = text(2000);

const groupRef = { groupId: GroupIdSchema };
/** Versione dell'elemento che l'utente aveva davanti; se manca, l'engine usa quella attuale. */
const base = { base: HlcSchema.optional() };

function command<const T extends string, S extends z.ZodRawShape>(type: T, shape: S) {
  return z.object({ type: z.literal(type), ...shape }).readonly();
}

export const CommandSchema = z.discriminatedUnion('type', [
  command('CreateGroup', {
    name: groupName,
    baseCurrency: CurrencyCodeSchema.optional(),
    /** Il creatore come membro del gruppo; null se tiene i conti per altri senza farne parte. */
    me: z.object({ name: memberName }).readonly().nullable(),
  }),
  command('UpdateGroup', {
    ...groupRef,
    ...base,
    changes: z
      .object({
        name: groupName.optional(),
        baseCurrency: CurrencyCodeSchema.optional(),
        archived: z.boolean().optional(),
      })
      .readonly(),
  }),
  command('AddMember', { ...groupRef, name: memberName }),
  command('UpdateMember', {
    ...groupRef,
    ...base,
    memberId: MemberIdSchema,
    changes: z.object({ name: memberName.optional(), archived: z.boolean().optional() }).readonly(),
  }),
  command('ClaimMember', { ...groupRef, memberId: MemberIdSchema.nullable() }),
  command('AddExpense', {
    ...groupRef,
    description,
    date: CalendarDateSchema,
    amounts: ExpenseAmountsSchema,
    category: category.optional(),
    notes: notes.optional(),
  }),
  command('UpdateExpense', {
    ...groupRef,
    ...base,
    expenseId: ExpenseIdSchema,
    changes: z
      .object({
        description: description.optional(),
        date: CalendarDateSchema.optional(),
        amounts: ExpenseAmountsSchema.optional(),
        category: category.nullable().optional(),
        notes: notes.nullable().optional(),
      })
      .readonly(),
  }),
  command('DeleteExpense', { ...groupRef, expenseId: ExpenseIdSchema }),
  command('RestoreExpense', { ...groupRef, expenseId: ExpenseIdSchema }),
  command('AddSettlement', {
    ...groupRef,
    transfer: SettlementTransferSchema,
    date: CalendarDateSchema,
    notes: notes.optional(),
  }),
  command('UpdateSettlement', {
    ...groupRef,
    ...base,
    settlementId: SettlementIdSchema,
    changes: z
      .object({
        transfer: SettlementTransferSchema.optional(),
        date: CalendarDateSchema.optional(),
        notes: notes.nullable().optional(),
      })
      .readonly(),
  }),
  command('DeleteSettlement', { ...groupRef, settlementId: SettlementIdSchema }),
  command('RestoreSettlement', { ...groupRef, settlementId: SettlementIdSchema }),
  command('UpdateSettings', {
    changes: z
      .object({
        defaultCurrency: CurrencyCodeSchema.optional(),
        language: LanguageSchema.optional(),
        displayName: memberName.optional(),
      })
      .readonly(),
  }),
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];

export const QuerySchema = z.discriminatedUnion('type', [
  command('ListGroups', {}),
  command('GetGroup', groupRef),
  command('GetBalances', groupRef),
  command('GetSettings', {}),
]);
export type Query = z.infer<typeof QuerySchema>;
export type QueryType = Query['type'];
