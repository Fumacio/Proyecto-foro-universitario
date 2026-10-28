import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Foro UTN` : 'Foro UTN';
  }, [title]);
}

export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Llama a `onLoadMore` cuando el sentinel entra en pantalla (scroll infinito). */
export function useInfiniteScroll<T extends HTMLElement>(opts: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}) {
  const ref = useRef<T | null>(null);
  const cb = useRef(opts.onLoadMore);
  cb.current = opts.onLoadMore;

  useEffect(() => {
    const el = ref.current;
    if (!el || !opts.hasMore || opts.loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      { rootMargin: opts.rootMargin ?? '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [opts.hasMore, opts.loading, opts.rootMargin]);

  return ref;
}

/** Estado sincronizado con localStorage, tolerante a storage bloqueado. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignorar */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** Re-renderiza cada `intervalMs` (para textos tipo "hace 1 min"). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
