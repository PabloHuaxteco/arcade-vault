// Biblioteca — pantalla raíz. Server Component: renderiza la sección av-hero y
// delega el buscador + chips + grid en la isla Client <LibraryBrowser>.
// Portado de la función Library de references/templates/biblioteca.jsx.

import { CATS, GAMES } from "@/lib/games";
import { LibraryBrowser } from "./_components/library-browser";

export default function LibraryPage() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <LibraryBrowser games={GAMES} cats={CATS} />
    </div>
  );
}
