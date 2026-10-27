# Contrato de la API — Foro UTN v2

Este documento es la **fuente de verdad** compartida por `server/` y `web/`. Si algo cambia, se cambia acá primero.

## Convenciones
- Base: `/api`. JSON en request y response (salvo uploads `multipart/form-data`, campo `file`).
- Auth: cookie httpOnly `token` (JWT, 30 días, `sameSite=lax`, `secure` en producción). El front usa
  `fetch(..., { credentials: 'include' })`. No hay tokens en localStorage.
- Fechas: strings ISO 8601.
- IDs: números enteros.
- Errores: status HTTP correcto + cuerpo
  ```json
  { "error": "Mensaje legible en español", "code": "VALIDATION|UNAUTHORIZED|FORBIDDEN|BANNED|NOT_FOUND|CONFLICT|RATE_LIMIT|LOCKED|INTERNAL", "details": { "campo": "mensaje" } }
  ```
  `details` solo en errores de validación (400).
- Paginación por página: query `page` (desde 1, default 1) y `limit` (default 20, máx 50). Respuesta:
  ```ts
  interface Paginated<T> { items: T[]; page: number; hasMore: boolean; total?: number }
  ```
- Usuario **baneado**: puede navegar y leer, pero toda escritura (postear, comentar, votar, mensajes,
  reportar, seguir, unirse) responde `403 { code: "BANNED" }`.
- Endpoints marcados 🔒 requieren sesión (401 `UNAUTHORIZED` si no). 🛡 = `MODERATOR` o `ADMIN`. 👑 = solo `ADMIN`.

## Tipos
```ts
type Role = 'ADMIN' | 'MODERATOR' | 'PROFESSOR' | 'STUDENT';

interface UserSummary {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
}

interface Ban { reason: string; expiresAt: string | null /* null = permanente */; createdAt: string }

interface Me extends UserSummary {
  email: string;
  bio: string | null;
  career: string | null;
  createdAt: string;
  karma: number;
  unreadNotifications: number;
  unreadMessages: number;
  ban: Ban | null;               // ban activo, o null
}

interface UserProfile extends UserSummary {
  bio: string | null;
  career: string | null;
  createdAt: string;
  karma: { post: number; comment: number; total: number };
  postCount: number;
  commentCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;          // false si no hay sesión o es uno mismo
  isBanned: boolean;
}

interface CommunityRef { id: number; slug: string; name: string; icon: string; color: string }

interface Community extends CommunityRef {
  description: string;
  rules: string[];
  memberCount: number;
  postCount: number;
  isMember: boolean;
  createdAt: string;
}

interface Tag { id: number; name: string; slug: string; color: string; postCount: number }

type PostType = 'TEXT' | 'QUESTION' | 'POLL' | 'LINK';

interface PollOption { id: number; text: string; votes: number }
interface Poll { options: PollOption[]; totalVotes: number; myOptionId: number | null; closesAt: string | null; isClosed: boolean }

interface PostListItem {
  id: number;
  type: PostType;
  title: string;
  excerpt: string;               // texto plano sin markdown, máx ~280 chars
  url: string | null;            // solo LINK
  imageUrl: string | null;       // imagen de portada (cualquier tipo)
  author: UserSummary | null;    // null si la cuenta fue borrada
  community: CommunityRef;
  tags: Tag[];
  score: number;
  myVote: -1 | 0 | 1;
  commentCount: number;
  viewCount: number;
  isBookmarked: boolean;
  isPinned: boolean;
  isLocked: boolean;
  acceptedCommentId: number | null;   // QUESTION resuelta si != null
  poll: Poll | null;             // solo POLL
  createdAt: string;
  editedAt: string | null;
}

interface PostDetail extends PostListItem {
  body: string;                  // markdown crudo
  canEdit: boolean;              // autor
  canModerate: boolean;          // mod/admin
}

interface Comment {
  id: number;
  postId: number;
  parentId: number | null;
  body: string;                  // "" si isDeleted
  isDeleted: boolean;
  author: UserSummary | null;    // null si isDeleted o cuenta borrada
  score: number;
  myVote: -1 | 0 | 1;
  isAccepted: boolean;
  createdAt: string;
  editedAt: string | null;
  replies: Comment[];            // árbol completo
}

interface CommentWithPost extends Omit<Comment, 'replies'> {
  post: { id: number; title: string; community: CommunityRef };
}

type NotificationType = 'POST_REPLY' | 'COMMENT_REPLY' | 'MENTION' | 'FOLLOW' | 'ANSWER_ACCEPTED' | 'MOD';

interface Notification {
  id: number;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: UserSummary | null;
  post: { id: number; title: string } | null;
  comment: { id: number; excerpt: string } | null;
  message: string | null;        // texto libre (p. ej. acciones de moderación)
}

interface Conversation {
  id: number;
  other: UserSummary;
  lastMessage: { body: string; createdAt: string; senderId: number } | null;
  unread: number;
  updatedAt: string;
}

interface Message { id: number; conversationId: number; sender: UserSummary; body: string; createdAt: string }

type ReportReason = 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'OFF_TOPIC' | 'OTHER';
type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

interface Report {
  id: number;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reporter: UserSummary | null;
  post: { id: number; title: string; author: UserSummary | null } | null;
  comment: { id: number; body: string; postId: number; author: UserSummary | null } | null;
  resolvedBy: UserSummary | null;
  resolvedAt: string | null;
}

interface AdminUser extends UserSummary {
  email: string;
  createdAt: string;
  postCount: number;
  commentCount: number;
  ban: Ban | null;
}
```

