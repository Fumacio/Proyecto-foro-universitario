import type { ApiErrorBody, ApiErrorCode } from './types';

export const API_BASE = '/api';

export type ApiErrorKind = ApiErrorCode | 'NETWORK';

export class ApiError extends Error {
  status: number;
  code: ApiErrorKind;
  details?: Record<string, string>;

  constructor(status: number, code: ApiErrorKind, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: QueryParams) {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Revisá los datos ingresados.',
  401: 'Iniciá sesión para continuar.',
  403: 'No tenés permiso para hacer esto.',
  404: 'No encontramos lo que buscabas.',
  409: 'Hubo un conflicto con los datos actuales.',
  413: 'El archivo es demasiado grande.',
  423: 'Este contenido está cerrado.',
  429: 'Demasiados intentos. Esperá un momento.',
};

function codeFromStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 423:
      return 'LOCKED';
    case 429:
      return 'RATE_LIMIT';
    default:
      return 'INTERNAL';
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) body = (await res.json()) as Partial<ApiErrorBody>;
  } catch {
    body = null;
  }
  const status = res.status;
  if (!body && status >= 500) {
    return new ApiError(status, 'INTERNAL', 'No se pudo conectar con el servidor. Probá de nuevo en un rato.');
  }
  return new ApiError(
    status,
    body?.code ?? codeFromStatus(status),
    body?.error ?? FALLBACK_MESSAGES[status] ?? 'Algo salió mal. Probá de nuevo.',
    body?.details ?? undefined,
  );
}

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body:
        opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Sin conexión con el servidor. Revisá tu internet.');
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  del: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  /** Sube un archivo como multipart/form-data en el campo `file`. */
  upload: <T>(path: string, file: File | Blob, fileName?: string) => {
    const form = new FormData();
    if (file instanceof File) form.append('file', file);
    else form.append('file', file, fileName ?? 'imagen.png');
    return request<T>('POST', path, { body: form });
  },
};

/** Valida archivos de imagen antes de subirlos (mismas reglas que el server). */
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Formato no soportado. Usá PNG, JPG, WEBP o GIF.';
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen supera los 5 MB.';
  return null;
}

export function errorMessage(e: unknown, fallback = 'Algo salió mal. Probá de nuevo.'): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
