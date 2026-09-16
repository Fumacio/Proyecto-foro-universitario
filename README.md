# Foro Universitario - UTN FRT

Foro academico para la comunidad de la UTN FRT.

## Caracteristicas Principales
- Autenticacion segura (JWT).
- Sistema de posts, comentarios y votos.
- Moderacion: Reportes y sistema de bans.
- Perfiles de usuario y gestion de cuenta.
- Panel de administracion.

## Tecnologias
- Backend: Node.js, Express, MySQL.
- Frontend: HTML/CSS/JS (Vanilla).

## Configuracion
1. Clonar el repositorio.
2. Instalar dependencias: `npm install`.
3. Configurar `.env` basado en `.env.example`.
4. Ejecutar: `npm run dev`.

---

## Seguridad aplicada

### Autenticacion y contrasenas
- JWT con `expiresIn: '7d'` y `token_version` para invalidacion al cambiar contrasena.
- Contrasena minimo 8 caracteres, con mayuscula, numero y simbolo.
- Validacion de formato de email, username (3-30 chars, alfanumerico y guion bajo).
- Rate limiting en login (10/15min), registro (10/15min) y forgot-password (5/hora).
- Token de recuperacion con expiracion de 1 hora y marco como usado.

### Proteccion de datos
- `Back/.env` removido del tracking de git y secrets rotados.
- `FRONTEND_URL` requerido en produccion (lanza error si falta).
- Body size limit en `express.json()` (1MB max).
- Headers de seguridad: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`.

### Validacion de inputs
- Posts: titulo (max 200), contenido (max 10,000), category_id verificado en DB.
- Comentarios: contenido (max 5,000), parent_id verificado que pertenezca al post.
- Categories: nombre (max 100), descripcion (max 500).
- Tags: nombre (max 50), color (regex hex #RRGGBB).
- Bans: `duration_hours` validado como entero positivo.
- Users admin: `role_id` validado contra tabla roles, username y email re-validados.

### Proteccion XSS
- `escapeHtml()` aplicado en: nav.js (username, role), posts.js (tag names), admin.js.
- Tags: `t.color` validado con regex hex antes de inyectar en inline style/onclick.
- Admin: onclick handlers migrados a `data-*` attributes.
- `escapeTextarea()` implementado en `api.js`.

### Rate limiting
- General: 100 req/15min por IP.
- Auth: 10 req/15min por IP.
- Forgot-password: 5 req/hora por IP.
- Votos: 30 req/min por IP.
- Uploads (imagen y avatar): 20 req/hora por IP.

### Logging seguro
- `errorHandler.js`: En produccion solo loguea mensaje e ID, no el objeto completo.
- `response.utils.js`: En produccion solo loguea mensaje, no el objeto error.
- `posts.controller.js`: Todos los `console.error` reemplazados por `sendError` centralizado.

### Moderacion
- Middleware de ban que bloquea acciones de usuarios baneados.
- Uploads con validacion MIME type, extension y tamano maximo.
- Filenames aleatorios via `crypto.randomBytes`.
- Password hasheado con `bcrypt` (10 rounds).
- CORS restringido a `FRONTEND_URL`.

### Cache
- `token_version` cacheado con TTL de 30 segundos en auth middleware (reduce queries a DB).

---

## Backend
- 10 controladores refactorizados con `sendError` centralizado.
- Utilidades compartidas: `post.utils.js`, `tree.utils.js`, `response.utils.js`.
- Migraciones eliminadas de `server.js` (solo usa `schema.sql`).

## Frontend
- Funciones compartidas en `api.js`: `renderAvatar`, `renderPostCard`, `renderPagination`.
- Eliminacion de codigo duplicado en `index.js`, `posts.js`, `nav.js`.
- `escapeHtml` para prevencion de XSS.

## Funcionalidad
- Sistema de registro y login con JWT.
- Recuperacion de contrasena por email.
- Sistema de reportes y bans.
- Panel de administracion.
- Perfiles de usuario con estadisticas.
- Busqueda con paginacion y filtros.

## Tests
- 315 pruebas unitarias en 17 suites.
- Cobertura: controllers (auth, posts, comments, categories, votes, bans, users, reports, tags, admin), middleware (auth, ban, role, errorHandler), utils (response, tree, mailer).
- Ejecutar: `npx jest --verbose`.
