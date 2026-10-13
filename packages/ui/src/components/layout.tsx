import { Button } from '@expense/ui/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@expense/ui/components/ui/empty';
import { ArrowLeftIcon, SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { routeHref } from '../router';

// Struttura comune delle pagine: barra in alto, contenuto centrato e stretto, pensato prima per il mobile.

export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <a href={routeHref({ page: 'groups' })} className="font-heading text-base font-semibold">
            Spese di gruppo
          </a>
          <Button variant="ghost" size="icon" asChild>
            <a href={routeHref({ page: 'settings' })} aria-label="Impostazioni">
              <SettingsIcon />
            </a>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly back?: { readonly href: string; readonly label: string };
  readonly actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      {back !== undefined && (
        <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" asChild>
          <a href={back.href}>
            <ArrowLeftIcon data-icon="inline-start" />
            {back.label}
          </a>
        </Button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          {description !== undefined && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions !== undefined && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function NotFound({
  message = 'La pagina che cerchi non esiste.',
}: {
  readonly message?: string;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Non trovato</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" asChild>
          <a href={routeHref({ page: 'groups' })}>Torna ai gruppi</a>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
