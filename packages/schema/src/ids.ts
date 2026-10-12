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
