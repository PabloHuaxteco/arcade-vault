"use client";

// Contexto de sesión falsa compartido por Nav, Auth, Reproductor y Salón.
// Con rutas separadas ya no hay un componente App que pase `user` por props,
// así que el estado vive en este provider montado en el layout.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearUser, readUser, writeUser, type StoredUser } from "@/lib/storage";

interface SessionValue {
  user: StoredUser | null;
  signIn: (name: string) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);

  // Hidratar desde localStorage tras el montaje, nunca en el render inicial,
  // para no provocar hydration mismatch.
  useEffect(() => {
    setUser(readUser());
  }, []);

  const signIn = useCallback((name: string) => {
    const next: StoredUser = { name: (name || "PLAYER1").toUpperCase().slice(0, 10) };
    setUser(next);
    writeUser(next);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    clearUser();
  }, []);

  return (
    <SessionContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