## Endpoints

### Auth
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/register` | `{ username, email, password, displayName? }` | `201 { user: Me }` + cookie |
| POST | `/auth/login` | `{ login /* email o username */, password }` | `{ user: Me }` + cookie |
| POST | `/auth/logout` | — | `204` (borra cookie) |
| GET | `/auth/me` | — | `{ user: Me \| null }` (**200 con null** si no hay sesión válida) |
| POST | `/auth/forgot-password` | `{ email }` | `{ ok: true }` siempre (no revela si existe). En dev sin SMTP, loguea el link `${FRONTEND_URL}/reset-password?token=...` en consola |
| POST | `/auth/reset-password` | `{ token, password }` | `{ ok: true }` (sube tokenVersion) |
| POST 🔒 | `/auth/change-password` | `{ currentPassword, newPassword }` | `{ ok: true }` + cookie nueva (otras sesiones caen) |

Validación: `username` 3–20, `^[a-zA-Z0-9_]+$`, único (case-insensitive). `password` 8–100 con al menos una letra y un número. `displayName` ≤ 40.

### Usuarios
| Método | Ruta | Body/Query | Respuesta |
|---|---|---|---|
| GET | `/users/:username` | — | `{ user: UserProfile }` |
| GET | `/users/:username/posts` | `page, limit, sort=new\|top` | `Paginated<PostListItem>` |
| GET | `/users/:username/comments` | `page, limit` | `Paginated<CommentWithPost>` (sin borrados) |
| GET | `/users/:username/followers` / `/following` | `page` | `Paginated<UserSummary>` |
| POST 🔒 | `/users/:username/follow` | — | `{ isFollowing: true, followerCount }` |
| DELETE 🔒 | `/users/:username/follow` | — | `{ isFollowing: false, followerCount }` |
| PATCH 🔒 | `/users/me` | `{ displayName?, bio? (≤500), career? (≤100) }` | `{ user: Me }` |
| POST 🔒 | `/users/me/avatar` | multipart `file` (png/jpg/webp/gif ≤ 5 MB) | `{ user: Me }` |
| DELETE 🔒 | `/users/me/avatar` | — | `{ user: Me }` |
| DELETE 🔒 | `/users/me` | `{ password }` | `204` (borra cuenta; posts quedan con author null) |
| GET 🔒 | `/users/me/bookmarks` | `page, limit` | `Paginated<PostListItem>` |

### Comunidades
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/communities` | `?joined=true` (🔒 solo las mías) | `{ items: Community[] }` (orden: miembros desc) |
| GET | `/communities/:slug` | — | `{ community: Community }` |
| POST 👑 | `/communities` | `{ name, slug, description, icon /* emoji */, color /* #hex */, rules: string[] }` | `201 { community }` |
| PATCH 👑 | `/communities/:slug` | parcial del anterior (slug no cambia) | `{ community }` |
| DELETE 👑 | `/communities/:slug` | — | `204` |
| POST 🔒 | `/communities/:slug/join` | — | `{ isMember: true, memberCount }` |
| DELETE 🔒 | `/communities/:slug/join` | — | `{ isMember: false, memberCount }` |

