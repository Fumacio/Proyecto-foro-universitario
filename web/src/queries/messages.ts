import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import { patchMe } from '@/lib/cache';
import type { Conversation, Message, MessagesPage } from '@/lib/types';

export function useConversations(enabled = true) {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: ({ signal }) => api.get<{ items: Conversation[] }>('/conversations', undefined, signal),
    enabled,
    select: (d) => d.items,
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => api.post<{ conversation: Conversation }>('/conversations', { username }),
    onSuccess: ({ conversation }) => {
      qc.setQueryData<{ items: Conversation[] }>(['conversations'], (d) =>
        d
          ? { items: [conversation, ...d.items.filter((c) => c.id !== conversation.id)] }
          : { items: [conversation] },
      );
    },
  });
}

/** Mensajes paginados hacia atrás: pages[0] = los más nuevos; cada página viene en orden ascendente. */
export function useMessages(conversationId: number | null) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam, signal }) =>
      api.get<MessagesPage>(
        `/conversations/${conversationId}/messages`,
        { before: pageParam ?? undefined, limit: 30 },
        signal,
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.hasMore && last.items.length > 0 ? last.items[0].id : undefined),
    enabled: conversationId != null,
    staleTime: Infinity,
  });
}

export function flattenMessages(data: InfiniteData<MessagesPage> | undefined): Message[] {
  if (!data) return [];
  const out: Message[] = [];
  const seen = new Set<number>();
  for (let i = data.pages.length - 1; i >= 0; i--) {
    for (const m of data.pages[i].items) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

/** Agrega un mensaje (enviado o recibido por SSE) al cache de su conversación y actualiza la lista. */
export function appendMessage(qc: QueryClient, msg: Message, opts?: { incrementUnread?: boolean }) {
  qc.setQueryData<InfiniteData<MessagesPage>>(['messages', msg.conversationId], (d) => {
    if (!d || d.pages.length === 0) return d;
    if (d.pages.some((p) => p.items.some((m) => m.id === msg.id))) return d;
    const [first, ...rest] = d.pages;
    return { ...d, pages: [{ ...first, items: [...first.items, msg] }, ...rest] };
  });
  let found = false;
  qc.setQueryData<{ items: Conversation[] }>(['conversations'], (d) => {
    if (!d) return d;
    const conv = d.items.find((c) => c.id === msg.conversationId);
    if (!conv) return d;
    found = true;
    const updated: Conversation = {
      ...conv,
      lastMessage: { body: messagePreview(msg), createdAt: msg.createdAt, senderId: msg.sender.id },
      updatedAt: msg.createdAt,
      unread: opts?.incrementUnread ? conv.unread + 1 : conv.unread,
    };
    return { items: [updated, ...d.items.filter((c) => c.id !== msg.conversationId)] };
  });
  if (!found) qc.invalidateQueries({ queryKey: ['conversations'] });
}

export function useSendMessage(conversationId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, attachmentIds }: { body: string; attachmentIds?: number[] }) =>
      api.post<{ message: Message }>(`/conversations/${conversationId}/messages`, {
        body,
        ...(attachmentIds?.length ? { attachmentIds } : {}),
      }),
    onSuccess: ({ message }) => appendMessage(qc, message),
  });
}

/** Texto para la vista previa de un mensaje (los que son solo adjuntos vienen con body ""). */
export function messagePreview(m: { body: string; attachments?: { filename: string; kind: string }[] }) {
  if (m.body.trim()) return m.body;
  const files = m.attachments ?? [];
  if (files.length === 0) return '📎 Archivo adjunto';
  if (files.length === 1) return `${files[0].kind === 'IMAGE' ? '🖼️' : '📎'} ${files[0].filename}`;
  return `📎 ${files.length} archivos`;
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: number) =>
      api.post<{ unreadMessages: number }>(`/conversations/${conversationId}/read`),
    meta: { skipGlobalError: true },
    onMutate: (conversationId) => {
      qc.setQueryData<{ items: Conversation[] }>(['conversations'], (d) =>
        d ? { items: d.items.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)) } : d,
      );
    },
    onSuccess: ({ unreadMessages }) => patchMe(qc, { unreadMessages }),
  });
}
