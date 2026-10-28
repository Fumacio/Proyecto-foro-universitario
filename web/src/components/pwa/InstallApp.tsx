import { Download, Share, SquarePlus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { installCardDismissedStore, iosInstallDialogStore, useInstallApp } from '@/lib/pwa';
import { cn } from '@/lib/utils';
import { LogoMark } from '../common';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

/** Tarjeta "Instalá la app" (rail derecho / menú móvil). Se puede cerrar. */
export function InstallAppCard({ className }: { className?: string }) {
  const { available, install, ios } = useInstallApp();
  const dismissed = installCardDismissedStore.useValue();
  if (!available || dismissed) return null;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-brand-200/70 bg-linear-to-br from-brand-50 via-white to-violet-50 p-4 dark:border-brand-500/20 dark:from-brand-500/10 dark:via-zinc-900/60 dark:to-violet-500/10',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => installCardDismissedStore.set(true)}
        aria-label="No mostrar más"
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-white/70 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <LogoMark className="size-10 shrink-0 drop-shadow-sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">Instalá Foro UTN</p>
          <p className="mt-0.5 text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">
            Abrilo desde tu pantalla de inicio, a pantalla completa y más rápido.
          </p>
        </div>
      </div>
      <Button size="sm" className="mt-3 w-full" onClick={() => void install()}>
        <Download />
        {ios ? 'Cómo instalarla' : 'Instalar app'}
      </Button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30">
        {n}
      </span>
      <span className="pt-0.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</span>
    </li>
  );
}

const kbd = 'mx-0.5 inline-flex h-6 items-center gap-1 rounded-md bg-zinc-100 px-1.5 align-middle text-[13px] font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700';

/** Instrucciones para iPhone/iPad (Safari no tiene `beforeinstallprompt`). Montado una vez en el shell. */
export function IOSInstallDialog() {
  const open = iosInstallDialogStore.useValue();
  return (
    <Dialog
      open={open}
      onOpenChange={iosInstallDialogStore.set}
      size="sm"
      title="Instalá Foro UTN en tu iPhone"
      description="Son tres pasos y queda en tu pantalla de inicio como cualquier app."
      footer={
        <Button onClick={() => iosInstallDialogStore.set(false)} className="w-full sm:w-auto">
          Entendido
        </Button>
      }
    >
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
        <LogoMark className="size-12 drop-shadow" />
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Foro UTN</p>
          <p className="text-xs text-zinc-500">foro de la UTN FRT</p>
        </div>
      </div>
      <ol className="space-y-4">
        <Step n={1}>
          Tocá el botón <span className={kbd}><Share className="size-3.5 text-sky-600" /> Compartir</span> en la barra de Safari.
        </Step>
        <Step n={2}>
          Bajá y elegí <span className={kbd}><SquarePlus className="size-3.5" /> Agregar a inicio</span>.
        </Step>
        <Step n={3}>
          Confirmá con <span className={kbd}>Agregar</span>. ¡Listo!
        </Step>
      </ol>
    </Dialog>
  );
}
