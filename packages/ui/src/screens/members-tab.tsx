import type { GroupView, MemberView } from '@expense/engine';
import { Alert, AlertDescription } from '@expense/ui/components/ui/alert';
import { Badge } from '@expense/ui/components/ui/badge';
import { Button } from '@expense/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@expense/ui/components/ui/dialog';
import { Field, FieldLabel } from '@expense/ui/components/ui/field';
import { Input } from '@expense/ui/components/ui/input';
import { ArchiveIcon, ArchiveRestoreIcon, InfoIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { type SubmitEvent, useId, useState } from 'react';
import { ErrorAlert } from '../components/error-alert';
import { useCommand } from '../engine/store';

export function MembersTab({ group }: { readonly group: GroupView }) {
  const active = group.members.filter(({ archived }) => !archived);
  const archived = group.members.filter((member) => member.archived);

  return (
    <div className="flex flex-col gap-6">
      <AddMemberForm group={group} />
      {group.me === null && group.members.length > 0 && (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            Se partecipi anche tu alle spese, scegli «Sono io» accanto al tuo nome: le spese che
            registri partiranno da te.
          </AlertDescription>
        </Alert>
      )}
      {active.length > 0 && <MemberList group={group} members={active} />}
      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Archiviati</h2>
          <p className="text-sm text-muted-foreground">
            Restano nelle spese passate, ma non compaiono più tra chi partecipa alle nuove.
          </p>
          <MemberList group={group} members={archived} />
        </section>
      )}
    </div>
  );
}

function AddMemberForm({ group }: { readonly group: GroupView }) {
  const [name, setName] = useState('');
  const command = useCommand();
  const id = useId();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const result = await command.run({ type: 'AddMember', groupId: group.groupId, name });
    if (result.ok) setName('');
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Aggiungi una persona</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder="Nome"
            maxLength={60}
            required
          />
          <Button type="submit" disabled={command.pending}>
            <PlusIcon data-icon="inline-start" />
            Aggiungi
          </Button>
        </div>
      </Field>
      <ErrorAlert error={command.error} />
    </form>
  );
}

function MemberList({
  group,
  members,
}: {
  readonly group: GroupView;
  readonly members: readonly MemberView[];
}) {
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {members.map((member) => (
        <MemberRow key={member.memberId} group={group} member={member} />
      ))}
    </ul>
  );
}

function MemberRow({ group, member }: { readonly group: GroupView; readonly member: MemberView }) {
  const command = useCommand();
  const isMe = group.me === member.memberId;
  const { groupId } = group;
  const { memberId } = member;

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{member.name}</span>
        {isMe && <Badge>Tu</Badge>}
        {!isMe && !member.archived && (
          <Button
            variant="ghost"
            size="sm"
            disabled={command.pending}
            onClick={() => {
              void command.run({ type: 'ClaimMember', groupId, memberId });
            }}
          >
            Sono io
          </Button>
        )}
        <RenameMemberDialog group={group} member={member} />
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={command.pending}
          aria-label={member.archived ? `Riattiva ${member.name}` : `Archivia ${member.name}`}
          onClick={() => {
            void command.run({
              type: 'UpdateMember',
              groupId,
              memberId,
              base: member.version,
              changes: { archived: !member.archived },
            });
          }}
        >
          {member.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
        </Button>
      </div>
      <ErrorAlert error={command.error} />
    </li>
  );
}

function RenameMemberDialog({
  group,
  member,
}: {
  readonly group: GroupView;
  readonly member: MemberView;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Rinomina ${member.name}`}>
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <RenameMemberForm
          group={group}
          member={member}
          onDone={() => {
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RenameMemberForm({
  group,
  member,
  onDone,
}: {
  readonly group: GroupView;
  readonly member: MemberView;
  readonly onDone: () => void;
}) {
  const [name, setName] = useState(member.name);
  const command = useCommand();
  const id = useId();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (name.trim() === member.name) {
      onDone();
      return;
    }
    const result = await command.run({
      type: 'UpdateMember',
      groupId: group.groupId,
      memberId: member.memberId,
      base: member.version,
      changes: { name },
    });
    if (result.ok) onDone();
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogHeader>
        <DialogTitle>Rinomina</DialogTitle>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Nome</FieldLabel>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          maxLength={60}
          required
          autoFocus
        />
      </Field>
      <ErrorAlert error={command.error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Annulla
          </Button>
        </DialogClose>
        <Button type="submit" disabled={command.pending}>
          Salva
        </Button>
      </DialogFooter>
    </form>
  );
}
