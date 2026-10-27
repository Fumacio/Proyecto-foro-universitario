import * as DM from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;
export const MenuGroup = DM.Group;
export const MenuRadioGroup = DM.RadioGroup;

export const popoverSurface =
  'z-50 rounded-xl border border-zinc-200 bg-white p-1.5 text-sm shadow-pop outline-none data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out dark:border-zinc-800 dark:bg-zinc-900';

export function MenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(popoverSurface, 'min-w-48', className)}
        {...props}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

const itemClass =
  'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-zinc-700 outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-zinc-100 data-[highlighted]:text-zinc-950 dark:text-zinc-300 dark:data-[highlighted]:bg-zinc-800 dark:data-[highlighted]:text-white [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-zinc-400 data-[highlighted]:[&_svg]:text-current';

export function MenuItem({
  className,
  danger,
  icon,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DM.Item> & { danger?: boolean; icon?: ReactNode }) {
  return (
    <DM.Item
      className={cn(
        itemClass,
        danger &&
          'text-rose-600 data-[highlighted]:bg-rose-50 data-[highlighted]:text-rose-700 dark:text-rose-400 dark:data-[highlighted]:bg-rose-500/10 dark:data-[highlighted]:text-rose-300 [&_svg]:text-rose-500',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </DM.Item>
  );
}

export function MenuRadioItem({ className, children, icon, ...props }: ComponentPropsWithoutRef<typeof DM.RadioItem> & { icon?: ReactNode }) {
  return (
    <DM.RadioItem className={cn(itemClass, 'pr-8', className)} {...props}>
      {icon}
      {children}
      <DM.ItemIndicator className="absolute right-2.5">
        <Check className="!text-brand-600 dark:!text-brand-400" />
      </DM.ItemIndicator>
    </DM.RadioItem>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <DM.Separator className={cn('-mx-1.5 my-1.5 h-px bg-zinc-100 dark:bg-zinc-800', className)} />;
}

export function MenuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DM.Label className={cn('px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400', className)}>
      {children}
    </DM.Label>
  );
}
