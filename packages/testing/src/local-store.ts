import type { DeviceRecord, LocalStore, StoredEvent } from '@expense/engine';
import { describe, expect, it } from 'vitest';

// Suite di contratto della porta LocalStore: ogni implementazione deve superarla (PLANNING §14).

export interface StoreFactory {
  /** Un salvataggio nuovo e vuoto, e un modo per riaprirlo come dopo un riavvio dell'app. */
  create(): Promise<{ readonly store: LocalStore; readonly reopen: () => Promise<LocalStore> }>;
}

const device: DeviceRecord = {
  deviceId: 'd_1',
  profileId: 'p_1',
  clock: { wallTime: 10, counter: 0 },
};

const event = (id: string): StoredEvent => ({
  id,
  stream: 'g_1',
  type: 'MemberAdded',
  v: 1,
  hlc: `00000000000${id.slice(-2)}:00000:d_1`,
  deviceId: 'd_1',
  actor: null,
  payload: { memberId: `m_${id}`, name: `Membro ${id}` },
});

export function describeLocalStoreContract(name: string, factory: StoreFactory): void {
  describe(`LocalStore: ${name}`, () => {
    it('vuoto alla prima apertura', async () => {
      const { store } = await factory.create();
      expect(await store.loadDevice()).toBeUndefined();
      expect(await store.loadEvents()).toEqual([]);
    });

    it('salva eventi e dispositivo insieme e li ritrova dopo la riapertura', async () => {
      const { store, reopen } = await factory.create();
      await store.save([event('e_01'), event('e_02')], device);
      const reopened = await reopen();
      expect(await reopened.loadDevice()).toEqual(device);
      expect(await reopened.loadEvents()).toEqual(
        expect.arrayContaining([event('e_01'), event('e_02')]) as unknown,
      );
    });

    it('un evento già salvato non si duplica; il dispositivo si aggiorna', async () => {
      const { store } = await factory.create();
      await store.save([event('e_01')], device);
      const later: DeviceRecord = { ...device, clock: { wallTime: 20, counter: 3 } };
      await store.save([event('e_01'), event('e_03')], later);
      expect(await store.loadEvents()).toHaveLength(2);
      expect(await store.loadDevice()).toEqual(later);
    });
  });
}
