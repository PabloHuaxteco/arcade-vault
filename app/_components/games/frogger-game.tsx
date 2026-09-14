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
  type FroggerSkin,
  type FroggerSnapshot,
} from "@/lib/games/frogger/engine";
import { insertScore } from "@/lib/scores-client";
import { useSession } from "../session-provider";
import { TouchControls } from "./touch-controls";

const DPAD = [
  { code: "ArrowUp", label: "▲" },
  { code: "ArrowLeft", label: "◀" },
  { code: "ArrowDown", label: "▼" },
  { code: "ArrowRight", label: "▶" },
];

const SKIN_STORAGE_KEY = "av_frogger_skin";
const SKIN_OPTIONS: { value: FroggerSkin; label: string }[] = [
  { value: "clasico", label: "Clásico" },
  { value: "retro", label: "Retro" },
  { value: "neon", label: "Neon" },
];

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

  const [skin, setSkin] = useState<FroggerSkin>("clasico");
  const [snapshot, setSnapshot] = useState<FroggerSnapshot>(INITIAL_SNAPSHOT);
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
      savedSkin === "clasico" ||
      savedSkin === "retro" ||
      savedSkin === "neon"
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
    // `skin` no va en las dependencias a propósito: el motor se crea una sola
    // vez y el cambio de paleta se aplica en caliente con setSkin().
  }, []);

  // Aplica el skin sin recrear el motor: la partida en curso no se pierde.
  useEffect(() => {
    handleRef.current?.setSkin(skin);
  }, [skin]);

  // KeyP y Escape alternan pausa por el mismo camino que el botón.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "KeyP" || e.code === "Escape") togglePause();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePause]);

  const handleSkinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as FroggerSkin;
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

      <TouchControls
        dpad={DPAD}
        actions={[]}
        onPress={(code) => handleRef.current?.press(code)}
        onRelease={(code) => handleRef.current?.release(code)}
      />

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
