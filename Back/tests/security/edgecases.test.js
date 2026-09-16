// ══════════════════════════════════════════════════════════════════════════════
// Comprehensive Edge Case & Integration Tests
// ══════════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));
const bcrypt = require('bcrypt');

jest.mock('../../utils/mailer', () => ({ sendMail: jest.fn() }));
const { sendMail } = require('../../utils/mailer');

jest.mock('../../utils/post.utils', () => ({
  saveTags: jest.fn(),
  getTagsByPostIds: jest.fn().mockResolvedValue({})
}));
const { saveTags, getTagsByPostIds } = require('../../utils/post.utils');

jest.mock('../../utils/response.utils', () => ({
  sendError: jest.fn((res, _err, message, status = 500) => {
    res.status(status).json({ error: message });
  })
}));
const { sendError } = require('../../utils/response.utils');

// Controllers
const { getAll: postsGetAll, getById: postsGetById, create: postsCreate, update: postsUpdate, remove: postsRemove } = require('../../controllers/posts.controller');
const { getByPost, create: commentsCreate, update: commentsUpdate, remove: commentsRemove } = require('../../controllers/comments.controller');
const { votePost, voteComment } = require('../../controllers/votes.controller');
const { getAll: catsGetAll, getById: catsGetById, create: catsCreate, update: catsUpdate, remove: catsRemove } = require('../../controllers/categories.controller');
const { getAll: tagsGetAll, create: tagsCreate, remove: tagsRemove } = require('../../controllers/tags.controller');
const { getAll: usersGetAll, getById: usersGetById, update: usersUpdate, remove: usersRemove } = require('../../controllers/users.controller');
const { banUser, unbanUser } = require('../../controllers/bans.controller');
const { register, login, updateProfile, forgotPassword, deleteAccount } = require('../../controllers/auth.controller');
const { createReport, getReportCounts, resolveReport } = require('../../controllers/reports.controller');
const { getDashboard } = require('../../controllers/admin.controller');

// Middleware
const auth = require('../../middleware/auth');
const checkBan = require('../../middleware/ban');
const role = require('../../middleware/role');

// Utils
const { buildTree } = require('../../utils/tree.utils');

const JWT_SECRET = 'test_secret';

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue([]);
  getTagsByPostIds.mockResolvedValue({});
  saveTags.mockResolvedValue();
  sendMail.mockResolvedValue(true);
  sendError.mockImplementation((res, _err, message, status = 500) => {
    res.status(status).json({ error: message });
  });
  bcrypt.hash.mockResolvedValue('hashed_pw');
  bcrypt.compare.mockResolvedValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1, role: 'alumno' },
    headers: {},
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

