const pool = require('../../db/connection');
const { saveTags, getTagsByPostIds } = require('../../utils/post.utils');
const {
  getAll,
  getById,
  create,
  update,
  remove,
  uploadImage
} = require('../../controllers/posts.controller');

jest.mock('../../db/connection', () => ({ query: jest.fn() }));
jest.mock('../../utils/post.utils', () => ({
  saveTags: jest.fn(),
  getTagsByPostIds: jest.fn().mockResolvedValue({})
}));
jest.mock('../../utils/response.utils', () => ({
  sendError: jest.fn((res, _err, message) => res.status(500).json({ error: message }))
}));

// ─── Helpers ────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1, role: 'alumno' },
    file: null,
    ...overrides
  };
}

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  // Re-establish default mock implementations after resetAllMocks clears them
  pool.query.mockResolvedValue([]);
  getTagsByPostIds.mockResolvedValue({});
  const { sendError } = require('../../utils/response.utils');
  sendError.mockImplementation((res, _err, message) => res.status(500).json({ error: message }));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

// ══════════════════════════════════════════════════════════════════════════
// getAll
// ══════════════════════════════════════════════════════════════════════════
describe('getAll', () => {
  const sampleRow = {
    id: 1,
    title: 'Test Post',
    content: 'Content here',
    category_id: 5,
    user_id: 1,
    username: 'john',
    avatar_url: null,
    category_name: 'General',
    vote_count: 3,
    comment_count: 2,
    created_at: '2026-01-01'
  };

  function setupPool(rows = [sampleRow], total = 1) {
    pool.query
      .mockResolvedValueOnce([rows])         // main query  → [rows, fields]
      .mockResolvedValueOnce([[{ total }]]); // count query → [rows, fields]
  }

  test('returns posts with default params', async () => {
    const req = mockReq();
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
        pages: 1
      })
    );
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('applies category_id filter', async () => {
    const req = mockReq({ query: { category_id: '5' } });
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    const mainCall = pool.query.mock.calls[0];
    expect(mainCall[0]).toContain('p.category_id = ?');
    expect(mainCall[1]).toContain('5');
  });

  test('applies tag_id filter', async () => {
    const req = mockReq({ query: { tag_id: '3' } });
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    const mainCall = pool.query.mock.calls[0];
    expect(mainCall[0]).toContain('post_tags WHERE tag_id = ?');
    expect(mainCall[1]).toContain('3');
  });

  test('applies search query (q) filter', async () => {
    const req = mockReq({ query: { q: 'javascript' } });
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    const mainCall = pool.query.mock.calls[0];
    expect(mainCall[0]).toContain('p.title LIKE ?');
    expect(mainCall[1]).toContain('%javascript%');
  });

  test('sorts by votes when sort=votes', async () => {
    const req = mockReq({ query: { sort: 'votes' } });
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    const mainCall = pool.query.mock.calls[0];
    expect(mainCall[0]).toContain('ORDER BY vote_count DESC');
  });

  test('sorts by recent (default) when sort is not votes', async () => {
    const req = mockReq({ query: { sort: 'recent' } });
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    const mainCall = pool.query.mock.calls[0];
    expect(mainCall[0]).toContain('ORDER BY p.created_at DESC');
    expect(mainCall[0]).not.toContain('vote_count DESC');
  });

  test('handles pagination with custom page and limit', async () => {
    const req = mockReq({ query: { page: '3', limit: '10' } });
    const res = mockRes();
    setupPool([sampleRow], 50);

    await getAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 3,
        limit: 10,
        pages: 5
      })
    );

    const mainCall = pool.query.mock.calls[0];
    // offset = (3-1)*10 = 20
    expect(mainCall[1]).toContain(10);  // limit
    expect(mainCall[1]).toContain(20);  // offset
  });

  test('clamps limit to minimum 1 when 0 is provided', async () => {
    const req = mockReq({ query: { limit: '0' } });
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 })
    );
  });

  test('clamps limit to maximum 100', async () => {
    const req = mockReq({ query: { limit: '999' } });
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });

  test('combines multiple filters', async () => {
    const req = mockReq({ query: { category_id: '2', tag_id: '7', q: 'react' } });
    const res = mockRes();
    setupPool();

    await getAll(req, res);

    const mainCall = pool.query.mock.calls[0];
    expect(mainCall[0]).toContain('p.category_id = ?');
    expect(mainCall[0]).toContain('post_tags WHERE tag_id = ?');
    expect(mainCall[0]).toContain('p.title LIKE ?');
  });

  test('attaches tags from getTagsByPostIds to each post', async () => {
    getTagsByPostIds.mockResolvedValueOnce({ 1: [{ id: 10, name: 'js' }] });

    const req = mockReq();
    const res = mockRes();
    setupPool([sampleRow], 1);

    await getAll(req, res);

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.data[0].tags).toEqual([{ id: 10, name: 'js' }]);
  });

  test('returns empty tags array when getTagsByPostIds has no match', async () => {
    getTagsByPostIds.mockResolvedValueOnce({});

    const req = mockReq();
    const res = mockRes();
    setupPool([sampleRow], 1);

    await getAll(req, res);

    expect(res.json.mock.calls[0][0].data[0].tags).toEqual([]);
  });

  test('returns 500 on database error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq();
    const res = mockRes();

    await getAll(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener posts' });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// getById
// ══════════════════════════════════════════════════════════════════════════
describe('getById', () => {
  const samplePost = {
    id: 42,
    title: 'My Post',
    content: 'Body text',
    category_id: 3,
    user_id: 1,
    username: 'alice',
    avatar_url: null,
    category_name: 'Science',
    vote_count: 10
  };

  test('returns 404 when post is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await getById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  test('returns post with tags when found', async () => {
    pool.query.mockResolvedValueOnce([[samplePost]]);
    getTagsByPostIds.mockResolvedValueOnce({ 42: [{ id: 1, name: 'physics' }] });

    const req = mockReq({ params: { id: '42' } });
    const res = mockRes();

    await getById(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        title: 'My Post',
        tags: [{ id: 1, name: 'physics' }]
      })
    );
    expect(getTagsByPostIds).toHaveBeenCalledWith([42]);
  });

  test('returns empty tags array when no tags match', async () => {
    pool.query.mockResolvedValueOnce([[samplePost]]);
    getTagsByPostIds.mockResolvedValueOnce({});

    const req = mockReq({ params: { id: '42' } });
    const res = mockRes();

    await getById(req, res);

    expect(res.json.mock.calls[0][0].tags).toEqual([]);
  });

  test('returns 500 on database error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await getById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener post' });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// create
