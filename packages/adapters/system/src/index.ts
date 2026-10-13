import type { Clock, IdGenerator } from '@expense/engine';

// Orologio e generatore di id della piattaforma. Usano solo API presenti ovunque l'app gira: browser,
// WebView di Windows e Android, Node.

export function createSystemClock(): Clock {
  return { now: () => Date.now() };
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Id ULID: 26 caratteri, i primi 10 dall'ora (quindi ordinati per tempo di creazione) e 16 casuali.
 * La casualità viene da Web Crypto: due dispositivi non generano mai lo stesso id.
 */
export function createUlidGenerator(
  clock: Clock = createSystemClock(),
  randomBytes: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (bytes) =>
    crypto.getRandomValues(bytes),
): IdGenerator {
  return { newId: () => encodeUlid(clock.now(), randomBytes(new Uint8Array(16))) };
}

/** Codifica ULID: ora in millisecondi (48 bit) e 16 byte casuali, in base 32 di Crockford. */
export function encodeUlid(time: number, random: Uint8Array): string {
  let timePart = '';
  let rest = Math.max(0, Math.floor(time));
  for (let index = 0; index < 10; index++) {
    timePart = (CROCKFORD[rest % 32] ?? '0') + timePart;
    rest = Math.floor(rest / 32);
  }
  // 256 è multiplo di 32: prendere 5 bit da ogni byte mantiene la distribuzione uniforme.
  const randomPart = [...random.slice(0, 16)].map((byte) => CROCKFORD[byte & 31] ?? '0').join('');
  return timePart + randomPart.padEnd(16, '0');
}
