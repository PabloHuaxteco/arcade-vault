"use client";

// Wrapper de React para el motor real de la ficha "salta-charcos" (SPEC de
// game-jam). Monta el <canvas> del juego dentro del marco .crt reutilizado
// del reproductor falso y alimenta la barra .player-hud de la plataforma con
// el snapshot que emite lib/games/frogger/engine.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import {
  createFroggerGame,
  type FroggerHandle,
  type FroggerSnapshot,
} from "@/lib/games/frogger/engine";
import { useSession } from "../session-provider";

const INITIAL_SNAPSHOT: FroggerSnapshot = {
  score: 0,
  over: false,
  lives: 3,
  round: 1,
  stats: [
    { l: "Puntuación", v: "0" },
    { l: "Vidas", v: "3" },
    { l: "Ronda", v: "1" },
  ],
};

export function FroggerGame({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useSession();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<FroggerHandle | null>(null);

  const [snapshot, setSnapshot] = useState<FroggerSnapshot>(INITIAL_SNAPSHOT);
  const [paused, setPaused] = useState(false);
  const [name, setName] = useState("INVITADO");

  // El usuario se hidrata tras el montaje (SessionProvider lee localStorage
  // en un efecto), así que sincronizamos el nombre cuando cambie.
  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const togglePause = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setPaused((wasPaused) => {
      if (wasPaused) handle.resume();
      else handle.pause();
      return !wasPaused;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createFroggerGame(canvas, { onState: setSnapshot });
    handleRef.current = handle;
    handle.start();
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  // KeyP y Escape alternan pausa por el mismo camino que el botón.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "KeyP" || e.code === "Escape") togglePause();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause]);

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          {snapshot.stats.map((stat) => (
            <div className="hud-stat" key={stat.l}>
              <div className="l">{stat.l}</div>
              <div className="v">{stat.v}</div>
            </div>
          ))}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            className="btn magenta"
            onClick={() => handleRef.current?.end()}
          >
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="game-canvas"
          />
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>
    </div>
  );
}
