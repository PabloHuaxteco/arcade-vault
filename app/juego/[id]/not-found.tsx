// Pantalla mostrada cuando el id de /juego/[id] no corresponde a ningún juego.

import Link from "next/link";

export default function GameNotFound() {
  return (
    <div className="fade-in" style={{ textAlign: "center", padding: 80 }}>
      <div
        className="pixel"
        style={{ fontSize: 16, color: "var(--magenta)", marginBottom: 16 }}
      >
        JUEGO NO ENCONTRADO
      </div>
      <p style={{ color: "var(--ink-faint)", marginBottom: 28 }}>
        Ese cartucho no está en el vault.
      </p>
      <Link className="btn lg" href="/biblioteca">
        VOLVER A LA BIBLIOTECA
      </Link>
    </div>
  );
}
