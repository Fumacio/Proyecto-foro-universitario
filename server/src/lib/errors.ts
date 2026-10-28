export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BANNED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'LOCKED'
  | 'INTERNAL';

export interface ErrorBody {
  error: string;
  code: ErrorCode;
  details?: Record<string, string>;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, string>;

  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }

  toBody(): ErrorBody {
    return this.details ? { error: this.message, code: this.code, details: this.details } : { error: this.message, code: this.code };
  }
}

/** 400 VALIDATION. Si se pasa `field`, se agrega a `details`. */
export function validationError(message: string, field?: string): HttpError {
  return new HttpError(400, 'VALIDATION', message, field ? { [field]: message } : {});
}

export const unauthorized = (message = 'Iniciá sesión para continuar') => new HttpError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'No tenés permiso para hacer esto') => new HttpError(403, 'FORBIDDEN', message);

export const notFound = (message = 'No encontramos lo que buscabas') => new HttpError(404, 'NOT_FOUND', message);

export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);

export const locked = (message = 'Este post está cerrado: no admite comentarios nuevos') =>
  new HttpError(423, 'LOCKED', message);

export const banned = (message: string) => new HttpError(403, 'BANNED', message);
