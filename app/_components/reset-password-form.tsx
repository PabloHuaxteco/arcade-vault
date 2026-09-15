"use client";

// Formulario de restablecimiento de contraseña, montado en /entrar/restablecer
// tras seguir el enlace de recuperación de correo. Reutiliza los mismos
// estilos de auth-card/field que <AuthForm> (app/_components/auth-form.tsx).

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-provider";

export function ResetPasswordForm() {
  const router = useRouter();
  const { updatePassword } = useSession();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    const { error } = await updatePassword(password);
    setPending(false);
    if (error) {
      setError(error);
      return;
    }
    router.push("/biblioteca");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            NUEVA CONTRASEÑA
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Contraseña nueva</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="field">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            className="btn lg"
            type="submit"
            style={{ width: "100%", marginTop: 8 }}
            disabled={pending}
          >
            {pending ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
          </button>

          {error ? (
            <p className="contact-error" aria-live="polite">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
