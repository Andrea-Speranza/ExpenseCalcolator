import { z } from 'zod';
import {
  CalendarDateSchema,
  CategorySchema,
  ClockTimeSchema,
  DescriptionSchema,
  ExpenseAmountsSchema,
  GroupModeSchema,
  GroupNameSchema,
  LanguageSchema,
  MemberNameSchema,
  NotesSchema,
  SettlementTransferSchema,
} from './fields';
import {
  DeviceIdSchema,
  EventIdSchema,
  ExpenseIdSchema,
  GroupIdSchema,
  MemberIdSchema,
  SettlementIdSchema,
  StreamIdSchema,
} from './ids';
import { CurrencyCodeSchema } from './money';

// Eventi: ogni modifica a un gruppo o al profilo è un evento immutabile (ADR 0007).

/**
 * Orologio logico ibrido (HLC): "<millisecondi, 13 cifre>:<contatore, 5 cifre>:<deviceId>".
 * Confrontati come stringhe, gli HLC danno l'ordine degli eventi, uguale su ogni dispositivo.
 */
export const HlcSchema = z.string().regex(/^\d{13}:\d{5}:[A-Za-z0-9_-]{1,64}$/);
export type Hlc = z.infer<typeof HlcSchema>;

const envelope = {
  id: EventIdSchema,
  stream: StreamIdSchema,
  hlc: HlcSchema,
  deviceId: DeviceIdSchema,
  /** Membro che ha fatto la modifica; null se l'autore non è un membro o per gli eventi del profilo. */
  actor: MemberIdSchema.nullable(),
  /** Solo per le modifiche: la versione (HLC) dell'elemento che l'autore aveva davanti. */
  base: HlcSchema.optional(),
};

/**
 * Busta di un evento qualsiasi, anche di un tipo sconosciuto scritto da una versione più recente dell'app:
 * si conserva così com'è e si ignora nel calcolo dello stato (PLANNING §6.3).
 */
export const StoredEventSchema = z
  .object({ ...envelope, type: z.string().min(1), v: z.int().min(1), payload: z.unknown() })
  .readonly();
export type StoredEvent = z.infer<typeof StoredEventSchema>;

function event<const T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.object({ ...envelope, type: z.literal(type), v: z.literal(1), payload }).readonly();
}

const expenseRef = { expenseId: ExpenseIdSchema };
const settlementRef = { settlementId: SettlementIdSchema };

/** Eventi di un gruppo: gruppo, membri, spese e rimborsi. */
export const GroupEventSchema = z.discriminatedUnion('type', [
  event(
    'GroupCreated',
    z.object({ name: GroupNameSchema, baseCurrency: CurrencyCodeSchema }).readonly(),
  ),
  event(
    'GroupUpdated',
    z
      .object({
        changes: z
          .object({
            name: GroupNameSchema.optional(),
            baseCurrency: CurrencyCodeSchema.optional(),
            archived: z.boolean().optional(),
          })
          .readonly(),
      })
      .readonly(),
  ),
  event('MemberAdded', z.object({ memberId: MemberIdSchema, name: MemberNameSchema }).readonly()),
  event(
    'MemberUpdated',
    z
      .object({
        memberId: MemberIdSchema,
        changes: z
          .object({ name: MemberNameSchema.optional(), archived: z.boolean().optional() })
          .readonly(),
      })
      .readonly(),
  ),
  event(
    'ExpenseAdded',
    z
      .object({
        ...expenseRef,
        description: DescriptionSchema,
        date: CalendarDateSchema,
        time: ClockTimeSchema.optional(),
        amounts: ExpenseAmountsSchema,
        category: CategorySchema.optional(),
        notes: NotesSchema.optional(),
      })
      .readonly(),
  ),
  event(
    'ExpenseUpdated',
    z
      .object({
        ...expenseRef,
        // null toglie un campo facoltativo (ora, categoria, note).
        changes: z
          .object({
            description: DescriptionSchema.optional(),
            date: CalendarDateSchema.optional(),
            time: ClockTimeSchema.nullable().optional(),
            amounts: ExpenseAmountsSchema.optional(),
            category: CategorySchema.nullable().optional(),
            notes: NotesSchema.nullable().optional(),
          })
          .readonly(),
      })
      .readonly(),
  ),
  event('ExpenseDeleted', z.object(expenseRef).readonly()),
  event('ExpenseRestored', z.object(expenseRef).readonly()),
  event(
    'SettlementAdded',
    z
      .object({
        ...settlementRef,
        transfer: SettlementTransferSchema,
        date: CalendarDateSchema,
        notes: NotesSchema.optional(),
      })
      .readonly(),
  ),
  event(
    'SettlementUpdated',
    z
      .object({
        ...settlementRef,
        changes: z
          .object({
            transfer: SettlementTransferSchema.optional(),
            date: CalendarDateSchema.optional(),
            notes: NotesSchema.nullable().optional(),
          })
          .readonly(),
      })
      .readonly(),
  ),
  event('SettlementDeleted', z.object(settlementRef).readonly()),
  event('SettlementRestored', z.object(settlementRef).readonly()),
]);
export type GroupEvent = z.infer<typeof GroupEventSchema>;
export type GroupEventType = GroupEvent['type'];

/** Impostazioni personali: una chiave per impostazione, vince la modifica più recente (ADR 0007). */
export const SettingSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('defaultCurrency'), value: CurrencyCodeSchema }).readonly(),
  z.object({ key: z.literal('language'), value: LanguageSchema }).readonly(),
  z.object({ key: z.literal('displayName'), value: MemberNameSchema }).readonly(),
]);
export type Setting = z.infer<typeof SettingSchema>;
export type SettingKey = Setting['key'];

/** Eventi del profilo personale (ADR 0005): impostazioni, gruppi collegati e "chi sono io" in ogni gruppo. */
export const ProfileEventSchema = z.discriminatedUnion('type', [
  event('SettingChanged', SettingSchema),
  event('GroupLinked', z.object({ groupId: GroupIdSchema, mode: GroupModeSchema }).readonly()),
  event('GroupUnlinked', z.object({ groupId: GroupIdSchema }).readonly()),
  event(
    'MemberClaimed',
    z.object({ groupId: GroupIdSchema, memberId: MemberIdSchema.nullable() }).readonly(),
  ),
]);
export type ProfileEvent = z.infer<typeof ProfileEventSchema>;
export type ProfileEventType = ProfileEvent['type'];
