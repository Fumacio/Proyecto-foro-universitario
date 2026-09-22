const { z } = require('zod');

const voteSchema = z.object({
  value: z.coerce
    .number({ error: 'El valor debe ser 1 o -1' })
    .refine((v) => v === 1 || v === -1, { error: 'El valor debe ser 1 o -1' })
});

module.exports = { voteSchema };
