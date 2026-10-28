import * as RP from '@radix-ui/react-popover';
import * as RT from '@radix-ui/react-tooltip';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { popoverSurface } from './Menu';

export const Popover = RP.Root;
export const PopoverTrigger = RP.Trigger;
export const PopoverClose = RP.Close;
export const PopoverAnchor = RP.Anchor;

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 8,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof RP.Content>) {
  return (
    <RP.Portal>
      <RP.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(popoverSurface, 'p-0', className)}
        {...props}
      >
        {children}
      </RP.Content>
    </RP.Portal>
  );
}

export const TooltipProvider = RT.Provider;

export const tooltipContentClass =
  'z-[60] max-w-xs rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in dark:bg-zinc-100 dark:text-zinc-900';

export function Tooltip({
  content,
  children,
  side = 'top',
  delay,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}) {
  if (!content) return <>{children}</>;
  return (
    <RT.Root delayDuration={delay}>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={tooltipContentClass}
        >
          {content}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
