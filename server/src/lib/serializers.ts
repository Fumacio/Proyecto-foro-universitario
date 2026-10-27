import type { Prisma } from '@prisma/client';
import { excerpt } from './text.js';
import type {
  AdminUser,
  BanDto,
  CommentDto,
  CommentWithPost,
  CommunityDto,
  CommunityRef,
  MessageDto,
  NotificationDto,
  PollDto,
  PostDetail,
  PostListItem,
  ReportDto,
  Role,
  TagDto,
  UserSummary,
  VoteValue,
} from './types.js';

export const iso = (d: Date): string => d.toISOString();
export const isoOrNull = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

const NO_VIEWER = -1;
const toVote = (value: number | undefined): VoteValue => (value === undefined || value === 0 ? 0 : value > 0 ? 1 : -1);

export const isModRole = (role: Role): boolean => role === 'ADMIN' || role === 'MODERATOR';

// ---------- usuarios ----------

export const userSummarySelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
} satisfies Prisma.UserSelect;

export type UserSummaryRow = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;

export function toUserSummary(u: UserSummaryRow): UserSummary {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl, role: u.role };
}

export function toUserSummaryOrNull(u: UserSummaryRow | null | undefined): UserSummary | null {
  return u ? toUserSummary(u) : null;
}

/** Condición de "ban activo": no levantado y sin vencer (o permanente). */
export function activeBanWhere(now = new Date()): Prisma.BanWhereInput {
  return { liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

export function toBan(b: { reason: string; expiresAt: Date | null; createdAt: Date } | null | undefined): BanDto | null {
  return b ? { reason: b.reason, expiresAt: isoOrNull(b.expiresAt), createdAt: iso(b.createdAt) } : null;
}

export function adminUserInclude() {
  return {
    _count: { select: { posts: true, comments: { where: { isDeleted: false } } } },
    bans: { where: activeBanWhere(), orderBy: { createdAt: 'desc' }, take: 1 },
  } satisfies Prisma.UserInclude;
}

export type AdminUserRow = Prisma.UserGetPayload<{ include: ReturnType<typeof adminUserInclude> }>;

export function toAdminUser(u: AdminUserRow): AdminUser {
  return {
    ...toUserSummary(u),
    email: u.email,
    createdAt: iso(u.createdAt),
    postCount: u._count.posts,
    commentCount: u._count.comments,
    ban: toBan(u.bans[0]),
  };
}

// ---------- comunidades y etiquetas ----------

export const communityRefSelect = {
  id: true,
  slug: true,
  name: true,
  icon: true,
  color: true,
} satisfies Prisma.CommunitySelect;

export type CommunityRefRow = Prisma.CommunityGetPayload<{ select: typeof communityRefSelect }>;

export function toCommunityRef(c: CommunityRefRow): CommunityRef {
  return { id: c.id, slug: c.slug, name: c.name, icon: c.icon, color: c.color };
}

export function communityInclude(viewerId: number | null) {
  return {
    _count: { select: { memberships: true, posts: true } },
    memberships: { where: { userId: viewerId ?? NO_VIEWER }, select: { userId: true } },
  } satisfies Prisma.CommunityInclude;
}

export type CommunityRow = Prisma.CommunityGetPayload<{ include: ReturnType<typeof communityInclude> }>;

export function rulesFromJson(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((r): r is string => typeof r === 'string') : [];
}

export function toCommunity(c: CommunityRow): CommunityDto {
  return {
    ...toCommunityRef(c),
    description: c.description,
    rules: rulesFromJson(c.rules),
    memberCount: c._count.memberships,
    postCount: c._count.posts,
    isMember: c.memberships.length > 0,
    createdAt: iso(c.createdAt),
  };
}

export const tagInclude = { _count: { select: { posts: true } } } satisfies Prisma.TagInclude;

export type TagRow = Prisma.TagGetPayload<{ include: typeof tagInclude }>;

export function toTag(t: TagRow): TagDto {
  return { id: t.id, name: t.name, slug: t.slug, color: t.color, postCount: t._count.posts };
}

// ---------- posts ----------

export function postInclude(viewerId: number | null) {
  const v = viewerId ?? NO_VIEWER;
  return {
    author: { select: userSummarySelect },
    community: { select: communityRefSelect },
    tags: { include: { tag: { include: tagInclude } } },
    votes: { where: { userId: v }, select: { value: true } },
    bookmarks: { where: { userId: v }, select: { userId: true } },
    pollOptions: {
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { votes: true } } },
    },
    pollVotes: { where: { userId: v }, select: { optionId: true } },
  } satisfies Prisma.PostInclude;
}

export type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

export function toPoll(p: PostRow, now = new Date()): PollDto | null {
  if (p.type !== 'POLL') return null;
  const options = p.pollOptions.map((o) => ({ id: o.id, text: o.text, votes: o._count.votes }));
  return {
    options,
    totalVotes: options.reduce((acc, o) => acc + o.votes, 0),
    myOptionId: p.pollVotes[0]?.optionId ?? null,
    closesAt: isoOrNull(p.pollClosesAt),
    isClosed: p.pollClosesAt ? p.pollClosesAt.getTime() <= now.getTime() : false,
  };
}