### Etiquetas
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/tags` | — | `{ items: Tag[] }` (orden: postCount desc) |
| POST 👑 | `/tags` | `{ name, color }` (slug se genera) | `201 { tag }` |
| DELETE 👑 | `/tags/:id` | — | `204` |

### Posts
| Método | Ruta | Body/Query | Respuesta |
|---|---|---|---|
| GET | `/posts` | ver abajo | `Paginated<PostListItem>` |
| POST 🔒 | `/posts` | ver abajo | `201 { post: PostDetail }` |
| GET | `/posts/:id` | — | `{ post: PostDetail }` (suma 1 a viewCount) |
| PATCH 🔒 | `/posts/:id` | `{ title?, body?, tagIds?, imageUrl? }` autor o 🛡 | `{ post: PostDetail }` (setea editedAt) |
| DELETE 🔒 | `/posts/:id` | autor o 🛡 | `204` |
| POST 🔒 | `/posts/:id/vote` | `{ value: 1 \| -1 \| 0 }` (0 = quitar) | `{ score, myVote }` |
| POST 🔒 | `/posts/:id/bookmark` | — | `{ isBookmarked: true }` |
| DELETE 🔒 | `/posts/:id/bookmark` | — | `{ isBookmarked: false }` |
| POST 🛡 | `/posts/:id/pin` | `{ pinned: boolean }` | `{ isPinned }` |
| POST 🛡 | `/posts/:id/lock` | `{ locked: boolean }` | `{ isLocked }` |
| POST 🔒 | `/posts/:id/accept` | `{ commentId: number \| null }` autor del post QUESTION o 🛡 | `{ acceptedCommentId }` |
| POST 🔒 | `/posts/:id/poll/vote` | `{ optionId }` (cambiar voto permitido; 409 si cerrada) | `{ poll: Poll }` |

**GET `/posts` query**
- `sort`: `hot` (default) · `new` · `top` · `comments`
- `t`: `day` · `week` · `month` · `year` · `all` (default `all`; solo aplica a `top` y `comments`)
- `feed`: `all` (default) · `following` (🔒 comunidades unidas + usuarios seguidos)
- `community`: slug · `tag`: slug · `author`: username · `type`: PostType · `unanswered=true` (QUESTION sin respuesta aceptada)
- `q`: texto (busca en título y cuerpo)
- `page`, `limit`
- Si hay `community` y `sort=hot`, los fijados (`isPinned`) van primero.
- **Hot**: `sign(score)*log10(max(|score|,1)) + createdAtEpochSec/45000` (guardado en columna y recalculado al votar).

**POST `/posts` body**
```ts
{
  communityId: number;
  type: PostType;
  title: string;            // 3–200
  body?: string;            // ≤ 40000, markdown (requerido no-vacío para TEXT y QUESTION)
  url?: string;             // requerido para LINK (http/https)
  imageUrl?: string | null; // debe ser una URL devuelta por /uploads/image (empieza con /uploads/)
  tagIds?: number[];        // máx 5
  poll?: { options: string[] /* 2–6, cada una 1–80 */; closesInDays?: number | null /* 1–30 */ }; // requerido para POLL
}
```

### Comentarios
| Método | Ruta | Body/Query | Respuesta |
|---|---|---|---|
| GET | `/posts/:id/comments` | `sort=best\|new\|old` (default best = score desc) | `{ items: Comment[] /* raíces con replies */, total: number }` |
| POST 🔒 | `/posts/:id/comments` | `{ body /* 1–10000 */, parentId? }` | `201 { comment: Comment }` (423 `LOCKED` si el post está cerrado, salvo 🛡) |
| PATCH 🔒 | `/comments/:id` | `{ body }` autor | `{ comment: Comment }` |
| DELETE 🔒 | `/comments/:id` | autor o 🛡 | `204` (soft delete: queda en el árbol como borrado) |
| POST 🔒 | `/comments/:id/vote` | `{ value: 1 \| -1 \| 0 }` | `{ score, myVote }` |

El comentario aceptado (`isAccepted`) se ordena primero entre las raíces.
Menciones `@username` en posts y comentarios generan notificación `MENTION` (no a uno mismo, máx 10 por texto).

### Uploads
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST 🔒 | `/uploads/image` | multipart `file` (png/jpg/webp/gif ≤ 5 MB) | `201 { url: "/uploads/xxxx.webp" }` |

Los archivos se sirven estáticos en `/uploads/*` (fuera de `/api`).

### Búsqueda
| Método | Ruta | Query | Respuesta |
|---|---|---|---|
| GET | `/search` | `q` (≥ 2 chars) | `{ posts: PostListItem[] /* ≤ 8 */, users: UserSummary[] /* ≤ 6 */, communities: CommunityRef[] /* ≤ 5 */ }` |

Para resultados completos paginados de posts se usa `GET /posts?q=`.

### Notificaciones
| Método | Ruta | Body/Query | Respuesta |
|---|---|---|---|
| GET 🔒 | `/notifications` | `page, limit, unread=true?` | `Paginated<Notification> & { unreadCount: number }` |
| POST 🔒 | `/notifications/read` | `{ ids?: number[] }` (sin ids = todas) | `{ unreadCount }` |

### Mensajes directos
| Método | Ruta | Body/Query | Respuesta |
|---|---|---|---|
| GET 🔒 | `/conversations` | — | `{ items: Conversation[] }` (orden: updatedAt desc) |
| POST 🔒 | `/conversations` | `{ username }` | `{ conversation: Conversation }` (crea o devuelve la existente; 400 si es uno mismo) |
| GET 🔒 | `/conversations/:id/messages` | `before?` (id), `limit` (default 30) | `{ items: Message[] /* orden ascendente */, hasMore }` |
| POST 🔒 | `/conversations/:id/messages` | `{ body /* 1–4000 */ }` | `201 { message: Message }` |
| POST 🔒 | `/conversations/:id/read` | — | `{ unreadMessages: number }` (total del usuario) |

### Tiempo real (SSE)
`GET /api/stream` 🔒 — `Content-Type: text/event-stream`. Autentica con la cookie. Ping cada 25 s (`: ping`).
Eventos:
- `event: notification` · `data: Notification`
- `event: message` · `data: Message` (al destinatario y también al emisor, para otras pestañas)
- `event: unread` · `data: { notifications: number, messages: number }` (después de cada cambio)

### Reportes y moderación
| Método | Ruta | Body/Query | Respuesta |
|---|---|---|---|
| POST 🔒 | `/reports` | `{ postId? \| commentId?, reason: ReportReason, details? (≤ 500) }` (exactamente uno de los dos) | `201 { ok: true }` |
| GET 🛡 | `/reports` | `status=PENDING\|RESOLVED\|DISMISSED` (default PENDING), `page` | `Paginated<Report>` |
| PATCH 🛡 | `/reports/:id` | `{ status: 'RESOLVED' \| 'DISMISSED', deleteContent?: boolean }` | `{ report: Report }` |

### Admin
| Método | Ruta | Body/Query | Respuesta |
|---|---|---|---|
| GET 🛡 | `/admin/stats` | — | `{ users, posts, comments, communities, pendingReports, activeBans, activity: { date: 'YYYY-MM-DD', posts: number, comments: number, users: number }[] /* últimos 14 días */ }` |
| GET 🛡 | `/admin/users` | `q, page, limit, role?` | `Paginated<AdminUser> & { total }` |
| PATCH 👑 | `/admin/users/:id` | `{ role: Role }` (no puede cambiarse el propio rol) | `{ user: AdminUser }` |
| POST 🛡 | `/admin/users/:id/ban` | `{ reason (3–500), days: number \| null /* null = permanente, 1–3650 */ }` | `{ user: AdminUser }` (no se puede banear a ADMIN ni a uno mismo; genera notificación `MOD`) |
| DELETE 🛡 | `/admin/users/:id/ban` | — | `{ user: AdminUser }` |
| GET 🛡 | `/admin/bans` | `page` | `Paginated<AdminUser>` (solo con ban activo) |

### Estadísticas públicas
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/stats` | `{ users, posts, comments, communities }` |
| GET | `/health` | `{ status: 'ok' }` |

