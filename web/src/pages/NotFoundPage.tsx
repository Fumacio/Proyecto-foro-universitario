import { Compass, CircleQuestionMark, House, MapPinOff, MessageSquare, Search } from 'lucide-react';
import { Link } from 'react-router';
import { Button, buttonVariants } from '@/components/ui/Button';
import { useDocumentTitle } from '@/hooks';
import { paletteStore } from '@/lib/store';

export function NotFoundPage() {
  useDocumentTitle('Página no encontrada');
  return (
    <div className="surface relative overflow-hidden px-6 py-14 text-center sm:py-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(161 161 170 / 0.35) 1px, transparent 0)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-md">
        {/* Ilustración */}
        <div className="relative mx-auto h-44 w-64">
          <div className="absolute left-1/2 top-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/15 blur-2xl" />
          <div className="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[2rem] bg-linear-to-br from-brand-500 to-violet-600 text-white shadow-xl shadow-brand-600/30 ring-8 ring-white dark:ring-zinc-900">
            <MapPinOff className="size-12" strokeWidth={1.6} />
          </div>
          <span className="absolute left-2 top-6 grid size-11 -rotate-12 place-items-center rounded-2xl bg-white text-sky-500 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <CircleQuestionMark className="size-5" />
          </span>
          <span className="absolute right-3 top-2 grid size-10 rotate-12 place-items-center rounded-2xl bg-white text-amber-500 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <Compass className="size-5" />
          </span>
          <span className="absolute bottom-3 right-6 grid size-9 -rotate-6 place-items-center rounded-xl bg-white text-emerald-500 shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <MessageSquare className="size-4" />
          </span>
          <span className="absolute bottom-6 left-8 size-3 rounded-full bg-fuchsia-400/70" />
          <span className="absolute right-0 top-20 size-2 rounded-full bg-sky-400/70" />
        </div>

        <p className="mt-6 bg-linear-to-r from-brand-600 to-violet-500 bg-clip-text text-6xl font-extrabold tracking-tighter text-transparent dark:from-brand-400 dark:to-violet-300">
          404
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-zinc-950 dark:text-white">Te perdiste en el campus</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          La página que buscás no existe o se mudó de aula. Revisá el link o volvé al inicio para seguir explorando el foro.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Link to="/" className={buttonVariants({ size: 'lg' })}>
            <House />
            Volver al inicio
          </Link>
          <Button variant="secondary" size="lg" onClick={() => paletteStore.set(true)}>
            <Search />
            Buscar en el foro
          </Button>
        </div>
      </div>
    </div>
  );
}
