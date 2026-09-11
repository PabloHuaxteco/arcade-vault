import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

/**
 * Cliente de Supabase para el navegador.
 *
 * Se crea uno por uso (no un singleton compartido): en `@supabase/ssr` el
 * cliente lee y escribe cookies del documento en cada llamada. Usar solo desde
 * componentes con `"use client"`. Para Server Components / Actions / Route
 * Handlers, usar `lib/supabase/server.ts`.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
