import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage, isApiError } from '@/lib/api';
import { kindFromFilename, uploadAttachment, UploadAbortedError, validateAttachment } from '@/lib/attachments';
import type { Attachment, AttachmentKind } from '@/lib/types';

export type UploadStatus = 'uploading' | 'done' | 'error';

export interface UploadItem {
  key: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  status: UploadStatus;
  /** 0 a 1 */
  progress: number;
  error?: string;
  attachment?: Attachment;
  /** Para reintentar. */
  file?: File;
  /** Miniatura local (object URL) mientras sube una imagen. */
  localUrl?: string;
  /** Ya estaba guardado (post/comentario/borrador que se está editando). */
  persisted?: boolean;
}

interface Options {
  max: number;
  initial?: Attachment[];
  /**
   * `fresh` (default): al quitar, solo se borran del server los que se subieron en esta sesión
   * (los ya guardados se sacan de la lista y el server los borra al guardar).
   * `all`: se borran siempre (borradores, que se autoguardan).
   */
  deleteOnRemove?: 'fresh' | 'all';
}

let seq = 0;
const nextKey = () => `up-${Date.now().toString(36)}-${++seq}`;

function fromAttachment(a: Attachment): UploadItem {
  return { key: `att-${a.id}`, name: a.filename, size: a.size, kind: a.kind, status: 'done', progress: 1, attachment: a, persisted: true };
}

const fingerprint = (f: { name: string; size: number }) => `${f.name}|${f.size}`;

