const jwt = require('jsonwebtoken');

/** Firma el JWT de sesión. token_version permite invalidar sesiones viejas (cambio de contraseña). */
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, token_version: user.token_version },
    process.env.JWT_SECRET
  );
}

module.exports = { signToken };
