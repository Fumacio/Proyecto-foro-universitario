import { ImagePlus, RefreshCw, Trash, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, validateImage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUploadImage } from '@/queries/misc';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';

/** Subida de imagen de portada: arrastrar, click o pegar. Devuelve la URL de /uploads. */
export function ImageDropzone({ value, onChange, className }: { value: string | null; onChange: (url: string | null) => void; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const upload = useUploadImage();

  const handle = (file: File | undefined) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const local = URL.createObjectURL(file);
    setPreview(local);
    upload.mutate(file, {
      onSuccess: ({ url }) => onChange(url),
      onError: (e) => toast.error(errorMessage(e, 'No se pudo subir la imagen.')),
      onSettled: () => {
        setPreview(null);
        URL.revokeObjectURL(local);
      },
    });
  };

  const shown = preview ?? value;

  if (shown) {
    return (
      <div className={cn('group relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900', className)}>
        <img src={shown} alt="Portada" className={cn('max-h-80 w-full object-cover transition-opacity', upload.isPending && 'opacity-50')} />
        {upload.isPending ? (
          <div className="absolute inset-0 grid place-items-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950/70 px-3 py-1.5 text-sm font-medium text-white backdrop-blur">
              <Spinner className="size-4" /> Subiendo…
            </span>
          </div>
        ) : (
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button size="sm" variant="secondary" className="bg-white/90 backdrop-blur dark:bg-zinc-900/90" onClick={() => inputRef.current?.click()}>
              <RefreshCw />
              Cambiar
            </Button>
            <Button size="sm" variant="secondary" className="bg-white/90 text-rose-600 backdrop-blur dark:bg-zinc-900/90 dark:text-rose-400" onClick={() => onChange(null)}>
              <Trash />
              Quitar
            </Button>
          </div>
        )}
        <input ref={inputRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files?.[0]);
      }}
      onPaste={(e) => handle(Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/')))}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
        dragging
          ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10'
          : 'border-zinc-200 hover:border-brand-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-brand-500/40 dark:hover:bg-zinc-900/60',
        className,
      )}
      aria-label="Subir imagen de portada"
    >
      <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        {dragging ? <UploadCloud className="size-5" /> : <ImagePlus className="size-5" />}
      </span>
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {dragging ? 'Soltá la imagen acá' : <>Arrastrá una imagen o <span className="text-brand-600 dark:text-brand-400">hacé click para elegir</span></>}
      </p>
      <p className="text-xs text-zinc-500">PNG, JPG, WEBP o GIF · hasta 5 MB</p>
    </div>
    <input ref={inputRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );
}
