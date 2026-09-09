"use client";

// Isla Client de la Home: envuelve una sección y le añade la clase `in` cuando
// entra en el viewport, disparando la transición CSS `.reveal`. Portado de
// `useReveal` de references/templates/home-about/home.jsx, pero por instancia:
// cada <Reveal> observa su propio elemento en vez de un querySelectorAll global.

import { useEffect, useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Clases extra de la sección; se combinan con `reveal` (p. ej. "home-section"). */
  className?: string;
}

export function Reveal({ children, className }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    io.observe(el);

    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={className ? `${className} reveal` : "reveal"}>
      {children}
    </section>
  );
}
