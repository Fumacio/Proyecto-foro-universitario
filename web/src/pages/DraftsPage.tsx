import { FilePen, PenLine } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { DraftList } from '@/components/drafts/DraftList';
import { PageHeader, PageLayout } from '@/components/layout/AppShell';
import { PopularCommunities } from '@/components/layout/RightRail';
import { buttonVariants } from '@/components/ui/Button';
import { Card } from '@/components/ui/misc';
import { useDocumentTitle } from '@/hooks';
import { plural } from '@/lib/utils';
import { useDrafts } from '@/queries/drafts';

export default function DraftsPage() {
  useDocumentTitle('Borradores');
  const navigate = useNavigate();
  const q = useDrafts();
  const count = q.data?.length ?? 0;

  return (
    <PageLayout
      aside={
        <>
          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <FilePen className="size-4 text-brand-500" />
              ¿Cómo funcionan?
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>• Mientras escribís un post se guarda solo, cada pocos segundos.</li>
              <li>• Los archivos adjuntos quedan guardados con el borrador.</li>
              <li>• Solo vos ves tus borradores. Al publicar, el borrador desaparece.</li>
              <li>• Podés tener hasta 50 a la vez.</li>
            </ul>
          </Card>
          <PopularCommunities />
        </>
      }
    >
      <PageHeader
        title="Borradores"
        description={q.data ? (count ? `${plural(count, 'post')} sin publicar. Se guardan solos mientras escribís.` : 'Tus posts sin publicar se guardan solos acá.') : 'Tus posts sin publicar.'}
        icon={
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <FilePen className="size-5" />
          </span>
        }
        actions={
          <Link to="/submit" className={buttonVariants({ size: 'sm' })}>
            <PenLine />
            Nuevo post
          </Link>
        }
      />
      <div className="surface overflow-hidden">
        <DraftList
          drafts={q.data}
          loading={q.isPending}
          error={q.isError ? q.error : null}
          onRetry={() => void q.refetch()}
          onOpen={(d) => navigate(`/submit?draft=${d.id}`)}
          emptyAction={
            <Link to="/submit" className={buttonVariants({ size: 'sm' })}>
              <PenLine />
              Crear post
            </Link>
          }
        />
      </div>
    </PageLayout>
  );
}
