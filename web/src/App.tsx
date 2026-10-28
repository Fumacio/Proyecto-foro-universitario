import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { TooltipProvider } from './components/ui/Popover';
import { useMediaQuery } from './hooks';
import { queryClient } from './lib/queryClient';
import { useTheme } from './lib/store';
import { router } from './router';

function ThemedToaster() {
  const { resolved } = useTheme();
  const desktop = useMediaQuery('(min-width: 768px)');
  return (
    <Toaster
      theme={resolved}
      position={desktop ? 'bottom-right' : 'top-center'}
      closeButton
      richColors
      offset={desktop ? 20 : 12}
      toastOptions={{
        classNames: {
          toast: 'font-sans !rounded-2xl !shadow-pop',
          title: '!font-semibold',
          description: '!text-[13px]',
        },
      }}
    />
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={350} skipDelayDuration={150}>
        <RouterProvider router={router} />
        <ThemedToaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
