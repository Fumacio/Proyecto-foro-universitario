import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export { prisma };

export const PASSWORD = 'Password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

export async function resetDb(): Promise<void> {
  await prisma.$transaction([
    prisma.attachment.deleteMany(),
    prisma.postReaction.deleteMany(),
    prisma.commentReaction.deleteMany(),
    prisma.draft.deleteMany(),
    prisma.emailLog.deleteMany(),
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
}

let seq = 0;

export async function createUser(opts: { username?: string; role?: Role; email?: string } = {}) {
  seq += 1;
  const username = opts.username ?? `user_${seq}_${Math.floor(Math.random() * 1e4)}`;
  return prisma.user.create({
    data: {
      username,
      usernameKey: username.toLowerCase(),
      email: (opts.email ?? `${username}@test.utn`).toLowerCase(),
      passwordHash,
      role: opts.role ?? 'STUDENT',
    },
  });
}

export type Agent = ReturnType<typeof request.agent>;

/** Agent de supertest con la sesión iniciada (cookie guardada). */
export async function loginAs(username: string, password = PASSWORD): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ login: username, password });
  if (res.status !== 200) throw new Error(`login falló para ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export async function userAndAgent(opts: { username?: string; role?: Role } = {}) {
  const user = await createUser(opts);
  return { user, agent: await loginAs(user.username) };
}

export async function createCommunity(slug = `com-${++seq}`) {
  return prisma.community.create({
    data: { slug, name: `Comunidad ${slug}`, description: 'desc', icon: '💬', color: '#123456', rules: ['Respeto'] },
  });
}

export async function createTag(name = `tag${++seq}`) {
  return prisma.tag.create({ data: { name, slug: name.toLowerCase(), color: '#ff0000' } });
}

export function anon() {
  return request(app);
}
