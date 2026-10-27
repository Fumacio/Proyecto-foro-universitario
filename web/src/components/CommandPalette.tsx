import * as RD from '@radix-ui/react-dialog';
import {
  ArrowRight,
  Bell,
  CornerDownLeft,
  FileText,
  House,
  LayoutGrid,
  MessageCircle,
  Plus,
  Search,
  SearchX,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useDebounce } from '@/hooks';
import { paletteStore } from '@/lib/store';
import { cn, displayName, formatCount, postPath } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { useSearch } from '@/queries/misc';
import { CommunityIcon, RoleBadge } from './common';
import { Avatar } from './ui/Avatar';
import { overlayClass } from './ui/Dialog';
import { Kbd } from './ui/misc';
import { Spinner } from './ui/Spinner';

interface Item {
  key: string;
  section: string;
  to: string;
  render: ReactNode;
}

function QuickIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-8 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      <Icon className="size-4" />
    </span>
  );
}

export function CommandPalette() {
  const open = paletteStore.useValue();
  const navigate = useNavigate();
  const { me } = useMe();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounce(q, 220);
  const search = useSearch(debounced);
  const term = q.trim();

  // Atajos globales: Ctrl/⌘+K y "/"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteStore.set((o) => !o);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        paletteStore.set(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ('');
      setActive(-1);
    }
  }, [open]);

  useEffect(() => setActive(-1), [debounced]);

  const items: Item[] = useMemo(() => {
    if (term.length < 2) {
      const quick: Item[] = [
        { key: 'q-home', section: 'Ir a', to: '/', render: <Row icon={<QuickIcon icon={House} />} title="Inicio" /> },
        { key: 'q-c', section: 'Ir a', to: '/c', render: <Row icon={<QuickIcon icon={LayoutGrid} />} title="Comunidades" /> },
      ];
      if (me) {
        quick.push(
          { key: 'q-submit', section: 'Ir a', to: '/submit', render: <Row icon={<QuickIcon icon={Plus} />} title="Crear post" /> },
          { key: 'q-notif', section: 'Ir a', to: '/notifications', render: <Row icon={<QuickIcon icon={Bell} />} title="Notificaciones" /> },
          { key: 'q-msg', section: 'Ir a', to: '/messages', render: <Row icon={<QuickIcon icon={MessageCircle} />} title="Mensajes" /> },
          { key: 'q-settings', section: 'Ir a', to: '/settings', render: <Row icon={<QuickIcon icon={Settings} />} title="Configuración" /> },
        );
      }
      return quick;
    }
    const data = search.data;
    if (!data) return [];
    return [
      ...data.communities.map<Item>((c) => ({
        key: `c-${c.id}`,
        section: 'Comunidades',
        to: `/c/${c.slug}`,
        render: <Row icon={<CommunityIcon community={c} size="md" />} title={c.name} subtitle={`c/${c.slug}`} />,
      })),
      ...data.users.map<Item>((u) => ({
        key: `u-${u.id}`,
        section: 'Usuarios',
        to: `/u/${u.username}`,
        render: (
          <Row
            icon={<Avatar user={u} size="md" />}
            title={
              <span className="flex items-center gap-1.5">
                {displayName(u)} <RoleBadge role={u.role} />
              </span>
            }
            subtitle={`@${u.username}`}
          />
        ),
      })),
      ...data.posts.map<Item>((p) => ({
        key: `p-${p.id}`,
        section: 'Posts',
        to: postPath(p),
        render: (
          <Row
            icon={<QuickIcon icon={FileText} />}
            title={p.title}
            subtitle={`${p.community.icon} ${p.community.name} · ${formatCount(p.score)} votos · ${formatCount(p.commentCount)} comentarios`}
          />
        ),
      })),
    ];
  }, [term.length, search.data, me]);

  const go = (to: string) => {
    paletteStore.set(false);
    navigate(to);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (items.length ? (i <= 0 ? items.length - 1 : i - 1) : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && items[active]) go(items[active].to);
      else if (term) go(`/search?q=${encodeURIComponent(term)}`);
    }
  };

  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let lastSection = '';
  const loading = term.length >= 2 && (search.isFetching || debounced.trim() !== term);
  const noResults = term.length >= 2 && !loading && search.data && items.length === 0;

  return (
    <RD.Root open={open} onOpenChange={paletteStore.set}>
      <RD.Portal>
        <RD.Overlay className={overlayClass} />
        <RD.Content
          className="fixed left-1/2 top-[8vh] z-50 flex max-h-[min(36rem,84dvh)] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-pop outline-none data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out dark:border-zinc-800 dark:bg-zinc-900"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector('input')?.focus();
          }}
        >
          <RD.Title className="sr-only">Buscar en el foro</RD.Title>
          <RD.Description className="sr-only">Buscá comunidades, usuarios y posts. Usá las flechas para moverte y Enter para abrir.</RD.Description>
          <div className="flex items-center gap-3 border-b border-zinc-100 px-4 dark:border-zinc-800">
            {loading ? <Spinner className="size-5 text-brand-500" /> : <Search className="size-5 text-zinc-400" />}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar comunidades, usuarios o posts…"
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-activedescendant={active >= 0 ? `palette-item-${active}` : undefined}
              aria-autocomplete="list"
            />
            <Kbd className="hidden sm:inline-flex">Esc</Kbd>
          </div>
          <div ref={listRef} id="palette-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
            {term.length === 1 && <p className="px-3 py-6 text-center text-sm text-zinc-400">Escribí al menos 2 letras…</p>}
            {noResults && (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                <SearchX className="size-8 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm text-zinc-500">No encontramos nada para “{term}”.</p>
              </div>
            )}
            {search.isError && term.length >= 2 && !search.data && (
              <p className="px-3 py-6 text-center text-sm text-rose-500">No se pudo buscar. Probá de nuevo.</p>
            )}
            {items.map((it, i) => {
              const header = it.section !== lastSection ? it.section : null;
              lastSection = it.section;
              return (
                <div key={it.key}>
                  {header && (
                    <p className="px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 first:pt-1">{header}</p>
                  )}
                  <button
                    type="button"
                    id={`palette-item-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(it.to)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                      i === active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
                    )}
                  >
                    {it.render}
                    <ArrowRight className={cn('ml-auto size-4 shrink-0 text-brand-500 transition-opacity', i === active ? 'opacity-100' : 'opacity-0')} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/70 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            <span className="hidden items-center gap-1.5 sm:flex">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> para moverte
            </span>
            {term ? (
              <button type="button" onClick={() => go(`/search?q=${encodeURIComponent(term)}`)} className="ml-auto inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline dark:text-brand-400">
                Ver todos los resultados <Kbd><CornerDownLeft className="size-3" /></Kbd>
              </button>
            ) : (
              <span className="ml-auto">Tip: abrí esto con <Kbd>/</Kbd></span>
            )}
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

function Row({ icon, title, subtitle }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <>
      {icon}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
        {subtitle && <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>}
      </span>
    </>
  );
}
