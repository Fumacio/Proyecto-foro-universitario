jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');
const {
  getAll,
  getById,
  update,
  remove,
  uploadAvatar,
  getStats,
  getActivity,
  findByEmail,
} = require('../../controllers/users.controller');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ===================== getAll =====================

describe('users.controller - getAll', () => {
  it('should return all users with role names', async () => {
    const fakeRows = [
      { id: 1, username: 'alice', role: 'admin', email: 'alice@test.com' },
      { id: 2, username: 'bob', role: 'student', email: 'bob@test.com' },
    ];
    pool.query.mockResolvedValue([fakeRows]);

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/SELECT.*FROM users.*JOIN roles/);
    expect(res.json).toHaveBeenCalledWith(fakeRows);
  });

  it('should return an empty array when no users exist', async () => {
    pool.query.mockResolvedValue([[]]);

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should handle database errors', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = {};
    const res = mockRes();

    await getAll(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener usuarios' });
  });
});

// ===================== getById =====================

describe('users.controller - getById', () => {
  const fakeUser = {
    id: 5,
    username: 'charlie',
    email: 'charlie@test.com',
    avatar_url: '/uploads/avatars/charlie.png',
    role: 'student',
    first_name: 'Charlie',
    last_name: 'C',
    age: 22,
    commission: 'A',
    career: 'CS',
    gender: 'M',
    bio: 'Hello',
    created_at: '2025-01-01',
  };

  it('should return 404 when user is not found', async () => {
    pool.query.mockResolvedValue([[]]);

    const req = { params: { id: 999 }, user: { id: 1, role: 'admin' } };
    const res = mockRes();

    await getById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });

  it('should return the user with email when the user views their own profile', async () => {
    pool.query.mockResolvedValue([[{ ...fakeUser }]]);

    const req = { params: { id: 5 }, user: { id: 5, role: 'student' } };
    const res = mockRes();

    await getById(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const returned = res.json.mock.calls[0][0];
    expect(returned.email).toBe('charlie@test.com');
  });

  it('should hide the email when another regular user views the profile', async () => {
    pool.query.mockResolvedValue([[{ ...fakeUser }]]);

    const req = { params: { id: 5 }, user: { id: 10, role: 'student' } };
    const res = mockRes();

    await getById(req, res);

    const returned = res.json.mock.calls[0][0];
    expect(returned.email).toBeUndefined();
  });

  it('should include the email when an admin views another user profile', async () => {
    pool.query.mockResolvedValue([[{ ...fakeUser }]]);

    const req = { params: { id: 5 }, user: { id: 1, role: 'admin' } };
    const res = mockRes();

    await getById(req, res);

    const returned = res.json.mock.calls[0][0];
    expect(returned.email).toBe('charlie@test.com');
  });

  it('should handle database errors', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: 1 }, user: { id: 1, role: 'admin' } };
    const res = mockRes();

    await getById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener usuario' });
  });
});

// ===================== update =====================

describe('users.controller - update', () => {
  it('should return 400 when no fields are provided', async () => {
    const req = { params: { id: 1 }, body: {} };
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No hay campos para actualizar' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should update the username successfully', async () => {
    pool.query.mockResolvedValue([]);

    const req = { params: { id: 1 }, body: { username: 'newname' } };
    const res = mockRes();

    await update(req, res);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/UPDATE users SET username = \?/);
    expect(pool.query.mock.calls[0][1]).toEqual(['newname', 1]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario actualizado' });
  });

  it('should update multiple fields at once', async () => {
    pool.query.mockResolvedValue([]);

    const req = { params: { id: 2 }, body: { username: 'user2', email: 'u2@test.com' } };
    const res = mockRes();

    await update(req, res);

    expect(pool.query.mock.calls[0][0]).toMatch(/UPDATE users SET username = \?, email = \?/);
    expect(pool.query.mock.calls[0][1]).toEqual(['user2', 'u2@test.com', 2]);
  });

  it('should handle database errors', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: 1 }, body: { username: 'fail' } };
    const res = mockRes();

    await update(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al actualizar usuario' });
  });
});

// ===================== remove =====================

describe('users.controller - remove', () => {
  it('should return 404 when user is not found', async () => {
    pool.query.mockResolvedValue([{ affectedRows: 0 }]);

    const req = { params: { id: 999 } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });

  it('should delete the user successfully', async () => {
    pool.query.mockResolvedValue([{ affectedRows: 1 }]);

    const req = { params: { id: 5 } };
    const res = mockRes();

    await remove(req, res);

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM users WHERE id = ?', [5]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario eliminado' });
  });

  it('should handle database errors', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: 1 } };
    const res = mockRes();

    await remove(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al eliminar usuario' });
  });
});

