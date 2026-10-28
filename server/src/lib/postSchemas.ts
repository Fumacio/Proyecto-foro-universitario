import { z } from 'zod';
import { HttpError } from './errors.js';
import { prisma } from './prisma.js';
import { isUploadUrl } from './upload.js';
import { idSchema } from './validate.js';

export const POST_TYPES = ['TEXT', 'QUESTION', 'POLL', 'LINK'] as const;

export const imageUrlSchema = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === undefined || v === null || isUploadUrl(v), 'La imagen tiene que subirse desde el foro (/uploads/...)');

export const tagIdsSchema = z
  .array(idSchema, { error: 'Las etiquetas tienen que ser una lista' })
  .max(5, 'Podés elegir hasta 5 etiquetas')
  .transform((ids) => [...new Set(ids)]);

export const BODY_MAX = 40_000;
export const bodySchema = z.string().max(BODY_MAX, 'El texto puede tener como máximo 40.000 caracteres');

export async function assertTagsExist(tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;
  const count = await prisma.tag.count({ where: { id: { in: tagIds } } });
  if (count !== tagIds.length) throw new HttpError(400, 'VALIDATION', 'Alguna etiqueta no existe', { tagIds: 'Alguna etiqueta no existe' });
}
