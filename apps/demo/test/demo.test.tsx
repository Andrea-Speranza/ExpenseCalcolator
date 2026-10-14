/**
 * @vitest-environment jsdom
 */
import {
  createManualClock,
  createMemoryStore,
  createSequentialIds,
  type Engine,
  openEngine,
} from '@expense/engine';
import { dictionaryDifferences } from '@expense/i18n';
import { App } from '@expense/ui';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DemoFrame } from '../src/demo-frame';
import { DEMO_DICTIONARIES } from '../src/i18n';

// La demo come la vede chi la prova: l'app vera dentro la cornice, con un engine in memoria.

beforeAll(() => {
  // I componenti di Radix misurano gli elementi con ResizeObserver, che jsdom non ha.
  globalThis.ResizeObserver = class {
    observe() {
      // niente da misurare in jsdom
    }
    unobserve() {
      // come sopra
    }
    disconnect() {
      // come sopra
    }
  };
});

beforeEach(() => {
  window.location.hash = '';
});

afterEach(cleanup);

function memoryEngine(): Promise<Engine> {
  return openEngine({
    store: createMemoryStore(),
    clock: createManualClock(),
    ids: createSequentialIds('t'),
  });
}

async function renderDemo(engine?: Engine) {
  const opened = engine ?? (await memoryEngine());
  render(
    <DemoFrame engine={opened} defaultLanguage="it">
      <App engine={opened} defaultLanguage="it" />
    </DemoFrame>,
  );
  return userEvent.setup();
}

describe('demo', () => {
  it('mostra l’avviso e crea il gruppo di esempio', async () => {
    const user = await renderDemo();
    expect(screen.getByRole('note').textContent).toContain('i dati restano solo in questo browser');

    await user.click(screen.getByRole('button', { name: 'Prova con un gruppo di esempio' }));
    expect(await screen.findByRole('heading', { name: 'Weekend al lago' })).toBeDefined();
    for (const description of ['Cena in trattoria', 'Benzina', 'Spesa al supermercato']) {
      expect(screen.getByRole('link', { name: new RegExp(description) })).toBeDefined();
    }
    expect(screen.getByText('Totale spese').nextSibling?.textContent).toMatch(/^237,30\s€$/);

    await user.click(screen.getByRole('tab', { name: 'Saldi' }));
    expect(await screen.findByText('Restituiti in contanti', { exact: false })).toBeDefined();
  });

  it('nasconde il pulsante quando c’è già un gruppo', async () => {
    const engine = await memoryEngine();
    await renderDemo(engine);
    expect(screen.getByRole('button', { name: 'Prova con un gruppo di esempio' })).toBeDefined();

    await engine.execute({
      type: 'CreateGroup',
      name: 'Casa',
      baseCurrency: 'EUR',
      me: { name: 'Io' },
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Prova con un gruppo di esempio' })).toBeNull();
    });
  });

  it('segue la lingua scelta nelle impostazioni dell’app', async () => {
    const engine = await memoryEngine();
    await renderDemo(engine);
    await engine.execute({ type: 'UpdateSettings', changes: { language: 'en' } });
    expect(await screen.findByRole('button', { name: 'Try a sample group' })).toBeDefined();
  });

  it('ha gli stessi testi in italiano e in inglese', () => {
    expect(dictionaryDifferences(DEMO_DICTIONARIES.it, DEMO_DICTIONARIES.en, 'en-GB')).toEqual([]);
  });
});
