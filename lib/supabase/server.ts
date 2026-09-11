import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/types";

/**
 * Cliente de Supabase para el servidor: Server Components, Server Actions y
 * Route Handlers.
 *
 * Se crea uno por request (no un singleton): lee y escribe las cookies de sesión
 * de la request actual. En Next 16 `cookies()` es asíncrono, por eso esta
 * factoría es `async` y los consumidores hacen `await createClient()`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Escribir cookies desde un Server Component lanza: es esperado.
            // El refresco real de sesión llegará con `proxy.ts` en la spec de auth.
          }
        },
      },
    }
  );
}
