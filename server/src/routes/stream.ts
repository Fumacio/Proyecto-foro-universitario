import { Router } from 'express';
import { addClient, PING_INTERVAL_MS, sendComment } from '../lib/sse.js';
import { countUnreadMessages, countUnreadNotifications } from '../lib/unread.js';
import { authUser, requireAuth } from '../middleware/auth.js';

/** GET /api/stream — Server-Sent Events del usuario logueado. */
const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const user = authUser(req);
  const [notifications, messages] = await Promise.all([countUnreadNotifications(user.id), countUnreadMessages(user.id)]);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  res.write('retry: 5000\n\n');
  res.write(`event: unread\ndata: ${JSON.stringify({ notifications, messages })}\n\n`);

  const remove = addClient(user.id, res);
  const ping = setInterval(() => sendComment(res, 'ping'), PING_INTERVAL_MS);

  const cleanup = () => {
    clearInterval(ping);
    remove();
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

export default router;
