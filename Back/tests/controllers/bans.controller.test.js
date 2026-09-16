jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');

const {
  banUser,
  unbanUser,
  getBans,
  getBanStatus,
} = require('../../controllers/bans.controller');

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
// banUser
// ══════════════════════════════════════════════════════════════════════════════

describe('bans.controller - banUser', () => {
  it('should return 400 if user_id is missing', async () => {
    const req = { body: { reason: 'Spam' }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'user_id y reason son obligatorios' });
  });

  it('should return 400 if reason is missing', async () => {
    const req = { body: { user_id: 5 }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'user_id y reason son obligatorios' });
  });

  it('should return 400 if type is invalid', async () => {
    const req = { body: { user_id: 5, reason: 'Spam', type: 'forever' }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tipo de ban inválido' });
  });

  it('should return 400 if temporary ban has no duration_hours', async () => {
    const req = { body: { user_id: 5, reason: 'Spam', type: 'temporary' }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Los bans temporales requieren duration_hours' });
  });

  it('should return 404 if user is not found', async () => {
    pool.query.mockResolvedValueOnce([[]]); // SELECT user

    const req = { body: { user_id: 999, reason: 'Spam', type: 'permanent' }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });

  it('should return 403 if trying to ban an admin (role_id=1)', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 5, role_id: 1 }]]);

    const req = { body: { user_id: 5, reason: 'Spam', type: 'permanent' }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'No se puede banear a un administrador' });
  });

  it('should return 409 if user is already permanently banned', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5, role_id: 3 }]])  // user exists
      .mockResolvedValueOnce([[{ id: 10 }]]);              // existing active ban

    const req = { body: { user_id: 5, reason: 'Spam', type: 'permanent' }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'El usuario ya está baneado' });
  });

  it('should create permanent ban successfully', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5, role_id: 3 }]])
      .mockResolvedValueOnce([[]])                          // no active ban
      .mockResolvedValueOnce([{ insertId: 20 }]);           // INSERT ban

    const req = { body: { user_id: 5, reason: 'Spam', type: 'permanent' }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 20,
      message: 'Usuario baneado permanentemente',
    });

    const insertCall = pool.query.mock.calls[2];
    expect(insertCall[0]).toContain('INSERT INTO bans');
    expect(insertCall[1][2]).toBe('permanent');
    expect(insertCall[1][3]).toBeNull();
  });

  it('should create temporary ban with duration_hours', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5, role_id: 3 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 21 }]);

    const req = { body: { user_id: 5, reason: 'Offensive', type: 'temporary', duration_hours: 24 }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 21,
      message: 'Usuario baneado por 24 horas',
    });

    const insertCall = pool.query.mock.calls[2];
    expect(insertCall[1][2]).toBe('temporary');
    expect(insertCall[1][3]).toBeInstanceOf(Date);
  });

  it('should default type to temporary when not provided', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5, role_id: 3 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 22 }]);

    const req = { body: { user_id: 5, reason: 'Spam', duration_hours: 48 }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = pool.query.mock.calls[2];
    expect(insertCall[1][2]).toBe('temporary');
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { body: { user_id: 5, reason: 'Spam', type: 'permanent' }, user: { id: 1 } };
    const res = mockRes();

    await banUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al banear usuario' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// unbanUser
// ══════════════════════════════════════════════════════════════════════════════

describe('bans.controller - unbanUser', () => {
  it('should return 400 if user_id is missing', async () => {
    const req = { body: {} };
    const res = mockRes();

    await unbanUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'user_id es obligatorio' });
  });

  it('should return 404 if user is not banned', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const req = { body: { user_id: 999 } };
    const res = mockRes();

    await unbanUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'El usuario no está baneado' });
  });

  it('should unban user successfully', async () => {
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = { body: { user_id: 5 } };
    const res = mockRes();

    await unbanUser(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario desbaneado correctamente' });
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { body: { user_id: 5 } };
    const res = mockRes();

    await unbanUser(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al desbanear usuario' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getBans
// ══════════════════════════════════════════════════════════════════════════════

describe('bans.controller - getBans', () => {
  it('should return active and expired bans separated', async () => {
    const futureDate = new Date(Date.now() + 3600000);
    const pastDate = new Date(Date.now() - 3600000);

    const bans = [
      { id: 1, user_id: 5, type: 'permanent', expires_at: null, username: 'alice', banned_by_username: 'admin1' },
      { id: 2, user_id: 6, type: 'temporary', expires_at: futureDate, username: 'bob', banned_by_username: 'admin1' },
      { id: 3, user_id: 7, type: 'temporary', expires_at: pastDate, username: 'charlie', banned_by_username: 'admin1' },
    ];

    pool.query.mockResolvedValueOnce([bans]);

    const req = {};
    const res = mockRes();

    await getBans(req, res);

    expect(res.json).toHaveBeenCalledWith({
      active: [bans[0], bans[1]],  // permanent + not-yet-expired
      expired: [bans[2]],           // expired temporary
    });
  });

  it('should return empty arrays when no bans exist', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = {};
    const res = mockRes();

    await getBans(req, res);

    expect(res.json).toHaveBeenCalledWith({ active: [], expired: [] });
  });

  it('should classify temporary ban as expired when expires_at is now', async () => {
    const now = new Date();
    const bans = [
      { id: 1, user_id: 5, type: 'temporary', expires_at: now, username: 'bob', banned_by_username: 'admin' },
    ];

    pool.query.mockResolvedValueOnce([bans]);

    const req = {};
    const res = mockRes();

    await getBans(req, res);

    // Date comparison: expires_at <= now means expired
    expect(res.json.mock.calls[0][0].expired).toHaveLength(1);
    expect(res.json.mock.calls[0][0].active).toHaveLength(0);
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = {};
    const res = mockRes();

    await getBans(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener bans' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getBanStatus
// ══════════════════════════════════════════════════════════════════════════════

describe('bans.controller - getBanStatus', () => {
  it('should return banned: false when user has no active ban', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { params: { user_id: '5' } };
    const res = mockRes();

    await getBanStatus(req, res);

    expect(res.json).toHaveBeenCalledWith({ banned: false, ban: null });
  });

  it('should return banned: true with ban details for permanent ban', async () => {
    const banData = { id: 1, reason: 'Spam', type: 'permanent', expires_at: null, created_at: '2025-01-01' };
    pool.query.mockResolvedValueOnce([[banData]]);

    const req = { params: { user_id: '5' } };
    const res = mockRes();

    await getBanStatus(req, res);

    expect(res.json).toHaveBeenCalledWith({ banned: true, ban: banData });
  });

  it('should return banned: true with ban details for temporary ban', async () => {
    const futureDate = new Date(Date.now() + 3600000);
    const banData = { id: 2, reason: 'Offensive', type: 'temporary', expires_at: futureDate, created_at: '2025-01-01' };
    pool.query.mockResolvedValueOnce([[banData]]);

    const req = { params: { user_id: '6' } };
    const res = mockRes();

    await getBanStatus(req, res);

    expect(res.json).toHaveBeenCalledWith({ banned: true, ban: banData });
  });

  it('should pass user_id as parameter to query', async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const req = { params: { user_id: '42' } };
    const res = mockRes();

    await getBanStatus(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['42']
    );
  });

  it('should call sendError on database failure', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { user_id: '5' } };
    const res = mockRes();

    await getBanStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener estado de ban' });
  });
});
