import '@expense/ui/styles.css';
import { openEngine } from '@expense/engine';
import { detectLanguage } from '@expense/i18n';
import { openIndexedDbStore } from '@expense/local-indexeddb';
import { createSystemClock, createUlidGenerator } from '@expense/system';
import { App, StartupError } from '@expense/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Shell web: collega la UI all'engine, con i dati salvati nel browser (IndexedDB) e orologio e id del
// sistema. Le app native (Fase 4) useranno la stessa build.

/** Lingua da usare finché l'utente non la sceglie nelle impostazioni: quella del browser (ADR 0010). */
const deviceLanguage = detectLanguage(navigator.languages);
document.documentElement.lang = deviceLanguage;

const container = document.getElementById('root');
if (container === null) throw new Error('Manca l’elemento #root in index.html.');
const root = createRoot(container);

async function start(): Promise<void> {
  // Chiede al browser di non cancellare i dati quando lo spazio scarseggia (PLANNING §8.10). Non blocca
  // l'avvio: se il browser rifiuta, l'app funziona lo stesso.
  void navigator.storage.persist().catch(() => false);

  const clock = createSystemClock();
  const engine = await openEngine({
    store: await openIndexedDbStore(),
    clock,
    ids: createUlidGenerator(clock),
  });
  root.render(
    <StrictMode>
      <App engine={engine} defaultLanguage={deviceLanguage} />
    </StrictMode>,
  );
}

start().catch((error: unknown) => {
  root.render(<StartupError error={error} language={deviceLanguage} />);
});
