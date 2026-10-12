const { registerSchema, updateProfileSchema } = require('../../schemas/auth.schemas');
const { createPostSchema } = require('../../schemas/posts.schemas');
const { createReportSchema } = require('../../schemas/reports.schemas');
const { createCategorySchema } = require('../../schemas/categories.schemas');

describe('Schemas: campos opcionales vacíos', () => {
  // El front manda null (o "") en los campos que el usuario deja vacíos.
  // Antes eso hacía fallar el registro, la edición de perfil, los posts sin imagen y los reportes.
  test('registro con campos opcionales en null o vacíos', () => {
    const result = registerSchema.safeParse({
      username: 'ana', email: 'ANA@x.com ', password: 'secret1',
      first_name: null, last_name: '', age: null, commission: null, career: null, gender: null
    });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('ana@x.com');
    expect(result.data.last_name).toBeNull();
  });

  test('edición de perfil borrando la bio', () => {
    const result = updateProfileSchema.safeParse({ bio: null, age: '' });
    expect(result.success).toBe(true);
    expect(result.data.bio).toBeNull();
    expect(result.data.age).toBeNull();
  });

  test('perfil sin ningún campo es inválido', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });

  test('post sin imagen (image_url: null)', () => {
    const result = createPostSchema.safeParse({ title: 't', content: 'c', category_id: 1, image_url: null });
    expect(result.success).toBe(true);
  });

  test('reporte sin descripción', () => {
    expect(createReportSchema.safeParse({ post_id: 1, reason: 'spam', description: null }).success).toBe(true);
  });

  test('categoría con descripción vacía', () => {
    const result = createCategorySchema.safeParse({ name: 'Química', description: '' });
    expect(result.success).toBe(true);
    expect(result.data.description).toBeNull();
  });
});

describe('Schemas: seguridad', () => {
  test('image_url solo acepta imágenes subidas al servidor', () => {
    const bad = ['x" onerror="alert(1)', 'https://evil.com/a.png', 'javascript:alert(1)', '/uploads/posts/../../server.js'];
    for (const image_url of bad) {
      expect(createPostSchema.safeParse({ title: 't', content: 'c', category_id: 1, image_url }).success).toBe(false);
    }
    const ok = createPostSchema.safeParse({
      title: 't', content: 'c', category_id: 1, image_url: '/uploads/posts/0123456789abcdef0123456789abcdef.png'
    });
    expect(ok.success).toBe(true);
  });

  test('username no acepta HTML ni espacios', () => {
    for (const username of ['<img src=x>', 'a b c', "x');alert(1)//"]) {
      expect(registerSchema.safeParse({ username, email: 'a@x.com', password: 'secret1' }).success).toBe(false);
    }
    expect(registerSchema.safeParse({ username: 'José_P.2', email: 'a@x.com', password: 'secret1' }).success).toBe(true);
  });

  test('tags repetidos se deduplican', () => {
    const result = createPostSchema.safeParse({ title: 't', content: 'c', category_id: 1, tag_ids: [1, 1, 2] });
    expect(result.data.tag_ids).toEqual([1, 2]);
  });
});
