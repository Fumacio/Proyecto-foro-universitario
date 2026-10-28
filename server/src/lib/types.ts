// Tipos de respuesta de la API (espejo de docs/API.md).

export type Role = 'ADMIN' | 'MODERATOR' | 'PROFESSOR' | 'STUDENT';
export type PostType = 'TEXT' | 'QUESTION' | 'POLL' | 'LINK';
export type VoteValue = -1 | 0 | 1;

export interface UserSummary {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
}

export interface BanDto {
  reason: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface Preferences {
  emailReplies: boolean;
  emailMentions: boolean;
  emailMessages: boolean;
  emailFollows: boolean;
  emailReactions: boolean;
}

export interface Me extends UserSummary {
  email: string;
  bio: string | null;
  career: string | null;
  createdAt: string;
  karma: number;
  unreadNotifications: number;
  unreadMessages: number;
  ban: BanDto | null;
  hasPassword: boolean;
  googleLinked: boolean;
  preferences: Preferences;
  draftCount: number;
}

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🤔', '🔥'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  reacted: boolean;
}

export type AttachmentKind = 'IMAGE' | 'PDF' | 'DOCUMENT' | 'SPREADSHEET' | 'PRESENTATION' | 'ARCHIVE' | 'TEXT' | 'OTHER';

export interface AttachmentDto {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  url: string;
  previewUrl: string | null;
  downloadCount: number;
  createdAt: string;
}

export interface DraftDto {
  id: number;
  communityId: number | null;
  type: PostType;
  title: string;
  body: string;
  url: string | null;
  imageUrl: string | null;
  tagIds: number[];
  poll: { options: string[]; closesInDays: number | null } | null;
  attachments: AttachmentDto[];
  createdAt: string;
  updatedAt: string;
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
  isFollowing: boolean;
  isBanned: boolean;
}

export interface CommunityRef {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
}

export interface CommunityDto extends CommunityRef {
  description: string;
  rules: string[];
  memberCount: number;
  postCount: number;
  isMember: boolean;
  createdAt: string;
}

export interface TagDto {
  id: number;
  name: string;
  slug: string;
  color: string;
  postCount: number;
}

export interface PollOptionDto {
  id: number;
  text: string;
  votes: number;
}

export interface PollDto {
  options: PollOptionDto[];
  totalVotes: number;
  myOptionId: number | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface PostListItem {
  id: number;
  type: PostType;
  title: string;
  excerpt: string;
  url: string | null;
  imageUrl: string | null;
  author: UserSummary | null;
  community: CommunityRef;
  tags: TagDto[];
  score: number;
  myVote: VoteValue;
  commentCount: number;
  viewCount: number;
  isBookmarked: boolean;
  isPinned: boolean;
  isLocked: boolean;
  acceptedCommentId: number | null;
  poll: PollDto | null;
  createdAt: string;
  editedAt: string | null;
  reactions: ReactionSummary[];
  attachmentCount: number;
}

export interface PostDetail extends PostListItem {
  body: string;
  canEdit: boolean;
  canModerate: boolean;
  attachments: AttachmentDto[];
}

export interface CommentDto {
  id: number;
  postId: number;
  parentId: number | null;
  body: string;
  isDeleted: boolean;
  author: UserSummary | null;
  score: number;
  myVote: VoteValue;
  isAccepted: boolean;
  createdAt: string;
  editedAt: string | null;
  reactions: ReactionSummary[];
  attachments: AttachmentDto[];
  replies: CommentDto[];
}

export interface CommentWithPost extends Omit<CommentDto, 'replies'> {
  post: { id: number; title: string; community: CommunityRef };
}

export type NotificationType = 'POST_REPLY' | 'COMMENT_REPLY' | 'MENTION' | 'FOLLOW' | 'ANSWER_ACCEPTED' | 'MOD' | 'REACTION';

export interface NotificationDto {
  id: number;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: UserSummary | null;
  post: { id: number; title: string } | null;
  comment: { id: number; excerpt: string } | null;
  message: string | null;
}

export interface ConversationDto {
  id: number;
  other: UserSummary;
  lastMessage: { body: string; createdAt: string; senderId: number } | null;
  unread: number;
  updatedAt: string;
}

export interface MessageDto {
  id: number;
  conversationId: number;
  sender: UserSummary;
  body: string;
  createdAt: string;
  attachments: AttachmentDto[];
}

export type ReportReason = 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'OFF_TOPIC' | 'OTHER';
export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface ReportDto {
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
  ban: BanDto | null;
}
