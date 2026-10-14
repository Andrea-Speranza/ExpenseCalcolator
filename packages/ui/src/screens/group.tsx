import { Button } from '@expense/ui/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@expense/ui/components/ui/tabs';
import { Settings2Icon } from 'lucide-react';
import { NotFound, PageHeader } from '../components/layout';
import { useQuery } from '../engine/store';
import { activeMembers, memberNames } from '../group-data';
import { K, useI18n } from '../i18n';
import { type GroupTab, isGroupTab, navigate, routeHref } from '../router';
import { BalancesTab } from './balances-tab';
import { ExpensesTab } from './expenses-tab';
import { HistoryTab } from './history-tab';
import { MembersTab } from './members-tab';

export function GroupScreen({
  groupId,
  tab,
}: {
  readonly groupId: string;
  readonly tab: GroupTab;
}) {
  const { t } = useI18n();
  const result = useQuery({ type: 'GetGroup', groupId });
  if (!result.ok) return <NotFound message={t(K.common.groupNotHere)} />;
  const group = result.value;
  const people = activeMembers(group).length;
  const me = group.me === null ? undefined : memberNames(group).get(group.me);

  return (
    <>
      <PageHeader
        back={{
          href: routeHref({ page: group.archived ? 'archivedGroups' : 'groups' }),
          label: t(K.common.groups),
        }}
        title={group.name}
        actions={
          <Button variant="outline" size="icon" asChild>
            <a
              href={routeHref({ page: 'groupSettings', groupId })}
              aria-label={t(K.group.settings)}
            >
              <Settings2Icon />
            </a>
          </Button>
        }
        description={[
          group.baseCurrency,
          t(K.group.people, { count: people }),
          ...(me === undefined ? [] : [t(K.group.youAre, { name: me })]),
          ...(group.archived ? [t(K.group.archived)] : []),
        ].join(t(K.common.separator))}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isGroupTab(value))
            navigate({ page: 'group', groupId, tab: value }, { replace: true });
        }}
      >
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="spese">{t(K.group.tabs.expenses)}</TabsTrigger>
          <TabsTrigger value="saldi">{t(K.group.tabs.balances)}</TabsTrigger>
          <TabsTrigger value="storico">{t(K.group.tabs.history)}</TabsTrigger>
          <TabsTrigger value="membri">{t(K.group.tabs.members)}</TabsTrigger>
        </TabsList>
        <TabsContent value="spese">
          <ExpensesTab group={group} />
        </TabsContent>
        <TabsContent value="saldi">
          <BalancesTab group={group} />
        </TabsContent>
        <TabsContent value="storico">
          <HistoryTab group={group} />
        </TabsContent>
        <TabsContent value="membri">
          <MembersTab group={group} />
        </TabsContent>
      </Tabs>
    </>
  );
}