// ===================== uploadAvatar =====================

describe('users.controller - uploadAvatar', () => {
  it('should return 400 when no file is sent', async () => {
    const req = { file: undefined, user: { id: 1 } };
    const res = mockRes();

    await uploadAvatar(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No se envió ningún archivo' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should upload avatar and return the new URL', async () => {
    pool.query.mockResolvedValue([]);

    const req = {
      file: { filename: 'avatar123.png' },
      user: { id: 7 },
    };
    const res = mockRes();

    await uploadAvatar(req, res);

    expect(pool.query).toHaveBeenCalledWith('UPDATE users SET avatar_url = ? WHERE id = ?', [
      '/uploads/avatars/avatar123.png',
      7,
    ]);
    expect(res.json).toHaveBeenCalledWith({ avatar_url: '/uploads/avatars/avatar123.png' });
  });

  it('should handle database errors', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { file: { filename: 'img.jpg' }, user: { id: 1 } };
    const res = mockRes();

    await uploadAvatar(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al subir avatar' });
  });
});

// ===================== getStats =====================

describe('users.controller - getStats', () => {
  it('should return posts, comments and karma counts', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 12 }]])   // posts
      .mockResolvedValueOnce([[{ total: 34 }]])   // comments
      .mockResolvedValueOnce([[{ total: 78 }]]);  // karma

    const req = { params: { id: 3 } };
    const res = mockRes();

    await getStats(req, res);

    expect(pool.query).toHaveBeenCalledTimes(3);
    expect(res.json).toHaveBeenCalledWith({ posts: 12, comments: 34, karma: 78 });
  });

  it('should return zeros when the user has no activity', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    const req = { params: { id: 99 } };
    const res = mockRes();

    await getStats(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: 0, comments: 0, karma: 0 });
  });

  it('should handle database errors', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: 1 } };
    const res = mockRes();

    await getStats(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener estadísticas' });
  });
});

// ===================== getActivity =====================

describe('users.controller - getActivity', () => {
  it('should return recent posts and comments', async () => {
    const fakePosts = [{ id: 10, title: 'Post 1', created_at: '2025-06-01', category_name: 'General' }];
    const fakeComments = [{ id: 20, content: 'Nice!', created_at: '2025-06-02', post_id: 10, post_title: 'Post 1' }];

    pool.query
      .mockResolvedValueOnce([fakePosts])
      .mockResolvedValueOnce([fakeComments]);

    const req = { params: { id: 4 } };
    const res = mockRes();

    await getActivity(req, res);

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({ posts: fakePosts, comments: fakeComments });
  });

  it('should return empty arrays when user has no activity', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);

    const req = { params: { id: 99 } };
    const res = mockRes();

    await getActivity(req, res);

    expect(res.json).toHaveBeenCalledWith({ posts: [], comments: [] });
  });

  it('should handle database errors', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { params: { id: 1 } };
    const res = mockRes();

    await getActivity(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener actividad' });
  });
});

// ===================== findByEmail =====================

describe('users.controller - findByEmail', () => {
  it('should return 400 when email is not provided', async () => {
    const req = { query: {} };
    const res = mockRes();

    await findByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email requerido' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should return 404 when no user matches the email', async () => {
    pool.query.mockResolvedValue([[]]);

    const req = { query: { email: 'nobody@test.com' } };
    const res = mockRes();

    await findByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No se encontró usuario con ese email' });
  });

  it('should return the user when the email is found', async () => {
    const fakeUser = { id: 3, username: 'dave', email: 'dave@test.com', role: 'student' };
    pool.query.mockResolvedValue([[fakeUser]]);

    const req = { query: { email: 'dave@test.com' } };
    const res = mockRes();

    await findByEmail(req, res);

    expect(pool.query.mock.calls[0][1]).toEqual(['dave@test.com']);
    expect(res.json).toHaveBeenCalledWith(fakeUser);
  });

  it('should handle database errors', async () => {
    pool.query.mockRejectedValue(new Error('DB error'));

    const req = { query: { email: 'err@test.com' } };
    const res = mockRes();

    await findByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al buscar usuario' });
  });
});
