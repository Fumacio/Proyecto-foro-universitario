import { Flag, Gauge, LayoutGrid, ShieldCheck, Tags, Users } from 'lucide-react';
import { Route, Routes } from 'react-router';
import { LinkTabs } from '@/components/ui/Segmented';
import { useMe } from '@/queries/auth';
import { useAdminStats } from '@/queries/admin';
import { NotFoundPage } from '../NotFoundPage';
import { CommunitiesAdmin } from './CommunitiesAdmin';
import { Dashboard } from './Dashboard';
import { ReportsQueue } from './ReportsQueue';
import { TagsAdmin } from './TagsAdmin';
import { UsersAdmin } from './UsersAdmin';

export default function ModPage() {
  const { me } = useMe();
  const stats = useAdminStats();
  const isAdmin = me?.role === 'ADMIN';

  const tabs = [
    { to: '/mod', label: 'Dashboard', icon: Gauge, end: true },
    { to: '/mod/reports', label: 'Reportes', icon: Flag, badge: stats.data?.pendingReports },
    { to: '/mod/users', label: 'Usuarios', icon: Users },
    ...(isAdmin
      ? [
          { to: '/mod/communities', label: 'Comunidades', icon: LayoutGrid },
          { to: '/mod/tags', label: 'Etiquetas', icon: Tags },
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">Moderación</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{isAdmin ? 'Panel de administración del foro' : 'Panel del equipo de moderación'}</p>
        </div>
      </div>
      <LinkTabs items={tabs} className="mb-5" />
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="reports" element={<ReportsQueue />} />
        <Route path="users" element={<UsersAdmin />} />
        {isAdmin && <Route path="communities" element={<CommunitiesAdmin />} />}
        {isAdmin && <Route path="tags" element={<TagsAdmin />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
