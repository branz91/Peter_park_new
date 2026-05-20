import { create } from 'zustand';

import type { AuthSession } from '@/api/auth';

interface AuthState {
  session: AuthSession | null;
  hydrated: boolean;
  setSession: (session: AuthSession | null) => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,
  setSession: (session) => set({ session }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
