import { useSyncExternalStore } from 'react';

/** Pequeño store reactivo con persistencia opcional en localStorage. */
export function createStore<T>(initial: T, storageKey?: string) {
  let value = initial;
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) value = JSON.parse(raw) as T;
    } catch {
      /* storage bloqueado: usamos el valor por defecto */
    }
  }
  const listeners = new Set<() => void>();

  const get = () => value;
  const set = (next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        /* ignorar */
      }
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const useValue = () => useSyncExternalStore(subscribe, get, get);

  return { get, set, subscribe, useValue };
}

/* ---------------- Tema ---------------- */

export type ThemePref = 'light' | 'dark' | 'system';

export const themeStore = createStore<ThemePref>('system', 'foro:theme');

const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return darkQuery?.matches ? 'dark' : 'light';
  return pref;
}

function applyTheme() {
  const resolved = resolveTheme(themeStore.get());
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#09090b' : '#fafafa');
  resolvedStore.set(resolved);
}

export const resolvedStore = createStore<'light' | 'dark'>(resolveTheme(themeStore.get()));

if (typeof window !== 'undefined') {
  themeStore.subscribe(applyTheme);
  darkQuery?.addEventListener('change', () => {
    if (themeStore.get() === 'system') applyTheme();
  });
  applyTheme();
}

export function useTheme() {
  const theme = themeStore.useValue();
  const resolved = resolvedStore.useValue();
  return { theme, resolved, setTheme: themeStore.set };
}

/* ---------------- Preferencias de feed ---------------- */

export type FeedView = 'card' | 'compact';
export const feedViewStore = createStore<FeedView>('card', 'foro:feed-view');

export function useFeedView() {
  return [feedViewStore.useValue(), feedViewStore.set] as const;
}

/* ---------------- Estado de UI global ---------------- */

export const paletteStore = createStore(false);
export const drawerStore = createStore(false);

/** Conversación abierta en pantalla (para no notificar mensajes que ya se están viendo). */
export const activeConversation = { id: null as number | null };
