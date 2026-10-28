import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { createStore } from './store';

/* ---------------- Instalación ---------------- */

/** Evento no estándar de Chromium (no está en lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const installPromptStore = createStore<BeforeInstallPromptEvent | null>(null);
/** El usuario cerró la tarjeta "Instalá la app" (solo oculta la tarjeta, no el ítem del menú). */
export const installCardDismissedStore = createStore<boolean>(false, 'foro:install-dismissed');
export const iosInstallDialogStore = createStore(false);

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
/** iPhone/iPad (los iPad nuevos se presentan como Mac con pantalla táctil). */
export const isIOS =
  /iphone|ipad|ipod/i.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const standaloneQuery = typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)') : null;

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return !!standaloneQuery?.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function useStandalone() {
  return useSyncExternalStore(
    (cb) => {
      standaloneQuery?.addEventListener('change', cb);
      return () => standaloneQuery?.removeEventListener('change', cb);
    },
    isStandalone,
    () => false,
  );
}

/**
 * Estado del botón "Instalar app": disponible si el navegador ofreció `beforeinstallprompt`
 * o si es iOS (ahí mostramos instrucciones). Nunca si ya corre instalada.
 */
export function useInstallApp() {
  const deferred = installPromptStore.useValue();
  const standalone = useStandalone();
  const canPrompt = !!deferred && !standalone;
  const ios = isIOS && !standalone && !canPrompt;
  return {
    available: canPrompt || ios,
    ios,
    install: async () => {
      if (deferred) {
        try {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === 'accepted') installCardDismissedStore.set(true);
        } catch {
          /* el navegador puede rechazar si no hubo gesto del usuario */
        } finally {
          // El evento se puede usar una sola vez.
          installPromptStore.set(null);
        }
      } else if (ios) {
        iosInstallDialogStore.set(true);
      }
    },
  };
}

/* ---------------- Service worker ---------------- */

let userAcceptedUpdate = false;

function showUpdateToast(worker: ServiceWorker) {
  toast('Hay una versión nueva del foro', {
    id: 'sw-update',
    description: 'Actualizá para usar las últimas mejoras.',
    duration: Infinity,
    action: {
      label: 'Actualizar',
      onClick: () => {
        userAcceptedUpdate = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
        // Si por algún motivo no cambia el controlador, recargamos igual.
        setTimeout(() => window.location.reload(), 3000);
      },
    },
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          // Solo es "actualización" si ya había un SW controlando la página.
          if (next.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(next);
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !userAcceptedUpdate) return;
        reloading = true;
        window.location.reload();
      });
      // Buscar versiones nuevas cada hora y al volver a la pestaña.
      setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
      });
    } catch (err) {
      console.warn('[pwa] No se pudo registrar el service worker', err);
    }
  };
  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}

/** Se llama una vez al arrancar (main.tsx). */
export function initPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPromptStore.set(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    installPromptStore.set(null);
    installCardDismissedStore.set(true);
    toast.success('¡Listo! Foro UTN quedó instalado', { description: 'Lo vas a encontrar junto a tus otras apps.' });
  });
  // Solo en producción: en dev el SW cachearía módulos de Vite y rompería el HMR.
  if (import.meta.env.PROD) registerServiceWorker();
}
