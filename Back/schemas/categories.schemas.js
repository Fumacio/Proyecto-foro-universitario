const { z } = require('zod');
const { id, optionalText } = require('./common');

const createCategorySchema = z.object({
  name: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  description: optionalText(500, 'La descripción'),
  parent_id: id.nullable().optional()
});

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(100).optional(),
    description: optionalText(500, 'La descripción'),
    parent_id: id.nullable().optional()
  })
  .refine((data) => data.name !== undefined || data.description !== undefined || data.parent_id !== undefined, {
    error: 'No hay campos para actualizar'
  });

module.exports = { createCategorySchema, updateCategorySchema };
