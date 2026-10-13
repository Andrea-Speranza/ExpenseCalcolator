import type { Engine } from '@expense/engine';
import { AppShell, NotFound } from './components/layout';
import { EngineProvider } from './engine/provider';
import { useRoute } from './router';
import { ExpenseScreen } from './screens/expense-screen';
import { GroupScreen } from './screens/group';
import { GroupSettingsScreen } from './screens/group-settings';
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