export function toPostListItem(p: PostRow): PostListItem {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    excerpt: excerpt(p.body),
    url: p.type === 'LINK' ? p.url : null,
    imageUrl: p.imageUrl,
    author: toUserSummaryOrNull(p.author),
    community: toCommunityRef(p.community),
    tags: p.tags.map((pt) => toTag(pt.tag)).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    score: p.score,
    myVote: toVote(p.votes[0]?.value),
    commentCount: p.commentCount,
    viewCount: p.viewCount,
    isBookmarked: p.bookmarks.length > 0,
    isPinned: p.isPinned,
    isLocked: p.isLocked,
    acceptedCommentId: p.acceptedCommentId,
    poll: toPoll(p),
    createdAt: iso(p.createdAt),
    editedAt: isoOrNull(p.editedAt),
  };
}

export function toPostDetail(p: PostRow, viewer: { id: number; role: Role } | null | undefined): PostDetail {
  return {
    ...toPostListItem(p),
    body: p.body,
    canEdit: !!viewer && p.authorId === viewer.id,
    canModerate: !!viewer && isModRole(viewer.role),
  };
}

// ---------- comentarios ----------

export function commentInclude(viewerId: number | null) {
  return {
    author: { select: userSummarySelect },
    votes: { where: { userId: viewerId ?? NO_VIEWER }, select: { value: true } },
  } satisfies Prisma.CommentInclude;
}

export type CommentRow = Prisma.CommentGetPayload<{ include: ReturnType<typeof commentInclude> }>;

export function toComment(c: CommentRow, acceptedCommentId: number | null): CommentDto {
  return {
    id: c.id,
    postId: c.postId,
    parentId: c.parentId,
    body: c.isDeleted ? '' : c.body,
    isDeleted: c.isDeleted,
    author: c.isDeleted ? null : toUserSummaryOrNull(c.author),
    score: c.score,
    myVote: c.isDeleted ? 0 : toVote(c.votes[0]?.value),
    isAccepted: !c.isDeleted && acceptedCommentId === c.id,
    createdAt: iso(c.createdAt),
    editedAt: isoOrNull(c.editedAt),
    replies: [],
  };
}

export type CommentSort = 'best' | 'new' | 'old';

const comparators: Record<CommentSort, (a: CommentDto, b: CommentDto) => number> = {
  best: (a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  new: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
  old: (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
};

/** Arma el árbol completo; el aceptado va primero entre las raíces. */
export function buildCommentTree(rows: CommentRow[], acceptedCommentId: number | null, sort: CommentSort): CommentDto[] {
  const byId = new Map<number, CommentDto>();
  for (const row of rows) byId.set(row.id, toComment(row, acceptedCommentId));
  const roots: CommentDto[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId !== null ? byId.get(node.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  const cmp = comparators[sort];
  const sortDeep = (list: CommentDto[]) => {
    list.sort(cmp);
    for (const n of list) sortDeep(n.replies);
  };
  sortDeep(roots);
  roots.sort((a, b) => Number(b.isAccepted) - Number(a.isAccepted));
  return roots;
}

export function commentWithPostInclude(viewerId: number | null) {
  return {
    ...commentInclude(viewerId),
    post: { select: { id: true, title: true, acceptedCommentId: true, community: { select: communityRefSelect } } },
  } satisfies Prisma.CommentInclude;
}

export type CommentWithPostRow = Prisma.CommentGetPayload<{ include: ReturnType<typeof commentWithPostInclude> }>;

export function toCommentWithPost(c: CommentWithPostRow): CommentWithPost {
  const { replies: _replies, ...rest } = toComment(c, c.post.acceptedCommentId);
  return { ...rest, post: { id: c.post.id, title: c.post.title, community: toCommunityRef(c.post.community) } };
}

// ---------- notificaciones ----------

export const notificationInclude = {
  actor: { select: userSummarySelect },
  post: { select: { id: true, title: true } },
  comment: { select: { id: true, body: true, isDeleted: true } },
} satisfies Prisma.NotificationInclude;

export type NotificationRow = Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>;

export function toNotification(n: NotificationRow): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    read: n.read,
    createdAt: iso(n.createdAt),
    actor: toUserSummaryOrNull(n.actor),
    post: n.post ? { id: n.post.id, title: n.post.title } : null,
    comment: n.comment ? { id: n.comment.id, excerpt: n.comment.isDeleted ? '' : excerpt(n.comment.body, 140) } : null,
    message: n.message,
  };
}

// ---------- mensajes ----------

export const messageInclude = { sender: { select: userSummarySelect } } satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

export function toMessage(m: MessageRow): MessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    sender: toUserSummary(m.sender),
    body: m.body,
    createdAt: iso(m.createdAt),
  };
}

// ---------- reportes ----------

export const reportInclude = {
  reporter: { select: userSummarySelect },
  resolvedBy: { select: userSummarySelect },
  post: { select: { id: true, title: true, author: { select: userSummarySelect } } },
  comment: { select: { id: true, body: true, postId: true, author: { select: userSummarySelect } } },
} satisfies Prisma.ReportInclude;

export type ReportRow = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

export function toReport(r: ReportRow): ReportDto {
  return {
    id: r.id,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: iso(r.createdAt),
    reporter: toUserSummaryOrNull(r.reporter),
    post: r.post ? { id: r.post.id, title: r.post.title, author: toUserSummaryOrNull(r.post.author) } : null,
    comment: r.comment
      ? { id: r.comment.id, body: r.comment.body, postId: r.comment.postId, author: toUserSummaryOrNull(r.comment.author) }
      : null,
    resolvedBy: toUserSummaryOrNull(r.resolvedBy),
    resolvedAt: isoOrNull(r.resolvedAt),
  };
}
