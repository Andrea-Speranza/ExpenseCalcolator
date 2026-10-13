import {
  createManualClock,
  createMemoryStore,
  createSequentialIds,
  type Engine,
  type LocalStore,
  openEngine,
  type Result,
} from '../src/index';

/** Estrae il valore di un risultato riuscito; fa fallire il test se è un errore. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Errore inatteso: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Estrae l'errore di un risultato fallito; fa fallire il test se è riuscito. */
export function unwrapError<T, E>(result: Result<T, E>): E {
  if (result.ok) throw new Error(`Successo inatteso: ${JSON.stringify(result.value)}`);
  return result.error;
}

export interface Device {
  readonly engine: Engine;
  readonly store: LocalStore;
  readonly clock: ReturnType<typeof createManualClock>;
}

/** Un dispositivo simulato: salvataggio in memoria, orologio manuale, id con un prefisso proprio. */
export async function device(
  name: string,
  store: LocalStore = createMemoryStore(),
): Promise<Device> {
  const clock = createManualClock();
  const engine = await openEngine({ store, clock, ids: createSequentialIds(name) });
  return { engine, store, clock };
}

export const eur = (minor: number) => ({ minor, currency: 'EUR' });

/** Spesa pagata da `payer` e divisa in parti uguali tra `members`. */
export const equalSplit = (payer: string, minor: number, members: readonly string[]) => ({
  total: eur(minor),
  paidBy: [{ memberId: payer, amount: eur(minor) }],
  split: { method: 'equal' as const, memberIds: members },
});

/** Crea un gruppo con Anna (creatrice) e Luca; restituisce gli id. */
export async function weekend(engine: Engine) {
  const created = unwrap(
    await engine.execute({ type: 'CreateGroup', name: 'Weekend', me: { name: 'Anna' } }),
  );
  const { memberId: luca } = unwrap(
    await engine.execute({ type: 'AddMember', groupId: created.groupId, name: 'Luca' }),
  );
  if (created.memberId === null) throw new Error('manca la creatrice');
  return { groupId: created.groupId, anna: created.memberId, luca };
}