// ══════════════════════════════════════════════════════════════════════════
describe('create', () => {
  test('returns 400 when title is missing', async () => {
    const req = mockReq({ body: { content: 'Body', category_id: 1 } });
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Faltan campos obligatorios') })
    );
  });

  test('returns 400 when content is missing', async () => {
    const req = mockReq({ body: { title: 'Title', category_id: 1 } });
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when category_id is missing', async () => {
    const req = mockReq({ body: { title: 'Title', content: 'Body' } });
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('creates post successfully without tags', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 2 }]])   // category exists check
      .mockResolvedValueOnce([{ insertId: 10 }]); // INSERT
    const req = mockReq({
      body: { title: 'New Post', content: 'Content', category_id: 2 }
    });
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 10,
      title: 'New Post',
      content: 'Content',
      category_id: 2,
      image_url: null
    });
    expect(saveTags).not.toHaveBeenCalled();
  });

  test('creates post successfully with tags', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 3 }]])   // category exists check
      .mockResolvedValueOnce([{ insertId: 11 }]); // INSERT
    const req = mockReq({
      body: { title: 'Tagged Post', content: 'Body', category_id: 3, tag_ids: [1, 2] }
    });
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(saveTags).toHaveBeenCalledWith(11, [1, 2]);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 11 })
    );
  });

  test('does not call saveTags when tag_ids is empty array', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])   // category exists check
      .mockResolvedValueOnce([{ insertId: 12 }]); // INSERT
    const req = mockReq({
      body: { title: 'Post', content: 'Body', category_id: 1, tag_ids: [] }
    });
    const res = mockRes();

    await create(req, res);

    expect(saveTags).not.toHaveBeenCalled();
  });

  test('includes image_url in response when provided', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])   // category exists check
      .mockResolvedValueOnce([{ insertId: 13 }]); // INSERT
    const req = mockReq({
      body: {
        title: 'Post',
        content: 'Body',
        category_id: 1,
        image_url: 'https://example.com/img.png'
      }
    });
    const res = mockRes();

    await create(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ image_url: 'https://example.com/img.png' })
    );
  });

  test('passes user_id from req.user into the INSERT query', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])   // category exists check
      .mockResolvedValueOnce([{ insertId: 14 }]); // INSERT
    const req = mockReq({
      user: { id: 7, role: 'alumno' },
      body: { title: 'User Post', content: 'Body', category_id: 1 }
    });
    const res = mockRes();

    await create(req, res);

    const insertCall = pool.query.mock.calls[1]; // INSERT is now the second call
    expect(insertCall[1]).toContain(7); // user_id
  });

  test('returns 500 on database error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({
      body: { title: 'Post', content: 'Body', category_id: 1 }
    });
    const res = mockRes();

    await create(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al crear post' });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// update
// ══════════════════════════════════════════════════════════════════════════
describe('update', () => {
  test('returns 404 when post does not exist', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { id: '999' }, body: { title: 'X' } });
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  test('returns 403 when user is not owner and not admin', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 2 }]]);
    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: { title: 'Hacked' }
    });
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tenés permiso para editar este post' });
  });

  test('allows admin to edit any post', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 99 }]]);
    pool.query.mockResolvedValueOnce([]); // UPDATE query
    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'admin' },
      body: { title: 'Admin Edit' }
    });
    const res = mockRes();

    await update(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Post actualizado' });
  });

  test('allows owner to edit their own post', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 1 }]]);
    pool.query.mockResolvedValueOnce([]);
    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: { title: 'My Edit' }
    });
    const res = mockRes();

    await update(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Post actualizado' });
  });

  test('returns 400 when no fields to update and no tag_ids', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 1 }]]);
    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: {}
    });
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No hay campos para actualizar' });
  });

  test('updates title and content fields', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 1 }]]);
    pool.query.mockResolvedValueOnce([]);
    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: { title: 'New Title', content: 'New Content' }
    });
    const res = mockRes();

    await update(req, res);

    const updateCall = pool.query.mock.calls[1];
    expect(updateCall[0]).toContain('title = ?');
    expect(updateCall[0]).toContain('content = ?');
    expect(updateCall[1]).toContain('New Title');
    expect(updateCall[1]).toContain('New Content');
    expect(updateCall[1]).toContain('10'); // id
  });

  test('updates tags when tag_ids is provided', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 1 }]]);
    // No text fields updated, so UPDATE query is skipped
    pool.query.mockResolvedValueOnce([]); // DELETE from post_tags
    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: { tag_ids: [5, 6] }
    });
    const res = mockRes();

    await update(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM post_tags WHERE post_id = ?',
      ['10']
    );
    expect(saveTags).toHaveBeenCalledWith('10', [5, 6]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Post actualizado' });
  });

  test('clears all tags when tag_ids is empty array', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 1 }]]);
    pool.query.mockResolvedValueOnce([]); // DELETE from post_tags
    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: { tag_ids: [] }
    });
    const res = mockRes();

    await update(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM post_tags WHERE post_id = ?',
      ['10']
    );
    expect(saveTags).not.toHaveBeenCalled();
  });

  test('allows update with only tag_ids and no text fields', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 1 }]]);
    pool.query.mockResolvedValueOnce([]); // DELETE
    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: { tag_ids: [3] }
    });
    const res = mockRes();

    await update(req, res);

    // Only 2 pool.query calls: SELECT existing + DELETE post_tags (no UPDATE)
    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ message: 'Post actualizado' });
  });

  test('returns 500 on database error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' }, body: { title: 'X' } });
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al actualizar post' });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// remove
// ══════════════════════════════════════════════════════════════════════════
describe('remove', () => {
  test('returns 404 when post does not exist', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  test('returns 403 when user is not owner and not admin', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 5 }]]);
    const req = mockReq({
      params: { id: '20' },
      user: { id: 1, role: 'alumno' }
    });
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tenés permiso para eliminar este post' });
  });

  test('allows admin to delete any post', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 99 }]]);
    pool.query.mockResolvedValueOnce([]); // DELETE query
    const req = mockReq({
      params: { id: '20' },
      user: { id: 1, role: 'admin' }
    });
    const res = mockRes();

    await remove(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Post eliminado' });
  });

  test('allows owner to delete their own post', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 3 }]]);
    pool.query.mockResolvedValueOnce([]); // DELETE query
    const req = mockReq({
      params: { id: '30' },
      user: { id: 3, role: 'alumno' }
    });
    const res = mockRes();

    await remove(req, res);

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM posts WHERE id = ?', ['30']);
    expect(res.json).toHaveBeenCalledWith({ message: 'Post eliminado' });
  });

  test('returns 500 on database error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al eliminar post' });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// uploadImage
// ══════════════════════════════════════════════════════════════════════════
describe('uploadImage', () => {
  test('returns 400 when no file is uploaded', async () => {
    const req = mockReq({ file: null });
    const res = mockRes();

    await uploadImage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No se envió ningún archivo' });
  });

  test('returns 400 when req.file is undefined', async () => {
    const req = mockReq();
    delete req.file;
    const res = mockRes();

    await uploadImage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No se envió ningún archivo' });
  });

  test('returns image_url on successful upload', async () => {
    const req = mockReq({ file: { filename: 'abc123.jpg' } });
    const res = mockRes();

    await uploadImage(req, res);

    expect(res.json).toHaveBeenCalledWith({ image_url: '/uploads/posts/abc123.jpg' });
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('returns 500 on unexpected error', async () => {
    const req = mockReq();
    Object.defineProperty(req, 'file', {
      get() { throw new Error('Unexpected'); },
      configurable: true
    });
    const res = mockRes();

    await uploadImage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al subir imagen' });
  });
});
