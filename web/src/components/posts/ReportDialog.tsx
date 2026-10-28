import { Flag } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ReportReason } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCreateReport } from '@/queries/misc';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Textarea } from '../ui/Input';

export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'SPAM', label: 'Spam', description: 'Publicidad, contenido repetido o engañoso.' },
  { value: 'HARASSMENT', label: 'Acoso o agresión', description: 'Insultos, hostigamiento o ataques personales.' },
  { value: 'INAPPROPRIATE', label: 'Contenido inapropiado', description: 'Material ofensivo, violento o explícito.' },
  { value: 'OFF_TOPIC', label: 'Fuera de tema', description: 'No corresponde a esta comunidad.' },
  { value: 'OTHER', label: 'Otro motivo', description: 'Contanos qué pasa en los detalles.' },
];

export const REPORT_REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label])) as Record<
  ReportReason,
  string
>;

export function ReportDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: { postId: number } | { commentId: number };
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const report = useCreateReport();
  const isPost = 'postId' in target;

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setReason(null);
      setDetails('');
    }
  };

  const submit = () => {
    if (!reason) return;
    report.mutate(
      { ...target, reason, details: details.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('¡Gracias! Recibimos tu reporte.', { description: 'El equipo de moderación lo va a revisar.' });
          close(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={isPost ? 'Reportar post' : 'Reportar comentario'}
      description="Los reportes son anónimos para el autor del contenido."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={submit} disabled={!reason || (reason === 'OTHER' && !details.trim())} loading={report.isPending}>
            <Flag />
            Enviar reporte
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">Motivo</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
              reason === r.value
                ? 'border-rose-400 bg-rose-50/70 dark:border-rose-500/50 dark:bg-rose-500/10'
                : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50',
            )}
          >
            <input
              type="radio"
              name="reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="mt-0.5 size-4 accent-rose-600"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.label}</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">{r.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-4">
        <label htmlFor="report-details" className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
          Detalles {reason !== 'OTHER' && <span className="font-normal text-zinc-400">(opcional)</span>}
        </label>
        <Textarea
          id="report-details"
          value={details}
          maxLength={500}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Contanos un poco más…"
          rows={3}
        />
        <p className="mt-1 text-right text-xs tabular-nums text-zinc-400">{details.length}/500</p>
      </div>
    </Dialog>
  );
}
