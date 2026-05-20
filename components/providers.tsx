import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';

import { getSession, onAuthStateChange } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    getSession()
      .then((session) => {
        if (!mounted) return;
        setSession(session);
        setHydrated(true);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setHydrated(true);
        setReady(true);
      });

    const unsubscribe = onAuthStateChange((session) => {
      setSession(session);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setSession, setHydrated]);

  if (!ready) return null;

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
