import { expect, type Page, test } from '@playwright/test';

// I percorsi principali della web app in un browser vero: dati in IndexedDB, file scaricati e caricati.
// Ogni contesto del browser ha il proprio archivio, quindi due contesti sono due dispositivi diversi.

/** Raccoglie gli errori JavaScript della pagina: alla fine del test devono essere zero. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Crea il gruppo "Vacanza" con Anna (chi usa l'app), Luca e Sara. */
async function createGroup(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Nuovo gruppo' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome del gruppo').fill('Vacanza');
  await dialog.getByLabel('Il tuo nome').fill('Anna');
  await dialog.getByRole('button', { name: 'Crea gruppo' }).click();
  await expect(page.getByRole('heading', { name: 'Vacanza' })).toBeVisible();
  for (const name of ['Luca', 'Sara']) {
    await page.getByLabel('Aggiungi una persona').fill(name);
    await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
}

/** Spesa pagata da Anna e divisa in parti uguali tra tutti. */
async function addExpense(page: Page, description: string, amount: string): Promise<void> {
  await page.getByRole('tab', { name: 'Spese' }).click();
  await page.getByRole('link', { name: 'Nuova spesa' }).click();
  await page.getByLabel('Descrizione').fill(description);
  await page.getByLabel('Importo (EUR)').fill(amount);
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText(description)).toBeVisible();
}

test('funziona senza rete e ritrova i dati dopo aver riaperto la pagina', async ({
  page,
  context,
}) => {
  const errors = trackErrors(page);
  await page.goto('./');
  // Una volta aperta, l'app non usa la rete: si usa anche in modalità aereo.
  await context.setOffline(true);
  await createGroup(page);
  await addExpense(page, 'Cena', '90');
  await page.getByRole('tab', { name: 'Saldi' }).click();
  await expect(page.getByText('+60,00 €')).toBeVisible();

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText('+60,00 €')).toBeVisible();
  await expect(page.getByText('-30,00 €')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('un gruppo esportato si importa su un altro dispositivo', async ({
  page,
  browser,
  baseURL,
}) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await createGroup(page);
  await addExpense(page, 'Cena', '90');

  await page.getByRole('link', { name: 'Impostazioni del gruppo' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta il gruppo' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('Vacanza.spese.json');
  const file = await download.path();

  // Luca, sul suo telefono, apre il file ricevuto e dice chi è.
  const phone = await browser.newContext({
    locale: 'it-IT',
    ...(baseURL === undefined ? {} : { baseURL }),
  });
  const other = await phone.newPage();
  const otherErrors = trackErrors(other);
  await other.goto('./');
  await other.getByLabel('File da importare').setInputFiles(file);
  await expect(other.getByText(/Importate \d+ modifiche in «Vacanza»/)).toBeVisible();
  await other.getByRole('link', { name: 'Apri' }).click();
  await other
    .getByRole('listitem')
    .filter({ hasText: 'Luca' })
    .getByRole('button', { name: 'Sono io' })
    .click();
  await other.getByRole('tab', { name: 'Saldi' }).click();
  await expect(other.getByText('+60,00 €')).toBeVisible();
  await expect(other.getByText('-30,00 €')).toHaveCount(2);
  await phone.close();

  expect(errors).toEqual([]);
  expect(otherErrors).toEqual([]);
});