function makeToken(payload = {}) {
  return jwt.sign(
    { id: 1, username: 'testuser', role: 'alumno', token_version: 1, ...payload },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. POSTS CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Posts Controller Edge Cases', () => {
  const sampleRow = {
    id: 1, title: 'Test Post', content: 'Content', category_id: 5,
    user_id: 1, username: 'john', avatar_url: null, category_name: 'General',
    vote_count: 3, comment_count: 2, created_at: '2026-01-01'
  };

  function setupPool(rows = [sampleRow], total = 1) {
    pool.query
      .mockResolvedValueOnce([rows])
      .mockResolvedValueOnce([[{ total }]]);
  }

  // 1. getAll with no query params (default behavior)
  test('1. getAll with no query params returns defaults', async () => {
    const req = mockReq();
    const res = mockRes();
    setupPool();

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, pages: 1 })
    );
  });

  // 2. getAll with page=0 (should be treated as page=1 via Math.max)
  test('2. getAll with page=0 treated as page=1', async () => {
    const req = mockReq({ query: { page: '0' } });
    const res = mockRes();
    setupPool();

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  // 3. getAll with page=-5 (should be treated as page=1)
  test('3. getAll with page=-5 treated as page=1', async () => {
    const req = mockReq({ query: { page: '-5' } });
    const res = mockRes();
    setupPool();

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
  });

  // 4. getAll with limit=0 (should be treated as limit=1)
  test('4. getAll with limit=0 treated as limit=1', async () => {
    const req = mockReq({ query: { limit: '0' } });
    const res = mockRes();
    setupPool();

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1 })
    );
  });

  // 5. getAll with limit=999 (should be capped at 100)
  test('5. getAll with limit=999 capped at 100', async () => {
    const req = mockReq({ query: { limit: '999' } });
    const res = mockRes();
    setupPool();

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });

  // 6. getAll with limit=1000 (should be capped at 100)
  test('6. getAll with limit=1000 capped at 100', async () => {
    const req = mockReq({ query: { limit: '1000' } });
    const res = mockRes();
    setupPool();

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });

  // 7. getAll with sort='invalid' (should default to recent)
  test('7. getAll with sort=invalid defaults to recent', async () => {
    const req = mockReq({ query: { sort: 'invalid' } });
    const res = mockRes();
    setupPool();

    await postsGetAll(req, res);

    const mainCall = pool.query.mock.calls[0];
    expect(mainCall[0]).toContain('ORDER BY p.created_at DESC');
    expect(mainCall[0]).not.toContain('vote_count DESC');
  });

  // 8. getAll returning empty results (no posts match)
  test('8. getAll returning empty results', async () => {
    const req = mockReq();
    const res = mockRes();
    setupPool([], 0);

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [], total: 0, pages: 0 })
    );
  });

  // 9. getAll with tag_id that matches no posts
  test('9. getAll with tag_id matching no posts', async () => {
    const req = mockReq({ query: { tag_id: '999' } });
    const res = mockRes();
    setupPool([], 0);

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [], total: 0 })
    );
  });

  // 10. getAll with category_id that doesn't exist
  test('10. getAll with category_id that does not exist', async () => {
    const req = mockReq({ query: { category_id: '99999' } });
    const res = mockRes();
    setupPool([], 0);

    await postsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [], total: 0 })
    );
  });

  // 11. create with title and content at exact max lengths (200 and 10000)
  test('11. create with title=200 chars and content=10000 chars succeeds', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{ insertId: 20 }]);

    const req = mockReq({
      body: {
        title: 'A'.repeat(200),
        content: 'B'.repeat(10000),
        category_id: 1
      }
    });
    const res = mockRes();

    await postsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 20 })
    );
  });

  // 12. create with empty title (should fail)
  test('12. create with empty title returns 400', async () => {
    const req = mockReq({ body: { title: '', content: 'Body', category_id: 1 } });
    const res = mockRes();

    await postsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // 13. create with empty content (should fail)
  test('13. create with empty content returns 400', async () => {
    const req = mockReq({ body: { title: 'Title', content: '', category_id: 1 } });
    const res = mockRes();

    await postsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // 14. create with category_id that doesn't exist in DB
  test('14. create with nonexistent category_id returns 400', async () => {
    pool.query.mockResolvedValueOnce([[]]); // category check returns empty

    const req = mockReq({
      body: { title: 'Title', content: 'Content', category_id: 99999 }
    });
    const res = mockRes();

    await postsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('categoría') })
    );
  });

  // 15. create with non-array tag_ids (string truthy but not array — controller still calls saveTags)
  test('15. create with non-array tag_ids still creates post (no crash)', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{ insertId: 21 }]);

    const req = mockReq({
      body: { title: 'Title', content: 'Content', category_id: 1, tag_ids: 'not_an_array' }
    });
    const res = mockRes();

    await postsCreate(req, res);

    // Controller uses tag_ids.length > 0 which is truthy for strings, so saveTags is called
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 21 }));
  });

  // 16. update by non-owner non-admin (should get 403)
  test('16. update by non-owner non-admin returns 403', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 5 }]]);

    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: { title: 'Hacked' }
    });
    const res = mockRes();

    await postsUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('permiso') })
    );
  });

  // 17. update nonexistent post (should get 404)
  test('17. update nonexistent post returns 404', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = mockReq({ params: { id: '999' }, body: { title: 'X' } });
    const res = mockRes();

    await postsUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  // 18. remove nonexistent post (should get 404)
  test('18. remove nonexistent post returns 404', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await postsRemove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  // 19. getById with non-numeric id (NaN handling)
  test('19. getById with non-numeric id returns 404', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = mockReq({ params: { id: 'abc' } });
    const res = mockRes();

    await postsGetById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. COMMENTS CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Comments Controller Edge Cases', () => {
  // 20. getByPost with empty results
  test('20. getByPost with empty results', async () => {
    pool.query
      .mockResolvedValueOnce([[]])    // comments query
      .mockResolvedValueOnce([[{ total: 0 }]]); // count query

    const req = mockReq({ params: { postId: '1' } });
    const res = mockRes();

    await getByPost(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [], total: 0 })
    );
  });

  // 21. getByPost with page=1, limit=200 (max)
  test('21. getByPost with limit=200 (max allowed)', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    const req = mockReq({ params: { postId: '1' }, query: { page: '1', limit: '200' } });
    const res = mockRes();

    await getByPost(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 })
    );
  });

  // 22. getByPost with limit=201 (should be capped at 200)
  test('22. getByPost with limit=201 capped at 200', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    const req = mockReq({ params: { postId: '1' }, query: { limit: '201' } });
    const res = mockRes();

    await getByPost(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 })
    );
  });

  // 23. create with parent_id pointing to comment in DIFFERENT post
  test('23. create with parent_id in different post returns 400', async () => {
    // First query: post exists
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
    // Second query: parent comment exists but in different post
    pool.query.mockResolvedValueOnce([[]]);

    const req = mockReq({
      params: { postId: '1' },
      user: { id: 1 },
      body: { content: 'Reply', parent_id: 55 }
    });
    const res = mockRes();

    await commentsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('padre') })
    );
  });

  // 24. create with parent_id of 0 (falsy in JS — treated as no parent, comment is created)
  test('24. create with parent_id=0 creates comment (0 is falsy, skipped as no parent)', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);  // post exists
    pool.query.mockResolvedValueOnce([{ insertId: 40 }]); // insert (parent_id=0 is falsy, skip parent check)

    const req = mockReq({
      params: { postId: '1' },
      user: { id: 1 },
      body: { content: 'Reply', parent_id: 0 }
    });
    const res = mockRes();

    await commentsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 40 })
    );
  });

  // 25. create with content at exact max (5000)
  test('25. create with content at exact max 5000 chars succeeds', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);  // post exists
    pool.query.mockResolvedValueOnce([{ insertId: 30 }]); // insert

    const req = mockReq({
      params: { postId: '1' },
      user: { id: 1 },
      body: { content: 'A'.repeat(5000) }
    });
    const res = mockRes();

    await commentsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 30 })
    );
  });

  // 26. update by non-owner (should get 403)
  test('26. update comment by non-owner returns 403', async () => {
    pool.query.mockResolvedValueOnce([[{ user_id: 5 }]]); // comment owner

    const req = mockReq({
      params: { id: '10' },
      user: { id: 1, role: 'alumno' },
      body: { content: 'Hacked' }
    });
    const res = mockRes();

    await commentsUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // 27. remove nonexistent comment (should get 404)
  test('27. remove nonexistent comment returns 404', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = mockReq({ params: { id: '999' }, user: { id: 1 } });
    const res = mockRes();

    await commentsRemove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Comentario no encontrado' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. VOTES CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Votes Controller Edge Cases', () => {
  // 28. votePost with value 1 (upvote)
  test('28. votePost with value 1 (upvote)', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])     // post exists
      .mockResolvedValueOnce([[]])               // no existing vote
      .mockResolvedValueOnce([{}])               // INSERT
      .mockResolvedValueOnce([[{ total: 1 }]]); // vote count

    const req = mockReq({ params: { id: '1' }, body: { value: 1 }, user: { id: 1 } });
    const res = mockRes();

    await votePost(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Voto registrado', vote_count: 1 })
    );
  });

  // 29. votePost with value -1 (downvote)
  test('29. votePost with value -1 (downvote)', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ total: -1 }]]);

    const req = mockReq({ params: { id: '1' }, body: { value: -1 }, user: { id: 1 } });
    const res = mockRes();

    await votePost(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Voto registrado', vote_count: -1 })
    );
  });

  // 30. votePost twice with same value (should remove vote)
  test('30. votePost twice with same value removes vote', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])     // post exists
      .mockResolvedValueOnce([[{ id: 10, value: 1 }]]) // existing same vote
      .mockResolvedValueOnce([{}])               // DELETE vote
      .mockResolvedValueOnce([[{ total: 0 }]]); // vote count

    const req = mockReq({ params: { id: '1' }, body: { value: 1 }, user: { id: 1 } });
    const res = mockRes();

    await votePost(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Voto eliminado', vote_count: 0 })
    );
  });

  // 31. votePost with value=1 then value=-1 (should update)
  test('31. votePost updates existing vote from 1 to -1', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]])           // post exists
      .mockResolvedValueOnce([[{ id: 10, value: 1 }]]) // existing upvote
      .mockResolvedValueOnce([{}])                      // UPDATE vote to -1
      .mockResolvedValueOnce([[{ total: -1 }]]);       // vote count

    const req = mockReq({ params: { id: '1' }, body: { value: -1 }, user: { id: 1 } });
    const res = mockRes();

    await votePost(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Voto registrado', vote_count: -1 })
    );
  });

  // 32. votePost on nonexistent post (should get 404)
  test('32. votePost on nonexistent post returns 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // post not found

    const req = mockReq({ params: { id: '999' }, body: { value: 1 }, user: { id: 1 } });
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  // 33. voteComment on nonexistent comment (should get 404)
  test('33. voteComment on nonexistent comment returns 404', async () => {
    pool.query.mockResolvedValueOnce([[]]); // comment not found

    const req = mockReq({ params: { id: '999' }, body: { value: 1 }, user: { id: 1 } });
    const res = mockRes();

    await voteComment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Comentario no encontrado' });
  });

  // 34. votePost with value=0 (should fail)
  test('34. votePost with value=0 returns 400', async () => {
    const req = mockReq({ params: { id: '1' }, body: { value: 0 }, user: { id: 1 } });
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El valor debe ser 1 o -1' });
  });

  // 35. votePost with value=3 (should fail)
  test('35. votePost with value=3 returns 400', async () => {
    const req = mockReq({ params: { id: '1' }, body: { value: 3 }, user: { id: 1 } });
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El valor debe ser 1 o -1' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. CATEGORIES CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Categories Controller Edge Cases', () => {
  // 36. getAll with no categories (empty)
  test('36. getAll with no categories returns empty array', async () => {
    pool.query.mockResolvedValueOnce([[]]); // no root categories

    const req = mockReq();
    const res = mockRes();

    await catsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  // 37. getAll with categories having subcategories
  test('37. getAll with categories having subcategories', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1, name: 'Cat1', parent_id: null }]])
      .mockResolvedValueOnce([[{ id: 2, name: 'Sub1', description: 'desc' }]]);

    const req = mockReq();
    const res = mockRes();

    await catsGetAll(req, res);

    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 1,
        name: 'Cat1',
        subcategories: [{ id: 2, name: 'Sub1', description: 'desc' }]
      })
    ]);
  });

  // 38. getById nonexistent (should get 404)
  test('38. getById nonexistent returns 404', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await catsGetById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
  });

  // 39. create with empty name (should fail)
  test('39. create with empty name returns 400', async () => {
    const req = mockReq({ body: { name: '' } });
    const res = mockRes();

    await catsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El nombre es obligatorio' });
  });

  // 40. create with name at max length (100)
  test('40. create with name at max length 100 succeeds', async () => {
    pool.query.mockResolvedValueOnce([{ insertId: 10 }]);

    const req = mockReq({ body: { name: 'A'.repeat(100) } });
    const res = mockRes();

    await catsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10 })
    );
  });

  // 41. update with empty fields (should get 400)
  test('41. update with empty fields returns 400', async () => {
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();

    await catsUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No hay campos para actualizar' });
  });

  // 42. remove nonexistent (should get 404)
  test('42. remove nonexistent returns 404', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await catsRemove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Categoría no encontrada' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. TAGS CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Tags Controller Edge Cases', () => {
  // 43. getAll returns tags ordered by name
  test('43. getAll returns tags ordered by name', async () => {
    pool.query.mockResolvedValueOnce([
      [{ id: 2, name: 'beta' }, { id: 1, name: 'alpha' }]
    ]);

    const req = mockReq();
    const res = mockRes();

    await tagsGetAll(req, res);

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM tags ORDER BY name');
    expect(res.json).toHaveBeenCalledWith([
      { id: 2, name: 'beta' },
      { id: 1, name: 'alpha' }
    ]);
  });

  // 44. create duplicate tag name (should get 409)
  test('44. create duplicate tag name returns 409', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // tag exists

    const req = mockReq({ body: { name: 'javascript', color: '#FF0000' } });
    const res = mockRes();

    await tagsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'El tag ya existe' });
  });

  // 45. create with invalid color format (should fail)
  test('45. create with invalid color format returns 400', async () => {
    const req = mockReq({ body: { name: 'newtag', color: 'not-a-color' } });
    const res = mockRes();

    await tagsCreate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('color') })
    );
  });

  // 46. remove nonexistent tag (should get 404)
  test('46. remove nonexistent tag returns 404', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await tagsRemove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tag no encontrado' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. USERS CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Users Controller Edge Cases', () => {
  const sampleUser = {
    id: 10, username: 'alice', email: 'alice@test.com',
    avatar_url: null, role: 'alumno', first_name: 'Alice',
    last_name: 'A', age: 20, commission: 'A', career: 'CS',
    gender: 'F', bio: 'Hi', created_at: '2026-01-01'
  };

  // 47. getById hides email from non-own/non-admin
  test('47. getById hides email from non-own non-admin', async () => {
    pool.query.mockResolvedValueOnce([[{ ...sampleUser }]]);

    const req = mockReq({ params: { id: '10' }, user: { id: 1, role: 'alumno' } });
    const res = mockRes();

    await usersGetById(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.email).toBeUndefined();
  });

  // 48. getById returns email for own profile
  test('48. getById returns email for own profile', async () => {
    pool.query.mockResolvedValueOnce([[{ ...sampleUser }]]);

    const req = mockReq({ params: { id: '10' }, user: { id: 10, role: 'alumno' } });
    const res = mockRes();

    await usersGetById(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.email).toBe('alice@test.com');
  });

  // 49. update with invalid role_id (not in roles table)
  test('49. update with invalid role_id returns 400', async () => {
    pool.query.mockResolvedValueOnce([[]]); // role check returns empty

    const req = mockReq({
      params: { id: '1' },
      user: { id: 1, role: 'admin' },
      body: { role_id: 999 }
    });
    const res = mockRes();

    await usersUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El role_id no es válido' });
  });

  // 50. update with valid role_id
  test('50. update with valid role_id succeeds', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 2 }]]); // role check valid
    pool.query.mockResolvedValueOnce([{}]);            // UPDATE

    const req = mockReq({
      params: { id: '1' },
      user: { id: 1, role: 'admin' },
      body: { role_id: 2 }
    });
    const res = mockRes();

    await usersUpdate(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario actualizado' });
  });

  // 51. update with short username (should fail)
  test('51. update with short username returns 400', async () => {
    const req = mockReq({
      params: { id: '1' },
      user: { id: 1, role: 'admin' },
      body: { username: 'ab' }
    });
    const res = mockRes();

    await usersUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('username') })
    );
  });

  // 52. update with invalid email format (should fail)
  test('52. update with invalid email format returns 400', async () => {
    const req = mockReq({
      params: { id: '1' },
      user: { id: 1, role: 'admin' },
      body: { email: 'not-an-email' }
    });
    const res = mockRes();

    await usersUpdate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('email') })
    );
  });

  // 53. remove nonexistent user (should get 404)
  test('53. remove nonexistent user returns 404', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();

    await usersRemove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. BANS CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Bans Controller Edge Cases', () => {
  // 54. banUser with duration_hours=0 (should fail)
  test('54. banUser with duration_hours=0 returns 400', async () => {
    const req = mockReq({
      body: { user_id: 2, reason: 'Spam', type: 'temporary', duration_hours: 0 },
      user: { id: 1 }
    });
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // 55. banUser with duration_hours=-1 (should fail)
  test('55. banUser with duration_hours=-1 returns 400', async () => {
    const req = mockReq({
      body: { user_id: 2, reason: 'Spam', type: 'temporary', duration_hours: -1 },
      user: { id: 1 }
    });
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // 56. banUser with duration_hours=1.5 (should fail, not integer)
  test('56. banUser with duration_hours=1.5 returns 400', async () => {
    const req = mockReq({
      body: { user_id: 2, reason: 'Spam', type: 'temporary', duration_hours: 1.5 },
      user: { id: 1 }
    });
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // 57. banUser on admin (should fail)
  test('57. banUser on admin returns 403', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, role_id: 1 }]]); // admin user

    const req = mockReq({
      body: { user_id: 1, reason: 'Bad', type: 'permanent' },
      user: { id: 2 }
    });
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('administrador') })
    );
  });

  // 58. banUser on already-banned user (should get 409)
  test('58. banUser on already-banned user returns 409', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 2, role_id: 3 }]]) // user exists, not admin
      .mockResolvedValueOnce([[{ id: 10 }]]);           // active ban exists

    const req = mockReq({
      body: { user_id: 2, reason: 'Spam', type: 'permanent' },
      user: { id: 1 }
    });
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('baneado') })
    );
  });

  // 59. unbanUser not currently banned (should get 404)
  test('59. unbanUser not currently banned returns 404', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const req = mockReq({ body: { user_id: 5 } });
    const res = mockRes();

    await unbanUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('baneado') })
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. AUTH CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Auth Controller Edge Cases', () => {
  const validBody = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Passw0rd!',
    first_name: 'Test',
    last_name: 'User',
    age: 21,
    commission: 'A',
    career: 'CS',
    gender: 'M',
    bio: 'Hello'
  };

  // 60. register with username containing spaces (should fail)
  test('60. register with username containing spaces returns 400', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, username: 'user name' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('username') })
    );
  });

  // 61. register with username containing special chars like @, #, ! (should fail)
  test('61. register with username containing special chars returns 400', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, username: 'user@name' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // 62. register with username exactly 3 chars (should pass)
  test('62. register with username exactly 3 chars succeeds', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 10 }]);
    bcrypt.hash.mockResolvedValue('hashed_pw');

    await register({ body: { ...validBody, username: 'abc' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  // 63. register with unicode username (should fail - regex)
  test('63. register with unicode username returns 400', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, username: 'usérname' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // 64. login with non-existent email
  test('64. login with non-existent email returns 401', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);

    await login({ body: { email: 'nobody@test.com', password: 'Passw0rd!' } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
  });

  // 65. login with wrong password
  test('65. login with wrong password returns 401', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[{ id: 1, password_hash: 'hash', token_version: 1, role: 'alumno' }]]);
    bcrypt.compare.mockResolvedValue(false);

    await login({ body: { email: 'test@example.com', password: 'wrong' } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
  });

  // 66. updateProfile changing only email
  test('66. updateProfile changing only email succeeds', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[{ id: 1, username: 'testuser', email: 'old@test.com', password_hash: 'hash', token_version: 1 }]])
      .mockResolvedValueOnce([[]]) // email not taken
      .mockResolvedValueOnce([{}]) // UPDATE
      .mockResolvedValueOnce([[{ id: 1, username: 'testuser', email: 'new@test.com', role: 'alumno', token_version: 1, avatar_url: null, first_name: 'T', last_name: 'U', age: 21, commission: 'A', career: 'CS', gender: 'M', bio: 'Hi' }]]);

    await updateProfile({ body: { email: 'new@test.com' }, user: { id: 1 } }, res);

    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.token).toBeDefined();
  });

  // 67. updateProfile changing only username
  test('67. updateProfile changing only username succeeds', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[{ id: 1, username: 'oldname', email: 'test@test.com', password_hash: 'hash', token_version: 1 }]])
      .mockResolvedValueOnce([[]]) // username not taken
      .mockResolvedValueOnce([{}]) // UPDATE
      .mockResolvedValueOnce([[{ id: 1, username: 'newname', email: 'test@test.com', role: 'alumno', token_version: 1, avatar_url: null, first_name: 'T', last_name: 'U', age: 21, commission: 'A', career: 'CS', gender: 'M', bio: 'Hi' }]]);

    await updateProfile({ body: { username: 'newname' }, user: { id: 1 } }, res);

    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.token).toBeDefined();
  });

  // 68. updateProfile changing password without current_password (should fail)
  test('68. updateProfile changing password without current_password returns 400', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[{ id: 1, password_hash: 'hash' }]]);

    await updateProfile({ body: { new_password: 'NewPass1!' }, user: { id: 1 } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('contraseña actual') })
    );
  });

  // 69. forgotPassword with non-existent email (should not error, returns generic message)
  test('69. forgotPassword with non-existent email returns generic message', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);

    await forgotPassword({ body: { email: 'nobody@test.com' } }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Si el email está registrado') })
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  // 70. deleteAccount with wrong password
  test('70. deleteAccount with wrong password returns 401', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[{ id: 1, password_hash: 'hash', role_id: 3 }]]);
    bcrypt.compare.mockResolvedValue(false);

    await deleteAccount({ body: { password: 'wrong' }, user: { id: 1 } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña es incorrecta' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. REPORTS CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Reports Controller Edge Cases', () => {
  // 71. createReport with post_id
  test('71. createReport with post_id succeeds', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]]) // post exists
      .mockResolvedValueOnce([[]])           // no existing report
      .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT

    const req = mockReq({
      body: { post_id: 1, reason: 'spam' },
      user: { id: 2 }
    });
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('enviado') })
    );
  });

  // 72. createReport with comment_id
  test('72. createReport with comment_id succeeds', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]]) // comment exists
      .mockResolvedValueOnce([[]])           // no existing report
      .mockResolvedValueOnce([{ insertId: 2 }]); // INSERT

    const req = mockReq({
      body: { comment_id: 1, reason: 'abuso' },
      user: { id: 2 }
    });
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  // 73. createReport with both (should fail)
  test('73. createReport with both post_id and comment_id returns 400', async () => {
    const req = mockReq({
      body: { post_id: 1, comment_id: 1, reason: 'spam' },
      user: { id: 2 }
    });
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('no ambos') })
    );
  });

  // 74. createReport with neither (should fail)
  test('74. createReport with neither post_id nor comment_id returns 400', async () => {
    const req = mockReq({
      body: { reason: 'spam' },
      user: { id: 2 }
    });
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('post o comentario') })
    );
  });

  // 75. createReport with invalid reason
  test('75. createReport with invalid reason returns 400', async () => {
    const req = mockReq({
      body: { post_id: 1, reason: 'invalid_reason' },
      user: { id: 2 }
    });
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Razón inválida' });
  });

  // 76. createReport duplicate (same post, same reporter, pending)
  test('76. createReport duplicate returns 409', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1 }]]) // post exists
      .mockResolvedValueOnce([[{ id: 10 }]]); // existing report

    const req = mockReq({
      body: { post_id: 1, reason: 'spam' },
      user: { id: 2 }
    });
    const res = mockRes();

    await createReport(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  // 77. resolveReport that's already resolved
  test('77. resolveReport that is already resolved returns 400', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, status: 'resolved' }]]);

    const req = mockReq({ params: { id: '1' }, body: { action: 'resolved' }, user: { id: 1 } });
    const res = mockRes();

    await resolveReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('procesado') })
    );
  });

  // 78. getReportCounts returns correct counts
  test('78. getReportCounts returns correct counts', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 5 }]])  // pending
      .mockResolvedValueOnce([[{ total: 10 }]]) // resolved
      .mockResolvedValueOnce([[{ total: 3 }]]); // dismissed

    const req = mockReq();
    const res = mockRes();

    await getReportCounts(req, res);

    expect(res.json).toHaveBeenCalledWith({
      pending: 5,
      resolved: 10,
      dismissed: 3
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. ADMIN CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

describe('Admin Controller Edge Cases', () => {
  // 79. getDashboard returns correct structure
  test('79. getDashboard returns correct structure', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 100 }]])   // users
      .mockResolvedValueOnce([[{ total: 50 }]])    // posts
      .mockResolvedValueOnce([[{ total: 200 }]])   // comments
      .mockResolvedValueOnce([[{ total: 10 }]])    // categories
      .mockResolvedValueOnce([[{ total: 3 }]])     // pending reports
      .mockResolvedValueOnce([[{ total: 2 }]])     // active bans
      .mockResolvedValueOnce([[{ id: 1, username: 'u1', email: 'u1@test.com', role: 'alumno', created_at: '2026-01-01' }]]) // recent users
      .mockResolvedValueOnce([[{ id: 1, title: 'Post1', username: 'u1', created_at: '2026-01-01' }]]); // recent posts

    const req = mockReq();
    const res = mockRes();

    await getDashboard(req, res);

    expect(res.json).toHaveBeenCalledWith({
      counts: {
        users: 100,
        posts: 50,
        comments: 200,
        categories: 10,
        pendingReports: 3,
        activeBans: 2
      },
      recentUsers: expect.any(Array),
      recentPosts: expect.any(Array)
    });
  });

  // 80. getDashboard with empty database (all counts 0)
  test('80. getDashboard with empty database returns all zeros', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const req = mockReq();
    const res = mockRes();

    await getDashboard(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.counts.users).toBe(0);
    expect(response.counts.posts).toBe(0);
    expect(response.counts.comments).toBe(0);
    expect(response.counts.categories).toBe(0);
    expect(response.counts.pendingReports).toBe(0);
    expect(response.counts.activeBans).toBe(0);
    expect(response.recentUsers).toEqual([]);
    expect(response.recentPosts).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════════

describe('Auth Middleware Edge Cases', () => {
  // 81. auth middleware with valid token
  test('81. auth middleware with valid token calls next', async () => {
    const token = makeToken({ id: 1, token_version: 1 });
    pool.query.mockResolvedValueOnce([[{ token_version: 1 }]]);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
  });

  // 82. auth middleware with no token
  test('82. auth middleware with no token returns 401', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token no proporcionado' });
    expect(next).not.toHaveBeenCalled();
  });

  // 83. auth middleware with "Bearer" but no token
  test('83. auth middleware with Bearer but no token returns 401', async () => {
    const req = { headers: { authorization: 'Bearer ' } };
    const res = mockRes();
    const next = jest.fn();

    await auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Ban Middleware Edge Cases', () => {
  // 84. ban middleware with no active ban
  test('84. ban middleware with no active ban calls next', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { user: { id: 1 } };
    const res = mockRes();
    const next = jest.fn();

    await checkBan(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  // 85. ban middleware with active permanent ban
  test('85. ban middleware with active permanent ban returns 403', async () => {
    pool.query.mockResolvedValueOnce([[{
      id: 1, reason: 'Spam', type: 'permanent', expires_at: null
    }]]);

    const req = { user: { id: 1 } };
    const res = mockRes();
    const next = jest.fn();

    await checkBan(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('permanentemente') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // 86. ban middleware with expired temporary ban
  test('86. ban middleware with expired temporary ban calls next', async () => {
    pool.query.mockResolvedValueOnce([[]]); // expired bans don't match the query

    const req = { user: { id: 1 } };
    const res = mockRes();
    const next = jest.fn();

    await checkBan(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('Role Middleware Edge Cases', () => {
  // 87. role middleware with allowed role
  test('87. role middleware with allowed role calls next', () => {
    const middleware = role('admin', 'mod');

    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  // 88. role middleware with disallowed role
  test('88. role middleware with disallowed role returns 403', () => {
    const middleware = role('admin');

    const req = { user: { role: 'alumno' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('permiso') })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 12. UTILS - buildTree
// ══════════════════════════════════════════════════════════════════════════════

describe('buildTree Utility Edge Cases', () => {
  // 89. buildTree with flat comments (no nesting)
  test('89. buildTree with flat comments (no nesting)', () => {
    const items = [
      { id: 1, parent_id: null, content: 'A' },
      { id: 2, parent_id: null, content: 'B' },
      { id: 3, parent_id: null, content: 'C' }
    ];

    const result = buildTree(items, null);

    expect(result).toHaveLength(3);
    expect(result[0].replies).toEqual([]);
    expect(result[1].replies).toEqual([]);
    expect(result[2].replies).toEqual([]);
  });

  // 90. buildTree with deeply nested comments (3 levels)
  test('90. buildTree with deeply nested comments (3 levels)', () => {
    const items = [
      { id: 1, parent_id: null, content: 'Root' },
      { id: 2, parent_id: 1, content: 'Level 1' },
      { id: 3, parent_id: 2, content: 'Level 2' },
      { id: 4, parent_id: 3, content: 'Level 3' }
    ];

    const result = buildTree(items, null);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Root');
    expect(result[0].replies).toHaveLength(1);
    expect(result[0].replies[0].content).toBe('Level 1');
    expect(result[0].replies[0].replies).toHaveLength(1);
    expect(result[0].replies[0].replies[0].content).toBe('Level 2');
    expect(result[0].replies[0].replies[0].replies).toHaveLength(1);
    expect(result[0].replies[0].replies[0].replies[0].content).toBe('Level 3');
    expect(result[0].replies[0].replies[0].replies[0].replies).toEqual([]);
  });

  // 91. buildTree with empty array
  test('91. buildTree with empty array', () => {
    const result = buildTree([], null);
    expect(result).toEqual([]);
  });

  // 92. buildTree with circular reference protection (parent_id points to non-existent parent)
  test('92. buildTree with orphaned comments (parent_id to non-existent parent)', () => {
    const items = [
      { id: 1, parent_id: null, content: 'Root' },
      { id: 2, parent_id: 999, content: 'Orphan' }, // parent doesn't exist in list
      { id: 3, parent_id: 1, content: 'Child' }
    ];

    const result = buildTree(items, null);

    // Root should have 1 direct child (id:3)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].replies).toHaveLength(1);
    expect(result[0].replies[0].id).toBe(3);

    // Orphan (id:2) should NOT appear as a top-level item since parent_id=999 !== null
    const topLevelIds = result.map(r => r.id);
    expect(topLevelIds).not.toContain(2);
  });
});
