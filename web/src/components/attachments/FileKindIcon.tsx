import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { fileExtension, splitFilename } from '@/lib/attachments';
import type { AttachmentKind } from '@/lib/types';
import { cn } from '@/lib/utils';

export const KIND_STYLE: Record<AttachmentKind, { icon: LucideIcon; tile: string; bar: string }> = {
  PDF: {
    icon: FileText,
    tile: 'bg-rose-50 text-rose-600 ring-rose-200/80 dark:bg-rose-500/12 dark:text-rose-300 dark:ring-rose-500/25',
    bar: 'bg-rose-500',
  },
  DOCUMENT: {
    icon: FileText,
    tile: 'bg-blue-50 text-blue-600 ring-blue-200/80 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/25',
    bar: 'bg-blue-500',
  },
  SPREADSHEET: {
    icon: FileSpreadsheet,
    tile: 'bg-emerald-50 text-emerald-600 ring-emerald-200/80 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-500/25',
    bar: 'bg-emerald-500',
  },
  PRESENTATION: {
    icon: Presentation,
    tile: 'bg-orange-50 text-orange-600 ring-orange-200/80 dark:bg-orange-500/12 dark:text-orange-300 dark:ring-orange-500/25',
    bar: 'bg-orange-500',
  },
  ARCHIVE: {
    icon: FileArchive,
    tile: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    bar: 'bg-zinc-500',
  },
  TEXT: {
    icon: FileCode,
    tile: 'bg-violet-50 text-violet-600 ring-violet-200/80 dark:bg-violet-500/12 dark:text-violet-300 dark:ring-violet-500/25',
    bar: 'bg-violet-500',
  },
  IMAGE: {
    icon: FileImage,
    tile: 'bg-sky-50 text-sky-600 ring-sky-200/80 dark:bg-sky-500/12 dark:text-sky-300 dark:ring-sky-500/25',
    bar: 'bg-sky-500',
  },
  OTHER: {
    icon: File,
    tile: 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
    bar: 'bg-zinc-500',
  },
};

/** Ícono del tipo de archivo con la extensión abajo ("PDF", "DOCX"…). */
export function FileKindIcon({ kind, filename, size = 'md', className }: { kind: AttachmentKind; filename: string; size?: 'sm' | 'md'; className?: string }) {
  const meta = KIND_STYLE[kind] ?? KIND_STYLE.OTHER;
  const Icon = meta.icon;
  const ext = fileExtension(filename).slice(0, 4).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-inset',
        size === 'sm' ? 'size-9 gap-0' : 'size-11 gap-0.5',
        meta.tile,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} strokeWidth={1.9} />
      {ext && <span className={cn('font-bold leading-none tracking-wide', size === 'sm' ? 'text-[7.5px]' : 'text-[8.5px]')}>{ext}</span>}
    </span>
  );
}

/** Nombre de archivo truncado por el medio: "Resumen del parcial…mer-cuat.pdf". */
export function FileName({ name, className }: { name: string; className?: string }) {
  const [head, tail] = splitFilename(name);
  return (
    <span title={name} className={cn('flex min-w-0', className)}>
      <span className="truncate">{head}</span>
      <span className="shrink-0 whitespace-pre">{tail}</span>
    </span>
  );
}
