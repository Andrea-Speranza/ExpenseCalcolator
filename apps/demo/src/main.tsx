import './demo.css';
import { openEngine } from '@expense/engine';
import { detectLanguage } from '@expense/i18n';
import { openIndexedDbStore } from '@expense/local-indexeddb';
import { createSystemClock, createUlidGenerator } from '@expense/system';
import { App, StartupError } from '@expense/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { version } from '../../../package.json';
import { DemoFrame } from './demo-frame';

// Shell della demo pubblicata su GitHub Pages (ADR 0009): la stessa app di apps/web, con i dati nel browser di
// chi la prova, dentro la cornice della demo. L'app non cambia: la cornice le sta intorno.

/** Lingua da usare finché l'utente non la sceglie nelle impostazioni: quella del browser (ADR 0010). */
const deviceLanguage = detectLanguage(navigator.languages);
document.documentElement.lang = deviceLanguage;

const container = document.getElementById('root');
if (container === null) throw new Error('Manca l’elemento #root in index.html.');
const root = createRoot(container);

async function start(): Promise<void> {
  const clock = createSystemClock();
  const engine = await openEngine({
    store: await openIndexedDbStore(),
    clock,
    ids: createUlidGenerator(clock),
  });
  root.render(
    <StrictMode>
      <DemoFrame engine={engine} defaultLanguage={deviceLanguage}>
        <App engine={engine} defaultLanguage={deviceLanguage} version={version} />
      </DemoFrame>
    </StrictMode>,
  );
}

start().catch((error: unknown) => {
  root.render(<StartupError error={error} language={deviceLanguage} />);
});
