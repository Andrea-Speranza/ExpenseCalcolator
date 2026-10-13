import type { GroupView, Money } from '@expense/engine';
import { Button } from '@expense/ui/components/ui/button';
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@expense/ui/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@expense/ui/components/ui/field';
import { Input } from '@expense/ui/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@expense/ui/components/ui/native-select';
import { Textarea } from '@expense/ui/components/ui/textarea';
import { type SubmitEvent, useId, useState } from 'react';
import { parseAmount } from '../amounts';
import { ErrorAlert } from '../components/error-alert';
import { useCommand } from '../engine/store';
import { amountInputValue, today } from '../format';
import { memberNames } from '../group-data';

/** Valori iniziali: un trasferimento suggerito, oppure niente per un rimborso scritto a mano. */
export interface SettlementPreset {
  readonly from: string;
  readonly to: string;
  readonly amount: Money | null;
}

/** Registra un rimborso (es. "Luca ha dato 20 € ad Anna"). Va dentro un DialogContent. */
export function SettlementForm({
  group,
  preset,
  onDone,
}: {
  readonly group: GroupView;
  readonly preset: SettlementPreset;
  readonly onDone: () => void;
}) {
  const currency = preset.amount?.currency ?? group.baseCurrency;
  const members = group.members.filter(
    ({ memberId, archived }) => !archived || memberId === preset.from || memberId === preset.to,
  );
  const [from, setFrom] = useState(preset.from);
  const [to, setTo] = useState(preset.to);
  const [amount, setAmount] = useState(
    preset.amount === null ? '' : amountInputValue(preset.amount),
  );
  const [date, setDate] = useState(() => today());
  const [notes, setNotes] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const command = useCommand();
  const id = useId();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount, currency);
    setAmountError(parsed.ok ? null : parsed.error);
    if (!parsed.ok) return;
    const result = await command.run({
      type: 'AddSettlement',
      groupId: group.groupId,
      transfer: { from, to, amount: parsed.value },
      date,
      ...(notes.trim() === '' ? {} : { notes }),
    });
    if (result.ok) onDone();
  }

  const memberOptions = members.map(({ memberId, name }) => (
    <NativeSelectOption key={memberId} value={memberId}>
      {name}
    </NativeSelectOption>
  ));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <DialogHeader>
        <DialogTitle>Registra un rimborso</DialogTitle>
        <DialogDescription>
          Soldi dati da una persona all’altra per pareggiare i conti.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-from`}>Chi dà</FieldLabel>
            <NativeSelect
              id={`${id}-from`}
              className="w-full"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
              }}
              required
            >
              <NativeSelectOption value="">Scegli…</NativeSelectOption>
              {memberOptions}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-to`}>Chi riceve</FieldLabel>
            <NativeSelect
              id={`${id}-to`}
              className="w-full"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
              }}
              required
            >
              <NativeSelectOption value="">Scegli…</NativeSelectOption>
              {memberOptions}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={amountError !== null}>
            <FieldLabel htmlFor={`${id}-amount`}>Importo ({currency})</FieldLabel>
            <Input
              id={`${id}-amount`}
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
              aria-invalid={amountError !== null}
              required
            />
            {amountError !== null && <FieldError>{amountError}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>Data</FieldLabel>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
              }}
              required
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${id}-notes`}>Note</FieldLabel>
          <Textarea
            id={`${id}-notes`}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            maxLength={2000}
          />
        </Field>
      </FieldGroup>
      <ErrorAlert error={command.error} names={memberNames(group)} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Annulla
          </Button>
        </DialogClose>
        <Button type="submit" disabled={command.pending}>
          Registra
        </Button>
      </DialogFooter>
    </form>
  );
}
