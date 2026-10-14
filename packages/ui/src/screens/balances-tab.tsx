import type { GroupView, SettlementView, Transfer } from '@expense/engine';
import { Alert, AlertDescription } from '@expense/ui/components/ui/alert';
import { Badge } from '@expense/ui/components/ui/badge';
import { Button } from '@expense/ui/components/ui/button';
import { Dialog, DialogContent } from '@expense/ui/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@expense/ui/components/ui/empty';
import { Tabs, TabsList, TabsTrigger } from '@expense/ui/components/ui/tabs';
import { ArrowRightIcon, CircleAlertIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { DeleteOrRestoreButton } from '../components/delete-entry';
import { ErrorAlert } from '../components/error-alert';
import { useCommand, useQuery } from '../engine/store';
import { lastChange } from '../format';
import { activeMembers, memberNames, nameOf, newestFirst } from '../group-data';
import { K, useI18n } from '../i18n';
import type { Names } from '../messages';
import { SettlementForm, type SettlementPreset } from './settlement-form';

type TransferMode = 'simplified' | 'pairwise';

export function BalancesTab({ group }: { readonly group: GroupView }) {
  const { t, format } = useI18n();
  const result = useQuery({ type: 'GetBalances', groupId: group.groupId });
  const [mode, setMode] = useState<TransferMode>('simplified');
  // La finestra resta montata con gli ultimi valori mentre si chiude (animazione).
  const [dialog, setDialog] = useState<{
    readonly open: boolean;
    readonly preset: SettlementPreset;
  }>({
    open: false,
    preset: { from: '', to: '', amount: null },
  });
  const names = memberNames(group);

  if (!result.ok) return <ErrorAlert error={result.error} names={names} />;
  const { balances, simplifiedTransfers, pairwiseTransfers, excluded } = result.value;
  const transfers = mode === 'simplified' ? simplifiedTransfers : pairwiseTransfers;
  const me = activeMembers(group).find(({ memberId }) => memberId === group.me);

  return (
    <div className="flex flex-col gap-8">
      {excluded.length > 0 && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{t(K.balances.excluded, { count: excluded.length })}</AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t(K.balances.title)}</h2>
        {balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(K.balances.empty)}</p>
        ) : (
          balances.map(({ currency, balances: members }) => (
            <ul key={currency} className="flex flex-col divide-y rounded-xl border">
              {members.map(({ memberId, amount }) => (
                <li key={memberId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 truncate">{nameOf(names, memberId)}</span>
                  <span className="flex flex-col items-end">
                    <span
                      className={
                        amount.minor > 0
                          ? 'font-medium text-emerald-600 tabular-nums dark:text-emerald-400'
                          : amount.minor < 0
                            ? 'font-medium text-destructive tabular-nums'
                            : 'font-medium text-muted-foreground tabular-nums'
                      }
                    >
                      {format.money(amount, true)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(
                        amount.minor > 0
                          ? K.balances.receives
                          : amount.minor < 0
                            ? K.balances.gives
                            : K.balances.even,
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">{t(K.balances.transfers.title)}</h2>
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value === 'pairwise' ? 'pairwise' : 'simplified');
            }}
          >
            <TabsList>
              <TabsTrigger value="simplified">{t(K.balances.transfers.simplified)}</TabsTrigger>
              <TabsTrigger value="pairwise">{t(K.balances.transfers.pairwise)}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(K.balances.transfers.empty)}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {transfers.map((transfer) => (
              <TransferRow
                key={`${transfer.from}-${transfer.to}-${transfer.amount.currency}`}
                transfer={transfer}
                names={names}
                onSettle={() => {
                  setDialog({ open: true, preset: transfer });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">{t(K.settlements.title)}</h2>
          <Button
            variant="outline"
            disabled={activeMembers(group).length < 2}
            onClick={() => {
              setDialog({ open: true, preset: { from: me?.memberId ?? '', to: '', amount: null } });
            }}
          >
            <PlusIcon data-icon="inline-start" />
            {t(K.settlements.add)}
          </Button>
        </div>
        <SettlementList group={group} names={names} />
      </section>

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog((current) => ({ ...current, open }));
        }}
      >
        <DialogContent>
          <SettlementForm
            group={group}
            preset={dialog.preset}
            onDone={() => {
              setDialog((current) => ({ ...current, open: false }));
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransferRow({
  transfer,
  names,
  onSettle,
}: {
  readonly transfer: Transfer;
  readonly names: Names;
  readonly onSettle: () => void;
}) {
  const { t, format } = useI18n();
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
        <span className="truncate">{nameOf(names, transfer.from)}</span>
        <ArrowRightIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-label={t(K.balances.transfers.givesTo)}
        />
        <span className="truncate">{nameOf(names, transfer.to)}</span>
      </span>
      <span className="font-medium tabular-nums">{format.money(transfer.amount)}</span>
      <Button variant="secondary" size="sm" onClick={onSettle}>
        {t(K.balances.transfers.paid)}
      </Button>
    </li>
  );
}

function SettlementList({ group, names }: { readonly group: GroupView; readonly names: Names }) {
  const { t } = useI18n();
  const settlements = newestFirst(group.settlements);
  if (settlements.length === 0) {
    return (
      <Empty className="border py-6">
        <EmptyHeader>
          <EmptyTitle>{t(K.settlements.empty.title)}</EmptyTitle>
          <EmptyDescription>{t(K.settlements.empty.description)}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {settlements.map((settlement) => (
        <SettlementRow
          key={settlement.settlementId}
          group={group}
          settlement={settlement}
          names={names}
        />
      ))}
    </ul>
  );
}

function SettlementRow({
  group,
  settlement,
  names,
}: {
  readonly group: GroupView;
  readonly settlement: SettlementView;
  readonly names: Names;
}) {
  const i18n = useI18n();
  const { t, format } = i18n;
  const command = useCommand();
  const { from, to, amount } = settlement.transfer;
  const { deleted, settlementId } = settlement;
  const { groupId } = group;
  const who = `${nameOf(names, from)} → ${nameOf(names, to)}`;
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className={
            deleted
              ? 'flex min-w-0 flex-1 flex-col gap-0.5 opacity-60'
              : 'flex min-w-0 flex-1 flex-col gap-0.5'
          }
        >
          <span className={deleted ? 'line-through' : undefined}>{who}</span>
          <span className="text-sm text-muted-foreground">
            {[
              format.date(settlement.date),
              ...(settlement.notes === null ? [] : [settlement.notes]),
            ].join(t(K.common.separator))}
          </span>
          <span className="text-xs text-muted-foreground">{lastChange(i18n, settlement)}</span>
        </div>
        {deleted && <Badge variant="outline">{t(K.settlements.deleted)}</Badge>}
        <span className="pt-0.5 font-medium whitespace-nowrap tabular-nums">
          {format.money(amount)}
        </span>
        <DeleteOrRestoreButton
          deleted={deleted}
          label={t(K.settlements.deleteLabel, { who })}
          texts={{
            title: t(K.settlements.deleteTitle),
            description: t(K.settlements.deleteDescription, { who, amount: format.money(amount) }),
          }}
          disabled={command.pending}
          onDelete={() => {
            void command.run({ type: 'DeleteSettlement', groupId, settlementId });
          }}
          onRestore={() => {
            void command.run({ type: 'RestoreSettlement', groupId, settlementId });
          }}
        />
      </div>
      <ErrorAlert error={command.error} names={names} />
    </li>
  );
}
