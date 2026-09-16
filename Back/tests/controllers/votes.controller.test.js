jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');

const {
  votePost,
  voteComment,
} = require('../../controllers/votes.controller');

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
// votePost
// ══════════════════════════════════════════════════════════════════════════════

describe('votes.controller - votePost', () => {
  it('should return 400 if value is 0', async () => {
    const req = { params: { id: '10' }, body: { value: 0 }, user: { id: 1 } };
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El valor debe ser 1 o -1' });
  });

  it('should return 400 if value is 2', async () => {
    const req = { params: { id: '10' }, body: { value: 2 }, user: { id: 1 } };
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El valor debe ser 1 o -1' });
  });

  it('should return 400 if value is null', async () => {
    const req = { params: { id: '10' }, body: { value: null }, user: { id: 1 } };
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El valor debe ser 1 o -1' });
  });

  it('should return 400 if value is missing', async () => {
    const req = { params: { id: '10' }, body: {}, user: { id: 1 } };
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El valor debe ser 1 o -1' });
  });

  it('should return 404 if post is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]); // SELECT id FROM posts

    const req = { params: { id: '999' }, body: { value: 1 }, user: { id: 1 } };
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Post no encontrado' });
  });

  it('should create a new vote successfully', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])    // post exists
      .mockResolvedValueOnce([[]])               // no existing vote
      .mockResolvedValueOnce([{}])               // INSERT vote
      .mockResolvedValueOnce([[{ total: 5 }]]);   // vote count

    const req = { params: { id: '10' }, body: { value: 1 }, user: { id: 3 } };
    const res = mockRes();

    await votePost(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO votes (user_id, post_id, value) VALUES (?, ?, ?)',
      [3, '10', 1]
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Voto registrado', vote_count: 5 });
  });

  it('should toggle (remove) vote when same value is sent', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])              // post exists
      .mockResolvedValueOnce([[{ id: 50, value: 1 }]])   // existing vote = 1
      .mockResolvedValueOnce([{}])                         // DELETE vote
      .mockResolvedValueOnce([[{ total: 0 }]]);             // vote count

    const req = { params: { id: '10' }, body: { value: 1 }, user: { id: 3 } };
    const res = mockRes();

    await votePost(req, res);

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM votes WHERE id = ?', [50]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Voto eliminado', vote_count: 0 });
  });

  it('should change vote when different value is sent', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])              // post exists
      .mockResolvedValueOnce([[{ id: 50, value: 1 }]])   // existing vote = 1
      .mockResolvedValueOnce([{}])                         // UPDATE vote
      .mockResolvedValueOnce([[{ total: -1 }]]);            // vote count

    const req = { params: { id: '10' }, body: { value: -1 }, user: { id: 3 } };
    const res = mockRes();

    await votePost(req, res);

    expect(pool.query).toHaveBeenCalledWith('UPDATE votes SET value = ? WHERE id = ?', [-1, 50]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Voto registrado', vote_count: -1 });
  });

  it('should return correct vote count after voting', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ total: 7 }]]);

    const req = { params: { id: '10' }, body: { value: 1 }, user: { id: 3 } };
    const res = mockRes();

    await votePost(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Voto registrado', vote_count: 7 });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '10' }, body: { value: 1 }, user: { id: 1 } };
    const res = mockRes();

    await votePost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al votar' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// voteComment
// ══════════════════════════════════════════════════════════════════════════════

describe('votes.controller - voteComment', () => {
  it('should return 400 if value is 0', async () => {
    const req = { params: { id: '10' }, body: { value: 0 }, user: { id: 1 } };
    const res = mockRes();

    await voteComment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El valor debe ser 1 o -1' });
  });

  it('should return 400 if value is null', async () => {
    const req = { params: { id: '10' }, body: { value: null }, user: { id: 1 } };
    const res = mockRes();

    await voteComment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 400 if value is missing', async () => {
    const req = { params: { id: '10' }, body: {}, user: { id: 1 } };
    const res = mockRes();

    await voteComment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 404 if comment is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { params: { id: '999' }, body: { value: 1 }, user: { id: 1 } };
    const res = mockRes();

    await voteComment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Comentario no encontrado' });
  });

  it('should create a new vote on comment', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])    // comment exists
      .mockResolvedValueOnce([[]])               // no existing vote
      .mockResolvedValueOnce([{}])               // INSERT
      .mockResolvedValueOnce([[{ total: 3 }]]);   // count

    const req = { params: { id: '10' }, body: { value: 1 }, user: { id: 3 } };
    const res = mockRes();

    await voteComment(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO votes (user_id, comment_id, value) VALUES (?, ?, ?)',
      [3, '10', 1]
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Voto registrado', vote_count: 3 });
  });

  it('should toggle (remove) vote on comment when same value', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ id: 55, value: -1 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    const req = { params: { id: '10' }, body: { value: -1 }, user: { id: 3 } };
    const res = mockRes();

    await voteComment(req, res);

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM votes WHERE id = ?', [55]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Voto eliminado', vote_count: 0 });
  });

  it('should change vote on comment when different value', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ id: 55, value: 1 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ total: -1 }]]);

    const req = { params: { id: '10' }, body: { value: -1 }, user: { id: 3 } };
    const res = mockRes();

    await voteComment(req, res);

    expect(pool.query).toHaveBeenCalledWith('UPDATE votes SET value = ? WHERE id = ?', [-1, 55]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Voto registrado', vote_count: -1 });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: '10' }, body: { value: 1 }, user: { id: 1 } };
    const res = mockRes();

    await voteComment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al votar' });
  });
});
