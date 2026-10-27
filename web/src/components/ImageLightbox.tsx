import * as RD from '@radix-ui/react-dialog';
import { ExternalLink, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ImageLightbox({ src, alt, children, className }: { src: string; alt?: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <RD.Root open={open} onOpenChange={setOpen}>
      <RD.Trigger asChild>
        <button type="button" className={cn('group/img relative block cursor-zoom-in', className)} aria-label="Ampliar imagen">
          {children}
        </button>
      </RD.Trigger>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <RD.Content
          className="fixed inset-0 z-50 grid place-items-center p-4 outline-none data-[state=open]:animate-pop-in sm:p-10"
          onClick={() => setOpen(false)}
        >
          <RD.Title className="sr-only">{alt || 'Imagen'}</RD.Title>
          <RD.Description className="sr-only">Vista ampliada de la imagen</RD.Description>
          <img
            src={src}
            alt={alt ?? ''}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="fixed right-4 top-4 flex gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
              aria-label="Abrir original"
            >
              <ExternalLink className="size-[18px]" />
            </a>
            <RD.Close className="grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20" aria-label="Cerrar">
              <X className="size-5" />
            </RD.Close>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
