import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError, type ErrorBody } from '../lib/errors.js';
import { zodToHttpError } from '../lib/validate.js';

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', code: 'NOT_FOUND' } satisfies ErrorBody);
};

const UNIQUE_MESSAGES: Record<string, string> = {
  usernameKey: 'Ese nombre de usuario ya está en uso',
  username: 'Ese nombre de usuario ya está en uso',
  email: 'Ese email ya está registrado',
  slug: 'Ya existe uno con ese identificador (slug)',
  name: 'Ya existe uno con ese nombre',
};

function prismaUniqueMessage(err: Prisma.PrismaClientKnownRequestError): string {
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
  for (const f of fields) {
    for (const [key, msg] of Object.entries(UNIQUE_MESSAGES)) if (f === key || f.endsWith(`_${key}_key`)) return msg;
  }
  return 'Ya existe un registro con esos datos';
}

const MULTER_MESSAGES: Partial<Record<multer.MulterError['code'], string>> = {
  LIMIT_FILE_SIZE: 'La imagen supera el máximo de 5 MB',
  LIMIT_FILE_COUNT: 'Subí un solo archivo',
  LIMIT_UNEXPECTED_FILE: 'El archivo tiene que venir en el campo "file"',
  LIMIT_FIELD_COUNT: 'Demasiados campos en el formulario',
  LIMIT_PART_COUNT: 'Demasiadas partes en el formulario',
};

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof ZodError) return zodToHttpError(err);
  if (err instanceof multer.MulterError) {
    const msg = MULTER_MESSAGES[err.code] ?? 'No se pudo procesar el archivo';
    return new HttpError(400, 'VALIDATION', msg, { file: msg });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return new HttpError(409, 'CONFLICT', prismaUniqueMessage(err));
    if (err.code === 'P2025') return new HttpError(404, 'NOT_FOUND', 'No encontramos lo que buscabas');
    if (err.code === 'P2003') return new HttpError(400, 'VALIDATION', 'Referencia inválida', {});
  }
  // Errores de body-parser (JSON mal formado, cuerpo muy grande).
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const type = (err as { type?: unknown }).type;
    if (type === 'entity.parse.failed') return new HttpError(400, 'VALIDATION', 'El cuerpo no es un JSON válido', {});
    if (type === 'entity.too.large') return new HttpError(413, 'VALIDATION', 'El contenido es demasiado grande', {});
    if (type === 'encoding.unsupported' || type === 'charset.unsupported')
      return new HttpError(415, 'VALIDATION', 'Codificación no soportada', {});
  }
  return new HttpError(500, 'INTERNAL', 'Ocurrió un error inesperado. Probá de nuevo en un rato.');
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const httpErr = toHttpError(err);
  if (httpErr.status >= 500) {
    // El stack solo va al log del server, nunca a la respuesta.
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(httpErr.status).json(httpErr.toBody());
};
