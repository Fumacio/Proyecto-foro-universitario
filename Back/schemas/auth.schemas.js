const { z } = require('zod');

const username = z
  .string({ error: 'El username es obligatorio' })
  .trim()
  .min(3, 'El username debe tener al menos 3 caracteres')
  .max(30, 'El username no puede superar 30 caracteres');

const email = z
  .string({ error: 'El email es obligatorio' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Email inválido' }).max(100, 'El email no puede superar 100 caracteres'));

const password = z
  .string({ error: 'La contraseña es obligatoria' })
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .max(72, 'La contraseña no puede superar 72 caracteres');

const optionalText = (max, label) =>
  z.string({ error: `${label} debe ser texto` }).trim().max(max, `${label} no puede superar ${max} caracteres`).optional();

const optionalAge = z
  .coerce.number({ error: 'La edad debe ser un número' })
  .int('La edad debe ser un número entero')
  .min(13, 'La edad mínima es 13')
  .max(120, 'La edad máxima es 120')
  .nullable()
  .optional();

const registerSchema = z.object({
  username,
  email,
  password,
  first_name: optionalText(50, 'El nombre'),
  last_name: optionalText(50, 'El apellido'),
  age: optionalAge,
  commission: optionalText(30, 'La comisión'),
  career: optionalText(100, 'La carrera'),
  gender: optionalText(30, 'El género'),
  bio: optionalText(500, 'La bio')
});

const loginSchema = z.object({
  email,
  password: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria')
    .max(72, 'La contraseña no puede superar 72 caracteres')
});

const updateProfileSchema = z
  .object({
    username: username.optional(),
    email: email.optional(),
    current_password: z.string().min(1, 'La contraseña actual es obligatoria').max(72).optional(),
    new_password: password.optional(),
    first_name: optionalText(50, 'El nombre'),
    last_name: optionalText(50, 'El apellido'),
    age: optionalAge,
    commission: optionalText(30, 'La comisión'),
    career: optionalText(100, 'La carrera'),
    gender: optionalText(30, 'El género'),
    bio: optionalText(500, 'La bio')
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { error: 'No hay campos para actualizar' }
  );

const forgotPasswordSchema = z.object({ email });

const resetPasswordSchema = z.object({
  token: z.string({ error: 'El token es obligatorio' }).trim().min(1, 'El token es obligatorio').max(200),
  password
});

const deleteAccountSchema = z.object({
  password: z.string({ error: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria').max(72)
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  deleteAccountSchema
};
