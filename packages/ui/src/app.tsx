import type { Engine } from '@expense/engine';
import { AppShell, NotFound } from './components/layout';
import { EngineProvider } from './engine/provider';
import { useRoute } from './router';
import { ExpenseScreen } from './screens/expense-screen';
import { GroupScreen } from './screens/group';
import { GroupsScreen } from './screens/groups';
import { SettingsScreen } from './screens/settings';

export interface AppProps {
  /** Engine già aperto dalla shell, con il salvataggio della piattaforma (IndexedDB, file, …). */
  readonly engine: Engine;
}

export function App({ engine }: AppProps) {
  return (
    <EngineProvider engine={engine}>
      <AppShell>
        <CurrentPage />
      </AppShell>
    </EngineProvider>
  );
}

function CurrentPage() {
  const route = useRoute();
  switch (route.page) {
    case 'groups':
      return <GroupsScreen />;
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
    case 'notFound':
      return <NotFound />;
  }
}
