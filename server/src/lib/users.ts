import type { User } from '@prisma/client';
import { prisma } from './prisma.js';
import { activeBanWhere, iso, toBan, toUserSummary } from './serializers.js';
import type { Me, Preferences } from './types.js';
import { countUnreadMessages, countUnreadNotifications } from './unread.js';

export function getActiveBan(userId: number) {
  return prisma.ban.findFirst({ where: { userId, ...activeBanWhere() }, orderBy: { createdAt: 'desc' } });
}

export async function getKarma(userId: number): Promise<{ post: number; comment: number; total: number }> {
  const [posts, comments] = await Promise.all([
    prisma.post.aggregate({ where: { authorId: userId }, _sum: { score: true } }),
    prisma.comment.aggregate({ where: { authorId: userId, isDeleted: false }, _sum: { score: true } }),
  ]);
  const post = posts._sum.score ?? 0;
  const comment = comments._sum.score ?? 0;
  return { post, comment, total: post + comment };
}

export function toPreferences(u: Pick<User, keyof Preferences>): Preferences {
  return {
    emailReplies: u.emailReplies,
    emailMentions: u.emailMentions,
    emailMessages: u.emailMessages,
    emailFollows: u.emailFollows,
    emailReactions: u.emailReactions,
  };
}

export async function buildMe(user: User): Promise<Me> {
  const [karma, unreadNotifications, unreadMessages, ban, draftCount] = await Promise.all([
    getKarma(user.id),
    countUnreadNotifications(user.id),
    countUnreadMessages(user.id),
    getActiveBan(user.id),
    prisma.draft.count({ where: { userId: user.id } }),
  ]);
  return {
    ...toUserSummary(user),
    email: user.email,
    bio: user.bio,
    career: user.career,
    createdAt: iso(user.createdAt),
    karma: karma.total,
    unreadNotifications,
    unreadMessages,
    ban: toBan(ban),
    hasPassword: user.passwordHash !== null,
    googleLinked: user.googleId !== null,
    preferences: toPreferences(user),
    draftCount,
  };
}

export function findUserByUsername(username: string) {
  return prisma.user.findUnique({ where: { usernameKey: username.toLowerCase() } });
}

/** Texto legible de la duración de un ban. */
export function describeBan(expiresAt: Date | null): string {
  if (!expiresAt) return 'de forma permanente';
  return `hasta el ${expiresAt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}`;
}
