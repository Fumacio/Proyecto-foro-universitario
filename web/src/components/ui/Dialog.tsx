import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, type ButtonVariant } from './Button';

export const DialogRoot = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export const overlayClass =
  'fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out dark:bg-black/60';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  trigger?: ReactNode;
  className?: string;
  bodyClassName?: string;
  hideClose?: boolean;
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', trigger, className, bodyClassName, hideClose }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RD.Trigger asChild>{trigger}</RD.Trigger>}
      <RD.Portal>
        <RD.Overlay className={overlayClass} />
        <RD.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-zinc-200 bg-white shadow-pop outline-none data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out dark:border-zinc-800 dark:bg-zinc-900',
            sizes[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              <RD.Title className="text-base font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</RD.Title>
              {description ? (
                <RD.Description className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</RD.Description>
              ) : (
                <RD.Description className="sr-only">{typeof title === 'string' ? title : 'Diálogo'}</RD.Description>
              )}
            </div>
            {!hideClose && (
              <RD.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Cerrar" className="-mr-1.5 -mt-1">
                  <X />
                </Button>
              </RD.Close>
            )}
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4', bodyClassName)}>{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-zinc-100 bg-zinc-50/70 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/80">
              {footer}
            </div>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  onConfirm: () => unknown | Promise<unknown>;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  children,
}: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                /* el error ya se mostró con un toast */
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
