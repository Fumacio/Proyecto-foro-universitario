import * as RD from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface LightboxImage {
  src: string;
  alt?: string;
  /** Link de descarga (adjuntos). */
  downloadUrl?: string;
}

const roundBtn = 'grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20';

/**
 * Vista ampliada de una imagen. Con `gallery` + `index` permite pasar entre varias (← →).
 */
export function ImageLightbox({
  src,
  alt,
  children,
  className,
  gallery,
  index = 0,
  label = 'Ampliar imagen',
}: {
  src: string;
  alt?: string;
  children: ReactNode;
  className?: string;
  gallery?: LightboxImage[];
  index?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const images: LightboxImage[] = gallery?.length ? gallery : [{ src, alt }];
  const [current, setCurrent] = useState(index);
  const safe = Math.min(Math.max(current, 0), images.length - 1);
  const img = images[safe];
  const multi = images.length > 1;
  const go = (delta: number) => setCurrent((i) => (i + delta + images.length) % images.length);

  return (
    <RD.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setCurrent(index);
      }}
    >
      <RD.Trigger asChild>
        <button type="button" className={cn('group/img relative block cursor-zoom-in', className)} aria-label={label}>
          {children}
        </button>
      </RD.Trigger>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <RD.Content
          className="fixed inset-0 z-50 grid place-items-center p-4 outline-none data-[state=open]:animate-pop-in sm:p-10"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!multi) return;
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              go(1);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              go(-1);
            }
          }}
        >
          <RD.Title className="sr-only">{img.alt || 'Imagen'}</RD.Title>
          <RD.Description className="sr-only">
            {multi ? `Imagen ${safe + 1} de ${images.length}. Usá las flechas para pasar.` : 'Vista ampliada de la imagen'}
          </RD.Description>
          <img
            key={img.src}
            src={img.src}
            alt={img.alt ?? ''}
            className="max-h-full max-w-full animate-fade-in rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="fixed right-4 top-4 flex gap-2">
            {img.downloadUrl ? (
              <a href={img.downloadUrl} download onClick={(e) => e.stopPropagation()} className={roundBtn} aria-label="Descargar">
                <Download className="size-[18px]" />
              </a>
            ) : (
              <a href={img.src} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={roundBtn} aria-label="Abrir original">
                <ExternalLink className="size-[18px]" />
              </a>
            )}
            <RD.Close className={roundBtn} aria-label="Cerrar">
              <X className="size-5" />
            </RD.Close>
          </div>
          {multi && (
            <>
              <button
                type="button"
                aria-label="Imagen anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className={cn(roundBtn, 'fixed left-3 top-1/2 -translate-y-1/2 sm:left-6')}
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Imagen siguiente"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className={cn(roundBtn, 'fixed right-3 top-1/2 -translate-y-1/2 sm:right-6')}
              >
                <ChevronRight className="size-5" />
              </button>
              <div className="fixed bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
                {img.alt && <p className="max-w-[80vw] truncate text-sm font-medium text-white/90">{img.alt}</p>}
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-white/80 backdrop-blur">
                  {safe + 1} / {images.length}
                </span>
              </div>
            </>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
