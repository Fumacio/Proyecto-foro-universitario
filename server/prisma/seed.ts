/**
 * Datos de ejemplo del Foro UTN.
 *   npm run db:setup   → crea la DB y siembra si está vacía
 *   npm run db:reset   → borra todo y vuelve a sembrar
 *   npm run db:seed -- --force   → re-siembra sobre una DB existente (borra los datos)
 */
import bcrypt from 'bcryptjs';
import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { extractMentions, hotScore, slugify } from '../src/lib/text.js';
import {
  BOOKMARKS,
  COMMUNITIES,
  CONVERSATIONS,
  FOLLOWS,
  MEMBERSHIPS,
  POSTS,
  TAGS,
  USERS,
  type SeedComment,
  type SeedPost,
} from './seed-data.js';

const PASSWORD = 'foro1234';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();

// PRNG determinístico: el seed da siempre los mismos votos.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20_261_027);
const between = (min: number, max: number) => min + rand() * (max - min);

/** Nunca en el futuro ni antes de `after`. */
function clampTime(t: number, after: number): number {
  const limit = now - 2 * 60 * 1000;
  if (t <= limit) return t;
  return Math.min(limit, after + Math.max(30_000, (limit - after) * 0.6));
}

async function wipe(): Promise<void> {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversationParticipant.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.report.deleteMany(),
    prisma.ban.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.pollVote.deleteMany(),
    prisma.pollOption.deleteMany(),
    prisma.commentVote.deleteMany(),
    prisma.postVote.deleteMany(),
    prisma.postTag.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.post.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.community.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  // IDs desde 1 otra vez (solo SQLite; en otros motores se ignora).
  await prisma.$executeRawUnsafe('DELETE FROM sqlite_sequence').catch(() => undefined);
}

interface CommentRecord {
  id: number;
  postId: number;
  authorId: number;
  username: string;
  parentAuthorId: number | null;
  postAuthorId: number;
  body: string;
  createdAt: number;
  key?: string;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force') || process.env.SEED_FORCE === '1';
  const existing = await prisma.user.count();
  if (existing > 0 && !force) {
    console.info('[seed] La base ya tiene datos: no se re-siembra. Usá `npm run db:reset` para empezar de cero.');
    return;
  }
  const started = Date.now();
  await wipe();

  // ---------- usuarios ----------
  const userId = new Map<string, number>();
  const userJoined = new Map<string, number>();
  const userActivity = new Map<string, number>();
  const userRole = new Map<string, string>();
  for (const u of USERS) {
    const createdAt = new Date(now - u.joinedDaysAgo * DAY);
    const row = await prisma.user.create({
      data: {
        username: u.username,
        usernameKey: u.username.toLowerCase(),
        email: u.email.toLowerCase(),
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        displayName: u.displayName,
        career: u.career,
        bio: u.bio,
        role: u.role,
        createdAt,
      },
    });
    userId.set(u.username, row.id);
    userJoined.set(u.username, createdAt.getTime());
    userActivity.set(u.username, u.activity);
    userRole.set(u.username, u.role);
  }
  const uid = (username: string): number => {
    const id = userId.get(username);
    if (!id) throw new Error(`[seed] usuario desconocido: ${username}`);
    return id;
  };
  const voters = USERS.filter((u) => u.activity > 0).map((u) => u.username);

  // ---------- comunidades y etiquetas ----------
  const communityId = new Map<string, number>();
  for (const [i, c] of COMMUNITIES.entries()) {
    const row = await prisma.community.create({
      data: { ...c, createdAt: new Date(now - (220 - i) * DAY) },
    });
    communityId.set(c.slug, row.id);
  }
  const tagId = new Map<string, number>();
  for (const t of TAGS) {
    const row = await prisma.tag.create({ data: { name: t.name, slug: slugify(t.name), color: t.color } });
    tagId.set(t.name, row.id);
  }

  // ---------- membresías ----------
  const memberships = new Set<string>();
  const addMember = (username: string, slug: string) => memberships.add(`${username}|${slug}`);
  for (const [username, slugs] of Object.entries(MEMBERSHIPS)) for (const slug of slugs) addMember(username, slug);
  const walk = (list: SeedComment[] | undefined, slug: string) => {
    for (const c of list ?? []) {
      addMember(c.by, slug);
      walk(c.replies, slug);
    }
  };
  for (const p of POSTS) {
    addMember(p.by, p.community);
    walk(p.comments, p.community);
  }
  await prisma.membership.createMany({
    data: [...memberships].map((key) => {
      const [username = '', slug = ''] = key.split('|');
      const joined = userJoined.get(username) ?? now - 30 * DAY;
      return {
        userId: uid(username),
        communityId: communityId.get(slug)!,
        createdAt: new Date(joined + between(0.1, 0.5) * (now - joined)),
      };
    }),
  });

