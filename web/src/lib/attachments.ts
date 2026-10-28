import { API_BASE, ApiError } from './api';
import type { ApiErrorBody, Attachment, AttachmentKind } from './types';

/* Reglas de docs/API.md (v2.1 › Adjuntos). El server valida de nuevo (extensión + magic bytes). */

export const MAX_ATTACHMENT_MB = 25;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

export const ATTACHMENT_LIMITS = { post: 10, comment: 5, message: 5 } as const;

const EXTENSIONS: Record<Exclude<AttachmentKind, 'OTHER'>, string[]> = {
  IMAGE: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  PDF: ['pdf'],
  DOCUMENT: ['doc', 'docx', 'odt', 'rtf'],
  SPREADSHEET: ['xls', 'xlsx', 'ods', 'csv'],
  PRESENTATION: ['ppt', 'pptx', 'odp'],
  ARCHIVE: ['zip', 'rar', '7z'],
  TEXT: ['txt', 'md', 'c', 'h', 'cpp', 'hpp', 'cs', 'java', 'py', 'js', 'ts', 'sql', 'json', 'xml', 'html', 'css', 'ipynb'],
};

const KIND_BY_EXT = new Map<string, AttachmentKind>(
  Object.entries(EXTENSIONS).flatMap(([kind, exts]) => exts.map((e) => [e, kind as AttachmentKind] as const)),
);

/** Valor para `<input accept>` (por extensión: los MIME de código/Office varían entre sistemas). */
export const ATTACHMENT_ACCEPT = [...KIND_BY_EXT.keys()].map((e) => `.${e}`).join(',');

export function fileExtension(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : '';
}

export function kindFromFilename(name: string): AttachmentKind {
  return KIND_BY_EXT.get(fileExtension(name)) ?? 'OTHER';
}

export function validateAttachment(file: File): string | null {
  const ext = fileExtension(file.name);
  if (ext === 'svg') return `“${file.name}”: los SVG no están permitidos.`;
  if (!KIND_BY_EXT.has(ext)) {
    return `“${file.name}”: tipo de archivo no permitido. Podés subir PDF, Word, Excel, PowerPoint, imágenes, zip y código.`;
  }
  if (file.size === 0) return `“${file.name}” está vacío.`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `“${file.name}” pesa ${formatBytes(file.size)}: el máximo es ${MAX_ATTACHMENT_MB} MB por archivo.`;
  return null;
}

/** "2,4 MB", "830 KB", "12 B" (formato es-AR). */
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = v >= 100 || i === 0 ? 0 : 1;
  return `${v.toLocaleString('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ${units[i]}`;
}

/** Separa el nombre para truncar "por el medio": [inicio truncable, final siempre visible]. */
export function splitFilename(name: string, tail = 6): [string, string] {
  const ext = fileExtension(name);
  const base = ext ? name.slice(0, -(ext.length + 1)) : name;
  if (base.length <= tail + 4) return [base, ext ? `.${ext}` : ''];
  return [base.slice(0, base.length - tail), `${base.slice(-tail)}${ext ? `.${ext}` : ''}`];
}

export const KIND_LABEL: Record<AttachmentKind, string> = {
  IMAGE: 'Imagen',
  PDF: 'PDF',
  DOCUMENT: 'Documento',
  SPREADSHEET: 'Planilla',
  PRESENTATION: 'Presentación',
  ARCHIVE: 'Comprimido',
  TEXT: 'Texto / código',
  OTHER: 'Archivo',
};

/* ---------------- Subida con progreso (XMLHttpRequest) ---------------- */

export interface UploadHandle {
  promise: Promise<Attachment>;
  abort: () => void;
}

export class UploadAbortedError extends Error {
  constructor() {
    super('Subida cancelada');
    this.name = 'UploadAbortedError';
  }
}

function errorFromXhr(xhr: XMLHttpRequest): ApiError {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = JSON.parse(xhr.responseText) as Partial<ApiErrorBody>;
  } catch {
    body = null;
  }
  const status = xhr.status;
  const fallback =
    status === 413
      ? `El archivo supera los ${MAX_ATTACHMENT_MB} MB.`
      : status === 401
        ? 'Tu sesión expiró. Iniciá sesión de nuevo.'
        : status === 429
          ? 'Llegaste al límite de subidas por hoy. Probá más tarde.'
          : status >= 500
            ? 'El servidor no pudo guardar el archivo. Probá de nuevo.'
            : 'No se pudo subir el archivo.';
  return new ApiError(status, body?.code ?? (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 429 ? 'RATE_LIMIT' : status >= 500 ? 'INTERNAL' : 'VALIDATION'), body?.error ?? fallback, body?.details);
}

/** `POST /api/attachments` (multipart `file`) informando el progreso de 0 a 1. */
export function uploadAttachment(file: File, onProgress?: (fraction: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<Attachment>((resolve, reject) => {
    xhr.open('POST', `${API_BASE}/attachments`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText) as { attachment: Attachment };
          if (!res?.attachment) throw new Error('Respuesta inválida');
          onProgress?.(1);
          resolve(res.attachment);
        } catch {
          reject(new ApiError(xhr.status, 'INTERNAL', 'Respuesta inesperada del servidor.'));
        }
      } else reject(errorFromXhr(xhr));
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Sin conexión con el servidor. Revisá tu internet.'));
    xhr.onabort = () => reject(new UploadAbortedError());
    const form = new FormData();
    form.append('file', file, file.name);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

export function isImageAttachment(a: Pick<Attachment, 'kind'>) {
  return a.kind === 'IMAGE';
}
