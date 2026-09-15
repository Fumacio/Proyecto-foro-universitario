const role = require('../../middleware/role');

describe('Role Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  test('should return 401 if req.user is not set', () => {
    const middleware = role('admin');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 if user role is not in allowed roles', () => {
    req.user = { id: 1, role: 'alumno' };
    const middleware = role('admin');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No tenés permiso para esta acción' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next if user role is in allowed roles', () => {
    req.user = { id: 1, role: 'admin' };
    const middleware = role('admin');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should allow multiple roles', () => {
    req.user = { id: 1, role: 'alumno' };
    const middleware = role('admin', 'alumno');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should reject role not in the allowed list', () => {
    req.user = { id: 1, role: 'profesor' };
    const middleware = role('admin', 'alumno');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('should allow profesor role when specified', () => {
    req.user = { id: 1, role: 'profesor' };
    const middleware = role('profesor');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
