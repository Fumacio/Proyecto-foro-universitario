const jwt = require('jsonwebtoken');
const crypto = require('crypto');

jest.mock('../../db/connection', () => ({ query: jest.fn() }));
const pool = require('../../db/connection');

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));
const bcrypt = require('bcrypt');

jest.mock('../../utils/mailer', () => ({ sendMail: jest.fn() }));
const { sendMail } = require('../../utils/mailer');

jest.mock('../../utils/response.utils', () => ({
  sendError: jest.fn((res, _err, message, status = 500) => {
    res.status(status).json({ error: message });
  })
}));

const {
  register,
  login,
  updateProfile,
  forgotPassword,
  resetPassword,
  deleteAccount,
  banStatus
} = require('../../controllers/auth.controller');

const JWT_SECRET = 'test_secret';

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
  return res;
};

// ══════════════════════════════════════════════════════════════════════════════
// register
// ══════════════════════════════════════════════════════════════════════════════

describe('register', () => {
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

  test('should return 400 if username, email and password are missing', async () => {
    const res = mockRes();
    await register({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Faltan campos obligatorios' });
  });

  test('should return 400 if username is missing', async () => {
    const res = mockRes();
    const { username, ...body } = validBody;
    await register({ body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Faltan campos obligatorios' });
  });

  test('should return 400 if email is missing', async () => {
    const res = mockRes();
    const { email, ...body } = validBody;
    await register({ body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Faltan campos obligatorios' });
  });

  test('should return 400 if password is missing', async () => {
    const res = mockRes();
    const { password, ...body } = validBody;
    await register({ body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Faltan campos obligatorios' });
  });

  test('should return 400 if password is shorter than 8 characters', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, password: '12345' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña debe tener al menos 8 caracteres' });
  });

  test('should return 400 if password lacks uppercase, number or symbol', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, password: 'alllowercase' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña debe contener al menos una mayúscula, un número y un símbolo' });
  });

  test('should return 400 if username is shorter than 3 characters', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, username: 'ab' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El username debe tener entre 3 y 30 caracteres' });
  });

  test('should return 400 if username is longer than 30 characters', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, username: 'a'.repeat(31) } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El username debe tener entre 3 y 30 caracteres' });
  });

  test('should return 400 if username contains invalid characters', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, username: 'test user!' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El username solo puede contener letras, números y guiones bajos' });
  });

  test('should return 400 if username has spaces', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, username: 'test user' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El username solo puede contener letras, números y guiones bajos' });
  });

  test('should return 400 if email format is invalid (no @)', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, email: 'invalidemail' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El formato del email no es válido' });
  });

  test('should return 400 if email format is invalid (no domain)', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, email: 'user@' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El formato del email no es válido' });
  });

  test('should return 400 if email contains spaces', async () => {
    const res = mockRes();
    await register({ body: { ...validBody, email: 'user @example.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El formato del email no es válido' });
  });

  test('should return 409 if email or username already exists', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
    await register({ body: validBody }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'El email o username ya está registrado' });
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [validBody.email, validBody.username]
    );
  });

  test('should hash password with bcrypt and insert user with role_id=3', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[]])            // no duplicates
      .mockResolvedValueOnce([{ insertId: 10 }]); // INSERT result

    bcrypt.hash.mockResolvedValue('hashed_pw');

    await register({ body: validBody }, res);

    expect(bcrypt.hash).toHaveBeenCalledWith('Passw0rd!', 10);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining([
        'testuser',
        'test@example.com',
        'hashed_pw',
        'Test',
        'User',
        21,
        'A',
        'CS',
        'M',
        'Hello'
      ])
    );
    // Verify role_id is in the column list and 3 is hardcoded in VALUES
    const insertCall = pool.query.mock.calls[1];
    expect(insertCall[0]).toContain('role_id');
    expect(insertCall[0]).toContain('VALUES (?, ?, ?, 3,');
  });

  test('should return 201 with token and user data on success', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 10 }]);

    bcrypt.hash.mockResolvedValue('hashed_pw');

    await register({ body: validBody }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const response = res.json.mock.calls[0][0];
    expect(response.token).toBeDefined();

    // Verify the JWT token
    const decoded = jwt.verify(response.token, JWT_SECRET);
    expect(decoded.id).toBe(10);
    expect(decoded.username).toBe('testuser');
    expect(decoded.role).toBe('alumno');

    expect(response.user).toMatchObject({
      id: 10,
      username: 'testuser',
      email: 'test@example.com',
      role: 'alumno'
    });
  });

  test('should set expiresIn 7d in the JWT token', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 5 }]);

    bcrypt.hash.mockResolvedValue('hashed_pw');

    await register({ body: validBody }, res);

    const token = res.json.mock.calls[0][0].token;
    const decoded = jwt.decode(token);
    const expiresInSeconds = decoded.exp - decoded.iat;
    expect(expiresInSeconds).toBe(7 * 24 * 60 * 60); // 7 days
  });

  test('should always assign role_id=3 (alumno)', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);

    bcrypt.hash.mockResolvedValue('hashed_pw');

    await register({ body: validBody }, res);

    const insertSQL = pool.query.mock.calls[1][0];
    expect(insertSQL).toContain('role_id');
    expect(insertSQL).toContain('VALUES (?, ?, ?, 3,');
  });

  test('should default optional fields to null when not provided', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);

    bcrypt.hash.mockResolvedValue('hashed_pw');

    await register({
      body: {
        username: 'minimal',
        email: 'min@example.com',
        password: 'Passw0rd!'
      }
    }, res);

    const insertArgs = pool.query.mock.calls[1][1];
    // first_name, last_name, age, commission, career, gender, bio should all be null
    expect(insertArgs).toEqual([
      'minimal', 'min@example.com', 'hashed_pw',
      null, null, null, null, null, null, null
    ]);
  });

  test('should allow username with underscores and numbers', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);

    bcrypt.hash.mockResolvedValue('hashed_pw');

    await register({
      body: { ...validBody, username: 'user_123_test' }
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('should call sendError on unexpected exception', async () => {
    const { sendError } = require('../../utils/response.utils');
    const res = mockRes();
    pool.query.mockRejectedValue(new Error('DB down'));

    await register({ body: validBody }, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'Error al registrar usuario'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// login
// ══════════════════════════════════════════════════════════════════════════════

describe('login', () => {
  const dbUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password_hash: 'hashed_pw',
    avatar_url: null,
    first_name: 'Test',
    last_name: 'User',
    age: 21,
    commission: 'A',
    career: 'CS',
    gender: 'M',
    bio: 'Hello',
    token_version: 1,
    role: 'alumno'
  };

  test('should return 400 if email is missing', async () => {
    const res = mockRes();
    await login({ body: { password: 'pass123' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Faltan campos obligatorios' });
  });

  test('should return 400 if password is missing', async () => {
    const res = mockRes();
    await login({ body: { email: 'test@example.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Faltan campos obligatorios' });
  });

  test('should return 400 if both fields are missing', async () => {
    const res = mockRes();
    await login({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Faltan campos obligatorios' });
  });

  test('should return 401 if user is not found', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);
    await login({ body: { email: 'nobody@example.com', password: 'pass123' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
  });

  test('should return 401 if password does not match', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[dbUser]]);
    bcrypt.compare.mockResolvedValue(false);

    await login({ body: { email: 'test@example.com', password: 'wrongpw' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenciales inválidas' });
    expect(bcrypt.compare).toHaveBeenCalledWith('wrongpw', 'hashed_pw');
  });

  test('should return token and user data on successful login', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[dbUser]]);
    bcrypt.compare.mockResolvedValue(true);

    await login({ body: { email: 'test@example.com', password: 'pass123' } }, res);

    expect(res.json).toHaveBeenCalled();
    const response = res.json.mock.calls[0][0];
    expect(response.token).toBeDefined();

    const decoded = jwt.verify(response.token, JWT_SECRET);
    expect(decoded.id).toBe(1);
    expect(decoded.username).toBe('testuser');
    expect(decoded.role).toBe('alumno');
    expect(decoded.token_version).toBe(1);

    expect(response.user).toMatchObject({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'alumno'
    });
  });

  test('should set expiresIn 7d in the login JWT token', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[dbUser]]);
    bcrypt.compare.mockResolvedValue(true);

    await login({ body: { email: 'test@example.com', password: 'pass123' } }, res);

    const token = res.json.mock.calls[0][0].token;
    const decoded = jwt.decode(token);
    const expiresInSeconds = decoded.exp - decoded.iat;
    expect(expiresInSeconds).toBe(7 * 24 * 60 * 60);
  });

  test('should include token_version in JWT payload', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[{ ...dbUser, token_version: 5 }]]);
    bcrypt.compare.mockResolvedValue(true);

    await login({ body: { email: 'test@example.com', password: 'pass123' } }, res);

    const decoded = jwt.decode(res.json.mock.calls[0][0].token);
    expect(decoded.token_version).toBe(5);
  });

  test('should call sendError on unexpected exception', async () => {
    const { sendError } = require('../../utils/response.utils');
    const res = mockRes();
    pool.query.mockRejectedValue(new Error('DB error'));

    await login({ body: { email: 'test@example.com', password: 'pass123' } }, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'Error al iniciar sesión'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// updateProfile
// ══════════════════════════════════════════════════════════════════════════════

describe('updateProfile', () => {
  const currentUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password_hash: 'hashed_pw',
    token_version: 1
  };

  const updatedUserRow = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    avatar_url: null,
    token_version: 1,
    role: 'alumno',
    first_name: 'Test',
    last_name: 'User',
    age: 21,
    commission: 'A',
    career: 'CS',
    gender: 'M',
    bio: 'Hello'
  };

  const makeReq = (body = {}, userId = 1) => ({
    body,
    user: { id: userId }
  });

  test('should return 404 if user is not found', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);

    await updateProfile(makeReq({ username: 'newname' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });

  test('should return 400 if new_password provided without current_password', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[currentUser]]);

    await updateProfile(makeReq({ new_password: 'newpass123' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Debés ingresar tu contraseña actual para cambiarla' });
  });

  test('should return 401 if current_password is wrong', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[currentUser]]);
    bcrypt.compare.mockResolvedValue(false);

    await updateProfile(makeReq({ current_password: 'wrong', new_password: 'newpass123' }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña actual es incorrecta' });
  });

  test('should return 409 if new username is already taken', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[currentUser]])     // SELECT * FROM users WHERE id
      .mockResolvedValueOnce([[{ id: 99 }]]);    // username taken check

    await updateProfile(makeReq({ username: 'takenuser' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'El username ya está en uso' });
  });

  test('should return 409 if new email is already taken', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[currentUser]])     // SELECT * FROM users WHERE id
      .mockResolvedValueOnce([[{ id: 99 }]]);    // email taken check

    await updateProfile(makeReq({ email: 'taken@example.com' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'El email ya está en uso' });
  });

  test('should return 400 if no fields to update', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[currentUser]]);

    await updateProfile(makeReq({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No hay campos para actualizar' });
  });

  test('should update username successfully and return new token', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[currentUser]])       // SELECT * WHERE id
      .mockResolvedValueOnce([[]])                  // username not taken
      .mockResolvedValueOnce([{}])                  // UPDATE users
      .mockResolvedValueOnce([[{ ...updatedUserRow, username: 'newname' }]]);   // SELECT updated user

    await updateProfile(makeReq({ username: 'newname' }), res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users SET'),
      expect.arrayContaining(['newname'])
    );

    const response = res.json.mock.calls[0][0];
    expect(response.token).toBeDefined();
    const decoded = jwt.verify(response.token, JWT_SECRET);
    expect(decoded.username).toBe('newname');
  });

  test('should hash new password when current_password is correct', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[currentUser]])
      .mockResolvedValueOnce([{}])                  // UPDATE
      .mockResolvedValueOnce([[updatedUserRow]]);   // SELECT updated

    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('new_hashed_pw');

    await updateProfile(makeReq({ current_password: 'oldpw', new_password: 'newpw123' }), res);

    expect(bcrypt.compare).toHaveBeenCalledWith('oldpw', 'hashed_pw');
    expect(bcrypt.hash).toHaveBeenCalledWith('newpw123', 10);
  });

  test('should update profile fields (first_name, bio, etc.)', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[currentUser]])
      .mockResolvedValueOnce([{}])                  // UPDATE
      .mockResolvedValueOnce([[updatedUserRow]]);   // SELECT updated

    await updateProfile(makeReq({ first_name: 'Jane', bio: 'Updated bio' }), res);

    const updateCall = pool.query.mock.calls.find(
      c => typeof c[0] === 'string' && c[0].includes('UPDATE users SET')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[1]).toContain('Jane');
  });

  test('should set undefined profile fields to null', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[currentUser]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[updatedUserRow]]);

    await updateProfile(makeReq({ first_name: 'Jane' }), res);

    const updateCall = pool.query.mock.calls.find(
      c => typeof c[0] === 'string' && c[0].includes('UPDATE users SET')
    );
    // first_name = 'Jane' and all other profile fields = null
    expect(updateCall[1]).toContain('Jane');
    // Check that it includes the userId at the end
    expect(updateCall[1][updateCall[1].length - 1]).toBe(1);
  });

  test('should call sendError on unexpected exception', async () => {
    const { sendError } = require('../../utils/response.utils');
    const res = mockRes();
    pool.query.mockRejectedValue(new Error('DB error'));

    await updateProfile(makeReq({ username: 'newname' }), res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'Error al actualizar perfil'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// forgotPassword
// ══════════════════════════════════════════════════════════════════════════════

describe('forgotPassword', () => {
  test('should return 400 if email is missing', async () => {
    const res = mockRes();
    await forgotPassword({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El email es obligatorio' });
  });

  test('should return generic message if user is not found (no email leakage)', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);

    await forgotPassword({ body: { email: 'nobody@example.com' } }, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Si el email está registrado, recibirás un enlace de recuperación' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  test('should delete old reset tokens, create new one and send email', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[{ id: 1, email: 'test@example.com' }]])  // user lookup
      .mockResolvedValueOnce([{}])                                      // DELETE old tokens
      .mockResolvedValueOnce([{}]);                                     // INSERT new token

    sendMail.mockResolvedValue(true);

    await forgotPassword({ body: { email: 'test@example.com' } }, res);

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM password_resets WHERE user_id = ?',
      [1]
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO password_resets'),
      expect.arrayContaining([1, expect.any(String), expect.any(Date)])
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('Recuperar contraseña')
      })
    );
  });

  test('should return generic success message even when user exists', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[{ id: 1, email: 'test@example.com' }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    sendMail.mockResolvedValue(true);

    await forgotPassword({ body: { email: 'test@example.com' } }, res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Si el email está registrado, recibirás un enlace de recuperación' });
  });

  test('should call sendError on unexpected exception', async () => {
    const { sendError } = require('../../utils/response.utils');
    const res = mockRes();
    pool.query.mockRejectedValue(new Error('DB error'));

    await forgotPassword({ body: { email: 'test@example.com' } }, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'Error al procesar la solicitud'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// resetPassword
// ══════════════════════════════════════════════════════════════════════════════

describe('resetPassword', () => {
  test('should return 400 if token is missing', async () => {
    const res = mockRes();
    await resetPassword({ body: { password: 'newpass123' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token y contraseña son obligatorios' });
  });

  test('should return 400 if password is missing', async () => {
    const res = mockRes();
    await resetPassword({ body: { token: 'abc123' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token y contraseña son obligatorios' });
  });

  test('should return 400 if both token and password are missing', async () => {
    const res = mockRes();
    await resetPassword({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token y contraseña son obligatorios' });
  });

  test('should return 400 if password is shorter than 8 characters', async () => {
    const res = mockRes();
    await resetPassword({ body: { token: 'abc123', password: '12345' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña debe tener al menos 8 caracteres' });
  });

  test('should return 400 if password lacks uppercase, number or symbol', async () => {
    const res = mockRes();
    await resetPassword({ body: { token: 'abc123', password: 'alllowercase' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña debe contener al menos una mayúscula, un número y un símbolo' });
  });

  test('should return 400 if token is not found', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);

    await resetPassword({ body: { token: 'invalid_token', password: 'Newpass123!' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
  });

  test('should return 400 if token has already been used', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[
      { id: 1, user_id: 10, expires_at: new Date(Date.now() + 3600000), used: 1 }
    ]]);

    await resetPassword({ body: { token: 'used_token', password: 'Newpass123!' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El token ya fue utilizado' });
  });

  test('should return 400 if token has expired', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[
      { id: 1, user_id: 10, expires_at: new Date(Date.now() - 3600000), used: 0 }
    ]]);

    await resetPassword({ body: { token: 'expired_token', password: 'Newpass123!' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'El token expiró. Solicitá uno nuevo' });
  });

  test('should hash new password, update user and mark token as used on success', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[
        { id: 1, user_id: 10, expires_at: new Date(Date.now() + 3600000), used: 0 }
      ]])   // SELECT token
      .mockResolvedValueOnce([{}])  // UPDATE users password
      .mockResolvedValueOnce([{}]); // UPDATE password_resets used

    bcrypt.hash.mockResolvedValue('new_hashed_pw');

    await resetPassword({ body: { token: 'valid_token', password: 'Newpass123!' } }, res);

    expect(bcrypt.hash).toHaveBeenCalledWith('Newpass123!', 10);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      ['new_hashed_pw', 10]
    );
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE password_resets SET used = 1 WHERE id = ?',
      [1]
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Contraseña actualizada correctamente' });
  });

  test('should call sendError on unexpected exception', async () => {
    const { sendError } = require('../../utils/response.utils');
    const res = mockRes();
    pool.query.mockRejectedValue(new Error('DB error'));

    await resetPassword({ body: { token: 'tok', password: 'Passw0rd!' } }, res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'Error al restablecer la contraseña'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// deleteAccount
// ══════════════════════════════════════════════════════════════════════════════

describe('deleteAccount', () => {
  const makeReq = (body = {}, userId = 1) => ({
    body,
    user: { id: userId }
  });

  test('should return 400 if password is missing', async () => {
    const res = mockRes();
    await deleteAccount(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña es obligatoria para eliminar la cuenta' });
  });

  test('should return 404 if user is not found', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);

    await deleteAccount(makeReq({ password: 'pass123' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuario no encontrado' });
  });

  test('should return 403 if user is an admin', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[{ id: 1, password_hash: 'hash', role_id: 1 }]]);

    await deleteAccount(makeReq({ password: 'pass123' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Los administradores no pueden eliminar su cuenta desde aquí' });
  });

  test('should return 401 if password is incorrect', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[{ id: 1, password_hash: 'hash', role_id: 3 }]]);
    bcrypt.compare.mockResolvedValue(false);

    await deleteAccount(makeReq({ password: 'wrongpw' }), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'La contraseña es incorrecta' });
  });

  test('should delete user and return success message', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[{ id: 1, password_hash: 'hash', role_id: 3 }]])
      .mockResolvedValueOnce([{}]);

    bcrypt.compare.mockResolvedValue(true);

    await deleteAccount(makeReq({ password: 'correctpw' }), res);

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM users WHERE id = ?', [1]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cuenta eliminada correctamente' });
  });

  test('should allow moderator (role_id=2) to delete their account', async () => {
    const res = mockRes();
    pool.query
      .mockResolvedValueOnce([[{ id: 1, password_hash: 'hash', role_id: 2 }]])
      .mockResolvedValueOnce([{}]);

    bcrypt.compare.mockResolvedValue(true);

    await deleteAccount(makeReq({ password: 'pass123' }), res);

    expect(res.json).toHaveBeenCalledWith({ message: 'Cuenta eliminada correctamente' });
  });

  test('should call sendError on unexpected exception', async () => {
    const { sendError } = require('../../utils/response.utils');
    const res = mockRes();
    pool.query.mockRejectedValue(new Error('DB error'));

    await deleteAccount(makeReq({ password: 'pass123' }), res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'Error al eliminar la cuenta'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// banStatus
// ══════════════════════════════════════════════════════════════════════════════

describe('banStatus', () => {
  const makeReq = (userId = 1) => ({
    user: { id: userId }
  });

  test('should return banned: false if user has no active bans', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);

    await banStatus(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith({ banned: false });
  });

  test('should return banned: true with reason for permanent ban', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[
      { reason: 'Spamming', type: 'permanent', expires_at: null }
    ]]);

    await banStatus(makeReq(), res);

    expect(res.json).toHaveBeenCalledWith({
      banned: true,
      reason: 'Spamming',
      type: 'permanent',
      expires_at: null,
      hours_left: null
    });
  });

  test('should return banned: true with hours_left for temporary ban', async () => {
    const futureDate = new Date(Date.now() + 5 * 3600000); // 5 hours from now
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[
      { reason: 'Offensive language', type: 'temporary', expires_at: futureDate }
    ]]);

    await banStatus(makeReq(), res);

    const response = res.json.mock.calls[0][0];
    expect(response.banned).toBe(true);
    expect(response.reason).toBe('Offensive language');
    expect(response.type).toBe('temporary');
    expect(response.expires_at).toBe(futureDate);
    expect(response.hours_left).toBeGreaterThanOrEqual(4);
    expect(response.hours_left).toBeLessThanOrEqual(6);
  });

  test('should return hours_left as 0 for temporary ban that just expired', async () => {
    const pastDate = new Date(Date.now() - 1000); // 1 second ago
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[
      { reason: 'Minor offense', type: 'temporary', expires_at: pastDate }
    ]]);

    await banStatus(makeReq(), res);

    const response = res.json.mock.calls[0][0];
    expect(response.banned).toBe(true);
    expect(response.hours_left).toBe(0);
  });

  test('should query bans with the correct user_id', async () => {
    const res = mockRes();
    pool.query.mockResolvedValueOnce([[]]);

    await banStatus(makeReq(42), res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      [42]
    );
  });

  test('should call sendError on unexpected exception', async () => {
    const { sendError } = require('../../utils/response.utils');
    const res = mockRes();
    pool.query.mockRejectedValue(new Error('DB error'));

    await banStatus(makeReq(), res);

    expect(sendError).toHaveBeenCalledWith(
      res,
      expect.any(Error),
      'Error al verificar estado de ban'
    );
  });
});
