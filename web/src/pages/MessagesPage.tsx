import { ArrowLeft, MessageCircle, Search, SendHorizontal, SquarePen } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { RoleBadge } from '@/components/common';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Spinner } from '@/components/ui/Spinner';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { activeConversation } from '@/lib/store';
import { conversationTime, dayLabel, fullDate, timeHM } from '@/lib/time';
import type { Conversation, Message } from '@/lib/types';
import { cn, displayName } from '@/lib/utils';
import { useMe, useRequireUser } from '@/queries/auth';
import { flattenMessages, useConversations, useMarkConversationRead, useMessages, useSendMessage, useStartConversation } from '@/queries/messages';
import { useSearch } from '@/queries/misc';

/* ---------------- Nuevo mensaje ---------------- */

function NewMessageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 250);
  const search = useSearch(debounced);
  const start = useStartConversation();
  const navigate = useNavigate();
  const { me } = useMe();
  const users = (search.data?.users ?? []).filter((u) => u.id !== me?.id);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setQ(''); }} title="Nuevo mensaje" description="Buscá a la persona con la que querés hablar." size="sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o @usuario" className="pl-9" aria-label="Buscar usuario" />
      </div>
      <div className="-mx-2 mt-3 min-h-40">
        {debounced.trim().length < 2 ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-400">Escribí al menos 2 letras.</p>
        ) : search.isPending || search.isFetching ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-zinc-400">No encontramos usuarios.</p>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={start.isPending}
              onClick={() =>
                start.mutate(u.username, {
                  onSuccess: ({ conversation }) => {
                    onOpenChange(false);
                    setQ('');
                    navigate(`/messages/${conversation.id}`);
                  },
                })
              }
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:hover:bg-zinc-800/50"
            >
              <Avatar user={u} size="lg" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {displayName(u)} <RoleBadge role={u.role} />
                </span>
                <span className="text-xs text-zinc-500">@{u.username}</span>
              </span>
              {start.isPending && start.variables === u.username && <Spinner className="ml-auto size-4" />}
            </button>
          ))
        )}
      </div>
    </Dialog>
  );
}

/* ---------------- Lista ---------------- */

function ConversationList({ items, activeId, loading, error, onRetry, onNew }: { items: Conversation[]; activeId: number | null; loading: boolean; error: unknown; onRetry: () => void; onNew: () => void }) {
  const { me } = useMe();
  const [filter, setFilter] = useState('');
  const list = items.filter((c) => {
    const f = filter.trim().toLowerCase();
    return !f || c.other.username.toLowerCase().includes(f) || (c.other.displayName ?? '').toLowerCase().includes(f);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h1 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white">Mensajes</h1>
        <Button size="icon-sm" variant="ghost" aria-label="Nuevo mensaje" onClick={onNew}>
          <SquarePen />
        </Button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar conversación"
            aria-label="Buscar conversación"
            className="h-9 w-full rounded-xl bg-zinc-100 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:bg-zinc-800/70"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))
        ) : error ? (
          <ErrorState compact error={error} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <EmptyState
            compact
            icon={MessageCircle}
            title="Sin conversaciones"
            description="Escribile a alguien desde su perfil o con el botón de nuevo mensaje."
            action={
              <Button size="sm" onClick={onNew}>
                <SquarePen /> Nuevo mensaje
              </Button>
            }
          />
        ) : (
          list.map((c) => {
            const active = c.id === activeId;
            const mine = c.lastMessage?.senderId === me?.id;
            return (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-xl p-2.5 transition-colors',
                  active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                )}
              >
                <span className="relative">
                  <Avatar user={c.other} size="lg" className="size-11" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate text-sm', c.unread ? 'font-semibold text-zinc-950 dark:text-white' : 'font-medium text-zinc-800 dark:text-zinc-200')}>
                      {displayName(c.other)}
                    </span>
                    {c.lastMessage && (
                      <span className={cn('shrink-0 text-[11px]', c.unread ? 'font-semibold text-brand-600 dark:text-brand-400' : 'text-zinc-400')}>
                        {conversationTime(c.lastMessage.createdAt)}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={cn('min-w-0 flex-1 truncate text-[13px]', c.unread ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400')}>
                      {c.lastMessage ? `${mine ? 'Vos: ' : ''}${c.lastMessage.body}` : 'Sin mensajes todavía'}
                    </span>
                    {c.unread > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>
                    )}
                  </span>
                </span>
              </Link>
            );
          })
        )}
        {!loading && items.length > 0 && list.length === 0 && <p className="px-3 py-6 text-center text-sm text-zinc-400">Ninguna conversación coincide.</p>}
      </div>
    </div>
  );
}

