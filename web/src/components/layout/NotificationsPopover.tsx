import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { Notification } from '@/lib/types';
import { useMarkNotificationsRead, useLatestNotifications } from '@/queries/notifications';
import { NotificationItem } from '../notifications/NotificationItem';
import { CountBadge, EmptyState, ErrorState, Skeleton } from '../ui/misc';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '../ui/Popover';

export function NotificationsPopover({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const q = useLatestNotifications(open);
  const markRead = useMarkNotificationsRead();

  const onOpenItem = (n: Notification) => {
    if (!n.read) markRead.mutate([n.id]);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void q.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
          className="relative grid size-9 place-items-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 data-[state=open]:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:data-[state=open]:bg-zinc-800"
        >
          <Bell className="size-[19px]" />
          <CountBadge count={unread} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notificaciones</h2>
          <button
            type="button"
            disabled={!unread || markRead.isPending}
            onClick={() => markRead.mutate(undefined)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-40 dark:text-brand-400 dark:hover:bg-brand-500/10"
          >
            <CheckCheck className="size-3.5" />
            Marcar todo como leído
          </button>
        </div>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1.5">
          {q.isPending ? (
            <div className="space-y-1 p-1">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex gap-3 p-2">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : q.isError ? (
            <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
          ) : q.data.items.length === 0 ? (
            <EmptyState compact icon={BellOff} tone="zinc" title="Sin notificaciones" description="Cuando alguien te responda o te mencione, lo vas a ver acá." />
          ) : (
            q.data.items.map((n) => <NotificationItem key={n.id} n={n} onOpen={onOpenItem} dense />)
          )}
        </div>
        <div className="border-t border-zinc-100 p-1.5 dark:border-zinc-800">
          <PopoverClose asChild>
            <Link
              to="/notifications"
              className="block rounded-lg py-2 text-center text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Ver todas
            </Link>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
