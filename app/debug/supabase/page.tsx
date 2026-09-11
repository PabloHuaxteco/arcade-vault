/**
 * Ruta temporal de verificación de la conexión con Supabase.
 *
 * Comprueba de un vistazo, desde el navegador, que las variables
 * `NEXT_PUBLIC_SUPABASE_*` están puestas y que el cliente de servidor llega al
 * proyecto. No forma parte de la app: la borra la spec que introduzca datos
 * reales (esquema de tablas).
 */
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Estado =
  | { tipo: "SIN CONFIGURAR" }
  | { tipo: "CONECTADO"; url: string }
  | { tipo: "ERROR"; mensaje: string };

async function comprobar(): Promise<Estado> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return { tipo: "SIN CONFIGURAR" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getClaims();
    if (error) {
      return { tipo: "ERROR", mensaje: error.message };
    }
    return { tipo: "CONECTADO", url };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    return { tipo: "ERROR", mensaje };
  }
}

const colores: Record<Estado["tipo"], string> = {
  "SIN CONFIGURAR": "#b45309",
  CONECTADO: "#15803d",
  ERROR: "#b91c1c",
};

export default async function DebugSupabasePage() {
  const estado = await comprobar();

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: "40rem",
        margin: "0 auto",
        padding: "3rem 1.5rem",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
        Conexión con Supabase
      </h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        Ruta temporal de verificación. Se elimina con la spec del esquema de
        datos.
      </p>

      <p
        style={{
          display: "inline-block",
          marginTop: "1.5rem",
          padding: "0.5rem 0.875rem",
          borderRadius: "0.375rem",
          border: `1px solid ${colores[estado.tipo]}`,
          color: colores[estado.tipo],
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {estado.tipo}
      </p>

      {estado.tipo === "SIN CONFIGURAR" && (
        <p>
          Falta <code>NEXT_PUBLIC_SUPABASE_URL</code> o{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> en{" "}
          <code>.env.local</code>. Cópialas desde <code>.env.example</code>.
        </p>
      )}

      {estado.tipo === "CONECTADO" && (
        <p>
          Proyecto: <code>{estado.url}</code>
        </p>
      )}

      {estado.tipo === "ERROR" && (
        <p>
          La llamada a Supabase falló: <code>{estado.mensaje}</code>
        </p>
      )}
    </main>
  );
}
