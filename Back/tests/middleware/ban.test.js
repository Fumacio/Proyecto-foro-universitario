const checkBan = require('../../middleware/ban');

// Mock the pool
jest.mock('../../db/connection', () => ({
  query: jest.fn()
}));

const pool = require('../../db/connection');

describe('CheckBan Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 1 } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    pool.query.mockReset();
  });

  test('should return 401 if req.user is not set', async () => {
    req.user = undefined;
    await checkBan(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if req.user.id is not set', async () => {
    req.user = {};
    await checkBan(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next if user has no active bans', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await checkBan(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should return 403 if user has a permanent ban', async () => {
    pool.query.mockResolvedValueOnce([[{
      id: 1,
      reason: 'Spamming',
      type: 'permanent',
      expires_at: null
    }]]);
    await checkBan(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('baneada permanentemente')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 if user has an active temporary ban', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    pool.query.mockResolvedValueOnce([[{
      id: 1,
      reason: 'Off-topic',
      type: 'temporary',
      expires_at: futureDate
    }]]);
    await checkBan(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('baneada temporalmente')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next if temporary ban is expired', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await checkBan(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 500 on database error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));
    await checkBan(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al verificar estado de cuenta' });
  });
});
