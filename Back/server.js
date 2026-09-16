require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
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

const app = express();

// CORS restringido al frontend
const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl && process.env.NODE_ENV === 'production') {
  console.error('FATAL: FRONTEND_URL no está configurado en .env');
  process.exit(1);
}
app.use(cors({
  origin: frontendUrl || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones, intentá más tarde' }
});

// Rate limiting para rutas de autenticación (más estricto)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos por IP cada 15 min
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

// Rate limiting para votos (por usuario)
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 votos por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados votos, esperá un momento' }
});

app.use(express.json({ limit: '1mb' }));

// Headers de seguridad
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'Front')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use('/api/posts', voteLimiter);
app.use('/api/comments', voteLimiter);
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

// Middleware de error global (debe ser el último)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
