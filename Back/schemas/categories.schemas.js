const { z } = require('zod');
const { id } = require('./common');

const createCategorySchema = z.object({
  name: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  description: z.string().trim().max(500, 'La descripción no puede superar 500 caracteres').optional(),
  parent_id: id.nullable().optional()
});

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    parent_id: id.nullable().optional()
  })
  .refine((data) => data.name !== undefined || data.description !== undefined || data.parent_id !== undefined, {
    error: 'No hay campos para actualizar'
  });

module.exports = { createCategorySchema, updateCategorySchema };