## Datos de ejemplo (seed)
Cuentas (todas con contraseña **`foro1234`**):
| Usuario | Email | Rol |
|---|---|---|
| `admin` | admin@foro.utn | ADMIN |
| `moderadora` | mod@foro.utn | MODERATOR |
| `prof_garcia` | garcia@foro.utn | PROFESSOR |
| `lucia_dev`, `tomi_ing`, `sofi_mate`, `nico_frt`, `vale_sistemas` | `<usuario>@foro.utn` | STUDENT |

---

# v2.1 — Nuevas funciones

Login con Google · reacciones con emojis · borradores · avisos por mail · PWA · archivos adjuntos (PDF, Word, Excel, PowerPoint, imágenes, zip, código…).
Todo lo de arriba sigue igual salvo los **campos agregados** que se marcan acá.

## Tipos nuevos y campos agregados
```ts
// ---------- Reacciones ----------
// Conjunto fijo (el server rechaza cualquier otro con 400):
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🤔', '🔥'] as const;
type ReactionEmoji = typeof REACTIONS[number];
interface ReactionSummary { emoji: ReactionEmoji; count: number; reacted: boolean /* el usuario actual reaccionó con este */ }
// Se devuelven solo los emojis con count > 0, en el orden de REACTIONS.

// ---------- Adjuntos ----------
type AttachmentKind = 'IMAGE' | 'PDF' | 'DOCUMENT' | 'SPREADSHEET' | 'PRESENTATION' | 'ARCHIVE' | 'TEXT' | 'OTHER';
interface Attachment {
  id: number;
  filename: string;          // nombre original saneado, p. ej. "Resumen Parcial 1.pdf"
  mimeType: string;
  size: number;              // bytes
  kind: AttachmentKind;
  url: string;               // descarga: "/api/attachments/:id/download"
  previewUrl: string | null; // vista en el navegador (solo IMAGE y PDF): "/api/attachments/:id/view"
  downloadCount: number;
  createdAt: string;
}

// ---------- Preferencias ----------
interface Preferences {
  emailReplies: boolean;     // POST_REPLY, COMMENT_REPLY, ANSWER_ACCEPTED (default true)
  emailMentions: boolean;    // MENTION (default true)
  emailMessages: boolean;    // mensajes directos (default true)
  emailFollows: boolean;     // FOLLOW (default false)
  emailReactions: boolean;   // REACTION (default false)
}

// ---------- Borradores ----------
interface Draft {
  id: number;
  communityId: number | null;
  type: PostType;
  title: string;             // puede ser ""
  body: string;
  url: string | null;
  imageUrl: string | null;
  tagIds: number[];
  poll: { options: string[]; closesInDays: number | null } | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

// ---------- Campos agregados a tipos existentes ----------
interface Me {
  // ...campos de antes
  hasPassword: boolean;      // false si la cuenta se creó con Google y nunca puso contraseña
  googleLinked: boolean;
  preferences: Preferences;
  draftCount: number;
}
interface PostListItem {
  // ...campos de antes
  reactions: ReactionSummary[];
  attachmentCount: number;
}
interface PostDetail {
  // ...campos de antes
  attachments: Attachment[];
}
interface Comment {
  // ...campos de antes (también CommentWithPost)
  reactions: ReactionSummary[];
  attachments: Attachment[];   // [] si isDeleted
}
interface Message {
  // ...campos de antes
  attachments: Attachment[];
}
type NotificationType = 'POST_REPLY' | 'COMMENT_REPLY' | 'MENTION' | 'FOLLOW' | 'ANSWER_ACCEPTED' | 'MOD' | 'REACTION';
// REACTION: actor reaccionó a tu post o comentario. `message` = el emoji. Solo la primera reacción de ese actor a ese contenido.
```

