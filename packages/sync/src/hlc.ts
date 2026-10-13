import type { DeviceId, Hlc } from '@expense/schema';

// Orologio logico ibrido (HLC): unisce l'ora di sistema a un contatore. Ogni nuovo evento locale riceve
// un'etichetta maggiore di tutte quelle già generate o viste da questo dispositivo, quindi chi modifica dopo
// aver visto una modifica altrui viene sempre ordinato dopo di essa, anche se gli orologi di sistema non
// sono allineati (PLANNING §8.3, ADR 0007).

/** Stato dell'orologio di un dispositivo. Si salva nella stessa transazione degli eventi (ADR 0007, punto 9). */
export interface HlcClock {
  readonly wallTime: number;
  readonly counter: number;
}

export const INITIAL_CLOCK: HlcClock = { wallTime: 0, counter: 0 };

/** 13 cifre per i millisecondi (fino all'anno 2286) e 5 per il contatore: larghezza fissa, ordinabile come testo. */
const MAX_COUNTER = 99_999;
const HLC_PATTERN = /^(\d{13}):(\d{5}):([A-Za-z0-9_-]{1,64})$/;

export function formatHlc(wallTime: number, counter: number, deviceId: DeviceId): Hlc {
  return `${String(wallTime).padStart(13, '0')}:${String(counter).padStart(5, '0')}:${deviceId}`;
}

export function parseHlc(
  hlc: Hlc,
):
  { readonly wallTime: number; readonly counter: number; readonly deviceId: DeviceId } | undefined {
  const match = HLC_PATTERN.exec(hlc);
  if (match === null) return undefined;
  const [, wallTime = '', counter = '', deviceId = ''] = match;
  return { wallTime: Number(wallTime), counter: Number(counter), deviceId };
}

/**
 * Etichetta per un nuovo evento locale. `now` è l'ora di sistema in millisecondi: se non è un numero
 * valido, o se l'orologio di sistema è tornato indietro, si continua dall'ultimo valore noto.
 */
export function tickHlc(
  clock: HlcClock,
  now: number,
  deviceId: DeviceId,
): { readonly clock: HlcClock; readonly hlc: Hlc } {
  const physical = Number.isSafeInteger(now) && now > 0 ? now : 0;
  let wallTime = Math.max(clock.wallTime, physical);
  let counter = wallTime === clock.wallTime ? clock.counter + 1 : 0;
  if (counter > MAX_COUNTER) {
    // Più di 100.000 eventi nello stesso millisecondo: si prende in prestito il millisecondo successivo.
    wallTime += 1;
    counter = 0;
  }
  return { clock: { wallTime, counter }, hlc: formatHlc(wallTime, counter, deviceId) };
}

/** Dopo aver ricevuto un evento da altri: i prossimi eventi locali verranno ordinati dopo di esso. */
export function observeHlc(clock: HlcClock, seen: Hlc): HlcClock {
  const parsed = parseHlc(seen);
  if (parsed === undefined) return clock;
  const isLater =
    parsed.wallTime > clock.wallTime ||
    (parsed.wallTime === clock.wallTime && parsed.counter > clock.counter);
  return isLater ? { wallTime: parsed.wallTime, counter: parsed.counter } : clock;
}
