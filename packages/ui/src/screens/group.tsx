import { Button } from '@expense/ui/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@expense/ui/components/ui/tabs';
import { Settings2Icon } from 'lucide-react';
import { NotFound, PageHeader } from '../components/layout';
import { useQuery } from '../engine/store';
import { activeMembers, memberNames } from '../group-data';
import { type GroupTab, isGroupTab, navigate, routeHref } from '../router';
import { BalancesTab } from './balances-tab';
import { ExpensesTab } from './expenses-tab';
import { MembersTab } from './members-tab';

export function GroupScreen({
  groupId,
  tab,
}: {
  readonly groupId: string;
  readonly tab: GroupTab;
}) {
  const result = useQuery({ type: 'GetGroup', groupId });
  if (!result.ok) return <NotFound message="Questo gruppo non esiste su questo dispositivo." />;
  const group = result.value;
  const people = activeMembers(group).length;
  const me = group.me === null ? undefined : memberNames(group).get(group.me);

  return (
    <>
      <PageHeader
        back={{ href: routeHref({ page: 'groups' }), label: 'Gruppi' }}
        title={group.name}
        actions={
          <Button variant="outline" size="icon" asChild>
            <a
              href={routeHref({ page: 'groupSettings', groupId })}
              aria-label="Impostazioni del gruppo"
            >
              <Settings2Icon />
            </a>
          </Button>
        }
        description={[
          group.baseCurrency,
          people === 1 ? '1 persona' : `${String(people)} persone`,
          ...(me === undefined ? [] : [`tu sei ${me}`]),
          ...(group.archived ? ['archiviato'] : []),
        ].join(' · ')}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isGroupTab(value))
            navigate({ page: 'group', groupId, tab: value }, { replace: true });
        }}
      >
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="spese">Spese</TabsTrigger>
          <TabsTrigger value="saldi">Saldi</TabsTrigger>
          <TabsTrigger value="membri">Membri</TabsTrigger>
        </TabsList>
        <TabsContent value="spese">
          <ExpensesTab group={group} />
        </TabsContent>
        <TabsContent value="saldi">
          <BalancesTab group={group} />
        </TabsContent>
        <TabsContent value="membri">
          <MembersTab group={group} />
        </TabsContent>
      </Tabs>
    </>
  );
}
