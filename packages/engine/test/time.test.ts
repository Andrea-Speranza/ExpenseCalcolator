import { describe, expect, it } from 'vitest';
import { timeOfHlc } from '../src/index';
import { device, equalSplit, unwrap, unwrapError, weekend } from './helpers';

describe('timeOfHlc', () => {
  it('restituisce i millisecondi dell’orologio contenuti nell’etichetta', () => {
    expect(timeOfHlc('1760000000000:00003:dev_1')).toBe(1_760_000_000_000);
  });

  it('restituisce null per un’etichetta non valida', () => {
    expect(timeOfHlc('ieri')).toBeNull();
  });
});

describe('ora della spesa', () => {
  it('è facoltativa: si indica, si cambia e si toglie', async () => {
    const { engine } = await device('a');
    const { groupId, anna, luca } = await weekend(engine);
    const time = () =>
      unwrap(engine.query({ type: 'GetGroup', groupId })).expenses.map((expense) => expense.time);

    const { expenseId } = unwrap(
      await engine.execute({
        type: 'AddExpense',
        groupId,
        description: 'Cena',
        date: '2026-10-12',
        time: '20:30',
        amounts: equalSplit(anna, 9000, [anna, luca]),
      }),
    );
    unwrap(
      await engine.execute({
        type: 'AddExpense',
        groupId,
        description: 'Colazione',
        date: '2026-10-13',
        amounts: equalSplit(anna, 1000, [anna, luca]),
      }),
    );
    expect(time()).toEqual(['20:30', null]);

    const update = (value: string | null) =>
      engine.execute({ type: 'UpdateExpense', groupId, expenseId, changes: { time: value } });
    unwrap(await update('21:00'));
    expect(time()).toEqual(['21:00', null]);
    unwrap(await update(null));
    expect(time()).toEqual([null, null]);
  });

  it('rifiuta un’ora non valida', async () => {
    const { engine } = await device('a');
    const { groupId, anna } = await weekend(engine);
    const error = unwrapError(
      await engine.execute({
        type: 'AddExpense',
        groupId,
        description: 'Cena',
        date: '2026-10-12',
        time: '24:00',
        amounts: equalSplit(anna, 9000, [anna]),
      }),
    );
    expect(error).toMatchObject({ code: 'InvalidInput', issues: [{ path: 'time' }] });
  });
});