export function useAttachmentUploads({ max, initial, deleteOnRemove = 'fresh' }: Options) {
  const [items, setItems] = useState<UploadItem[]>(() => (initial ?? []).map(fromAttachment));
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const aborts = useRef(new Map<string, () => void>());
  const mounted = useRef(true);

  const patch = useCallback((key: string, p: Partial<UploadItem>) => {
    if (!mounted.current) return;
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));
  }, []);

  const start = useCallback(
    (key: string, file: File) => {
      const handle = uploadAttachment(file, (fraction) => patch(key, { progress: fraction }));
      aborts.current.set(key, handle.abort);
      handle.promise
        .then((attachment) => {
          aborts.current.delete(key);
          if (!mounted.current) {
            // Se desmontó mientras subía: lo borramos para no dejarlo suelto.
            void api.del(`/attachments/${attachment.id}`).catch(() => undefined);
            return;
          }
          const stillThere = itemsRef.current.some((it) => it.key === key);
          if (!stillThere) {
            void api.del(`/attachments/${attachment.id}`).catch(() => undefined);
            return;
          }
          patch(key, { status: 'done', progress: 1, attachment, kind: attachment.kind ?? kindFromFilename(file.name), error: undefined });
        })
        .catch((err: unknown) => {
          aborts.current.delete(key);
          if (err instanceof UploadAbortedError) return;
          if (isApiError(err) && err.status === 401) toast.error('Tu sesión expiró. Iniciá sesión de nuevo para subir archivos.');
          patch(key, { status: 'error', error: errorMessage(err, 'No se pudo subir el archivo.') });
        });
    },
    [patch],
  );

  const add = useCallback(
    (input: File[] | FileList | null | undefined) => {
      const files = Array.from(input ?? []);
      if (files.length === 0) return 0;
      const current = itemsRef.current;
      const existing = new Set(current.map(fingerprint));
      const problems: string[] = [];
      const accepted: File[] = [];
      let skippedForLimit = 0;
      for (const f of files) {
        const problem = validateAttachment(f);
        if (problem) {
          problems.push(problem);
          continue;
        }
        if (existing.has(fingerprint(f))) {
          problems.push(`“${f.name}” ya está adjunto.`);
          continue;
        }
        if (current.length + accepted.length >= max) {
          skippedForLimit++;
          continue;
        }
        existing.add(fingerprint(f));
        accepted.push(f);
      }
      if (skippedForLimit) problems.push(`Podés adjuntar hasta ${max} archivos (${skippedForLimit === 1 ? 'quedó 1 afuera' : `quedaron ${skippedForLimit} afuera`}).`);
      if (problems.length === 1) toast.error(problems[0]);
      else if (problems.length > 1) toast.error(`${problems.length} archivos no se pudieron agregar`, { description: problems.slice(0, 4).join(' · ') });

      if (accepted.length === 0) return 0;
      const fresh: UploadItem[] = accepted.map((file) => ({
        key: nextKey(),
        name: file.name,
        size: file.size,
        kind: kindFromFilename(file.name),
        status: 'uploading',
        progress: 0,
        file,
        localUrl: kindFromFilename(file.name) === 'IMAGE' ? URL.createObjectURL(file) : undefined,
      }));
      itemsRef.current = [...itemsRef.current, ...fresh];
      setItems((list) => [...list, ...fresh]);
      for (const it of fresh) start(it.key, it.file!);
      return fresh.length;
    },
    [max, start],
  );

  const remove = useCallback(
    (key: string) => {
      const it = itemsRef.current.find((x) => x.key === key);
      if (!it) return;
      aborts.current.get(key)?.();
      aborts.current.delete(key);
      if (it.localUrl) URL.revokeObjectURL(it.localUrl);
      if (it.attachment && (!it.persisted || deleteOnRemove === 'all')) {
        void api.del(`/attachments/${it.attachment.id}`).catch(() => undefined);
      }
      itemsRef.current = itemsRef.current.filter((x) => x.key !== key);
      setItems((list) => list.filter((x) => x.key !== key));
    },
    [deleteOnRemove],
  );

  const retry = useCallback(
    (key: string) => {
      const it = itemsRef.current.find((x) => x.key === key);
      if (!it?.file) return;
      patch(key, { status: 'uploading', progress: 0, error: undefined });
      start(key, it.file);
    },
    [patch, start],
  );

  /** Reemplaza la lista (p. ej. al cargar un borrador) sin borrar nada en el server. */
  const reset = useCallback((attachments: Attachment[] = []) => {
    for (const abort of aborts.current.values()) abort();
    aborts.current.clear();
    for (const it of itemsRef.current) if (it.localUrl) URL.revokeObjectURL(it.localUrl);
    const next = attachments.map(fromAttachment);
    itemsRef.current = next;
    setItems(next);
  }, []);

  /** Al cancelar una edición: borra lo que se subió en esta sesión y vuelve a la lista original. */
  const discard = useCallback(() => {
    for (const it of itemsRef.current) {
      aborts.current.get(it.key)?.();
      if (it.attachment && !it.persisted) void api.del(`/attachments/${it.attachment.id}`).catch(() => undefined);
      if (it.localUrl) URL.revokeObjectURL(it.localUrl);
    }
    aborts.current.clear();
  }, []);

  useEffect(() => {
    mounted.current = true;
    const map = aborts.current;
    return () => {
      mounted.current = false;
      for (const abort of map.values()) abort();
      map.clear();
      for (const it of itemsRef.current) if (it.localUrl) URL.revokeObjectURL(it.localUrl);
    };
  }, []);

  const attachments = useMemo(() => items.flatMap((it) => (it.status === 'done' && it.attachment ? [it.attachment] : [])), [items]);
  const ids = useMemo(() => attachments.map((a) => a.id), [attachments]);

  return {
    items,
    attachments,
    ids,
    max,
    count: items.length,
    remaining: Math.max(0, max - items.length),
    isUploading: items.some((it) => it.status === 'uploading'),
    hasErrors: items.some((it) => it.status === 'error'),
    add,
    remove,
    retry,
    reset,
    discard,
  };
}

export type AttachmentUploads = ReturnType<typeof useAttachmentUploads>;

/** ¿Cambió la lista respecto de la original? (para no mandar `attachmentIds` si no hace falta) */
export function sameIds(a: number[], b: number[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
