import { z } from 'zod';

// Identificativi: solo caratteri ASCII sicuri (es. ULID o UUID). Il core li usa anche per scelte
// deterministiche, come la rotazione dello spareggio, quindi devono essere identici su ogni piattaforma.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const MemberIdSchema = z.string().regex(ID_PATTERN);
export type MemberId = z.infer<typeof MemberIdSchema>;

export const ExpenseIdSchema = z.string().regex(ID_PATTERN);
export type ExpenseId = z.infer<typeof ExpenseIdSchema>;

export const SettlementIdSchema = z.string().regex(ID_PATTERN);
export type SettlementId = z.infer<typeof SettlementIdSchema>;

export const GroupIdSchema = z.string().regex(ID_PATTERN);
export type GroupId = z.infer<typeof GroupIdSchema>;

/** Profilo personale: impostazioni ed elenco dei gruppi, mai condiviso con altri (ADR 0005). */
export const ProfileIdSchema = z.string().regex(ID_PATTERN);
export type ProfileId = z.infer<typeof ProfileIdSchema>;

/** Installazione dell'app: ogni dispositivo scrive solo i propri segmenti (PLANNING §8.3). */
export const DeviceIdSchema = z.string().regex(ID_PATTERN);
export type DeviceId = z.infer<typeof DeviceIdSchema>;

export const EventIdSchema = z.string().regex(ID_PATTERN);
export type EventId = z.infer<typeof EventIdSchema>;

/** Log di eventi: un gruppo o un profilo. */
export const StreamIdSchema = z.string().regex(ID_PATTERN);
export type StreamId = z.infer<typeof StreamIdSchema>;
