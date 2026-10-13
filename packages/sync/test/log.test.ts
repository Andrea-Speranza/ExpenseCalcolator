import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { orderEvents } from '../src/index';
import { hlc } from './helpers';

const e = (id: string, at: number, device = 'd_a', note = '') => ({
  id,
  hlc: hlc(at, device),
  note,
});

describe('orderEvents', () => {
  it('ordina per HLC e, a parità, per id', () => {
    const events = [e('c', 2), e('b', 1, 'd_b'), e('a', 1, 'd_b'), e('d', 1, 'd_a')];
    expect(orderEvents(events).map(({ id }) => id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('scarta i doppioni', () => {
    expect(orderEvents([e('a', 1), e('a', 1), e('b', 2)]).map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('con lo stesso id e contenuti diversi sceglie sempre lo stesso evento', () => {
    const first = e('a', 1, 'd_a', 'uno');
    const second = e('a', 1, 'd_a', 'due');
    expect(orderEvents([first, second])).toEqual(orderEvents([second, first]));
    expect(orderEvents([e('a', 5), e('a', 3)])[0]?.hlc).toBe(hlc(3));
  });

  it('il risultato non dipende dall’ordine di arrivo né dai doppioni', () => {
    const events = fc.uniqueArray(
      fc.record({
        id: fc.stringMatching(/^[a-z]{1,4}$/),
        at: fc.nat({ max: 20 }),
        device: fc.constantFrom('d_a', 'd_b'),
      }),
      { selector: ({ id }) => id, maxLength: 30 },
    );
    fc.assert(
      fc.property(
        events.chain((list) =>
          fc.tuple(
            fc.constant(list),
            fc.shuffledSubarray(list, { minLength: list.length, maxLength: list.length }),
            fc.subarray(list),
          ),
        ),
        ([list, shuffled, duplicates]) => {
          const build = (items: typeof list) =>
            items.map(({ id, at, device }) => e(id, at, device));
          expect(orderEvents(build([...shuffled, ...duplicates]))).toEqual(
            orderEvents(build(list)),
          );
        },
      ),
    );
  });
});
