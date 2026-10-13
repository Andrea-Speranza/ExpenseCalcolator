import { describe, expect, it } from 'vitest';
import {
  exportGroupFile,
  importExchangeFile,
  parseExchangeFile,
  serializeExchangeFile,
} from '../src/index';
import { device, equalSplit, unwrap, unwrapError, weekend } from './helpers';

/** Il gruppo "Weekend" di Anna, con una cena, salvato come file di scambio. */
async function exportedWeekend() {
  const { engine } = await device('a');
  const ids = await weekend(engine);
  unwrap(
    await engine.execute({
      type: 'AddExpense',
      groupId: ids.groupId,
      description: 'Cena',
      date: '2026-10-12',
      amounts: equalSplit(ids.anna, 9000, [ids.anna, ids.luca]),
    }),
  );
  const text = serializeExchangeFile(unwrap(exportGroupFile(engine, ids.groupId)));
  return { engine, ...ids, text };
}

describe('file di scambio', () => {
  it('contiene il formato, il nome del gruppo e tutti i suoi eventi', async () => {
    const { engine, groupId, text } = await exportedWeekend();
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toEqual({
      format: 'expense-calcolator/eventi',
      version: 1,
      group: 'Weekend',
      events: engine.exportEvents(groupId),
    });
  });

  it('su un altro dispositivo ricrea lo stesso gruppo, con gli stessi saldi', async () => {
    const { engine, groupId, text } = await exportedWeekend();
    const other = (await device('b')).engine;

    const summary = unwrap(await importExchangeFile(other, unwrap(parseExchangeFile(text))));
    expect(summary).toEqual({
      added: engine.exportEvents(groupId).length,
      invalid: 0,
      groups: [
        { groupId, name: 'Weekend', baseCurrency: 'EUR', archived: false, mode: 'local', me: null },
      ],
    });
    expect(other.query({ type: 'GetBalances', groupId })).toEqual(
      engine.query({ type: 'GetBalances', groupId }),
    );

    // Importarlo di nuovo non cambia nulla.
    const again = unwrap(await importExchangeFile(other, unwrap(parseExchangeFile(text))));
    expect(again).toMatchObject({ added: 0, invalid: 0 });
  });

  it('scarta gli eventi non validi e importa gli altri', async () => {
    const { groupId, text } = await exportedWeekend();
    const file = unwrap(parseExchangeFile(text));
    const other = (await device('b')).engine;
    const summary = unwrap(
      await importExchangeFile(other, { ...file, events: [...file.events, { boh: 1 }, 'x'] }),
    );
    expect(summary).toMatchObject({ added: file.events.length, invalid: 2 });
    expect(summary.groups.map((group) => group.groupId)).toEqual([groupId]);
  });

  it('accetta il BOM che alcuni editor aggiungono', async () => {
    const { text } = await exportedWeekend();
    expect(parseExchangeFile(`\uFEFF${text}`).ok).toBe(true);
  });

  it('riconosce i file che non può importare', async () => {
    const { text } = await exportedWeekend();
    const reason = (content: string) => unwrapError(parseExchangeFile(content)).reason;
    expect(reason('non è json')).toBe('notJson');
    expect(reason('{"format":"altro","version":1,"group":"x","events":[]}')).toBe(
      'notExchangeFile',
    );
    expect(reason(text.replace('"version": 1', '"version": 2'))).toBe('newerVersion');
  });

  it('non esporta un gruppo che non esiste', async () => {
    const { engine } = await device('a');
    expect(unwrapError(exportGroupFile(engine, 'nessuno'))).toEqual({
      code: 'NotFound',
      entity: 'group',
      id: 'nessuno',
    });
  });
});
