import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type {
  Comment,
  CommentsResponse,
  Community,
  Me,
  Paginated,
  PostDetail,
  PostListItem,
  SearchResult,
} from './types';

/* Convención de claves:
 *  ['feed', ...]       → InfiniteData<Paginated<PostListItem>> (todas las listas de posts)
 *  ['post', id]        → { post: PostDetail }
 *  ['search', q]       → SearchResult
 *  ['comments', postId, sort] → CommentsResponse
 *  ['communities', 'all'|'joined'] → { items: Community[] }
 *  ['community', slug] → { community: Community }
 */

type PostPatch = Partial<PostListItem> | ((p: PostListItem) => Partial<PostListItem>);
type FeedData = InfiniteData<Paginated<PostListItem>>;

export function patchPost(qc: QueryClient, id: number, patch: PostPatch) {
  const apply = <T extends PostListItem>(p: T): T =>
    p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p;

  qc.setQueriesData<FeedData>({ queryKey: ['feed'] }, (data) =>
    data?.pages
      ? { ...data, pages: data.pages.map((pg) => ({ ...pg, items: pg.items.map(apply) })) }
      : data,
  );
  qc.setQueryData<{ post: PostDetail }>(['post', id], (d) => (d ? { post: apply(d.post) } : d));
  qc.setQueriesData<SearchResult>({ queryKey: ['search'] }, (d) =>
    d?.posts ? { ...d, posts: d.posts.map(apply) } : d,
  );
}

export function removePostFromCaches(qc: QueryClient, id: number) {
  qc.setQueriesData<FeedData>({ queryKey: ['feed'] }, (data) =>
    data?.pages
      ? { ...data, pages: data.pages.map((pg) => ({ ...pg, items: pg.items.filter((p) => p.id !== id) })) }
      : data,
  );
  qc.setQueriesData<SearchResult>({ queryKey: ['search'] }, (d) =>
    d?.posts ? { ...d, posts: d.posts.filter((p) => p.id !== id) } : d,
  );
  qc.removeQueries({ queryKey: ['post', id] });
}

/** Busca la versión más reciente de un post en cualquier cache. */
export function findPost(qc: QueryClient, id: number): PostListItem | undefined {
  const detail = qc.getQueryData<{ post: PostDetail }>(['post', id]);
  if (detail) return detail.post;
  for (const [, data] of qc.getQueriesData<FeedData>({ queryKey: ['feed'] })) {
    for (const pg of data?.pages ?? []) {
      const found = pg.items.find((p) => p.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Junta las páginas de un infinite query eliminando duplicados (el orden "hot" se mueve). */
export function flattenPages<T extends { id: number }>(data: InfiniteData<{ items: T[] }> | undefined): T[] {
  if (!data) return [];
  const seen = new Set<number>();
  const out: T[] = [];
  for (const pg of data.pages) {
    for (const item of pg.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/* ---------------- Comentarios ---------------- */

export function mapCommentTree(list: Comment[], id: number, fn: (c: Comment) => Comment): Comment[] {
  return list.map((c) => {
    if (c.id === id) return fn(c);
    if (c.replies.length === 0) return c;
    const replies = mapCommentTree(c.replies, id, fn);
    return replies === c.replies ? c : { ...c, replies };
  });
}

export function findComment(list: Comment[], id: number): Comment | undefined {
  for (const c of list) {
    if (c.id === id) return c;
    const found = findComment(c.replies, id);
    if (found) return found;
  }
  return undefined;
}

export function countComments(list: Comment[]): number {
  return list.reduce((n, c) => n + 1 + countComments(c.replies), 0);
}

export function patchComment(qc: QueryClient, postId: number, id: number, patch: Partial<Comment> | ((c: Comment) => Partial<Comment>)) {
  qc.setQueriesData<CommentsResponse>({ queryKey: ['comments', postId] }, (d) =>
    d
      ? {
          ...d,
          items: mapCommentTree(d.items, id, (c) => ({ ...c, ...(typeof patch === 'function' ? patch(c) : patch) })),
        }
      : d,
  );
}

export function insertComment(qc: QueryClient, postId: number, comment: Comment) {
  qc.setQueriesData<CommentsResponse>({ queryKey: ['comments', postId] }, (d) => {
    if (!d) return d;
    if (comment.parentId == null) {
      const accepted = d.items.filter((c) => c.isAccepted);
      const rest = d.items.filter((c) => !c.isAccepted);
      return { total: d.total + 1, items: [...accepted, comment, ...rest] };
    }
    return {
      total: d.total + 1,
      items: mapCommentTree(d.items, comment.parentId, (p) => ({ ...p, replies: [...p.replies, comment] })),
    };
  });
}

/* ---------------- Comunidades ---------------- */

export function patchCommunity(qc: QueryClient, slug: string, patch: Partial<Community>) {
  qc.setQueriesData<{ items: Community[] }>({ queryKey: ['communities'] }, (d) =>
    d?.items ? { ...d, items: d.items.map((c) => (c.slug === slug ? { ...c, ...patch } : c)) } : d,
  );
  qc.setQueryData<{ community: Community }>(['community', slug], (d) =>
    d ? { community: { ...d.community, ...patch } } : d,
  );
}

/* ---------------- Me ---------------- */

export function patchMe(qc: QueryClient, patch: Partial<Me> | ((m: Me) => Partial<Me>)) {
  qc.setQueryData<{ user: Me | null }>(['me'], (d) =>
    d?.user ? { user: { ...d.user, ...(typeof patch === 'function' ? patch(d.user) : patch) } } : d,
  );
}
