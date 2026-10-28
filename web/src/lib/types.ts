/* Tipos del contrato de la API (docs/API.md). Copiados textualmente; los extras van al final. */

export type Role = 'ADMIN' | 'MODERATOR' | 'PROFESSOR' | 'STUDENT';

export interface Paginated<T> {
  items: T[];
  page: number;
  hasMore: boolean;
  total?: number;
}

export interface UserSummary {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
}

export interface Ban {
  reason: string;
  expiresAt: string | null /* null = permanente */;
  createdAt: string;
}

export interface Me extends UserSummary {
  email: string;
  bio: string | null;
  career: string | null;
  createdAt: string;
  karma: number;
  unreadNotifications: number;
  unreadMessages: number;
  ban: Ban | null; // ban activo, o null
  /* v2.1 — opcionales por compatibilidad con un server anterior */
  hasPassword?: boolean; // false si la cuenta se creó con Google y nunca puso contraseña
  googleLinked?: boolean;
  preferences?: Preferences;
  draftCount?: number;
}

export interface UserProfile extends UserSummary {
  bio: string | null;
  career: string | null;
  createdAt: string;
  karma: { post: number; comment: number; total: number };
  postCount: number;
  commentCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean; // false si no hay sesión o es uno mismo
  isBanned: boolean;
}

export interface CommunityRef {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
}

export interface Community extends CommunityRef {
  description: string;
  rules: string[];
  memberCount: number;
  postCount: number;
  isMember: boolean;
  createdAt: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string;
  postCount: number;
}

export type PostType = 'TEXT' | 'QUESTION' | 'POLL' | 'LINK';

