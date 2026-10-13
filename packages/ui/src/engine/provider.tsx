import type { Engine } from '@expense/engine';
import { type ReactNode, useState } from 'react';
import { EngineContext, EngineStore } from './store';

export function EngineProvider({
  engine,
  children,
}: {
  readonly engine: Engine;
  readonly children: ReactNode;
}) {
  const [store] = useState(() => new EngineStore(engine));
  return <EngineContext value={store}>{children}</EngineContext>;
}