/* ---------------- Conversación ---------------- */

function groupMessages(messages: Message[]) {
  type Group = { day: string; key: string; runs: { senderId: number; items: Message[] }[] };
  const days: Group[] = [];
  for (const m of messages) {
    const label = dayLabel(m.createdAt);
    let day = days[days.length - 1];
    if (!day || day.day !== label) {
      day = { day: label, key: m.createdAt, runs: [] };
      days.push(day);
    }
    const run = day.runs[day.runs.length - 1];
    const last = run?.items[run.items.length - 1];
    if (run && run.senderId === m.sender.id && last && new Date(m.createdAt).getTime() - new Date(last.createdAt).getTime() < 5 * 60_000) {
      run.items.push(m);
    } else {
      day.runs.push({ senderId: m.sender.id, items: [m] });
    }
  }
  return days;
}

function ConversationView({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { me } = useMe();
  const requireUser = useRequireUser();
  const q = useMessages(conversation.id);
  const send = useSendMessage(conversation.id);
  const markRead = useMarkConversationRead();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const prevHeight = useRef<number | null>(null);
  const lastId = useRef<number | null>(null);
  const messages = useMemo(() => flattenMessages(q.data), [q.data]);
  const groups = useMemo(() => groupMessages(messages), [messages]);
  const newest = messages[messages.length - 1];

  // Registrar conversación activa (para no mostrar toasts de lo que ya se ve)
  useEffect(() => {
    activeConversation.id = conversation.id;
    return () => {
      activeConversation.id = null;
    };
  }, [conversation.id]);

  // Marcar como leída al abrir (si hay no leídos) y cuando llegan mensajes nuevos del otro
  const seenNewest = useRef<number | null | undefined>(undefined);
  const { mutate: markReadMutate } = markRead;
  useEffect(() => {
    if (conversation.unread > 0) markReadMutate(conversation.id);
  }, [conversation.id, conversation.unread, markReadMutate]);
  useEffect(() => {
    const prev = seenNewest.current;
    seenNewest.current = newest?.id ?? null;
    if (prev === undefined || !newest || newest.id === prev) return;
    if (newest.sender.id !== me?.id) markReadMutate(conversation.id);
  }, [newest, me?.id, conversation.id, markReadMutate]);

  // Mantener la posición al cargar mensajes viejos; auto-scroll con mensajes nuevos
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevHeight.current != null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }
    if (!newest) return;
    const isNew = lastId.current !== newest.id;
    const first = lastId.current === null;
    lastId.current = newest.id;
    if (!isNew) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (first || nearBottom || newest.sender.id === me?.id) {
      el.scrollTo({ top: el.scrollHeight, behavior: first ? 'auto' : 'smooth' });
    }
  }, [messages, newest, me?.id]);

  useEffect(() => {
    lastId.current = null;
    taRef.current?.focus();
  }, [conversation.id]);

  // Autosize del textarea
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [text]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !q.hasNextPage || q.isFetchingNextPage) return;
    if (el.scrollTop < 80) {
      prevHeight.current = el.scrollHeight;
      void q.fetchNextPage();
    }
  };

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    if (!requireUser()) return;
    send.mutate(body, { onSuccess: () => setText('') });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5 sm:px-4 dark:border-zinc-800">
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Volver a la lista" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <Link to={`/u/${conversation.other.username}`} className="flex min-w-0 items-center gap-3 rounded-xl pr-2 hover:opacity-90">
          <Avatar user={conversation.other} size="md" className="size-9" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-950 dark:text-white">
              {displayName(conversation.other)} <RoleBadge role={conversation.other.role} />
            </span>
            <span className="block text-xs text-zinc-500">@{conversation.other.username}</span>
          </span>
        </Link>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {q.isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Spinner className="size-4 text-zinc-400" />
          </div>
        )}
        {q.isPending ? (
          <div className="space-y-3">
            {[60, 40, 72, 30, 55].map((w, i) => (
              <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                <Skeleton className="h-10 rounded-2xl" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Avatar user={conversation.other} size="xl" />
            <p className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">{displayName(conversation.other)}</p>
            <p className="mt-1 text-sm text-zinc-500">Empezá la conversación con un saludo 👋</p>
          </div>
        ) : (
          <>
            {!q.hasNextPage && (
              <p className="mb-4 text-center text-xs text-zinc-400">Este es el comienzo de tu conversación con {displayName(conversation.other)}.</p>
            )}
            {groups.map((day) => (
              <Fragment key={day.key}>
                <div className="sticky top-0 z-10 my-3 flex justify-center">
                  <span className="rounded-full bg-zinc-100/90 px-3 py-1 text-[11px] font-medium capitalize text-zinc-500 backdrop-blur dark:bg-zinc-800/90 dark:text-zinc-400">{day.day}</span>
                </div>
                <div className="space-y-3">
                  {day.runs.map((run) => {
                    const mine = run.senderId === me?.id;
                    const sender = run.items[0].sender;
                    return (
                      <div key={run.items[0].id} className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
                        {!mine && <Avatar user={sender} size="sm" className="mb-5 hidden sm:inline-grid" />}
                        <div className={cn('flex max-w-[82%] flex-col gap-0.5 sm:max-w-[70%]', mine ? 'items-end' : 'items-start')}>
                          {run.items.map((m, i) => {
                            const firstOf = i === 0;
                            const lastOf = i === run.items.length - 1;
                            return (
                              <div
                                key={m.id}
                                title={fullDate(m.createdAt)}
                                className={cn(
                                  'whitespace-pre-wrap break-words px-3.5 py-2 text-[14.5px] leading-snug [overflow-wrap:anywhere]',
                                  mine
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
                                  'rounded-2xl',
                                  mine ? cn('rounded-br-md', !firstOf && 'rounded-tr-md') : cn('rounded-bl-md', !firstOf && 'rounded-tl-md'),
                                  lastOf && 'shadow-xs',
                                )}
                              >
                                {m.body}
                              </div>
                            );
                          })}
                          <span className="px-1 text-[10.5px] text-zinc-400">{timeHM(run.items[run.items.length - 1].createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Fragment>
            ))}
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800"
      >
        <textarea
          ref={taRef}
          value={text}
          rows={1}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Escribí un mensaje…"
          aria-label="Mensaje"
          className="max-h-36 min-h-10 flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[14.5px] leading-snug focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-brand-400 dark:focus:bg-zinc-900"
        />
        <Button type="submit" size="icon" className="size-10 rounded-full" aria-label="Enviar" disabled={!text.trim()} loading={send.isPending}>
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}

/* ---------------- Página ---------------- */

export default function MessagesPage() {
  const { id } = useParams();
  const activeId = id ? Number(id) : null;
  const navigate = useNavigate();
  const q = useConversations();
  const [newOpen, setNewOpen] = useState(false);
  const items = q.data ?? [];
  const active = activeId != null ? items.find((c) => c.id === activeId) : undefined;
  useDocumentTitle(active ? `Chat con ${displayName(active.other)}` : 'Mensajes');

  return (
    <div className="surface flex overflow-hidden max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:top-14 max-md:z-30 max-md:rounded-none max-md:border-0 md:h-[calc(100dvh-7.75rem)]">
      <div className={cn('w-full shrink-0 border-zinc-100 md:w-80 md:border-r dark:border-zinc-800', activeId != null && 'hidden md:block')}>
        <ConversationList items={items} activeId={activeId} loading={q.isPending} error={q.isError ? q.error : null} onRetry={() => void q.refetch()} onNew={() => setNewOpen(true)} />
      </div>
      <div className={cn('min-w-0 flex-1', activeId == null && 'hidden md:block')}>
        {activeId == null ? (
          <div className="grid h-full place-items-center p-6">
            <EmptyState
              icon={MessageCircle}
              title="Tus mensajes"
              description="Elegí una conversación o empezá una nueva para hablar en privado con alguien del foro."
              action={
                <Button onClick={() => setNewOpen(true)}>
                  <SquarePen /> Nuevo mensaje
                </Button>
              }
            />
          </div>
        ) : q.isPending ? (
          <div className="grid h-full place-items-center">
            <Spinner className="text-zinc-400" />
          </div>
        ) : active ? (
          <ConversationView key={active.id} conversation={active} onBack={() => navigate('/messages')} />
        ) : (
          <div className="grid h-full place-items-center p-6">
            <EmptyState icon={MessageCircle} tone="zinc" title="Conversación no encontrada" description="Puede que el link esté mal." action={<Button variant="secondary" onClick={() => navigate('/messages')}>Ver mensajes</Button>} />
          </div>
        )}
      </div>
      <NewMessageDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
