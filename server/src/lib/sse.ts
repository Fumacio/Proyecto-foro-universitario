import type { Response } from 'express';

/** Conexiones SSE abiertas por usuario (una por pestaña). Vive en memoria del proceso. */
const clients = new Map<number, Set<Response>>();

export const PING_INTERVAL_MS = 25_000;

export function addClient(userId: number, res: Response): () => void {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  set.add(res);
  return () => {
    const current = clients.get(userId);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) clients.delete(userId);
  };
}

export function isOnline(userId: number): boolean {
  return (clients.get(userId)?.size ?? 0) > 0;
}

export function connectionCount(): number {
  let n = 0;
  for (const set of clients.values()) n += set.size;
  return n;
}

function write(res: Response, chunk: string): void {
  try {
    if (!res.writableEnded) res.write(chunk);
  } catch {
    // conexión caída: la limpieza la hace el handler de "close"
  }
}

export function sendEvent(userId: number, event: string, data: unknown): void {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) write(res, chunk);
}

export function sendComment(res: Response, text: string): void {
  write(res, `: ${text}\n\n`);
}

/** Cierra todas las conexiones (apagado ordenado). */
export function closeAll(): void {
  for (const set of clients.values()) {
    for (const res of set) {
      try {
        res.end();
      } catch {
        /* ignore */
      }
    }
  }
  clients.clear();
}
