jest.mock('../../db/connection', () => ({ query: jest.fn() }));
jest.mock('../../utils/response.utils', () => ({
  sendError: jest.fn((res, err, message, status = 500) => {
    res.status(status).json({ error: message });
  })
}));
const pool = require('../../db/connection');

const {
  getAll,
  getById,
  create,
  update,
  remove,
} = require('../../controllers/categories.controller');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// getAll
// ══════════════════════════════════════════════════════════════════════════════

describe('categories.controller - getAll', () => {
  it('should return categories with subcategories', async () => {
    const categories = [
      { id: 1, name: 'Matematica', description: 'Mates', subcategory_count: 2 },
      { id: 2, name: 'Programacion', description: 'Prog', subcategory_count: 1 },
    ];
    const sub1 = [{ id: 3, name: 'Algebra', description: 'Algebra lineal' }];
    const sub2 = [{ id: 4, name: 'Node.js', description: 'Backend' }];

    pool.query
      .mockResolvedValueOnce([categories])   // SELECT parent categories
      .mockResolvedValueOnce([sub1])         // subcategories for id=1
      .mockResolvedValueOnce([sub2]);        // subcategories for id=2

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(res.json).toHaveBeenCalledWith([
      { id: 1, name: 'Matematica', description: 'Mates', subcategory_count: 2, subcategories: sub1 },
      { id: 2, name: 'Programacion', description: 'Prog', subcategory_count: 1, subcategories: sub2 },
    ]);
  });

  it('should return empty array when no categories exist', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should return empty subcategories array when category has no children', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Solo', description: 'x', subcategory_count: 0 }]])
      .mockResolvedValueOnce([[]]);

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result[0].subcategories).toEqual([]);
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener categorías' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getById
// ══════════════════════════════════════════════════════════════════════════════

describe('categories.controller - getById', () => {
  it('should return 404 if category is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { params: { id: '999' } };
    const res = mockRes();

    await getById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
  });

  it('should return category with its subcategories', async () => {
    const category = { id: 1, name: 'Matematica', description: 'Mates' };
    const subcategories = [{ id: 3, name: 'Algebra', description: 'Algebra lineal' }];

    pool.query
      .mockResolvedValueOnce([[category]])
      .mockResolvedValueOnce([subcategories]);

    const req = { params: { id: '1' } };
    const res = mockRes();

    await getById(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ...category,
      subcategories,
    });
  });

  it('should return category with empty subcategories when none exist', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5, name: 'Solo', description: 'x' }]])
      .mockResolvedValueOnce([[]]);

    const req = { params: { id: '5' } };
    const res = mockRes();

    await getById(req, res);

    const result = res.json.mock.calls[0][0];
    expect(result.subcategories).toEqual([]);
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '1' } };
    const res = mockRes();

    await getById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener categoría' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// create
// ══════════════════════════════════════════════════════════════════════════════

describe('categories.controller - create', () => {
  it('should return 400 if name is missing', async () => {
    const req = { body: { description: 'Some desc' } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El nombre es obligatorio' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should create category with name and description', async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 10 }]);

    const req = { body: { name: 'Fisica', description: 'Fisica general' } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 10,
      name: 'Fisica',
      description: 'Fisica general',
      parent_id: undefined,
    });
  });

  it('should create category with parent_id when provided', async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 11 }]);

    const req = { body: { name: 'Algebra', description: 'AL', parent_id: 1 } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: 1 })
    );

    const insertCall = pool.query.mock.calls[0];
    expect(insertCall[1]).toEqual(['Algebra', 'AL', 1]);
  });

  it('should default optional fields to null', async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 12 }]);

    const req = { body: { name: 'Basica' } };
    const res = mockRes();

    await create(req, res);

    const insertCall = pool.query.mock.calls[0];
    expect(insertCall[1]).toEqual(['Basica', null, null]);
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { body: { name: 'Fail' } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al crear categoría' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// update
// ══════════════════════════════════════════════════════════════════════════════

describe('categories.controller - update', () => {
  it('should return 400 if no fields are provided', async () => {
    const req = { params: { id: '1' }, body: {} };
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No hay campos para actualizar' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should update name successfully', async () => {
    pool.query.mockResolvedValueOnce([{}]);

    const req = { params: { id: '1' }, body: { name: 'Nuevo nombre' } };
    const res = mockRes();

    await update(req, res);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/UPDATE categories SET name = \?/);
    expect(pool.query.mock.calls[0][1]).toEqual(['Nuevo nombre', '1']);
    expect(res.json).toHaveBeenCalledWith({ message: 'Categoría actualizada' });
  });

  it('should update description field', async () => {
    pool.query.mockResolvedValueOnce([{}]);

    const req = { params: { id: '2' }, body: { description: 'Updated desc' } };
    const res = mockRes();

    await update(req, res);

    expect(pool.query.mock.calls[0][0]).toMatch(/UPDATE categories SET description = \?/);
    expect(pool.query.mock.calls[0][1]).toEqual(['Updated desc', '2']);
  });

  it('should update parent_id field', async () => {
    pool.query.mockResolvedValueOnce([{}]);

    const req = { params: { id: '3' }, body: { parent_id: 5 } };
    const res = mockRes();

    await update(req, res);

    expect(pool.query.mock.calls[0][0]).toMatch(/UPDATE categories SET parent_id = \?/);
    expect(pool.query.mock.calls[0][1]).toEqual([5, '3']);
  });

  it('should update multiple fields at once', async () => {
    pool.query.mockResolvedValueOnce([{}]);

    const req = { params: { id: '1' }, body: { name: 'X', description: 'Y', parent_id: 2 } };
    const res = mockRes();

    await update(req, res);

    expect(pool.query.mock.calls[0][0]).toMatch(/UPDATE categories SET name = \?, description = \?, parent_id = \?/);
    expect(pool.query.mock.calls[0][1]).toEqual(['X', 'Y', 2, '1']);
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '1' }, body: { name: 'Fail' } };
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al actualizar categoría' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// remove
// ══════════════════════════════════════════════════════════════════════════════

describe('categories.controller - remove', () => {
  it('should return 404 if category is not found', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const req = { params: { id: '999' } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
  });

  it('should delete category successfully', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = { params: { id: '1' } };
    const res = mockRes();

    await remove(req, res);

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM categories WHERE id = ?', ['1']);
    expect(res.json).toHaveBeenCalledWith({ message: 'Categoría eliminada' });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '1' } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al eliminar categoría' });
  });
});
