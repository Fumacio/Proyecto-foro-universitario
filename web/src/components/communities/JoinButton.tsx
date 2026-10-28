import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Community } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useRequireUser } from '@/queries/auth';
import { useJoinCommunity } from '@/queries/communities';
import { Button, type ButtonSize } from '../ui/Button';

export function JoinButton({ community, size = 'sm', className }: { community: Community; size?: ButtonSize; className?: string }) {
  const requireUser = useRequireUser();
  const join = useJoinCommunity();
  const [hover, setHover] = useState(false);
  const member = community.isMember;

  return (
    <Button
      size={size}
      variant={member ? 'secondary' : 'primary'}
      className={cn('relative z-10', member && hover && 'border-rose-200 text-rose-600 dark:border-rose-500/30 dark:text-rose-400', className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={member}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!requireUser()) return;
        join.mutate(
          { slug: community.slug, join: !member, memberCount: community.memberCount },
          {
            onSuccess: (res) =>
              toast.success(res.isMember ? `Te uniste a ${community.icon} ${community.name}` : `Saliste de ${community.name}`),
          },
        );
      }}
    >
      {member ? (
        hover ? (
          'Salir'
        ) : (
          <>
            <Check strokeWidth={2.5} />
            Miembro
          </>
        )
      ) : (
        <>
          <Plus strokeWidth={2.5} />
          Unirme
        </>
      )}
    </Button>
  );
}
