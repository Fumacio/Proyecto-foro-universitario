import { prisma } from './prisma.js';
import { REACTIONS, type ReactionEmoji, type ReactionSummary } from './types.js';

const ORDER = new Map<string, number>(REACTIONS.map((e, i) => [e, i]));

/** Valida el emoji contra el conjunto fijo. Acepta "❤" sin el selector de variación. */
export function normalizeEmoji(input: unknown): ReactionEmoji | null {
  if (typeof input !== 'string') return null;
  let e = input.trim();
  if (e === '❤') e = '❤️';
  return ORDER.has(e) ? (e as ReactionEmoji) : null;
}

type Group = { targetId: number; emoji: string; count: number };

function buildSummaries(groups: Group[], mine: { targetId: number; emoji: string }[]): Map<number, ReactionSummary[]> {
  const reacted = new Set(mine.map((m) => `${m.targetId}|${m.emoji}`));
  const result = new Map<number, ReactionSummary[]>();
  for (const g of groups) {
    if (g.count <= 0 || !ORDER.has(g.emoji)) continue;
    let list = result.get(g.targetId);
    if (!list) {
      list = [];
      result.set(g.targetId, list);
    }
    list.push({ emoji: g.emoji as ReactionEmoji, count: g.count, reacted: reacted.has(`${g.targetId}|${g.emoji}`) });
  }
  for (const list of result.values()) list.sort((a, b) => ORDER.get(a.emoji)! - ORDER.get(b.emoji)!);
  return result;
}

/** Resumen de reacciones de varios posts en 2 consultas (groupBy + las del usuario). */
export async function postReactionSummaries(postIds: number[], viewerId: number | null): Promise<Map<number, ReactionSummary[]>> {
  const ids = [...new Set(postIds)];
  if (ids.length === 0) return new Map();
  const [groups, mine] = await Promise.all([
    prisma.postReaction.groupBy({ by: ['postId', 'emoji'], where: { postId: { in: ids } }, _count: { _all: true } }),
    viewerId
      ? prisma.postReaction.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true, emoji: true } })
      : Promise.resolve([]),
  ]);
  return buildSummaries(
    groups.map((g) => ({ targetId: g.postId, emoji: g.emoji, count: g._count._all })),
    mine.map((m) => ({ targetId: m.postId, emoji: m.emoji })),
  );
}

export async function commentReactionSummaries(
  commentIds: number[],
  viewerId: number | null,
): Promise<Map<number, ReactionSummary[]>> {
  const ids = [...new Set(commentIds)];
  if (ids.length === 0) return new Map();
  const [groups, mine] = await Promise.all([
    prisma.commentReaction.groupBy({ by: ['commentId', 'emoji'], where: { commentId: { in: ids } }, _count: { _all: true } }),
    viewerId
      ? prisma.commentReaction.findMany({ where: { userId: viewerId, commentId: { in: ids } }, select: { commentId: true, emoji: true } })
      : Promise.resolve([]),
  ]);
  return buildSummaries(
    groups.map((g) => ({ targetId: g.commentId, emoji: g.emoji, count: g._count._all })),
    mine.map((m) => ({ targetId: m.commentId, emoji: m.emoji })),
  );
}
