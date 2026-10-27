import { ArrowLeft, ArrowBigUp, Bell, CircleCheckBig, MessagesSquare, Moon, ShieldCheck, Sun, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Outlet, Link } from 'react-router';
import { LogoMark } from '@/components/common';
import { useTheme } from '@/lib/store';

const FEATURES = [
  { icon: MessagesSquare, title: 'Preguntá y respondé', text: 'Dudas de cursada, parciales y finales con respuestas marcadas como solución.' },
  { icon: Users, title: 'Comunidades por materia', text: 'Sumate a las de tu carrera y armá tu propio feed.' },
  { icon: Bell, title: 'En tiempo real', text: 'Notificaciones y mensajes directos al instante.' },
  { icon: ShieldCheck, title: 'Un espacio cuidado', text: 'Moderado por estudiantes y docentes de la facultad.' },
];

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#140d36] lg:flex lg:w-[46%] xl:w-1/2">
      {/* Fondo: gradiente + grilla + blobs */}
      <div className="absolute inset-0 bg-linear-to-br from-brand-600 via-violet-700 to-indigo-950" />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at 30% 20%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 30% 20%, black 20%, transparent 75%)',
        }}
      />
      <div className="absolute -left-24 -top-24 size-96 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="absolute -bottom-32 right-[-10%] size-[28rem] rounded-full bg-sky-400/25 blur-3xl" />

      <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
        <Link to="/" className="inline-flex items-center gap-3 self-start rounded-xl text-white">
          <LogoMark className="size-10 drop-shadow-xl" />
          <span className="text-xl font-bold tracking-tight">Foro UTN</span>
        </Link>

        <div className="max-w-lg">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" />
            Facultad Regional Tucumán
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-white xl:text-5xl">
            La comunidad de la{' '}
            <span className="bg-linear-to-r from-white via-fuchsia-100 to-sky-200 bg-clip-text text-transparent">UTN FRT</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
            Un lugar para compartir apuntes, resolver dudas y enterarte de todo lo que pasa en la facu.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 backdrop-blur">
                  <f.icon className="size-[18px]" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{f.title}</span>
                  <span className="block text-[13px] leading-snug text-white/65">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tarjeta de ejemplo flotante */}
        <div className="relative max-w-sm">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="grid size-5 place-items-center rounded-md bg-amber-300/30 text-[11px]">📐</span>
              <span className="font-semibold text-white/90">Análisis Matemático I</span>
              <span>· hace 2 h</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">¿Cómo encaro los límites con indeterminación 0/0?</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-400/20 px-2 py-0.5 font-semibold text-orange-200">
                <ArrowBigUp className="size-3.5 fill-current" /> 42
              </span>
              <span>18 comentarios</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-400/20 px-1.5 py-0.5 font-semibold text-emerald-200">
                <CircleCheckBig className="size-3" /> Resuelta
              </span>
            </div>
          </div>
          <p className="mt-6 text-xs text-white/45">© {new Date().getFullYear()} Foro UTN · Universidad Tecnológica Nacional</p>
        </div>
      </div>
    </div>
  );
}

export function AuthLayout() {
  const { resolved, setTheme } = useTheme();
  return (
    <div className="flex min-h-dvh bg-white dark:bg-zinc-950">
      <BrandPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="size-4" />
            Volver al foro
          </Link>
          <button
            type="button"
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            aria-label={resolved === 'dark' ? 'Usar tema claro' : 'Usar tema oscuro'}
            className="grid size-9 place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            {resolved === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
        </div>
        <main className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-[400px] animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-8">
      <LogoMark className="mb-6 size-11 lg:hidden" />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
    </div>
  );
}
