"use client";

// Next.js 16 ya no fuerza el scroll al inicio en cada navegación (ver
// "Scroll Behavior Override" en los docs de la versión 16), así que sin esto
// las páginas nuevas heredan la posición de scroll de la pantalla anterior.
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

export function ScrollToTop() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
