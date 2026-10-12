// Cargar .env de la RAÍZ del proyecto siempre (independiente del cwd desde donde se lance)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const categoriesRoutes = require('./routes/categories.routes');
const postsRoutes = require('./routes/posts.routes');
const commentsRoutes = require('./routes/comments.routes');
const votesRoutes = require('./routes/votes.routes');
const tagsRoutes = require('./routes/tags.routes');
const adminRoutes = require('./routes/admin.routes');
const reportsRoutes = require('./routes/reports.routes');
const bansRoutes = require('./routes/bans.routes');
const errorHandler = require('./middleware/errorHandler');
const pool = require('./db/connection');

if (!process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el .env (copiá .env.example y generá un secreto largo y aleatorio).');
}
if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('changeme'))) {
  throw new Error('JWT_SECRET es demasiado débil para producción. Generá uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
}

const app = express();

// Detrás de un proxy (Nginx, Render, Railway...) el rate limit tiene que ver la IP real del cliente.
// TRUST_PROXY=1 significa "confiar en un proxy delante".
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// Seguridad: headers HTTP (helmet) y compresión de respuestas
app.use(helmet({
  contentSecurityPolicy: false, // el front usa scripts inline; se endurece en deploy
  crossOriginResourcePolicy: { policy: 'cross-origin' } // permite cargar /uploads
}));
app.use(compression());

// CORS restringido al frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting general. Cada página del front hace 3-5 llamadas a la API y en la facultad
// muchos alumnos salen a internet con la misma IP, así que 100 era muy poco.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: Number(process.env.RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intentá más tarde' }
});

// Rate limiting para rutas de autenticación (más estricto).
// Solo cuentan los intentos fallidos: frena la fuerza bruta sin bloquear a toda una facultad
// que sale a internet con la misma IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos fallidos por IP cada 15 min
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de autenticación, esperá 15 minutos' }
});

// Rate limiting para forgot-password (por IP)
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 requests por IP cada hora
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de recuperación, esperá 1 hora' }
});

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'Front')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/posts/:postId/comments', commentsRoutes);
app.use('/api', votesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/bans', bansRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Ruta de API inexistente → JSON (antes devolvía la página HTML de error de Express)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware de error global (debe ser el último)
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });

  // Apagado prolijo: termina los requests en curso y cierra las conexiones a la DB
  const shutdown = (signal) => {
    console.log(`${signal} recibido, cerrando servidor...`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
