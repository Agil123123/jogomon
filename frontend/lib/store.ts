// ============================================================
// JOGO-MON — Zustand Auth Store
// ============================================================
import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

function readInitialAuth(): Pick<AuthState, 'token' | 'user' | 'isAuthenticated'> {
  if (typeof window === 'undefined') return { token: null, user: null, isAuthenticated: false };
  try {
    const rawToken = localStorage.getItem('jm_token');
    // guard: token string "null"/"undefined"/empty dari bug lama
    const token = rawToken && rawToken !== 'null' && rawToken !== 'undefined' ? rawToken : null;
    const userStr = localStorage.getItem('jm_user');
    if (token && userStr && userStr !== 'null' && userStr !== 'undefined') {
      const user = JSON.parse(userStr) as User;
      if (token && user?.id && user?.username) return { token, user, isAuthenticated: true };
    }
  } catch {}
  return { token: null, user: null, isAuthenticated: false };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...readInitialAuth(),
  hasHydrated: typeof window === 'undefined' ? false : true,

  login: (token: string, user: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jm_token', token);
      localStorage.setItem('jm_user', JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true, hasHydrated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jm_token');
      localStorage.removeItem('jm_user');
    }
    set({ token: null, user: null, isAuthenticated: false, hasHydrated: true });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const cur = readInitialAuth();
    if (cur.token && cur.user) {
      set({ token: cur.token, user: cur.user, isAuthenticated: true, hasHydrated: true });
    } else if (!cur.token) {
      set({ token: null, user: null, isAuthenticated: false, hasHydrated: true });
    } else {
      set({ hasHydrated: true });
    }
  },
}));
