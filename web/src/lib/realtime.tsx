import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationIcon, notificationPlainText, notificationTarget } from '@/components/notifications/NotificationItem';
import { appendMessage, messagePreview } from '@/queries/messages';
import { API_BASE } from './api';
import { patchMe } from './cache';
import { navigateTo } from './navigation';
import { activeConversation } from './store';
import type { Message, Notification, UnreadEvent } from './types';
import { displayName } from './utils';

function ToastCard({
  id,
  icon,
  title,
  body,
  to,
}: {
  id: string | number;
  icon: ReactNode;
  title: string;
  body?: string;
  to: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        toast.dismiss(id);
        navigateTo(to);
      }}
      className="flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 text-left shadow-pop transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
        {body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-zinc-500 dark:text-zinc-400">{body}</span>}
      </span>
    </button>
  );
}

/**
 * Abre una única conexión SSE a /api/stream mientras haya sesión.
 * Reconecta con backoff exponencial (1 s → 30 s) si se corta.
 */
export function useRealtime(userId: number | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (userId == null || typeof EventSource === 'undefined') return;
    let es: EventSource | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(`${API_BASE}/stream`, { withCredentials: true });

      es.onopen = () => {
        if (retry > 0) {
          // Puede que nos hayamos perdido eventos mientras estábamos desconectados.
          qc.invalidateQueries({ queryKey: ['me'] });
          qc.invalidateQueries({ queryKey: ['notifications'] });
          qc.invalidateQueries({ queryKey: ['conversations'] });
        }
        retry = 0;
      };

      es.addEventListener('notification', (ev) => {
        let n: Notification;
        try {
          n = JSON.parse((ev as MessageEvent).data) as Notification;
        } catch {
          return;
        }
        qc.invalidateQueries({ queryKey: ['notifications'] });
        toast.custom(
          (id) => (
            <ToastCard
              id={id}
              icon={<NotificationIcon n={n} size="md" />}
              title={notificationPlainText(n)}
              body={n.comment?.excerpt}
              to={notificationTarget(n)}
            />
          ),
          { duration: 6000 },
        );
      });

      es.addEventListener('message', (ev) => {
        let m: Message;
        try {
          m = JSON.parse((ev as MessageEvent).data) as Message;
        } catch {
          return;
        }
        const mine = m.sender.id === userId;
        const viewing = activeConversation.id === m.conversationId && document.visibilityState === 'visible';
        appendMessage(qc, m, { incrementUnread: !mine && !viewing });
        if (!mine && !viewing) {
          toast.custom(
            (id) => (
              <ToastCard
                id={id}
                icon={
                  <span className="relative">
                    <Avatar user={m.sender} size="md" />
                    <span className="absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-brand-500 text-white ring-2 ring-white dark:ring-zinc-900">
                      <MessageCircle className="size-2.5" strokeWidth={2.75} />
                    </span>
                  </span>
                }
                title={`Mensaje de ${displayName(m.sender)}`}
                body={messagePreview(m)}
                to={`/messages/${m.conversationId}`}
              />
            ),
            { duration: 6000 },
          );
        }
      });

      es.addEventListener('unread', (ev) => {
        try {
          const u = JSON.parse((ev as MessageEvent).data) as UnreadEvent;
          patchMe(qc, { unreadNotifications: u.notifications, unreadMessages: u.messages });
        } catch {
          /* ignorar */
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        const delay = Math.min(30_000, 1000 * 2 ** retry) + Math.random() * 500;
        retry++;
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, [userId, qc]);
}
