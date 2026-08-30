'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
}

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  isManager: boolean;
  canManageSystem: boolean;   // ADMIN only: users, settings, integrations
  canManageAssets: boolean;   // ADMIN only: buildings, room types, room config
  isStaff: boolean;
  hydrated: boolean;          // true once localStorage has been read
  setAuthUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, isAdmin: false, isManager: false,
  canManageSystem: false, canManageAssets: false, isStaff: false,
  hydrated: false,
  setAuthUser: () => {},
});

function normalizeRole(role: any): 'ADMIN' | 'USER' {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

function normalizeUser(user: any): AuthUser | null {
  if (!user) return null;
  return {
    ...user,
    role: normalizeRole(user.role),
  };
}

function persistUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem('hotel_user');
    return;
  }
  localStorage.setItem('hotel_user', JSON.stringify(user));
}

function readUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('hotel_user');
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

function buildDemoUser(): AuthUser {
  return {
    id: 'demo-admin',
    email: 'demo@hotel.local',
    fullName: 'Demo Admin',
    role: 'ADMIN',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const setAuthUser = (nextUser: AuthUser | null) => {
    const normalized = normalizeUser(nextUser);
    persistUser(normalized);
    setUser(normalized);
  };

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      const demoUser = buildDemoUser();
      persistUser(demoUser);
      setUser(demoUser);
      setHydrated(true);
      return;
    }

    setUser(readUser());
    setHydrated(true);

    // Keep in sync if another tab logs in/out
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hotel_user') setUser(readUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isAdmin          = user?.role === 'ADMIN';
  const isManager        = false;
  const canManageSystem  = isAdmin;
  const canManageAssets  = isAdmin;
  const isStaff          = !!user;

  return (
    <AuthContext.Provider value={{ user, isAdmin, isManager, canManageSystem, canManageAssets, isStaff, hydrated, setAuthUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
