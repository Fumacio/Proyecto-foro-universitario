import {
  Bold,
  Code,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { errorMessage, validateImage } from '@/lib/api';
import { cn, isMac } from '@/lib/utils';
import { useUploadImage } from '@/queries/misc';
import { Tooltip } from '../ui/Popover';
import { Markdown } from './Markdown';

export interface MarkdownEditorHandle {
  focus: () => void;
  insert: (text: string) => void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  minRows?: number;
  maxHeight?: number;
  autoFocus?: boolean;
  onSubmit?: () => void;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  footer?: ReactNode;
  className?: string;
  allowImages?: boolean;
}

type Edit = { start: number; end: number; text: string; selStart: number; selEnd: number };

let uploadSeq = 0;
const mod = isMac ? '⌘' : 'Ctrl';

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(function MarkdownEditor(
  {
    value,
    onChange,
    placeholder = 'Escribí acá… (soporta Markdown)',
    maxLength,
    minRows = 5,
    maxHeight = 520,
    autoFocus,
    onSubmit,
    disabled,
    id,
    invalid,
    describedBy,
    footer,
    className,
    allowImages = true,
  },
  ref,
) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const upload = useUploadImage();

  // Autosize
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta || tab !== 'write') return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight + 2, maxHeight)}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, tab, maxHeight]);

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  const applyEdit = (edit: Edit) => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(edit.start, edit.end);
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, edit.text);
    } catch {
      ok = false;
    }
    if (!ok) {
      const v = valueRef.current;
      onChange(v.slice(0, edit.start) + edit.text + v.slice(edit.end));
    }
    requestAnimationFrame(() => {
      taRef.current?.setSelectionRange(edit.selStart, edit.selEnd);
    });
  };

  const selection = () => {
    const ta = taRef.current;
    return { s: ta?.selectionStart ?? value.length, e: ta?.selectionEnd ?? value.length };
  };

  const wrap = (before: string, after: string, placeholderText: string) => {
    const { s, e } = selection();
    const v = valueRef.current;
    const sel = v.slice(s, e);
    if (v.slice(s - before.length, s) === before && v.slice(e, e + after.length) === after) {
      applyEdit({
        start: s - before.length,
        end: e + after.length,
        text: sel,
        selStart: s - before.length,
        selEnd: e - before.length,
      });
      return;
    }
    const inner = sel || placeholderText;
    applyEdit({
      start: s,
      end: e,
      text: before + inner + after,
      selStart: s + before.length,
      selEnd: s + before.length + inner.length,
    });
  };

  const prefixLines = (prefix: (i: number) => string, detect: RegExp) => {
    const { s, e } = selection();
    const v = valueRef.current;
    const lineStart = v.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = v.indexOf('\n', e);
    if (lineEnd === -1) lineEnd = v.length;
    const lines = v.slice(lineStart, lineEnd).split('\n');
    const all = lines.every((l) => detect.test(l));
    const next = all ? lines.map((l) => l.replace(detect, '')) : lines.map((l, i) => prefix(i) + l.replace(detect, ''));
    const text = next.join('\n');
    applyEdit({
      start: lineStart,
      end: lineEnd,
      text,
      selStart: lines.length === 1 ? lineStart + text.length : lineStart,
      selEnd: lineStart + text.length,
    });
  };

  const insertLink = () => {
    const { s, e } = selection();
    const sel = valueRef.current.slice(s, e);
    if (sel && /^https?:\/\//.test(sel)) {
      const text = `[texto](${sel})`;
      applyEdit({ start: s, end: e, text, selStart: s + 1, selEnd: s + 6 });
    } else {
      const label = sel || 'texto';
      const text = `[${label}](https://)`;
      const urlStart = s + label.length + 3;
      applyEdit({ start: s, end: e, text, selStart: urlStart, selEnd: urlStart + 8 });
    }
  };

  const insertCode = () => {
    const { s, e } = selection();
    const sel = valueRef.current.slice(s, e);
    if (sel.includes('\n')) {
      const text = `\n\`\`\`\n${sel}\n\`\`\`\n`;
      applyEdit({ start: s, end: e, text, selStart: s + 5, selEnd: s + 5 + sel.length });
    } else wrap('`', '`', 'código');
  };

  const insertAtCursor = (text: string) => {
    const { s, e } = selection();
    const v = valueRef.current;
    const needsNl = s > 0 && v[s - 1] !== '\n';
    const full = (needsNl ? '\n' : '') + text;
    applyEdit({ start: s, end: e, text: full, selStart: s + full.length, selEnd: s + full.length });
  };

  const uploadFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    for (const file of images) {
      const problem = validateImage(file);
      if (problem) {
        toast.error(problem);
        continue;
      }
      const token = `![Subiendo imagen ${++uploadSeq}…]()`;
      if (tab !== 'write') setTab('write');
      insertAtCursor(`${token}\n`);
      setUploading((n) => n + 1);
      try {
        const { url } = await upload.mutateAsync(file);
        const alt = (file.name || 'imagen').replace(/\.[a-z0-9]+$/i, '').replace(/[[\]]/g, '') || 'imagen';
        onChange(valueRef.current.replace(token, `![${alt}](${url})`));
      } catch (err) {
        onChange(valueRef.current.replace(`${token}\n`, '').replace(token, ''));
        toast.error(errorMessage(err, 'No se pudo subir la imagen.'));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    insert: (text: string) => insertAtCursor(text),
  }));

  const tools: { icon: LucideIcon; label: string; run: () => void; hidden?: boolean }[] = [
    { icon: Bold, label: `Negrita (${mod}+B)`, run: () => wrap('**', '**', 'texto en negrita') },
    { icon: Italic, label: `Cursiva (${mod}+I)`, run: () => wrap('_', '_', 'texto en cursiva') },
    { icon: Heading2, label: 'Título', run: () => prefixLines(() => '## ', /^#{1,6} /) },
    { icon: Link2, label: 'Link', run: insertLink },
    { icon: Code, label: 'Código', run: insertCode },
    { icon: Quote, label: 'Cita', run: () => prefixLines(() => '> ', /^> ?/) },
    { icon: List, label: 'Lista', run: () => prefixLines(() => '- ', /^[-*] /) },
    { icon: ListOrdered, label: 'Lista numerada', run: () => prefixLines((i) => `${i + 1}. `, /^\d+\. /) },
    { icon: ImagePlus, label: 'Subir imagen', run: () => fileRef.current?.click(), hidden: !allowImages },
  ];

  const count = value.length;
  const over = maxLength != null && count > maxLength;
  const near = maxLength != null && count > maxLength * 0.9;

  return (
    <div
      className={cn(
        'group/editor overflow-hidden rounded-xl border bg-white shadow-xs transition-[border-color,box-shadow] duration-150 dark:bg-zinc-900',
        invalid || over
          ? 'border-rose-500 focus-within:ring-4 focus-within:ring-rose-500/15'
          : 'border-zinc-200 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15 dark:border-zinc-800 dark:focus-within:border-brand-400',
        dragging && 'border-brand-500 ring-4 ring-brand-500/20',
        disabled && 'opacity-60',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-1.5 py-1 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex shrink-0 items-center rounded-lg p-0.5" role="tablist" aria-label="Modo del editor">
          {(['write', 'preview'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors',
                tab === t
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              {t === 'write' ? 'Escribir' : 'Vista previa'}
            </button>
          ))}
        </div>
        <div
          className={cn(
            'no-scrollbar ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto',
            tab === 'preview' && 'pointer-events-none opacity-0',
          )}
          aria-hidden={tab === 'preview'}
        >
          {tools
            .filter((t) => !t.hidden)
            .map((t) => (
              <Tooltip key={t.label} content={t.label}>
                <button
                  type="button"
                  aria-label={t.label}
                  disabled={disabled}
                  tabIndex={tab === 'preview' ? -1 : 0}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={t.run}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <t.icon className="size-4" />
                </button>
              </Tooltip>
            ))}
        </div>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={taRef}
          id={id}
          value={value}
          rows={minRows}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={invalid || over || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            const k = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
              if (k === 'b') {
                e.preventDefault();
                wrap('**', '**', 'texto en negrita');
              } else if (k === 'i') {
                e.preventDefault();
                wrap('_', '_', 'texto en cursiva');
              } else if (k === 'enter' && onSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }
          }}
          onPaste={(e) => {
            if (!allowImages) return;
            const files = Array.from(e.clipboardData.files ?? []);
            if (files.some((f) => f.type.startsWith('image/'))) {
              e.preventDefault();
              void uploadFiles(files);
            }
          }}
          onDragOver={(e) => {
            if (!allowImages || !e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            setDragging(false);
            if (!allowImages) return;
            const files = Array.from(e.dataTransfer.files ?? []);
            if (files.length) {
              e.preventDefault();
              void uploadFiles(files);
            }
          }}
          className="block w-full resize-none bg-transparent px-3.5 py-3 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed dark:text-zinc-100"
        />
      ) : (
        <div className="min-h-[7.5rem] px-4 py-3.5" style={{ minHeight: `${minRows * 1.6 + 1.5}rem` }}>
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-zinc-400">Nada para previsualizar todavía.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
        <p className="hidden text-xs text-zinc-400 sm:block dark:text-zinc-500">
          {uploading > 0 ? (
            <span className="text-brand-600 dark:text-brand-400">Subiendo {uploading > 1 ? `${uploading} imágenes` : 'imagen'}…</span>
          ) : allowImages ? (
            'Markdown · Pegá o arrastrá imágenes'
          ) : (
            'Markdown soportado'
          )}
        </p>
        <div className="ml-auto flex items-center gap-3">
          {maxLength != null && (
            <span
              className={cn(
                'text-xs tabular-nums',
                over ? 'font-semibold text-rose-600' : near ? 'text-amber-600' : 'text-zinc-400 dark:text-zinc-500',
              )}
            >
              {count.toLocaleString('es-AR')}/{maxLength.toLocaleString('es-AR')}
            </span>
          )}
          {footer}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) {
            requestAnimationFrame(() => void uploadFiles(files));
          }
        }}
      />
    </div>
  );
});
