import type { AmountOutOfRange, InvalidAllocation } from './errors';
import { err, ok, type Result } from './result';

interface Part {
  share: bigint;
  readonly remainder: bigint;
  /** Posizione nell'ordine di spareggio, dopo la rotazione. */
  readonly position: number;
}

/**
 * Divide `total` (in unità minori) in parti proporzionali ai pesi, con il metodo del resto maggiore
 * (PLANNING §9.3):
 *
 * 1. ognuno riceve la parte intera della propria quota esatta;
 * 2. le unità avanzate vanno, una ciascuno, a chi ha il resto più alto;
 * 3. a parità di resto vince chi viene prima nell'ordine ruotato di `rotation` posizioni, così l'unità
 *    in più non tocca sempre alla stessa persona.
 *
 * La somma delle parti è sempre esattamente `total` e il risultato è identico su ogni dispositivo.
 * Un totale negativo si ripartisce come quello positivo, con il segno invertito.
 * I calcoli intermedi usano BigInt: importo × peso può superare gli interi sicuri.
 */
export function allocate(
  total: number,
  weights: readonly number[],
  rotation = 0,
): Result<readonly number[], InvalidAllocation | AmountOutOfRange> {
  if (!Number.isSafeInteger(total)) return err({ code: 'AmountOutOfRange' });

  const invalid = validate(weights, rotation);
  if (invalid !== undefined) return err({ code: 'InvalidAllocation', reason: invalid });

  const count = weights.length;
  const start = rotation % count;
  const magnitude = BigInt(Math.abs(total));
  const totalWeight = weights.reduce((acc, weight) => acc + BigInt(weight), 0n);

  const parts: Part[] = weights.map((weight, index) => {
    const exact = magnitude * BigInt(weight);
    return {
      share: exact / totalWeight,
      remainder: exact % totalWeight,
      position: (index - start + count) % count,
    };
  });

  const assigned = parts.reduce((acc, part) => acc + part.share, 0n);
  const ranked = [...parts].sort(byRemainderThenPosition);
  for (const part of ranked.slice(0, Number(magnitude - assigned))) {
    part.share += 1n;
  }

  return ok(parts.map((part) => (total < 0 ? 0 - Number(part.share) : Number(part.share))));
}

function validate(
  weights: readonly number[],
  rotation: number,
): InvalidAllocation['reason'] | undefined {
  if (weights.length === 0) return 'noWeights';
  if (weights.some((weight) => !Number.isSafeInteger(weight))) return 'nonIntegerWeight';
  if (weights.some((weight) => weight < 0)) return 'negativeWeight';
  if (weights.every((weight) => weight === 0)) return 'zeroTotalWeight';
  if (!Number.isSafeInteger(rotation) || rotation < 0) return 'invalidRotation';
  return undefined;
}

function byRemainderThenPosition(a: Part, b: Part): number {
  if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
  return a.position - b.position;
}