## Login con Google
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/auth/providers` | `{ google: boolean }` (true si están `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`) |
| GET | `/auth/google?next=/ruta` | `302` a Google (OAuth 2.0 authorization code, scopes `openid email profile`, `state` aleatorio en cookie httpOnly de 10 min). 404 si no está configurado |
| GET | `/auth/google/callback?code&state` | Valida `state`, cambia el code por tokens, lee el perfil (exige `email_verified`). Busca por `googleId`; si no, por email (y vincula); si no, crea la cuenta (username derivado del email, único; displayName y avatar de Google; sin contraseña). Setea la cookie de sesión y hace `302` a `${FRONTEND_URL}${next}` (next solo rutas relativas internas). Si falla: `302` a `${FRONTEND_URL}/login?error=google` |

- `redirect_uri` = `${FRONTEND_URL}/api/auth/google/callback` (en dev pasa por el proxy de Vite, en prod es el mismo server). Va en el README cómo crear las credenciales en Google Cloud Console.
- Cuentas sin contraseña: `POST /auth/change-password` acepta `currentPassword` vacío/ausente **solo si** `hasPassword=false` (así ponen una). `DELETE /users/me` acepta `{ password }` o, si `hasPassword=false`, `{ confirmUsername }`.
- Login con usuario/contraseña a una cuenta sin contraseña → 401 con mensaje "Esta cuenta usa Google para iniciar sesión".

## Reacciones
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST 🔒 | `/posts/:id/reactions` | `{ emoji }` | `{ reactions: ReactionSummary[] }` (**toggle**: si ya tenía ese emoji lo saca) |
| POST 🔒 | `/comments/:id/reactions` | `{ emoji }` | `{ reactions: ReactionSummary[] }` (toggle; 404 si el comentario está borrado) |
| GET | `/posts/:id/reactions/users?emoji=` | — | `{ items: UserSummary[] }` (hasta 50, para el tooltip "quién reaccionó") |
| GET | `/comments/:id/reactions/users?emoji=` | — | `{ items: UserSummary[] }` |

Un usuario puede tener varias reacciones distintas en el mismo contenido (una por emoji). Baneados → 403 BANNED.

## Adjuntos
| Método | Ruta | Body/Query | Respuesta |
|---|---|---|---|
| POST 🔒 | `/attachments` | multipart `file` | `201 { attachment: Attachment }` (queda "suelto", del usuario, hasta que se use) |
| DELETE 🔒 | `/attachments/:id` | — | `204` (solo el que lo subió, o 🛡; borra el archivo) |
| GET | `/attachments/:id/download` | — | el archivo con `Content-Disposition: attachment; filename*=UTF-8''…` (suma downloadCount) |
| GET | `/attachments/:id/view` | — | IMAGE/PDF inline (`Content-Disposition: inline`), resto 404 |

- Se usan pasando `attachmentIds: number[]` en: `POST /posts` (máx 10), `PATCH /posts/:id` (reemplaza la lista; los quitados se borran), `POST /posts/:id/comments` y `PATCH /comments/:id` (máx 5), `POST /conversations/:id/messages` (máx 5; en mensajes el `body` puede ser "" si hay al menos un adjunto). También en borradores.
  El server verifica que cada id sea del usuario y esté suelto (o ya sea de ese mismo post/comentario/borrador); si no → 400.
- **Tipos permitidos** (por extensión **y** verificando el contenido real / magic bytes):
  - IMAGE: png, jpg/jpeg, gif, webp
  - PDF: pdf
  - DOCUMENT: doc, docx, odt, rtf
  - SPREADSHEET: xls, xlsx, ods, csv
  - PRESENTATION: ppt, pptx, odp
  - ARCHIVE: zip, rar, 7z
  - TEXT: txt, md, y código (c, h, cpp, hpp, cs, java, py, js, ts, sql, json, xml, html, css, ipynb) — se validan como texto UTF-8 sin bytes nulos y **siempre** se descargan como `attachment` con `text/plain` (nunca se renderizan).
  - Cualquier otra cosa → 400 "Tipo de archivo no permitido". SVG no se permite.
- Tamaño máx **25 MB** por archivo (`MAX_UPLOAD_MB`). Cuota: 200 MB por usuario por día.
- Seguridad al servir: `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox` en las respuestas de archivos, `Cache-Control: private, max-age=3600`.
- Borrar post / comentario / mensaje / borrador borra sus adjuntos (archivo incluido). Los adjuntos sueltos con más de 24 h se limpian solos (tarea cada hora).
- `GET /posts` acepta `hasAttachments=true` (feed "Con archivos").
- Adjuntos de mensajes directos: solo los participantes de la conversación pueden descargarlos/verlos (403 si no).

## Borradores
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET 🔒 | `/drafts` | — | `{ items: Draft[] }` (orden updatedAt desc, máx 50 por usuario) |
| POST 🔒 | `/drafts` | campos de `Draft` (todos opcionales) + `attachmentIds?` | `201 { draft }` |
| GET 🔒 | `/drafts/:id` | — | `{ draft }` (404 si no es tuyo) |
| PATCH 🔒 | `/drafts/:id` | parcial + `attachmentIds?` | `{ draft }` |
| DELETE 🔒 | `/drafts/:id` | — | `204` |

`POST /posts` acepta `draftId?`: al publicar, los adjuntos pasan al post y el borrador se borra.
Validación laxa (un borrador puede estar incompleto), pero con los mismos máximos de longitud que un post.

## Preferencias y avisos por mail
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET 🔒 | `/users/me/preferences` | — | `{ preferences: Preferences }` |
| PATCH 🔒 | `/users/me/preferences` | parcial de `Preferences` | `{ preferences: Preferences }` |

- Cuando se crea una notificación (o llega un mensaje directo) y el destinatario tiene esa preferencia activa **y no está conectado** (sin conexión SSE abierta), se le manda un mail lindo (HTML + texto) con el contenido y un botón al lugar exacto.
- Anti-spam: máx 1 mail por (usuario, tipo, post/conversación) cada 15 min; máx 20 mails por usuario por día.
- Mail de bienvenida al registrarse (también con Google).
- Sin SMTP configurado: en dev se loguea en consola `[mail] → para: asunto` y el link; nunca rompe la request (envío asíncrono, errores solo al log).
- El footer de cada mail tiene link a `${FRONTEND_URL}/settings?tab=notifications`.

## PWA
- `web/public/manifest.webmanifest` (nombre "Foro UTN", `display: standalone`, colores de marca, íconos 192/512 + maskable, `start_url: "/"`, shortcuts a Crear post / Notificaciones / Mensajes).
- `web/public/sw.js` escrito a mano: precache del shell, navegación network-first con fallback offline (`/offline.html`), assets con hash cache-first, `/uploads/*` stale-while-revalidate, **nunca** cachea `/api/*`. Se registra solo en producción.
- El server sirve `sw.js`, `manifest.webmanifest` e `index.html` con `Cache-Control: no-cache`.
- Botón "Instalar app" (evento `beforeinstallprompt`; en iOS un diálogo con instrucciones "Compartir → Agregar a inicio").
