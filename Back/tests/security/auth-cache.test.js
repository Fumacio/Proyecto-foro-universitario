const jwt = require('jsonwebtoken');

// Mock de la DB pool ANTES de requerir auth
jest.mock('../../db/connection', () => ({
  query: jest.fn()
}));

const pool = require('../../db/connection');
const auth = require('../../middleware/auth');

const JWT_SECRET = 'test_secret_key';

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

describe('Auth Middleware - Token Version Caching', () => {
  let req, res, next;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeToken(payload) {
    return jwt.sign(payload, JWT_SECRET);
  }

  describe('Cache behavior', () => {
    test('first request queries DB (cache miss)', async () => {
      const uid = 201;
      const payload = { id: uid, username: 'cacheuser1', role: 'alumno', token_version: 1 };
      req.headers.authorization = `Bearer ${makeToken(payload)}`;
      pool.query.mockResolvedValue([[{ token_version: 1 }]]);

      await auth(req, res, next);

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT token_version FROM users WHERE id = ?',
        [uid]
      );
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('second request within 30s does NOT query DB (cache hit)', async () => {
      const uid = 202;
      const payload = { id: uid, username: 'cacheuser2', role: 'alumno', token_version: 1 };
      req.headers.authorization = `Bearer ${makeToken(payload)}`;
      pool.query.mockResolvedValue([[{ token_version: 1 }]]);

      // First request - populates cache
      await auth(req, res, next);
      expect(pool.query).toHaveBeenCalledTimes(1);

      // Reset mock call counts (keep mock implementation)
      pool.query.mockClear();
      const nextCallsAfterFirst = next.mock.calls.length;

      // Second request within TTL - should hit cache
      await auth(req, res, next);
      expect(pool.query).not.toHaveBeenCalled();
      // next should have been called exactly once more (not from the first request)
      expect(next.mock.calls.length).toBe(nextCallsAfterFirst + 1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('after 30s, queries DB again (cache expired)', async () => {
      const uid = 203;
      const payload = { id: uid, username: 'cacheuser3', role: 'alumno', token_version: 1 };
      req.headers.authorization = `Bearer ${makeToken(payload)}`;
      pool.query.mockResolvedValue([[{ token_version: 1 }]]);

      // First request - populates cache
      await auth(req, res, next);
      expect(pool.query).toHaveBeenCalledTimes(1);

      // Advance time past TTL (30 seconds + 1ms)
      pool.query.mockClear();
      jest.advanceTimersByTime(30001);

      // Should query DB again since cache expired
      await auth(req, res, next);
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT token_version FROM users WHERE id = ?',
        [uid]
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Cache invalidation on token_version mismatch', () => {
    test('after password change (token_version mismatch), cache is invalidated', async () => {
      const uid = 300;
      const payload = { id: uid, username: 'pwuser', role: 'alumno', token_version: 1 };
      req.headers.authorization = `Bearer ${makeToken(payload)}`;
      pool.query.mockResolvedValue([[{ token_version: 1 }]]);

      // First request - cache populated with version 1
      await auth(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Simulate password change in DB: now version 2, but token still has 1
      // Advance time past TTL so cache expires and DB is queried
      pool.query.mockClear();
      pool.query.mockResolvedValue([[{ token_version: 2 }]]);
      jest.advanceTimersByTime(30001);

      // Cache expired → DB queried → version 2 returned → token has version 1 → mismatch
      await auth(req, res, next);
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Sesión expirada, iniciá sesión nuevamente' });

      // Next request with NEW token (version 2) should query DB (cache was cleared by invalidation)
      pool.query.mockClear();
      pool.query.mockResolvedValue([[{ token_version: 2 }]]);
      const newPayload = { id: uid, username: 'pwuser', role: 'alumno', token_version: 2 };
      req.headers.authorization = `Bearer ${makeToken(newPayload)}`;

      await auth(req, res, next);
      expect(pool.query).toHaveBeenCalledTimes(1); // Cache miss because invalidation cleared it
      expect(next).toHaveBeenCalled();
    });
  });

  describe('JWT validation edge cases', () => {
    test('invalid JWT returns 401 without querying DB', async () => {
      req.headers.authorization = 'Bearer invalid_token_here';

      await auth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
      expect(pool.query).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('expired JWT returns "Token expirado"', async () => {
      const token = jwt.sign(
        { id: 1, username: 'expired', role: 'alumno', token_version: 1 },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );
      req.headers.authorization = `Bearer ${token}`;

      await auth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token expirado' });
      expect(pool.query).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('JWT signed with wrong secret returns "Token inválido"', async () => {
      const token = jwt.sign(
        { id: 1, username: 'wrongsecret', role: 'alumno', token_version: 1 },
        'completely_wrong_secret'
      );
      req.headers.authorization = `Bearer ${token}`;

      await auth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
      expect(pool.query).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Authorization header parsing', () => {
    test('Bearer token with extra trailing spaces should still work', async () => {
      const uid = 500;
      const payload = { id: uid, username: 'spacesuser', role: 'alumno', token_version: 1 };
      const token = makeToken(payload);
      // Extra trailing spaces after the token
      req.headers.authorization = `Bearer ${token}  `;
      pool.query.mockResolvedValue([[{ token_version: 1 }]]);

      await auth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe(uid);
    });

    test('Authorization header with "Basic" instead of "Bearer" should fail', async () => {
      req.headers.authorization = 'Basic dXNlcjpwYXNz';

      await auth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token no proporcionado' });
      expect(next).not.toHaveBeenCalled();
    });

    test('empty Authorization header should fail', async () => {
      req.headers.authorization = '';

      await auth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token no proporcionado' });
      expect(next).not.toHaveBeenCalled();
    });

    test('Authorization header with just "Bearer " (no token) should fail', async () => {
      req.headers.authorization = 'Bearer ';

      await auth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
