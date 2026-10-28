import { z } from 'zod';
import { HttpError, notFound } from './errors.js';

// Mensajes de error por defecto en español (los esquemas pueden definir los suyos).
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case 'invalid_type':
        if (issue.input === undefined) return 'Este campo es obligatorio';
        if (issue.expected === 'number' || issue.expected === 'int') return 'Tiene que ser un número';
        if (issue.expected === 'string') return 'Tiene que ser texto';
        if (issue.expected === 'boolean') return 'Tiene que ser verdadero o falso';
        if (issue.expected === 'array') return 'Tiene que ser una lista';
        return 'Tipo de dato inválido';
      case 'too_small': {
        const min = Number(issue.minimum);
        if (issue.origin === 'string') return min <= 1 ? 'No puede estar vacío' : `Tiene que tener al menos ${min} caracteres`;
        if (issue.origin === 'array' || issue.origin === 'set') return `Tiene que tener al menos ${min} elementos`;
        return `Tiene que ser mayor o igual a ${min}`;
      }
      case 'too_big': {
        const max = Number(issue.maximum);
        if (issue.origin === 'string') return `Puede tener como máximo ${max} caracteres`;
        if (issue.origin === 'array' || issue.origin === 'set') return `Puede tener como máximo ${max} elementos`;
        return `Tiene que ser menor o igual a ${max}`;
      }
      case 'invalid_format':
        if (issue.format === 'email') return 'Ingresá un email válido';
        if (issue.format === 'url') return 'Ingresá una URL válida';
        return 'Formato inválido';
      case 'invalid_value':
        return 'Opción inválida';
      case 'unrecognized_keys':
        return 'Campos desconocidos';
      default:
        return 'Valor inválido';
    }
  },
});

export function zodToHttpError(error: z.ZodError): HttpError {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_';
    if (!(key in details)) details[key] = issue.message;
  }
  return new HttpError(400, 'VALIDATION', error.issues[0]?.message ?? 'Datos inválidos', details);
}

/** Valida `data` con `schema`; si falla lanza 400 VALIDATION con `details` campo→mensaje. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw zodToHttpError(result.error);
  return result.data;
}

/** Parsea un id de ruta; si no es un entero positivo responde 404. */
export function parseId(value: unknown, message?: string): number {
  const n = typeof value === 'string' && /^\d{1,10}$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) throw notFound(message);
  return n;
}

// ---------- piezas reutilizables ----------

export const pageSchema = z.coerce.number().int().min(1).max(100_000).default(1);

export const limitSchema = (def = 20, max = 50) =>
  z.coerce
    .number()
    .int()
    .min(1)
    .default(def)
    .transform((v) => Math.min(v, max));

export const paginationSchema = z.object({ page: pageSchema, limit: limitSchema() });

/** Query booleana: "true" | "1" → true. */
export const boolQuery = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((v) => v === true || v === 'true' || v === '1');

export const idSchema = z.coerce.number().int().positive();

/** Texto opcional: "" o null → null. */
export const nullableText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === null || v === '' ? null : v));

export const passwordSchema = z
  .string({ error: 'Ingresá una contraseña' })
  .min(8, 'La contraseña tiene que tener al menos 8 caracteres')
  .max(100, 'La contraseña puede tener como máximo 100 caracteres')
  .refine((v) => /[A-Za-zÀ-ÿ]/.test(v) && /\d/.test(v), 'La contraseña tiene que tener al menos una letra y un número');

export const hexColorSchema = z
  .string({ error: 'Elegí un color' })
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'El color tiene que ser un hex como #1e90ff')
  .transform((v) => v.toLowerCase());

export type Paginated<T> = { items: T[]; page: number; hasMore: boolean; total?: number };

/** Corta los `limit + 1` resultados pedidos y arma la respuesta paginada. */
export function paginate<T>(rows: T[], page: number, limit: number, total?: number): Paginated<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return total === undefined ? { items, page, hasMore } : { items, page, hasMore, total };
}
