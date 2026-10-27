import { Ban, ChartLine, FileText, Flag, LayoutGrid, MessageSquare, Table, Users, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Card, ErrorState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Segmented';
import { useDocumentTitle } from '@/hooks';
import { cn, formatNumber } from '@/lib/utils';
import { useAdminStats } from '@/queries/admin';
import { ActivityChart, ActivityTable, ChartLegend } from './ActivityChart';

function StatCard({ label, value, icon: Icon, tone, to, hint }: { label: string; value: number | undefined; icon: LucideIcon; tone: string; to?: string; hint?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className={cn('grid size-8 place-items-center rounded-lg', tone)}>
          <Icon className="size-4" />
        </span>
      </div>
      {value == null ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 text-[28px] font-bold leading-none tracking-tight tabular-nums text-zinc-950 dark:text-white">{formatNumber(value)}</p>
      )}
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </>
  );
  const cls = 'surface block p-4 transition-colors';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:border-zinc-300 dark:hover:border-zinc-700')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Dashboard() {
  useDocumentTitle('Moderación');
  const q = useAdminStats();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const d = q.data;

  if (q.isError) return <div className="surface"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div>;

  const totals = d?.activity.reduce((acc, p) => ({ posts: acc.posts + p.posts, comments: acc.comments + p.comments, users: acc.users + p.users }), { posts: 0, comments: 0, users: 0 });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Usuarios" value={d?.users} icon={Users} tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400" to="/mod/users" hint={totals ? `+${formatNumber(totals.users)} en 14 días` : undefined} />
        <StatCard label="Posts" value={d?.posts} icon={FileText} tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" hint={totals ? `+${formatNumber(totals.posts)} en 14 días` : undefined} />
        <StatCard label="Comentarios" value={d?.comments} icon={MessageSquare} tone="bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" hint={totals ? `+${formatNumber(totals.comments)} en 14 días` : undefined} />
        <StatCard label="Comunidades" value={d?.communities} icon={LayoutGrid} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" />
        <StatCard
          label="Reportes pendientes"
          value={d?.pendingReports}
          icon={Flag}
          tone={d?.pendingReports ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}
          to="/mod/reports"
          hint={d ? (d.pendingReports ? 'Revisalos en la cola' : 'Todo al día') : undefined}
        />
        <StatCard label="Bans activos" value={d?.activeBans} icon={Ban} tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" to="/mod/users?banned=1" />
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-zinc-950 dark:text-white">Actividad de los últimos 14 días</h2>
            <ChartLegend className="mt-1.5" />
          </div>
          <Segmented
            size="sm"
            ariaLabel="Vista de la actividad"
            value={view}
            onChange={setView}
            items={[
              { value: 'chart', label: 'Gráfico', icon: ChartLine },
              { value: 'table', label: 'Tabla', icon: Table },
            ]}
          />
        </div>
        {!d ? (
          <Skeleton className="h-60 w-full rounded-xl" />
        ) : d.activity.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-400">Sin datos de actividad todavía.</p>
        ) : view === 'chart' ? (
          <ActivityChart data={d.activity} />
        ) : (
          <ActivityTable data={d.activity} />
        )}
      </Card>
    </div>
  );
}
