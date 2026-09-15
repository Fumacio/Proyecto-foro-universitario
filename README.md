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

## Pendientes - Seguridad

### CRITICO

| # | Archivo | Problema | Fix |
|---|---------|----------|-----|
| 1 | `Back/controllers/auth.controller.js:32-35, 67-70` | JWT sin `expiresIn` — tokens validos para siempre. Si se roba un token, funciona eternamente. | Agregar `{ expiresIn: '24h' }` a todos los `jwt.sign()` |
| 2 | `Back/.env` commiteado en historial de Git | Secretos expuestos en commit `cb92006` (DB_PASS, JWT_SECRET) | Rotar todos los secretos y limpiar historial con `git filter-branch` |

### ALTO

| # | Archivo | Problema | Fix |
|---|---------|----------|-----|
| 3 | `Back/controllers/auth.controller.js:10-14` | Registro sin validacion de email, largo de password, ni formato de username | Agregar validacion con `joi` o `express-validator` |
| 4 | `Back/controllers/auth.controller.js:148-151` | `updateProfile` genera JWT sin `token_version` actualizado de DB | Seleccionar `token_version` en la query del UPDATE |
| 5 | `Back/controllers/users.controller.js:40-48` | Admin puede setear `role_id` invalido (no existe en tabla roles) | Validar que `role_id` exista en la tabla `roles` antes del UPDATE |
| 6 | `Back/controllers/auth.controller.js:215` | Password minimo debil — solo 6 chars, sin complejidad | Requerir minimo 8 chars, mayuscula, numero y simbolo |

### MEDIO

| # | Archivo | Problema | Fix |
|---|---------|----------|-----|
| 7 | `Front/js/nav.js:29` | XSS via `user.username` inyectado sin `escapeHtml()` | Usar `renderAvatar()` de `api.js` que ya escapa |
| 8 | `Front/js/posts.js:66` | XSS via `t.color` en inline style y onclick sin sanitizar | Validar formato hex color en backend y frontend |
| 9 | `Back/controllers/posts.controller.js` | Sin validacion de largo de `title`/`content` ni existencia de `category_id` | Agregar validacion de longitudes y verificar category_id en DB |
| 10 | `Back/controllers/comments.controller.js` | Sin validacion de largo de `content` ni que `parent_id` pertenezca al post | Agregar validacion de longitudes y verificar parent_id |
| 11 | `Back/controllers/bans.controller.js:16-18` | `duration_hours` no valida que sea entero positivo | Validar `duration_hours > 0` y que sea entero |
| 12 | `Back/routes/votes.routes.js` | Sin rate limiting dedicado en votos | Agregar rate limiting por usuario |
| 13 | `Back/routes/posts.routes.js:10` | Upload de imagen sin rate limiting | Agregar rate limiting en uploads |
| 14 | `Back/routes/users.routes.js:13` | Upload de avatar sin rate limiting | Agregar rate limiting en uploads |
| 15 | `Back/middleware/errorHandler.js:2` | `console.error` loguea objeto completo del error (puede contener queries SQL, paths internos) | En produccion, loguear solo mensaje y ID, no el objeto completo |
| 16 | `Back/utils/response.utils.js:2` | Mismo problema — loguea el objeto `err` completo | Sanitizar logs en produccion |
| 17 | `Back/server.js` | CORS con fallback a `localhost:3000` en produccion si `FRONTEND_URL` no esta seteado | Requerir `FRONTEND_URL` en produccion, lanzar error si falta |

### BAJO

| # | Archivo | Problema | Fix |
|---|---------|----------|-----|
| 18 | `Back/middleware/auth.js:17-19` | Query a DB en cada request autenticada para verificar `token_version` | Considerar cache con TTL corto |
| 19 | `Back/controllers/categories.controller.js` | Sin validacion de largo de `name`/`description` | Agregar limites de longitud |
| 20 | `Back/controllers/tags.controller.js` | Sin validacion de largo de `name` ni formato de `color` | Validar nombre (max 50) y color (regex hex) |
| 21 | `Back/controllers/posts.controller.js` | `console.error` con objeto completo del error en multiples places | Sanitizar logs |

---

## Completado

### Seguridad aplicada
- JWT con `token_version` para invalidacion al cambiar contrasena
- CORS restringido a `FRONTEND_URL`
- Rate limiting en login, registro y forgot-password
- Middleware de ban que bloquea acciones de usuarios baneados
- Uploads con validacion MIME type, extension y tamaño maximo
- Filenames aleatorios via `crypto.randomBytes`
- Password hasheado con `bcrypt` (10 rounds)
- Login con campos explicitos (no expone hash innecesariamente)
- Middleware de error global

### Backend
- 10 controladores refactorizados con `sendError` centralizado
- Utilidades compartidas: `post.utils.js`, `tree.utils.js`, `response.utils.js`
- Migraciones eliminadas de `server.js` (solo usa `schema.sql`)

### Frontend
- Funciones compartidas en `api.js`: `renderAvatar`, `renderPostCard`, `renderPagination`
- Eliminacion de codigo duplicado en `index.js`, `posts.js`, `nav.js`
- `escapeHtml` para prevencion de XSS

### Funcionalidad
- Sistema de registro y login con JWT
- Recuperacion de contrasena por email
- Sistema de reportes y bans
- Panel de administracion
- Perfiles de usuario con estadisticas
- Busqueda con paginacion y filtros
