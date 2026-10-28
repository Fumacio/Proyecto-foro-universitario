import { CircleAlert, CloudUpload, Paperclip, RotateCw, X } from 'lucide-react';
import { useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from 'react';
import { ATTACHMENT_ACCEPT, formatBytes, MAX_ATTACHMENT_MB } from '@/lib/attachments';
import { cn } from '@/lib/utils';
import { Button, type ButtonSize, type ButtonVariant } from '../ui/Button';
import { Tooltip } from '../ui/Popover';
import { FileKindIcon, FileName, KIND_STYLE } from './FileKindIcon';
import type { AttachmentUploads, UploadItem } from './useAttachmentUploads';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** Archivos pegados (Ctrl+V) — ignora el pegado de texto. */
export function filesFromPaste(e: ClipboardEvent): File[] {
  return Array.from(e.clipboardData?.files ?? []);
}

/* ---------------- Botón 📎 ---------------- */

export function AttachButton({
  uploads,
  label = 'Adjuntar archivos',
  showLabel,
  variant = 'ghost',
  size,
  className,
  disabled,
}: {
  uploads: AttachmentUploads;
  label?: string;
  showLabel?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const full = uploads.remaining === 0;
  const tip = full ? `Máximo ${uploads.max} archivos` : `${label} · hasta ${MAX_ATTACHMENT_MB} MB c/u`;
  const btn = (
    <Button
      variant={variant}
      size={size ?? (showLabel ? 'sm' : 'icon-sm')}
      aria-label={showLabel ? undefined : label}
      disabled={disabled || full}
      onClick={() => inputRef.current?.click()}
      className={className}
    >
      <Paperclip />
      {showLabel && <span>{label}</span>}
      {uploads.count > 0 && !showLabel && <span className="sr-only">({uploads.count} adjuntos)</span>}
    </Button>
  );
  return (
    <>
      {showLabel ? btn : <Tooltip content={tip}>{btn}</Tooltip>}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={ATTACHMENT_ACCEPT}
        onChange={(e) => {
          uploads.add(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

/* ---------------- Lista de subidas ---------------- */

function ProgressBar({ value, tone }: { value: number; tone: string }) {
  return (
    <span className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-b-xl bg-zinc-200/70 dark:bg-zinc-800" aria-hidden>
      <span className={cn('block h-full rounded-full transition-[width] duration-200 ease-out', tone)} style={{ width: `${Math.max(4, Math.round(value * 100))}%` }} />
    </span>
  );
}

function UploadCard({ item, onRemove, onRetry, dense }: { item: UploadItem; onRemove: () => void; onRetry: () => void; dense?: boolean }) {
  const thumb = item.kind === 'IMAGE' ? (item.localUrl ?? item.attachment?.previewUrl ?? item.attachment?.url) : undefined;
  const pct = Math.round(item.progress * 100);
  const uploading = item.status === 'uploading';
  const error = item.status === 'error';
  return (
    <li
      className={cn(
        'relative flex items-center gap-2.5 overflow-hidden rounded-xl border bg-white transition-colors dark:bg-zinc-900',
        dense ? 'p-1.5 pr-1' : 'p-2 pr-1.5',
        error ? 'border-rose-300 bg-rose-50/50 dark:border-rose-500/40 dark:bg-rose-500/5' : 'border-zinc-200 dark:border-zinc-800',
        item.status === 'done' && !item.persisted && 'animate-pop-in',
      )}
    >
      {thumb ? (
        <span className={cn('relative shrink-0 overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700', dense ? 'size-9' : 'size-11')}>
          <img src={thumb} alt="" className={cn('size-full object-cover', uploading && 'opacity-60')} />
        </span>
      ) : (
        <FileKindIcon kind={item.kind} filename={item.name} size={dense ? 'sm' : 'md'} />
      )}
      <div className="min-w-0 flex-1">
        <FileName name={item.name} className={cn('font-medium text-zinc-900 dark:text-zinc-100', dense ? 'text-[12.5px]' : 'text-[13px]')} />
        <p className={cn('mt-0.5 flex items-center gap-1 truncate text-xs', error ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400')} aria-live="polite">
          {error ? (
            <>
              <CircleAlert className="size-3 shrink-0" />
              <span className="truncate" title={item.error}>{item.error}</span>
            </>
          ) : uploading ? (
            <span className="tabular-nums">
              Subiendo… {pct}% · {formatBytes(item.size)}
            </span>
          ) : (
            <span>{formatBytes(item.size)}</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        {error && item.file && (
          <Tooltip content="Reintentar">
            <Button variant="ghost" size="icon-xs" aria-label={`Reintentar subir ${item.name}`} onClick={onRetry}>
              <RotateCw />
            </Button>
          </Tooltip>
        )}
        <Tooltip content={uploading ? 'Cancelar subida' : 'Quitar'}>
          <Button variant="ghost" size="icon-xs" aria-label={uploading ? `Cancelar subida de ${item.name}` : `Quitar ${item.name}`} onClick={onRemove}>
            <X />
          </Button>
        </Tooltip>
      </div>
      {uploading && <ProgressBar value={item.progress} tone={KIND_STYLE[item.kind]?.bar ?? 'bg-brand-500'} />}
    </li>
  );
}

export function UploadList({ uploads, dense, className, columns = 2 }: { uploads: AttachmentUploads; dense?: boolean; className?: string; columns?: 1 | 2 }) {
  if (uploads.items.length === 0) return null;
  return (
    <ul aria-label="Archivos adjuntos" className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2', className)}>
      {uploads.items.map((it) => (
        <UploadCard key={it.key} item={it} dense={dense} onRemove={() => uploads.remove(it.key)} onRetry={() => uploads.retry(it.key)} />
      ))}
    </ul>
  );
}

/* ---------------- Zona para arrastrar ---------------- */

/** Picker completo: zona de arrastre + click + pegar, con la lista de archivos y su progreso. */
export function AttachmentPicker({ uploads, className, hint }: { uploads: AttachmentUploads; className?: string; hint?: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const full = uploads.remaining === 0;
  const hasItems = uploads.count > 0;

  const open = () => !full && inputRef.current?.click();

  return (
    <div className={cn('space-y-2.5', className)}>
      <UploadList uploads={uploads} />
      <div
        role="button"
        tabIndex={full ? -1 : 0}
        aria-disabled={full || undefined}
        aria-label={`Adjuntar archivos (${uploads.count} de ${uploads.max})`}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        }}
        onPaste={(e) => {
          const files = filesFromPaste(e);
          if (files.length) {
            e.preventDefault();
            uploads.add(files);
          }
        }}
        onDragEnter={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          depth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = full ? 'none' : 'copy';
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          depth.current = 0;
          setDragging(false);
          uploads.add(e.dataTransfer.files);
        }}
        className={cn(
          'group flex cursor-pointer items-center gap-3.5 rounded-xl border-2 border-dashed text-left transition-colors outline-none focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15',
          hasItems ? 'px-3.5 py-2.5' : 'flex-col justify-center px-6 py-7 text-center sm:flex-row sm:text-left',
          dragging
            ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-500/10'
            : full
              ? 'cursor-not-allowed border-zinc-200 opacity-60 dark:border-zinc-800'
              : 'border-zinc-200 hover:border-brand-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-brand-500/40 dark:hover:bg-zinc-900/60',
        )}
      >
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition-transform group-hover:scale-105 dark:bg-brand-500/10 dark:text-brand-400',
            hasItems ? 'size-8' : 'size-11',
            dragging && 'scale-110',
          )}
        >
          {dragging ? <CloudUpload className={hasItems ? 'size-4' : 'size-5'} /> : <Paperclip className={hasItems ? 'size-4' : 'size-5'} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block font-medium text-zinc-700 dark:text-zinc-300', hasItems ? 'text-[13px]' : 'text-sm')}>
            {dragging ? (
              'Soltá los archivos acá'
            ) : full ? (
              `Llegaste al máximo de ${uploads.max} archivos`
            ) : hasItems ? (
              <>
                Agregar más archivos <span className="font-normal text-zinc-400">({uploads.count}/{uploads.max})</span>
              </>
            ) : (
              <>
                Arrastrá archivos o <span className="text-brand-600 dark:text-brand-400">elegilos desde tu dispositivo</span>
              </>
            )}
          </span>
          {!hasItems && (
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {hint ?? <>PDF, Word, Excel, PowerPoint, imágenes, zip y código · hasta {MAX_ATTACHMENT_MB} MB c/u · máx. {uploads.max}</>}
            </span>
          )}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={ATTACHMENT_ACCEPT}
        onChange={(e) => {
          uploads.add(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* ---------------- Soltar archivos sobre un área ---------------- */

/**
 * Envuelve un área (composer de comentarios, chat): al arrastrar archivos encima muestra un
 * overlay y al soltarlos los adjunta. También adjunta los archivos pegados que nadie manejó.
 */
export function FileDropTarget({
  uploads,
  children,
  className,
  label = 'Soltá para adjuntar',
  disabled,
}: {
  uploads: AttachmentUploads;
  children: ReactNode;
  className?: string;
  label?: string;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  return (
    <div
      className={cn('relative', className)}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        depth.current = 0;
        setDragging(false);
        if (disabled || e.defaultPrevented || !hasFiles(e)) return;
        e.preventDefault();
        uploads.add(e.dataTransfer.files);
      }}
      onPaste={(e) => {
        if (disabled || e.defaultPrevented) return;
        const files = filesFromPaste(e);
        if (files.length) {
          e.preventDefault();
          uploads.add(files);
        }
      }}
    >
      {children}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 grid animate-fade-in place-items-center rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/85 backdrop-blur-[1px] dark:bg-brand-950/70">
          <span className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-200">
            <CloudUpload className="size-5" />
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
