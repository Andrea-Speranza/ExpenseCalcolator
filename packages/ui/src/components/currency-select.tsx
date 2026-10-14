import { knownCurrencies } from '@expense/engine';
import { NativeSelect, NativeSelectOption } from '@expense/ui/components/ui/native-select';
import type { ComponentProps } from 'react';
import { useI18n } from '../i18n';

const CURRENCIES = knownCurrencies();

/** Scelta della valuta tra i codici ISO 4217 conosciuti dal core (ADR 0004). */
export function CurrencySelect(props: Omit<ComponentProps<typeof NativeSelect>, 'children'>) {
  const { format } = useI18n();
  return (
    <NativeSelect {...props}>
      {CURRENCIES.map((code) => (
        <NativeSelectOption key={code} value={code}>
          {format.currency(code)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
