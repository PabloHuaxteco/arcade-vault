"use client";

// Wrapper de React para el motor real de la ficha "rocas" (SPEC 05).
// Monta el <canvas> del juego dentro del marco .crt reutilizado del
// reproductor falso y alimenta la barra .player-hud de la plataforma con el
// snapshot que emite lib/games/asteroids/engine.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import {
  createAsteroidsGame,
  type AsteroidsHandle,
  type AsteroidsSnapshot,
} from "@/lib/games/asteroids/engine";
import { appendScore } from "@/lib/storage";
import { useSession } from "../session-provider";

const INITIAL_SNAPSHOT: AsteroidsSnapshot = {
  score: 0,
  lives: 3,
  level: 1,
  over: false,
};

export function AsteroidsGame({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useSession();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<AsteroidsHandle | null>(null);

  const [snapshot, setSnapshot] = useState<AsteroidsSnapshot>(INITIAL_SNAPSHOT);
  const [paused, setPaused] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [initials, setInitials] = useState("");
  const [saved, setSaved] = useState(false);

  // El usuario se hidrata tras el montaje (SessionProvider lee localStorage
  // en un efecto), así que sincronizamos el nombre cuando cambie.
  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  // Al terminar la partida, prellenar las iniciales con el nombre de sesión.
  useEffect(() => {
    if (snapshot.over) {
      setInitials((prev) => prev || name.toUpperCase().slice(0, 10));
    }
  }, [snapshot.over, name]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createAsteroidsGame(canvas, { onState: setSnapshot });
    handleRef.current = handle;
    handle.start();
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  const togglePause = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setPaused((wasPaused) => {
      if (wasPaused) handle.resume();
      else handle.pause();
      return !wasPaused;
    });
  }, []);

  // KeyP y Escape alternan pausa por el mismo camino que el botón.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "KeyP" || e.code === "Escape") togglePause();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause]);

  const handleSave = () => {
    appendScore({ game: game.id, score: snapshot.score, name: initials });
    setSaved(true);
  };

  const handlePlayAgain = () => {
    handleRef.current?.restart();
    setPaused(false);
    setSaved(false);
    setInitials("");
  };

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
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{snapshot.score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">
              {"♥ ".repeat(Math.max(snapshot.lives, 0)).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(snapshot.level).padStart(2, "0")}</div>
          </div>
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

      {snapshot.over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">
              {snapshot.score.toLocaleString("es-ES")}
            </div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={initials}
                  onChange={(e) =>
                    setInitials(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={handleSave}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={handlePlayAgain}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/biblioteca")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