  // ---------- posts y comentarios ----------
  const postId = new Map<string, number>();
  const postCreated = new Map<number, number>();
  const commentKey = new Map<string, number>();
  const comments: CommentRecord[] = [];
  const ordered = [...POSTS].sort((a, b) => b.daysAgo - a.daysAgo);

  async function createComments(
    list: SeedComment[] | undefined,
    post: { id: number; authorId: number },
    parent: { id: number; authorId: number } | null,
    parentTime: number,
  ): Promise<void> {
    for (const c of list ?? []) {
      const createdAt = clampTime(parentTime + (c.h ?? between(1, 6)) * HOUR, parentTime);
      const authorId = uid(c.by);
      const row = await prisma.comment.create({
        data: { postId: post.id, parentId: parent?.id ?? null, authorId, body: c.body, createdAt: new Date(createdAt) },
      });
      const record: CommentRecord = {
        id: row.id,
        postId: post.id,
        authorId,
        username: c.by,
        parentAuthorId: parent?.authorId ?? null,
        postAuthorId: post.authorId,
        body: c.body,
        createdAt,
        ...(c.key ? { key: c.key } : {}),
      };
      comments.push(record);
      if (c.key) commentKey.set(c.key, row.id);
      await createComments(c.replies, post, { id: row.id, authorId }, createdAt);
    }
  }

  for (const p of ordered) {
    const createdAt = now - p.daysAgo * DAY;
    const authorId = uid(p.by);
    const row = await prisma.post.create({
      data: {
        type: p.type,
        title: p.title,
        body: p.body,
        url: p.url ?? null,
        authorId,
        communityId: communityId.get(p.community)!,
        isPinned: !!p.pinned,
        isLocked: !!p.locked,
        createdAt: new Date(createdAt),
        hot: hotScore(0, new Date(createdAt)),
        pollClosesAt: p.poll?.closesInDays ? new Date(createdAt + p.poll.closesInDays * DAY) : null,
        tags: { create: (p.tags ?? []).map((name) => ({ tagId: tagId.get(name)! })) },
        ...(p.poll ? { pollOptions: { create: p.poll.options.map((text, position) => ({ text, position })) } } : {}),
      },
    });
    postId.set(p.key, row.id);
    postCreated.set(row.id, createdAt);
    await createComments(p.comments, { id: row.id, authorId }, null, createdAt);
  }

  // ---------- votos ----------
  const postVotes: Prisma.PostVoteCreateManyInput[] = [];
  const postScore = new Map<number, number>();
  for (const p of ordered) {
    const id = postId.get(p.key)!;
    const created = postCreated.get(id)!;
    let score = 0;
    for (const username of voters) {
      if (username === p.by || (userJoined.get(username) ?? 0) > created) continue;
      const act = userActivity.get(username) ?? 0.3;
      const pUp = act * Math.pow(p.quality, 0.8) * 0.95;
      const pDown = act * (p.quality < 0.1 ? 0.8 : Math.pow(1 - p.quality, 2) * 0.35);
      const r = rand();
      const value = r < pUp ? 1 : r < pUp + pDown ? -1 : 0;
      if (value === 0) continue;
      score += value;
      postVotes.push({ userId: uid(username), postId: id, value, createdAt: new Date(clampTime(created + between(0.2, 30) * HOUR, created)) });
    }
    postScore.set(id, score);
  }
  await prisma.postVote.createMany({ data: postVotes });

  const acceptedKeys = new Set(POSTS.map((p) => p.accepted).filter((k): k is string => !!k));
  const commentVotes: Prisma.CommentVoteCreateManyInput[] = [];
  const commentScore = new Map<number, number>();
  for (const c of comments) {
    let q = between(0.3, 0.8);
    if (c.key && acceptedKeys.has(c.key)) q = 0.95;
    else if (userRole.get(c.username) === 'PROFESSOR') q = 0.85;
    else if (c.username === 'santi_k') q = 0.03;
    let score = 0;
    for (const username of voters) {
      const voterId = uid(username);
      if (voterId === c.authorId || (userJoined.get(username) ?? 0) > c.createdAt) continue;
      const act = (userActivity.get(username) ?? 0.3) * (voterId === c.postAuthorId ? 1.4 : 1);
      const pUp = act * q * 0.55;
      const pDown = act * Math.pow(1 - q, 2) * 0.25;
      const r = rand();
      const value = r < pUp ? 1 : r < pUp + pDown ? -1 : 0;
      if (value === 0) continue;
      score += value;
      commentVotes.push({ userId: voterId, commentId: c.id, value, createdAt: new Date(clampTime(c.createdAt + between(0.1, 12) * HOUR, c.createdAt)) });
    }
    commentScore.set(c.id, score);
  }
  await prisma.commentVote.createMany({ data: commentVotes });

