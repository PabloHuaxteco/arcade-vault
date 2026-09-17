"use client";

// Contexto de sesión real (Supabase Auth) compartido por Nav, Auth, Reproductor
// y Salón. Con rutas separadas ya no hay un componente App que pase `user` por
// props, así que el estado vive en este provider montado en el layout.

import type { AuthError, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

interface SessionUser {
  id: string; // auth.users.id — usado para el match "TÚ" en /salon
  name: string; // user_metadata.display_name, mayúsculas, máx. 10 caracteres
}

interface SessionValue {
  user: SessionUser | null;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (
    provider: "google" | "github"
  ) => Promise<{ error: string | null }>;
}

const SessionContext = createContext<SessionValue | null>(null);

// Deriva el nombre de jugador de user_metadata: display_name (registro por
// correo) o, si no existe, full_name (Google) / user_name / login (GitHub).
function deriveName(user: User): string {
  const meta = user.user_metadata ?? {};
  const raw =
    meta.display_name ||
    meta.full_name ||
    meta.user_name ||
    meta.login ||
    "JUGADOR";
  const cleaned = String(raw).trim();
  return (cleaned || "JUGADOR").toUpperCase().slice(0, 10);
}

function toSessionUser(user: User | null | undefined): SessionUser | null {
  return user ? { id: user.id, name: deriveName(user) } : null;
}

// Traduce los mensajes de error más comunes de Supabase Auth; el resto se
// muestra tal cual llega (o un mensaje genérico si no hay `message`).
function mapAuthError(error: AuthError | null): string | null {
  if (!error) return null;
  const known: Record<string, string> = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "Email not confirmed":
      "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.",
    "User already registered": "Ese correo ya está registrado.",
  };
  return (
    known[error.message] ??
    error.message ??
    "Ocurrió un error. Intenta de nuevo."
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(toSessionUser(data.session?.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toSessionUser(session?.user));
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: mapAuthError(error) };
    },
    [supabase]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.toUpperCase().slice(0, 10) },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return {
        error: mapAuthError(error),
        needsConfirmation: !error && !data.session,
      };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/entrar/restablecer`,
      });
      return { error: mapAuthError(error) };
    },
    [supabase]
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error: mapAuthError(error) };
    },
    [supabase]
  );

  const signInWithOAuth = useCallback(
    async (provider: "google" | "github") => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: mapAuthError(error) };
    },
    [supabase]
  );

  const value = useMemo(
    () => ({
      user,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      signInWithOAuth,
    }),
    [
      user,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      signInWithOAuth,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
