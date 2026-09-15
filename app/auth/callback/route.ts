import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Intercambia el `code` de confirmación de registro / recuperación de
 * contraseña / OAuth por una sesión real. Usado por signUp, resetPasswordForEmail
 * y signInWithOAuth (ver app/_components/session-provider.tsx).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/biblioteca";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar?error=confirmacion`);
}
