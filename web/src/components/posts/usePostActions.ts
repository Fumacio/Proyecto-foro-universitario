import { toast } from 'sonner';
import type { PostListItem } from '@/lib/types';
import { absoluteUrl, copyToClipboard, postPath } from '@/lib/utils';
import { useRequireUser } from '@/queries/auth';
import { useBookmarkPost, useVotePost } from '@/queries/posts';

export async function shareLink(path: string, title?: string) {
  const ok = await copyToClipboard(absoluteUrl(path));
  if (ok) toast.success('Link copiado al portapapeles', title ? { description: title } : undefined);
  else toast.error('No se pudo copiar el link');
}

export function usePostActions(post: PostListItem) {
  const requireUser = useRequireUser();
  const vote = useVotePost();
  const bookmark = useBookmarkPost();
  return {
    vote: (value: -1 | 0 | 1) => {
      if (!requireUser()) return;
      vote.mutate({ id: post.id, value });
    },
    toggleBookmark: () => {
      if (!requireUser({ allowBanned: true })) return;
      const next = !post.isBookmarked;
      bookmark.mutate(
        { id: post.id, bookmarked: next },
        { onSuccess: () => toast.success(next ? 'Guardado en tus posts guardados' : 'Quitado de guardados') },
      );
    },
    share: () => shareLink(postPath(post), post.title),
  };
}
