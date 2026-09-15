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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  test('should return 401 if no Authorization header', async () => {
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token no proporcionado' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if Authorization header does not start with Bearer', async () => {
    req.headers.authorization = 'InvalidToken';
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token no proporcionado' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is empty after Bearer', async () => {
    req.headers.authorization = 'Bearer ';
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is invalid', async () => {
    req.headers.authorization = 'Bearer invalid_token_here';
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is expired', async () => {
    const token = jwt.sign({ id: 1, username: 'test', role: 'alumno', token_version: 1 }, JWT_SECRET, { expiresIn: '-1h' });
    req.headers.authorization = `Bearer ${token}`;
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expirado' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if user not found in DB', async () => {
    const payload = { id: 999, username: 'testuser', role: 'alumno', token_version: 1 };
    const token = jwt.sign(payload, JWT_SECRET);
    req.headers.authorization = `Bearer ${token}`;
    pool.query.mockResolvedValue([[]]); // usuario no encontrado

    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token_version does not match DB', async () => {
    const payload = { id: 1, username: 'testuser', role: 'alumno', token_version: 1 };
    const token = jwt.sign(payload, JWT_SECRET);
    req.headers.authorization = `Bearer ${token}`;
    pool.query.mockResolvedValue([[{ token_version: 2 }]]); // DB tiene versión más nueva

    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Sesión expirada, iniciá sesión nuevamente' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next and set req.user if token is valid and token_version matches', async () => {
    const payload = { id: 1, username: 'testuser', role: 'alumno', token_version: 1 };
    const token = jwt.sign(payload, JWT_SECRET);
    req.headers.authorization = `Bearer ${token}`;
    pool.query.mockResolvedValue([[{ token_version: 1 }]]);

    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
    expect(req.user.username).toBe('testuser');
    expect(req.user.role).toBe('alumno');
  });

  test('should set req.user with admin role if token has admin role', async () => {
    const payload = { id: 2, username: 'admin', role: 'admin', token_version: 1 };
    const token = jwt.sign(payload, JWT_SECRET);
    req.headers.authorization = `Bearer ${token}`;
    pool.query.mockResolvedValue([[{ token_version: 1 }]]);

    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('admin');
  });
});
