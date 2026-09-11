"use client";

// Wrapper de React para el motor real de la ficha "caida" (SPEC 07).
// Monta los dos <canvas> del juego dentro del marco .crt reutilizado del
// reproductor falso y alimenta la barra .player-hud de la plataforma con el
// snapshot que emite lib/games/tetris/engine.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import {
  createTetrisGame,
  type TetrisHandle,
  type TetrisSkin,
  type TetrisSnapshot,
} from "@/lib/games/tetris/engine";
import { insertScore } from "@/lib/scores-client";
import { useSession } from "../session-provider";

const SKIN_STORAGE_KEY = "av_tetris_skin";
const SKIN_OPTIONS: { value: TetrisSkin; label: string }[] = [
  { value: "retro", label: "Retro" },
  { value: "neon", label: "Neon" },
  { value: "pastel", label: "Pastel" },
  { value: "pixel", label: "Pixel art" },
];

const INITIAL_SNAPSHOT: TetrisSnapshot = {
  score: 0,
  over: false,
  lines: 0,
  level: 1,
  combo: 0,
  stats: [
    { l: "Líneas", v: "0" },
    { l: "Nivel", v: "1" },
  ],
};

export function TetrisGame({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useSession();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<TetrisHandle | null>(null);

  const [skin, setSkin] = useState<TetrisSkin>("retro");
  const [snapshot, setSnapshot] = useState<TetrisSnapshot>(INITIAL_SNAPSHOT);
  const [paused, setPaused] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [initials, setInitials] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // La preferencia de skin vive en localStorage, local al navegador (no en
  // Supabase); se lee tras el montaje para no romper el render de servidor.
  useEffect(() => {
    const savedSkin = window.localStorage.getItem(SKIN_STORAGE_KEY);
    if (
      savedSkin === "retro" ||
      savedSkin === "neon" ||
      savedSkin === "pastel" ||
      savedSkin === "pixel"
    ) {
      setSkin(savedSkin);
    }
  }, []);

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

  const togglePause = useCallback(() => {
    const handle = handleRef.current;
    if (!handle) return;
    setPaused((wasPaused) => {
      if (wasPaused) handle.resume();
      else handle.pause();
      return !wasPaused;
    });
  }, []);

  // Cambiar de skin destruye el motor anterior y crea uno nuevo (no hay
  // setSkin() en el TetrisHandle): se pierde la partida en curso.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createTetrisGame(canvas, {
      onState: setSnapshot,
      skin,
      nextCanvas: nextCanvasRef.current ?? undefined,
    });
    handleRef.current = handle;
    setPaused(false);
    handle.start();

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "KeyP" || e.code === "Escape") togglePause();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      handle.destroy();
      handleRef.current = null;
    };
  }, [skin, togglePause]);

  const handleSkinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as TetrisSkin;
    window.localStorage.setItem(SKIN_STORAGE_KEY, value);
    setSkin(value);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await insertScore({
        gameId: game.id,
        name: initials,
        score: snapshot.score,
      });
      setSaved(true);
    } catch {
      setSaveError("No se pudo guardar la puntuación. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handlePlayAgain = () => {
    handleRef.current?.restart();
    setPaused(false);
    setSaved(false);
    setSaveError(null);
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
          {snapshot.stats.map((stat) => (
            <div className="hud-stat" key={stat.l}>
              <div className="l">{stat.l}</div>
              <div className="v">{stat.v}</div>
            </div>
          ))}
          <div className="hud-stat">
            <div className="l">Skin</div>
            <select value={skin} onChange={handleSkinChange}>
              {SKIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
        <div className="crt-screen-tetris">
          <canvas
            ref={canvasRef}
            width={300}
            height={600}
            className="game-canvas-tetris"
          />
          <canvas
            ref={nextCanvasRef}
            width={120}
            height={120}
            className="next-canvas"
            style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
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
              <div
                className="input-row"
                style={{
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 8,
                }}
              >
                <div className="input-row">
                  <input
                    value={initials}
                    onChange={(e) =>
                      setInitials(e.target.value.toUpperCase().slice(0, 10))
                    }
                    placeholder="TUS INICIALES"
                  />
                  <button
                    className="btn yellow"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveError && (
                  <div
                    className="toast-saved"
                    style={{ color: "var(--magenta, #ff2fb3)" }}
                  >
                    ▸ {saveError}
                  </div>
                )}
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
