/**
 * @vitest-environment jsdom
 */
import {
  createManualClock,
  createMemoryStore,
  createSequentialIds,
  openEngine,
} from '@expense/engine';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/app';

// L'app intera, con un engine vero in memoria, usata come farebbe una persona: clic e testo scritto.

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

async function renderApp(): Promise<UserEvent> {
  const engine = await openEngine({
    store: createMemoryStore(),
    clock: createManualClock(),
    ids: createSequentialIds('t'),
  });
  render(<App engine={engine} />);
  return userEvent.setup();
}

/** Crea il gruppo "Vacanza" con Anna (chi usa l'app), Luca e Sara; restituisce l'indirizzo del gruppo. */
async function createGroup(user: UserEvent): Promise<string> {
  await user.click(screen.getByRole('button', { name: 'Nuovo gruppo' }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText('Nome del gruppo'), 'Vacanza');
  await user.type(within(dialog).getByLabelText('Il tuo nome'), 'Anna');
  await user.click(within(dialog).getByRole('button', { name: 'Crea gruppo' }));

  // Dopo la creazione si apre la scheda dei membri.
  await screen.findByRole('heading', { name: 'Vacanza' });
  const name = screen.getByLabelText('Aggiungi una persona');
  await user.type(name, 'Luca{Enter}');
  await screen.findByText('Luca');
  await user.type(name, 'Sara{Enter}');
  await screen.findByText('Sara');
  return window.location.hash.replace(/\/membri$/, '');
}

function first<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('Nessun elemento trovato.');
  return item;
}

describe('app', () => {
  it('crea un gruppo, registra una spesa e pareggia i conti', async () => {
    const user = await renderApp();
    await createGroup(user);

    await user.click(screen.getByRole('tab', { name: 'Spese' }));
    await user.click(await screen.findByRole('link', { name: 'Nuova spesa' }));
    await user.type(await screen.findByLabelText('Descrizione'), 'Cena');
    await user.type(screen.getByLabelText('Importo (EUR)'), '90');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    await screen.findByText('Cena');
    expect(screen.getByText('pagato da Anna', { exact: false })).toBeDefined();

    // Anna ha pagato 90 € per tre: riceve 60 €, Luca e Sara danno 30 € ciascuno.
    await user.click(screen.getByRole('tab', { name: 'Saldi' }));
    expect(await screen.findByText('+60,00 €')).toBeDefined();
    expect(screen.getAllByText('-30,00 €')).toHaveLength(2);

    // Un trasferimento suggerito diventa un rimborso, già compilato.
    await user.click(first(screen.getAllByRole('button', { name: 'Pagato' })));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Importo (EUR)')).toHaveProperty('value', '30,00');
    await user.click(within(dialog).getByRole('button', { name: 'Registra' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText('+30,00 €')).toBeDefined();
    expect(screen.getAllByText('-30,00 €')).toHaveLength(1);
    expect(screen.getAllByText('in pari')).toHaveLength(1);
  });

  it('divide con le quote e modifica una spesa esistente', async () => {
    const user = await renderApp();
    const group = await createGroup(user);

    window.location.hash = `${group}/spese/nuova`;
    await user.type(await screen.findByLabelText('Descrizione'), 'Spesa al supermercato');
    await user.type(screen.getByLabelText('Importo (EUR)'), '40');
    await user.selectOptions(screen.getByLabelText('Chi ha pagato'), 'Luca');
    await user.click(screen.getByRole('tab', { name: 'Quote' }));
    const anna = screen.getByLabelText('Anna');
    await user.clear(anna);
    await user.type(anna, '2');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    // Quote 2/1/1 su 40 €: Anna 20 €, Luca e Sara 10 €. Luca ha pagato tutto.
    await user.click(await screen.findByRole('link', { name: /Spesa al supermercato/ }));
    const amount = await screen.findByLabelText('Importo (EUR)');
    expect(amount).toHaveProperty('value', '40,00');
    await user.clear(amount);
    await user.type(amount, '80');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    await screen.findByText('Spesa al supermercato');
    await user.click(screen.getByRole('tab', { name: 'Saldi' }));
    expect(await screen.findByText('+60,00 €')).toBeDefined();
    expect(screen.getByText('-40,00 €')).toBeDefined();
    expect(screen.getByText('-20,00 €')).toBeDefined();
  });

  it('segnala i campi da correggere senza salvare', async () => {
    const user = await renderApp();
    const group = await createGroup(user);

    window.location.hash = `${group}/spese/nuova`;
    await user.click(await screen.findByRole('button', { name: 'Salva' }));
    expect(screen.getByText('Scrivi una descrizione.')).toBeDefined();
    expect(screen.getByText('Indica un importo.')).toBeDefined();

    await user.type(screen.getByLabelText('Descrizione'), 'Taxi');
    await user.type(screen.getByLabelText('Importo (EUR)'), '30');
    await user.click(screen.getByRole('tab', { name: 'Importi' }));
    await user.type(screen.getByLabelText('Anna'), '10');
    expect(screen.getByText('Mancano 20,00 €.')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    // Le somme le verifica l'engine: l'errore arriva da lì, spiegato in italiano.
    expect(await screen.findByText('Gli importi sommano 10,00 € invece di 30,00 €.')).toBeDefined();
  });

  it('mostra una pagina di errore per gli indirizzi sconosciuti', async () => {
    window.location.hash = '#/gruppi/inesistente';
    await renderApp();
    expect(
      await screen.findByText('Questo gruppo non esiste su questo dispositivo.'),
    ).toBeDefined();
  });
});