export interface PollOption {
  id: number;
  text: string;
  votes: number;
}
export interface Poll {
  options: PollOption[];
  totalVotes: number;
  myOptionId: number | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface PostListItem {
  id: number;
  type: PostType;
  title: string;
  excerpt: string; // texto plano sin markdown, máx ~280 chars
  url: string | null; // solo LINK
  imageUrl: string | null; // imagen de portada (cualquier tipo)
  author: UserSummary | null; // null si la cuenta fue borrada
  community: CommunityRef;
  tags: Tag[];
  score: number;
  myVote: -1 | 0 | 1;
  commentCount: number;
  viewCount: number;
  isBookmarked: boolean;
  isPinned: boolean;
  isLocked: boolean;
  acceptedCommentId: number | null; // QUESTION resuelta si != null
  poll: Poll | null; // solo POLL
  createdAt: string;
  editedAt: string | null;
  /* v2.1 */
  reactions?: ReactionSummary[];
  attachmentCount?: number;
}

export interface PostDetail extends PostListItem {
  body: string; // markdown crudo
  canEdit: boolean; // autor
  canModerate: boolean; // mod/admin
  /* v2.1 */
  attachments?: Attachment[];
}

export interface Comment {
  id: number;
  postId: number;
  parentId: number | null;
  body: string; // "" si isDeleted
  isDeleted: boolean;
  author: UserSummary | null; // null si isDeleted o cuenta borrada
  score: number;
  myVote: -1 | 0 | 1;
  isAccepted: boolean;
  createdAt: string;
  editedAt: string | null;
  replies: Comment[]; // árbol completo
  /* v2.1 */
  reactions?: ReactionSummary[];
  attachments?: Attachment[]; // [] si isDeleted
}

export interface CommentWithPost extends Omit<Comment, 'replies'> {
  post: { id: number; title: string; community: CommunityRef };
}

export type NotificationType =
  | 'POST_REPLY'
  | 'COMMENT_REPLY'
  | 'MENTION'
  | 'FOLLOW'
  | 'ANSWER_ACCEPTED'
  | 'MOD'
  | 'REACTION'; // v2.1: `message` = el emoji

export interface Notification {
  id: number;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: UserSummary | null;
  post: { id: number; title: string } | null;
  comment: { id: number; excerpt: string } | null;
  message: string | null; // texto libre (p. ej. acciones de moderación)
}

export interface Conversation {
  id: number;
  other: UserSummary;
  lastMessage: { body: string; createdAt: string; senderId: number } | null;
  unread: number;
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  sender: UserSummary;
  body: string; // puede ser "" si hay adjuntos (v2.1)
  createdAt: string;
  attachments?: Attachment[]; // v2.1
}

export type ReportReason = 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'OFF_TOPIC' | 'OTHER';
export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface Report {
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

export interface AdminUser extends UserSummary {
  email: string;
  createdAt: string;
  postCount: number;
  commentCount: number;
  ban: Ban | null;
}

/* ---------- v2.1: reacciones ---------- */

/** Conjunto fijo (el server rechaza cualquier otro con 400). */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🤔', '🔥'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

/** Solo vienen los emojis con count > 0, en el orden de REACTIONS. */
export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  reacted: boolean; // el usuario actual reaccionó con este
}

/* ---------- v2.1: adjuntos ---------- */

export type AttachmentKind = 'IMAGE' | 'PDF' | 'DOCUMENT' | 'SPREADSHEET' | 'PRESENTATION' | 'ARCHIVE' | 'TEXT' | 'OTHER';

export interface Attachment {
  id: number;
  filename: string; // nombre original saneado, p. ej. "Resumen Parcial 1.pdf"
  mimeType: string;
  size: number; // bytes
  kind: AttachmentKind;
  url: string; // descarga: "/api/attachments/:id/download"
  previewUrl: string | null; // vista en el navegador (solo IMAGE y PDF): "/api/attachments/:id/view"
  downloadCount: number;
  createdAt: string;
}

/* ---------- v2.1: preferencias de avisos por mail ---------- */

export interface Preferences {
  emailReplies: boolean; // POST_REPLY, COMMENT_REPLY, ANSWER_ACCEPTED (default true)
  emailMentions: boolean; // MENTION (default true)
  emailMessages: boolean; // mensajes directos (default true)
  emailFollows: boolean; // FOLLOW (default false)
  emailReactions: boolean; // REACTION (default false)
}

/* ---------- v2.1: borradores ---------- */

export interface Draft {
  id: number;
  communityId: number | null;
  type: PostType;
  title: string; // puede ser ""
  body: string;
  url: string | null;
  imageUrl: string | null;
  tagIds: number[];
  poll: { options: string[]; closesInDays: number | null } | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface DraftInput {
  communityId?: number | null;
  type?: PostType;
  title?: string;
  body?: string;
  url?: string | null;
  imageUrl?: string | null;
  tagIds?: number[];
  poll?: { options: string[]; closesInDays: number | null } | null;
  attachmentIds?: number[];
}

/* ---------- Extras derivados de las respuestas de los endpoints ---------- */

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BANNED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'LOCKED'
  | 'INTERNAL';

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  details?: Record<string, string>;
}

export type PostSort = 'hot' | 'new' | 'top' | 'comments';
export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'all';
export type CommentSort = 'best' | 'new' | 'old';

export interface CreatePostInput {
  communityId: number;
  type: PostType;
  title: string;
  body?: string;
  url?: string;
  imageUrl?: string | null;
  tagIds?: number[];
  poll?: { options: string[]; closesInDays?: number | null };
  attachmentIds?: number[]; // v2.1, máx 10
  draftId?: number; // v2.1: al publicar, el borrador se borra
}

export interface UpdatePostInput {
  title?: string;
  body?: string;
  tagIds?: number[];
  imageUrl?: string | null;
  attachmentIds?: number[]; // v2.1: reemplaza la lista
}

export interface CommunityInput {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  rules: string[];
}

export interface SearchResult {
  posts: PostListItem[];
  users: UserSummary[];
  communities: CommunityRef[];
}

export interface CommentsResponse {
  items: Comment[];
  total: number;
}

export type NotificationsPage = Paginated<Notification> & { unreadCount: number };

export interface MessagesPage {
  items: Message[];
  hasMore: boolean;
}

export interface ActivityPoint {
  date: string; // YYYY-MM-DD
  posts: number;
  comments: number;
  users: number;
}

export interface AdminStats {
  users: number;
  posts: number;
  comments: number;
  communities: number;
  pendingReports: number;
  activeBans: number;
  activity: ActivityPoint[];
}

export interface PublicStats {
  users: number;
  posts: number;
  comments: number;
  communities: number;
}

export interface UnreadEvent {
  notifications: number;
  messages: number;
}
