import { Download, Eye } from 'lucide-react';
import { useState } from 'react';
import { formatBytes } from '@/lib/attachments';
import type { Attachment } from '@/lib/types';
import { cn, plural } from '@/lib/utils';
import { ImageLightbox, type LightboxImage } from '../ImageLightbox';
import { buttonVariants } from '../ui/Button';
import { Tooltip } from '../ui/Popover';
import { FileKindIcon, FileName } from './FileKindIcon';

type Variant = 'default' | 'compact' | 'chat';

const imageSrc = (a: Attachment) => a.previewUrl ?? a.url;

function ImageGrid({ images, variant }: { images: Attachment[]; variant: Variant }) {
  const gallery: LightboxImage[] = images.map((a) => ({ src: imageSrc(a), alt: a.filename, downloadUrl: a.url }));
  const maxShown = variant === 'chat' ? 4 : 6;
  const shown = images.slice(0, maxShown);
  const extra = images.length - shown.length;

  if (images.length === 1) {
    const a = images[0];
    return (
      <ImageLightbox
        src={imageSrc(a)}
        alt={a.filename}
        gallery={gallery}
        label={`Ampliar ${a.filename}`}
        className={cn(
          'overflow-hidden border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900',
          variant === 'chat' ? 'w-full max-w-[17rem] rounded-2xl' : variant === 'compact' ? 'max-w-xs rounded-xl' : 'max-w-md rounded-xl',
        )}
      >
        <img
          src={imageSrc(a)}
          alt={a.filename}
          loading="lazy"
          className={cn('w-full object-cover transition-transform duration-300 group-hover/img:scale-[1.02]', variant === 'default' ? 'max-h-80' : 'max-h-64')}
        />
      </ImageLightbox>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-1.5',
        variant === 'chat' ? 'w-full max-w-[17rem] grid-cols-2' : variant === 'compact' ? 'max-w-sm grid-cols-3' : 'max-w-xl grid-cols-2 sm:grid-cols-3',
      )}
    >
      {shown.map((a, i) => (
        <ImageLightbox
          key={a.id}
          src={imageSrc(a)}
          alt={a.filename}
          gallery={gallery}
          index={i}
          label={`Ampliar ${a.filename}`}
          className={cn(
            'aspect-square overflow-hidden border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900',
            variant === 'chat' ? 'rounded-xl' : 'rounded-xl',
          )}
        >
          <img src={imageSrc(a)} alt={a.filename} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover/img:scale-105" />
          {i === shown.length - 1 && extra > 0 && (
            <span className="absolute inset-0 grid place-items-center bg-zinc-950/55 text-lg font-semibold text-white backdrop-blur-[1px]">+{extra}</span>
          )}
        </ImageLightbox>
      ))}
    </div>
  );
}

function FileRow({ a, variant, mine }: { a: Attachment; variant: Variant; mine?: boolean }) {
  const [downloads, setDownloads] = useState(0);
  const count = (a.downloadCount ?? 0) + downloads;
  const meta = [formatBytes(a.size), count > 0 ? plural(count, 'descarga') : null].filter(Boolean).join(' · ');

  if (variant === 'chat') {
    return (
      <div
        className={cn(
          'flex w-full max-w-[17rem] items-center gap-2.5 rounded-2xl p-2 pr-1.5 ring-1 ring-inset',
          mine
            ? 'bg-brand-50 ring-brand-200/80 dark:bg-brand-500/15 dark:ring-brand-500/30'
            : 'bg-white ring-zinc-200 dark:bg-zinc-800/80 dark:ring-zinc-700/80',
        )}
      >
        <FileKindIcon kind={a.kind} filename={a.filename} size="sm" />
        <div className="min-w-0 flex-1">
          <FileName name={a.filename} className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100" />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{formatBytes(a.size)}</p>
        </div>
        {a.previewUrl && (
          <Tooltip content="Ver">
            <a href={a.previewUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${a.filename}`} className={buttonVariants({ variant: 'ghost', size: 'icon-xs', className: 'rounded-full' })}>
              <Eye />
            </a>
          </Tooltip>
        )}
        <Tooltip content="Descargar">
          <a href={a.url} download aria-label={`Descargar ${a.filename}`} onClick={() => setDownloads((n) => n + 1)} className={buttonVariants({ variant: 'ghost', size: 'icon-xs', className: 'rounded-full' })}>
            <Download />
          </a>
        </Tooltip>
      </div>
    );
  }

  const compact = variant === 'compact';
  return (
    <li
      className={cn(
        'group/file flex items-center gap-3 rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700',
        compact ? 'p-2 pr-2' : 'p-2.5 pr-2.5',
      )}
    >
      <FileKindIcon kind={a.kind} filename={a.filename} size={compact ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1">
        <FileName name={a.filename} className={cn('font-medium text-zinc-900 dark:text-zinc-100', compact ? 'text-[13px]' : 'text-sm')} />
        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {a.previewUrl && (
          <a
            href={a.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver ${a.filename}`}
            className={buttonVariants({ variant: 'ghost', size: compact ? 'xs' : 'sm', className: 'px-2 sm:px-2.5' })}
          >
            <Eye />
            <span className="hidden sm:inline">Ver</span>
          </a>
        )}
        <a
          href={a.url}
          download
          onClick={() => setDownloads((n) => n + 1)}
          aria-label={`Descargar ${a.filename}`}
          className={buttonVariants({ variant: 'secondary', size: compact ? 'xs' : 'sm', className: 'px-2 sm:px-2.5' })}
        >
          <Download />
          <span className="hidden sm:inline">Descargar</span>
        </a>
      </div>
    </li>
  );
}

/** Muestra adjuntos: imágenes en grilla (con lightbox) y el resto como tarjetas de archivo. */
export function AttachmentList({
  attachments,
  variant = 'default',
  mine,
  className,
}: {
  attachments: Attachment[] | undefined;
  variant?: Variant;
  /** Solo chat: burbuja propia (alineada a la derecha). */
  mine?: boolean;
  className?: string;
}) {
  const list = attachments ?? [];
  if (list.length === 0) return null;
  const images = list.filter((a) => a.kind === 'IMAGE');
  const files = list.filter((a) => a.kind !== 'IMAGE');

  if (variant === 'chat') {
    return (
      <div className={cn('flex w-full flex-col gap-1', mine ? 'items-end' : 'items-start', className)}>
        {images.length > 0 && <ImageGrid images={images} variant="chat" />}
        {files.map((a) => (
          <FileRow key={a.id} a={a} variant="chat" mine={mine} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      {images.length > 0 && <ImageGrid images={images} variant={variant} />}
      {files.length > 0 && (
        <ul className={cn('grid gap-2', variant === 'compact' ? 'max-w-xl' : 'max-w-2xl')}>
          {files.map((a) => (
            <FileRow key={a.id} a={a} variant={variant} />
          ))}
        </ul>
      )}
    </div>
  );
}
