// Footer común a las cinco pantallas. Server Component.
// Estilos inline portados tal cual de references/templates/app.jsx (el template
// no usa una clase CSS para el footer).

export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--line)",
        padding: "20px 32px",
        textAlign: "center",
        color: "var(--ink-faint)",
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: "0.16em",
      }}
    >
      © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
    </footer>
  );
}
