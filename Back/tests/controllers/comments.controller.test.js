jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');

jest.mock('../../utils/tree.utils', () => ({ buildTree: jest.fn() }));
const { buildTree } = require('../../utils/tree.utils');

const {
  getByPost,
  create,
  update,
  remove,
} = require('../../controllers/comments.controller');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.resetAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// getByPost
// ══════════════════════════════════════════════════════════════════════════════

describe('comments.controller - getByPost', () => {
  it('should return paginated comments with tree structure', async () => {
    const fakeRows = [
      { id: 1, post_id: 10, user_id: 2, content: 'Hello', parent_id: null, username: 'alice', avatar_url: null, vote_count: 3 },
      { id: 2, post_id: 10, user_id: 3, content: 'Reply', parent_id: 1, username: 'bob', avatar_url: null, vote_count: 1 },
    ];
    const nested = [{ ...fakeRows[0], replies: [fakeRows[1]] }];

    pool.query
      .mockResolvedValueOnce([fakeRows])          // SELECT comments
      .mockResolvedValueOnce([[{ total: 2 }]]);     // SELECT COUNT

    buildTree.mockReturnValue(nested);

    const req = { params: { postId: '10' }, query: {} };
    const res = mockRes();

    await getByPost(req, res);

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(buildTree).toHaveBeenCalledWith(fakeRows, null);
    expect(res.json).toHaveBeenCalledWith({
      data: nested,
      total: 2,
      page: 1,
      limit: 50,
      pages: 1,
    });
  });

  it('should use default pagination (page=1, limit=50)', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    buildTree.mockReturnValue([]);

    const req = { params: { postId: '5' }, query: {} };
    const res = mockRes();

    await getByPost(req, res);

    // LIMIT 50 OFFSET 0
    const selectCall = pool.query.mock.calls[0];
    expect(selectCall[0]).toContain('LIMIT ?');
    expect(selectCall[1]).toEqual(['5', 50, 0]);
  });

  it('should respect custom page and limit from query', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 100 }]]);

    buildTree.mockReturnValue([]);

    const req = { params: { postId: '5' }, query: { page: '3', limit: '10' } };
    const res = mockRes();

    await getByPost(req, res);

    // page 3, limit 10 => offset = (3-1)*10 = 20
    const selectCall = pool.query.mock.calls[0];
    expect(selectCall[1]).toEqual(['5', 10, 20]);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, limit: 10, pages: 10 })
    );
  });

  it('should clamp limit to max 200 and min 1', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    buildTree.mockReturnValue([]);

    const req = { params: { postId: '5' }, query: { page: '1', limit: '500' } };
    const res = mockRes();

    await getByPost(req, res);

    const selectCall = pool.query.mock.calls[0];
    expect(selectCall[1][1]).toBe(200); // clamped to 200
  });

  it('should calculate correct pages count', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 55 }]]);

    buildTree.mockReturnValue([]);

    const req = { params: { postId: '5' }, query: { page: '1', limit: '50' } };
    const res = mockRes();

    await getByPost(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ pages: 2 }) // ceil(55/50) = 2
    );
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { postId: '5' }, query: {} };
    const res = mockRes();

    await getByPost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener comentarios' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// create
// ══════════════════════════════════════════════════════════════════════════════

