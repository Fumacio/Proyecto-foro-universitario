/** Puente para navegar desde fuera de componentes (handlers globales de errores, toasts, SSE). */
let navigateImpl: (to: string) => void = (to) => window.location.assign(to);

export function setNavigator(fn: (to: string) => void) {
  navigateImpl = fn;
}

export function navigateTo(to: string) {
  navigateImpl(to);
}

export function currentPath() {
  return window.location.pathname + window.location.search + window.location.hash;
}

export function loginPath(next = currentPath()) {
  const clean = next.split('#')[0];
  if (/^\/(login|register|forgot-password|reset-password)/.test(clean)) return '/login';
  return `/login?next=${encodeURIComponent(clean)}`;
}