  // ---------- contadores desnormalizados ----------
  const commentsPerPost = new Map<number, number>();
  for (const c of comments) commentsPerPost.set(c.postId, (commentsPerPost.get(c.postId) ?? 0) + 1);
  for (const p of ordered) {
    const id = postId.get(p.key)!;
    const created = postCreated.get(id)!;
    const score = postScore.get(id) ?? 0;
    const commentCount = commentsPerPost.get(id) ?? 0;
    const ageDays = (now - created) / DAY;
    const viewCount = Math.round(12 + p.quality * 90 + commentCount * 14 + Math.sqrt(ageDays) * 25 + between(0, 40));
    await prisma.post.update({
      where: { id },
      data: {
        score,
        hot: hotScore(score, new Date(created)),
        commentCount,
        viewCount,
        acceptedCommentId: p.accepted ? (commentKey.get(p.accepted) ?? null) : null,
      },
    });
  }
  for (const [id, score] of commentScore) {
    if (score !== 0) await prisma.comment.update({ where: { id }, data: { score } });
  }

  // ---------- encuestas ----------
  const pollVotes: Prisma.PollVoteCreateManyInput[] = [];
  for (const p of ordered.filter((x): x is SeedPost & { poll: NonNullable<SeedPost['poll']> } => !!x.poll)) {
    const id = postId.get(p.key)!;
    const created = postCreated.get(id)!;
    const options = await prisma.pollOption.findMany({ where: { postId: id }, orderBy: { position: 'asc' } });
    const totalWeight = p.poll.weights.reduce((a, b) => a + b, 0);
    for (const username of voters) {
      if ((userJoined.get(username) ?? 0) > created || rand() > 0.8) continue;
      let r = rand() * totalWeight;
      let index = 0;
      while (index < p.poll.weights.length - 1 && r >= (p.poll.weights[index] ?? 0)) {
        r -= p.poll.weights[index] ?? 0;
        index++;
      }
      const option = options[index];
      if (!option) continue;
      pollVotes.push({ postId: id, userId: uid(username), optionId: option.id, createdAt: new Date(clampTime(created + between(0.5, 48) * HOUR, created)) });
    }
  }
  await prisma.pollVote.createMany({ data: pollVotes });

  // ---------- seguidores y guardados ----------
  const followTimes = new Map<string, number>();
  await prisma.follow.createMany({
    data: FOLLOWS.map(([a, b]) => {
      const t = clampTime(now - between(0.5, 25) * DAY, Math.max(userJoined.get(a)!, userJoined.get(b)!));
      followTimes.set(`${a}|${b}`, t);
      return { followerId: uid(a), followingId: uid(b), createdAt: new Date(t) };
    }),
  });
  await prisma.bookmark.createMany({
    data: BOOKMARKS.map(([username, key]) => {
      const id = postId.get(key)!;
      return { userId: uid(username), postId: id, createdAt: new Date(clampTime(postCreated.get(id)! + between(1, 40) * HOUR, postCreated.get(id)!)) };
    }),
  });

  // ---------- notificaciones (derivadas de la actividad) ----------
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const READ_BEFORE = now - 36 * HOUR;
  const pushNotification = (n: { userId: number; type: NotificationType; actorId?: number | null; postId?: number | null; commentId?: number | null; message?: string | null; createdAt: number }) => {
    if (n.actorId != null && n.actorId === n.userId) return;
    notifications.push({
      userId: n.userId,
      type: n.type,
      actorId: n.actorId ?? null,
      postId: n.postId ?? null,
      commentId: n.commentId ?? null,
      message: n.message ?? null,
      read: n.createdAt < READ_BEFORE,
      createdAt: new Date(n.createdAt),
    });
  };
  for (const c of comments) {
    const target = c.parentAuthorId ?? c.postAuthorId;
    pushNotification({
      userId: target,
      type: c.parentAuthorId ? 'COMMENT_REPLY' : 'POST_REPLY',
      actorId: c.authorId,
      postId: c.postId,
      commentId: c.id,
      createdAt: c.createdAt,
    });
    const mentioned = extractMentions(c.body)
      .map((name) => userId.get(USERS.find((u) => u.username.toLowerCase() === name)?.username ?? ''))
      .filter((id): id is number => !!id && id !== c.authorId && id !== target);
    for (const id of new Set(mentioned)) {
      pushNotification({ userId: id, type: 'MENTION', actorId: c.authorId, postId: c.postId, commentId: c.id, createdAt: c.createdAt });
    }
  }
  for (const p of POSTS) {
    if (!p.accepted) continue;
    const commentId = commentKey.get(p.accepted);
    const c = comments.find((x) => x.id === commentId);
    if (!c) continue;
    pushNotification({
      userId: c.authorId,
      type: 'ANSWER_ACCEPTED',
      actorId: uid(p.by),
      postId: c.postId,
      commentId: c.id,
      createdAt: clampTime(c.createdAt + between(0.5, 4) * HOUR, c.createdAt),
    });
  }
  for (const [a, b] of FOLLOWS) {
    pushNotification({ userId: uid(b), type: 'FOLLOW', actorId: uid(a), createdAt: followTimes.get(`${a}|${b}`)! });
  }

