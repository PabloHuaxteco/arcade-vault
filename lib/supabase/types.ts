/**
 * Tipo `Database` placeholder.
 *
 * Da tipado al genérico de los clientes de `@supabase/ssr`
 * (`createBrowserClient<Database>` / `createServerClient<Database>`) mientras
 * todavía no existe esquema. La spec del esquema de datos lo sustituirá por los
 * tipos generados con `supabase gen types`.
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
