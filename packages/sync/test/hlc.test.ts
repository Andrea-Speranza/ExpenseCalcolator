import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  formatHlc,
  type HlcClock,
  INITIAL_CLOCK,
  observeHlc,
  parseHlc,
  tickHlc,
} from '../src/index';

describe('formato HLC', () => {
  it('larghezza fissa, ordinabile come testo', () => {
    expect(formatHlc(1_760_350_000_000, 7, 'd_pc')).toBe('1760350000000:00007:d_pc');
    expect(formatHlc(5, 0, 'd_pc')).toBe('0000000000005:00000:d_pc');
  });

  it('si rilegge', () => {
    expect(parseHlc('1760350000000:00007:d_pc')).toEqual({
      wallTime: 1_760_350_000_000,
      counter: 7,
      deviceId: 'd_pc',
    });
    expect(parseHlc('non un hlc')).toBeUndefined();
  });
});

describe('tickHlc', () => {
  it('usa l’ora di sistema se è avanti', () => {
    expect(tickHlc(INITIAL_CLOCK, 1000, 'd_a')).toEqual({
      clock: { wallTime: 1000, counter: 0 },
      hlc: formatHlc(1000, 0, 'd_a'),
    });
  });

  it('nello stesso millisecondo, o con l’orologio tornato indietro, incrementa il contatore', () => {
    const clock: HlcClock = { wallTime: 1000, counter: 3 };
    expect(tickHlc(clock, 1000, 'd_a').clock).toEqual({ wallTime: 1000, counter: 4 });
    expect(tickHlc(clock, 500, 'd_a').clock).toEqual({ wallTime: 1000, counter: 4 });
  });

  it('ignora un’ora di sistema non valida', () => {
    const clock: HlcClock = { wallTime: 1000, counter: 0 };
    for (const broken of [Number.NaN, -5, 12.5]) {
      expect(tickHlc(clock, broken, 'd_a').clock).toEqual({ wallTime: 1000, counter: 1 });
    }
  });

  it('se il contatore si esaurisce passa al millisecondo successivo', () => {
    expect(tickHlc({ wallTime: 1000, counter: 99_999 }, 1000, 'd_a').clock).toEqual({
      wallTime: 1001,
      counter: 0,
    });
  });

  it('le etichette crescono sempre, qualunque cosa faccia l’orologio di sistema', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -10, max: 5000 }), { maxLength: 50 }), (nows) => {
        let clock = INITIAL_CLOCK;
        let previous = '';
        for (const now of nows) {
          const next = tickHlc(clock, now, 'd_a');
          expect(next.hlc > previous).toBe(true);
          previous = next.hlc;
          clock = next.clock;
        }
      }),
    );
  });
});

describe('observeHlc', () => {
  it('dopo aver visto un evento più recente, il prossimo evento locale viene dopo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 99_998 }),
        fc.integer({ min: 0, max: 10_000 }),
        (remoteTime, remoteCounter, now) => {
          const seen = formatHlc(remoteTime, remoteCounter, 'd_z');
          const clock = observeHlc({ wallTime: 50, counter: 0 }, seen);
          expect(tickHlc(clock, now, 'd_a').hlc > seen).toBe(true);
        },
      ),
    );
  });

  it('ignora eventi più vecchi e HLC non validi', () => {
    const clock: HlcClock = { wallTime: 1000, counter: 5 };
    expect(observeHlc(clock, formatHlc(900, 99, 'd_z'))).toBe(clock);
    expect(observeHlc(clock, formatHlc(1000, 2, 'd_z'))).toBe(clock);
    expect(observeHlc(clock, 'rotto')).toBe(clock);
  });

  it('a parità di millisecondo prende il contatore più alto', () => {
    expect(observeHlc({ wallTime: 1000, counter: 5 }, formatHlc(1000, 9, 'd_z'))).toEqual({
      wallTime: 1000,
      counter: 9,
    });
  });
});
