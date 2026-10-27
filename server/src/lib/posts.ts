import type { Prisma } from '@prisma/client';
import { notFound } from './errors.js';
import { prisma } from './prisma.js';
import { postInclude, toPostListItem } from './serializers.js';
import { hotScore } from './text.js';
import type { PostListItem } from './types.js';
import { paginate, type Paginated } from './validate.js';

export type PostSort = 'hot' | 'new' | 'top' | 'comments';
export type Period = 'day' | 'week' | 'month' | 'year' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<Exclude<Period, 'all'>, number> = {
  day: DAY_MS,
  week: 7 * DAY_MS,
  month: 30 * DAY_MS,
  year: 365 * DAY_MS,
};

export function periodStart(t: Period, now = Date.now()): Date | null {
  return t === 'all' ? null : new Date(now - PERIOD_MS[t]);
}

export function postOrderBy(sort: PostSort, pinnedFirst = false): Prisma.PostOrderByWithRelationInput[] {
  const pinned: Prisma.PostOrderByWithRelationInput[] = pinnedFirst ? [{ isPinned: 'desc' }] : [];
  switch (sort) {
    case 'new':
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    case 'top':
      return [{ score: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'comments':
      return [{ commentCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
    case 'hot':
    default:
      return [...pinned, { hot: 'desc' }, { id: 'desc' }];
  }
}

export async function listPosts(opts: {
  where: Prisma.PostWhereInput;
  orderBy: Prisma.PostOrderByWithRelationInput[];
  page: number;
  limit: number;
  viewerId: number | null;
}): Promise<Paginated<PostListItem>> {
  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where: opts.where,
      orderBy: opts.orderBy,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit + 1,
      include: postInclude(opts.viewerId),
    }),
    prisma.post.count({ where: opts.where }),
  ]);
  return paginate(rows.map(toPostListItem), opts.page, opts.limit, total);
}

export async function getPostRowOrThrow(id: number, viewerId: number | null) {
  const post = await prisma.post.findUnique({ where: { id }, include: postInclude(viewerId) });
  if (!post) throw notFound('El post no existe o fue eliminado');
  return post;
}

type Tx = Prisma.TransactionClient;

/** Recalcula score (= suma de votos) y hot del post. Se llama dentro de la transacción del voto. */
export async function refreshPostScore(tx: Tx, postId: number): Promise<number> {
  const [agg, post] = await Promise.all([
    tx.postVote.aggregate({ where: { postId }, _sum: { value: true } }),
    tx.post.findUniqueOrThrow({ where: { id: postId }, select: { createdAt: true } }),
  ]);
  const score = agg._sum.value ?? 0;
  await tx.post.update({ where: { id: postId }, data: { score, hot: hotScore(score, post.createdAt) } });
  return score;
}

export async function refreshCommentScore(tx: Tx, commentId: number): Promise<number> {
  const agg = await tx.commentVote.aggregate({ where: { commentId }, _sum: { value: true } });
  const score = agg._sum.value ?? 0;
  await tx.comment.update({ where: { id: commentId }, data: { score } });
  return score;
}

/** commentCount = comentarios no borrados del post. */
export async function refreshCommentCount(tx: Tx, postId: number): Promise<number> {
  const commentCount = await tx.comment.count({ where: { postId, isDeleted: false } });
  await tx.post.update({ where: { id: postId }, data: { commentCount } });
  return commentCount;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}
