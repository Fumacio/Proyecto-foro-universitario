jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');

const {
  getAll,
  create,
  remove,
} = require('../../controllers/tags.controller');

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

describe('tags.controller - getAll', () => {
  it('should return all tags ordered by name', async () => {
    const tags = [
      { id: 1, name: 'javascript', color: '#F7DF1E' },
      { id: 2, name: 'nodejs', color: '#68A063' },
      { id: 3, name: 'react', color: '#61DAFB' },
    ];
    pool.query.mockResolvedValueOnce([tags]);

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM tags ORDER BY name');
    expect(res.json).toHaveBeenCalledWith(tags);
  });

  it('should return empty array when no tags exist', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener tags' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// create
// ══════════════════════════════════════════════════════════════════════════════

describe('tags.controller - create', () => {
  it('should return 400 if name is missing', async () => {
    const req = { body: { color: '#FF0000' } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El nombre es obligatorio' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should return 409 if tag already exists', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // SELECT existing tag

    const req = { body: { name: 'javascript' } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'El tag ya existe' });
  });

  it('should create tag with custom color', async () => {
    pool.query
      .mockResolvedValueOnce([[]])                   // no existing tag
      .mockResolvedValueOnce([{ insertId: 10 }]);    // INSERT

    const req = { body: { name: 'python', color: '#3776AB' } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 10,
      name: 'python',
      color: '#3776AB',
    });
  });

  it('should default color to #F99B4A when not provided', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 11 }]);

    const req = { body: { name: 'rust' } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 11,
      name: 'rust',
      color: '#F99B4A',
    });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { body: { name: 'fail' } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al crear tag' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// remove
// ══════════════════════════════════════════════════════════════════════════════

describe('tags.controller - remove', () => {
  it('should return 404 if tag is not found', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const req = { params: { id: '999' } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tag no encontrado' });
  });

  it('should delete tag successfully', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = { params: { id: '1' } };
    const res = mockRes();

    await remove(req, res);

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM tags WHERE id = ?', ['1']);
    expect(res.json).toHaveBeenCalledWith({ message: 'Tag eliminado' });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '1' } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al eliminar tag' });
  });
});
