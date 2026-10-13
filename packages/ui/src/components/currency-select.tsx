import { knownCurrencies } from '@expense/engine';
import { NativeSelect, NativeSelectOption } from '@expense/ui/components/ui/native-select';
import type { ComponentProps } from 'react';
import { currencyLabel } from '../format';

const CURRENCIES = knownCurrencies();

/** Scelta della valuta tra i codici ISO 4217 conosciuti dal core (ADR 0004). */
export function CurrencySelect(props: Omit<ComponentProps<typeof NativeSelect>, 'children'>) {
  return (
    <NativeSelect {...props}>
      {CURRENCIES.map((code) => (
        <NativeSelectOption key={code} value={code}>
          {currencyLabel(code)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
