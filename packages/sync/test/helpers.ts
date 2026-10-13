import type { GroupEvent, ProfileEvent } from '@expense/schema';
import { formatHlc } from '../src/index';

interface Options {
  /** Istante logico dell'evento (millisecondi): basta un numero piccolo per ordinarli nei test. */
  readonly at: number;
  readonly device?: string;
  readonly actor?: string | null;
  readonly base?: string;
  readonly stream?: string;
  readonly id?: string;
}

let sequence = 0;

/** HLC leggibile per i test: `hlc(5, 'd_a')` → "0000000000005:00000:d_a". */
export const hlc = (at: number, device = 'd_a'): string => formatHlc(at, 0, device);

export function groupEvent<T extends GroupEvent['type']>(
  type: T,
  payload: Extract<GroupEvent, { readonly type: T }>['payload'],
  { at, device = 'd_a', actor = 'm_anna', base, stream = 'g_1', id }: Options,
): Extract<GroupEvent, { readonly type: T }> {
  sequence += 1;
  return {
    id: id ?? `ev_${String(sequence)}`,
    stream,
    type,
    v: 1,
    hlc: hlc(at, device),
    deviceId: device,
    actor,
    ...(base === undefined ? {} : { base }),
    payload,
  } as Extract<GroupEvent, { readonly type: T }>;
}

export function profileEvent<T extends ProfileEvent['type']>(
  type: T,
  payload: Extract<ProfileEvent, { readonly type: T }>['payload'],
  { at, device = 'd_a', stream = 'p_1', id }: Options,
): Extract<ProfileEvent, { readonly type: T }> {
  sequence += 1;
  return {
    id: id ?? `ev_${String(sequence)}`,
    stream,
    type,
    v: 1,
    hlc: hlc(at, device),
    deviceId: device,
    actor: null,
    payload,
  } as Extract<ProfileEvent, { readonly type: T }>;
}

export const amounts = (minor: number) => ({
  total: { minor, currency: 'EUR' },
  paidBy: [{ memberId: 'm_anna', amount: { minor, currency: 'EUR' } }],
  split: { method: 'equal' as const, memberIds: ['m_anna', 'm_luca'] },
});

/** Gruppo con Anna e Luca e una spesa "Cena" da 90 €, creati da Anna sul dispositivo d_a agli istanti 1–4. */
export function baseGroup(): GroupEvent[] {
  return [
    groupEvent('GroupCreated', { name: 'Weekend', baseCurrency: 'EUR' }, { at: 1 }),
    groupEvent('MemberAdded', { memberId: 'm_anna', name: 'Anna' }, { at: 2 }),
    groupEvent('MemberAdded', { memberId: 'm_luca', name: 'Luca' }, { at: 3 }),
    groupEvent(
      'ExpenseAdded',
      { expenseId: 'e_1', description: 'Cena', date: '2026-10-12', amounts: amounts(9000) },
      { at: 4 },
    ),
  ];
}
