const { z } = require('zod');

const createTagSchema = z.object({
  name: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(50, 'El nombre no puede superar 50 caracteres'),
  color: z
    .string({ error: 'El color debe ser texto' })
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un hex color (ej: #F99B4A)')
    .optional()
});

module.exports = { createTagSchema };
