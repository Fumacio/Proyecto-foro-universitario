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
}

export interface PostDetail extends PostListItem {
  body: string; // markdown crudo
  canEdit: boolean; // autor
  canModerate: boolean; // mod/admin
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
  | 'MOD';

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
  body: string;
  createdAt: string;
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
}

export interface UpdatePostInput {
  title?: string;
  body?: string;
  tagIds?: number[];
  imageUrl?: string | null;
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
