import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { allocate } from '../src/index';
import { unwrap, unwrapError } from './helpers';

const total = fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 });
const weights = fc
  .array(fc.nat({ max: 1_000_000 }), { minLength: 1, maxLength: 20 })
  .filter((list) => list.some((weight) => weight > 0));
const rotation = fc.nat({ max: 50 });

describe('allocate: esempi', () => {
  it('divide 10,00 € tra tre persone: il centesimo in più va al primo', () => {
    expect(unwrap(allocate(1000, [1, 1, 1]))).toEqual([334, 333, 333]);
  });

  it('la rotazione sposta il centesimo in più', () => {
    expect(unwrap(allocate(1000, [1, 1, 1], 1))).toEqual([333, 334, 333]);
    expect(unwrap(allocate(1000, [1, 1, 1], 2))).toEqual([333, 333, 334]);
    expect(unwrap(allocate(1000, [1, 1, 1], 3))).toEqual([334, 333, 333]);
  });

  it('divide in base alle quote (2 / 1 / 1)', () => {
    expect(unwrap(allocate(9000, [2, 1, 1]))).toEqual([4500, 2250, 2250]);
  });

  it('assegna le unità avanzate a chi ha il resto più alto', () => {
    // Quote esatte: 33,3 / 66,6 / 0 → la parte con resto ,6 riceve l'unità in più.
    expect(unwrap(allocate(100, [1, 2, 0]))).toEqual([33, 67, 0]);
  });

  it('non dà nulla a chi ha peso zero', () => {
    expect(unwrap(allocate(1000, [1, 0, 1]))).toEqual([500, 0, 500]);
  });

  it('ripartisce un totale negativo come quello positivo, con il segno invertito', () => {
    expect(unwrap(allocate(-1000, [1, 1, 1]))).toEqual([-334, -333, -333]);
  });

  it('ripartisce lo zero senza produrre zeri negativi', () => {
    const shares = unwrap(allocate(0, [1, 1]));
    expect(shares.every((share) => Object.is(share, 0))).toBe(true);
  });

  it('regge importi e pesi molto grandi senza perdere precisione', () => {
    const shares = unwrap(allocate(Number.MAX_SAFE_INTEGER, [1_000_000, 1_000_000, 1]));
    expect(shares.reduce((acc, share) => acc + share, 0)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('allocate: errori', () => {
  it.each([
    ['noWeights', []],
    ['negativeWeight', [1, -1]],
    ['nonIntegerWeight', [1, 0.5]],
    ['zeroTotalWeight', [0, 0]],
  ])('%s', (reason, list) => {
    expect(unwrapError(allocate(100, list))).toEqual({ code: 'InvalidAllocation', reason });
  });

  it.each([-1, 1.5])('rifiuta la rotazione %d', (value) => {
    expect(unwrapError(allocate(100, [1, 1], value))).toEqual({
      code: 'InvalidAllocation',
      reason: 'invalidRotation',
    });
  });

  it('rifiuta un totale non intero', () => {
    expect(unwrapError(allocate(10.5, [1, 1]))).toEqual({ code: 'AmountOutOfRange' });
  });
});

describe('allocate: invarianti', () => {
  it('la somma delle parti è sempre esattamente il totale', () => {
    fc.assert(
      fc.property(total, weights, rotation, (amount, list, turn) => {
        const shares = unwrap(allocate(amount, list, turn));
        expect(shares).toHaveLength(list.length);
        expect(shares.reduce((acc, share) => acc + share, 0)).toBe(amount);
      }),
    );
  });

  it('ogni parte dista meno di un’unità dalla sua quota esatta', () => {
    fc.assert(
      fc.property(total, weights, rotation, (amount, list, turn) => {
        const shares = unwrap(allocate(amount, list, turn));
        const totalWeight = list.reduce((acc, weight) => acc + BigInt(weight), 0n);
        shares.forEach((share, index) => {
          // |parte − totale × peso / pesoTotale| < 1, calcolato con interi per non perdere precisione.
          const scaled = BigInt(share) * totalWeight - BigInt(amount) * BigInt(list[index] ?? 0);
          expect(scaled < 0n ? -scaled : scaled).toBeLessThan(totalWeight);
        });
      }),
    );
  });

  it('a pesi uguali le parti differiscono al massimo di un’unità', () => {
    fc.assert(
      fc.property(total, fc.integer({ min: 1, max: 20 }), rotation, (amount, count, turn) => {
        const shares = unwrap(allocate(amount, Array<number>(count).fill(1), turn));
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('invertire il segno del totale inverte il segno delle parti', () => {
    fc.assert(
      fc.property(total, weights, rotation, (amount, list, turn) => {
        const positive = unwrap(allocate(amount, list, turn));
        const negative = unwrap(allocate(0 - amount, list, turn));
        expect(negative).toEqual(positive.map((share) => 0 - share));
      }),
    );
  });
});