describe('comments.controller - create', () => {
  it('should return 400 if content is missing', async () => {
    const req = { params: { postId: '10' }, body: {}, user: { id: 1 } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El contenido es obligatorio' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should return 404 if post does not exist', async () => {
    pool.query.mockResolvedValueOnce([[]]); // SELECT id FROM posts

    const req = { params: { postId: '999' }, body: { content: 'Hi' }, user: { id: 1 } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  it('should create comment and return 201', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])          // post exists
      .mockResolvedValueOnce([{ insertId: 42 }]);     // INSERT comment

    const req = { params: { postId: '10' }, body: { content: 'Great post!' }, user: { id: 5 } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 42,
      post_id: 10,
      content: 'Great post!',
      parent_id: undefined,
    });
  });

  it('should create comment with parent_id when provided', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])             // post exists
      .mockResolvedValueOnce([[{ id: 7 }]])              // parent comment belongs to post
      .mockResolvedValueOnce([{ insertId: 43 }]);        // INSERT comment

    const req = { params: { postId: '10' }, body: { content: 'Reply', parent_id: 7 }, user: { id: 5 } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: 7 })
    );

    const insertCall = pool.query.mock.calls[2];
    expect(insertCall[1]).toEqual(['10', 5, 'Reply', 7]);
  });

  it('should send null parent_id when not provided', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([{ insertId: 44 }]);

    const req = { params: { postId: '10' }, body: { content: 'Top-level comment' }, user: { id: 3 } };
    const res = mockRes();

    await create(req, res);

    const insertCall = pool.query.mock.calls[1];
    expect(insertCall[1][3]).toBeNull();
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { postId: '10' }, body: { content: 'Hi' }, user: { id: 1 } };
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al crear comentario' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// update
// ══════════════════════════════════════════════════════════════════════════════

describe('comments.controller - update', () => {
  it('should return 404 if comment is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { params: { id: '999' }, body: { content: 'Edit' }, user: { id: 1, role: 'alumno' } };
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Comentario no encontrado' });
  });

  it('should return 403 if user is not the owner and not admin', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 10 }]]);

    const req = { params: { id: '1' }, body: { content: 'Edit' }, user: { id: 5, role: 'alumno' } };
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tenés permiso para editar este comentario' });
  });

  it('should allow admin to edit any comment', async () => {
    pool.query
      .mockResolvedValueOnce([[{ user_id: 10 }]])     // SELECT user_id
      .mockResolvedValueOnce([{}]);                     // UPDATE

    const req = { params: { id: '1' }, body: { content: 'Admin edit' }, user: { id: 1, role: 'admin' } };
    const res = mockRes();

    await update(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Comentario actualizado' });
  });

  it('should allow owner to edit their own comment', async () => {
    pool.query
      .mockResolvedValueOnce([[{ user_id: 5 }]])
      .mockResolvedValueOnce([{}]);

    const req = { params: { id: '1' }, body: { content: 'My edit' }, user: { id: 5, role: 'alumno' } };
    const res = mockRes();

    await update(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Comentario actualizado' });
  });

  it('should return 400 if content is missing', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 5 }]]);

    const req = { params: { id: '1' }, body: {}, user: { id: 5, role: 'alumno' } };
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El contenido es obligatorio' });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '1' }, body: { content: 'Edit' }, user: { id: 1, role: 'admin' } };
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al actualizar comentario' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// remove
// ══════════════════════════════════════════════════════════════════════════════

describe('comments.controller - remove', () => {
  it('should return 404 if comment is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { params: { id: '999' }, user: { id: 1, role: 'alumno' } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Comentario no encontrado' });
  });

  it('should return 403 if user is not the owner and not admin', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 10 }]]);

    const req = { params: { id: '1' }, user: { id: 5, role: 'alumno' } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tenés permiso para eliminar este comentario' });
  });

  it('should allow admin to delete any comment', async () => {
    pool.query
      .mockResolvedValueOnce([[{ user_id: 10 }]])
      .mockResolvedValueOnce([{}]);

    const req = { params: { id: '1' }, user: { id: 1, role: 'admin' } };
    const res = mockRes();

    await remove(req, res);

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM comments WHERE id = ?', ['1']);
    expect(res.json).toHaveBeenCalledWith({ message: 'Comentario eliminado' });
  });

  it('should allow owner to delete their own comment', async () => {
    pool.query
      .mockResolvedValueOnce([[{ user_id: 5 }]])
      .mockResolvedValueOnce([{}]);

    const req = { params: { id: '1' }, user: { id: 5, role: 'alumno' } };
    const res = mockRes();

    await remove(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Comentario eliminado' });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '1' }, user: { id: 1, role: 'admin' } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al eliminar comentario' });
  });
});
