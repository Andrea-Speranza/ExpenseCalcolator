import type { Engine } from '@expense/engine';
import type { Language } from '@expense/i18n';
import { AppShell, NotFound } from './components/layout';
import { EngineProvider } from './engine/provider';
import { I18nProvider } from './i18n/provider';
import { useRoute } from './router';
import { ExpenseScreen } from './screens/expense-screen';
import { GroupScreen } from './screens/group';
import { GroupSettingsScreen } from './screens/group-settings';
import { GroupsScreen } from './screens/groups';
import { SettingsScreen } from './screens/settings';

export interface AppProps {
  /** Engine già aperto dalla shell, con il salvataggio della piattaforma (IndexedDB, file, …). */
  readonly engine: Engine;
  /**
   * Lingua da usare finché l'utente non ne sceglie una nelle impostazioni: la shell la ricava dal dispositivo
   * (es. `detectLanguage(navigator.languages)`, ADR 0010).
   */
  readonly defaultLanguage: Language;
}

export function App({ engine, defaultLanguage }: AppProps) {
  return (
    <EngineProvider engine={engine}>
      <I18nProvider fallback={defaultLanguage}>
        <AppShell>
          <CurrentPage />
        </AppShell>
      </I18nProvider>
    </EngineProvider>
  );
}

function CurrentPage() {
  const route = useRoute();
  switch (route.page) {
    case 'groups':
      return <GroupsScreen key="attivi" archived={false} />;
    case 'archivedGroups':
      return <GroupsScreen key="archiviati" archived />;
    case 'settings':
      return <SettingsScreen />;
    case 'group':
      return <GroupScreen key={route.groupId} groupId={route.groupId} tab={route.tab} />;
    case 'expense':
      return (
        <ExpenseScreen
          key={`${route.groupId}/${route.expenseId ?? 'nuova'}`}
          groupId={route.groupId}
          expenseId={route.expenseId}
        />
      );
    case 'groupSettings':
      return <GroupSettingsScreen key={route.groupId} groupId={route.groupId} />;
    case 'notFound':
      return <NotFound />;
  }
}
