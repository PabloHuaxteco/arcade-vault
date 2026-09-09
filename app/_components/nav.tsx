"use client";

// Navbar común. Portado de references/templates/nav.jsx: el hash-router y las
// props `route` / `navigate` se sustituyen por <Link> y usePathname().

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-provider";

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);

  // Equivalente a isActive() del template. "Inicio" solo se activa en la raíz;
  // la Biblioteca queda activa también en el detalle y el reproductor, que
  // cuelgan de /juego.
  const inicioActive = pathname === "/";
  const libraryActive =
    pathname.startsWith("/biblioteca") || pathname.startsWith("/juego");
  const salonActive = pathname.startsWith("/salon");
  const authActive = pathname.startsWith("/entrar");

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link className={inicioActive ? "active" : ""} href="/" onClick={close}>
            Inicio
          </Link>
          <Link className={libraryActive ? "active" : ""} href="/biblioteca" onClick={close}>
            Biblioteca
          </Link>
          <Link className={salonActive ? "active" : ""} href="/salon" onClick={close}>
            Salón de la Fama
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link className="btn auth-btn" href="/entrar">
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link className={inicioActive ? "active" : ""} href="/" onClick={close}>
          Inicio
        </Link>
        <Link className={libraryActive ? "active" : ""} href="/biblioteca" onClick={close}>
          Biblioteca
        </Link>
        <Link className={salonActive ? "active" : ""} href="/salon" onClick={close}>
          Salón de la Fama
        </Link>
        <Link className={authActive ? "active" : ""} href="/entrar" onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }} />
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