  // ---------- moderación: ban + reportes ----------
  const spamPostId = postId.get('spam-apuntes')!;
  const banCreated = postCreated.get(spamPostId)! + 5 * HOUR;
  await prisma.ban.create({
    data: {
      userId: uid('promo_apuntes'),
      bannedById: uid('moderadora'),
      reason: 'Spam: venta de apuntes por WhatsApp',
      createdAt: new Date(banCreated),
      expiresAt: new Date(banCreated + 7 * DAY),
    },
  });
  pushNotification({
    userId: uid('promo_apuntes'),
    type: 'MOD',
    message:
      'Tu cuenta fue suspendida por 7 días. Motivo: Spam: venta de apuntes por WhatsApp. Podés seguir leyendo el foro, pero no publicar, comentar, votar ni enviar mensajes.',
    createdAt: banCreated,
  });
  await prisma.notification.createMany({ data: notifications });

  const santiComment = commentKey.get('pps-santi')!;
  const santiTime = comments.find((c) => c.id === santiComment)!.createdAt;
  await prisma.report.createMany({
    data: [
      {
        reporterId: uid('meli_quimica'),
        postId: spamPostId,
        reason: 'SPAM',
        details: 'Vende apuntes y pide que le escriban por WhatsApp. Va contra las reglas de la comunidad.',
        createdAt: new Date(postCreated.get(spamPostId)! + 1.2 * HOUR),
      },
      {
        reporterId: uid('vale_sistemas'),
        commentId: santiComment,
        reason: 'HARASSMENT',
        details: 'Comentario despectivo hacia una compañera que hizo una consulta.',
        createdAt: new Date(santiTime + 2 * HOUR),
      },
      {
        reporterId: uid('santi_k'),
        postId: postId.get('phet')!,
        reason: 'OFF_TOPIC',
        details: null,
        status: 'DISMISSED',
        resolvedById: uid('moderadora'),
        createdAt: new Date(postCreated.get(postId.get('phet')!)! + 30 * HOUR),
        resolvedAt: new Date(postCreated.get(postId.get('phet')!)! + 34 * HOUR),
      },
    ],
  });

  // ---------- mensajes directos ----------
  let messageCount = 0;
  for (const conv of CONVERSATIONS) {
    const a = uid(conv.a);
    const b = uid(conv.b);
    const msgs = [...conv.messages].sort((x, y) => y.hoursAgo - x.hoursAgo);
    const first = now - (msgs[0]?.hoursAgo ?? 1) * HOUR;
    const last = now - (msgs[msgs.length - 1]?.hoursAgo ?? 1) * HOUR;
    const readAt = (username: string) => new Date(now - (conv.readUpToHoursAgo?.[username] ?? msgs[msgs.length - 1]?.hoursAgo ?? 0) * HOUR);
    await prisma.conversation.create({
      data: {
        key: `${Math.min(a, b)}:${Math.max(a, b)}`,
        createdById: a,
        createdAt: new Date(first - 60_000),
        updatedAt: new Date(last),
        participants: {
          create: [
            { userId: a, joinedAt: new Date(first - 60_000), lastReadAt: readAt(conv.a) },
            { userId: b, joinedAt: new Date(first - 60_000), lastReadAt: readAt(conv.b) },
          ],
        },
        messages: {
          create: msgs.map((m) => ({ senderId: uid(m.by), body: m.body, createdAt: new Date(now - m.hoursAgo * HOUR) })),
        },
      },
    });
    messageCount += msgs.length;
  }

  console.info(
    `[seed] ✔ ${USERS.length} usuarios, ${COMMUNITIES.length} comunidades, ${TAGS.length} etiquetas, ${POSTS.length} posts, ` +
      `${comments.length} comentarios, ${postVotes.length + commentVotes.length} votos, ${pollVotes.length} votos en encuestas, ` +
      `${notifications.length} notificaciones, ${CONVERSATIONS.length} conversaciones (${messageCount} mensajes) ` +
      `en ${((Date.now() - started) / 1000).toFixed(1)} s.`,
  );
  console.info(`[seed] Cuentas de prueba (contraseña "${PASSWORD}"): admin, moderadora, prof_garcia, lucia_dev, tomi_ing, sofi_mate, nico_frt, vale_sistemas`);
}

main()
  .catch((err) => {
    console.error('[seed] ✘ Error sembrando la base:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
