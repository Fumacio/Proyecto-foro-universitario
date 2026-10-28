import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className, label = 'Cargando' }: { className?: string; label?: string }) {
  return <LoaderCircle role="status" aria-label={label} className={cn('size-5 animate-spin', className)} />;
}

export function PageSpinner() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-zinc-400">
      <Spinner className="size-6" />
    </div>
  );
}
