"use client";

// Formulario de acceso real: tabs iniciar / crear sobre Supabase Auth.
// Portado de references/templates/auth.jsx; ver useSession() (session-provider.tsx)
// para signIn/signUp/signOut/requestPasswordReset reales. Los botones GOOGLE/GITHUB
// siguen inertes hasta el paso de OAuth.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-provider";

export function AuthForm() {
  const router = useRouter();
  const { signIn, signUp, signOut, requestPasswordReset } = useSession();

  const [tab, setTab] = useState<"in" | "up">("in");
  const [playerName, setPlayerName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSentTo, setSignupSentTo] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPending, setForgotPending] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);

    if (tab === "in") {
      const { error } = await signIn(email, pass);
      setPending(false);
      if (error) {
        setError(error);
        return;
      }
      router.push("/biblioteca");
      return;
    }

    const { error, needsConfirmation } = await signUp(email, pass, playerName);
    setPending(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsConfirmation) {
      setSignupSentTo(email);
    } else {
      router.push("/biblioteca");
    }
  };

  const playAsGuest = () => {
    signOut();
    router.push("/biblioteca");
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotPending(true);
    const { error } = await requestPasswordReset(forgotEmail);
    setForgotPending(false);
    if (error) {
      setForgotError(error);
      return;
    }
    setForgotSent(true);
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
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {signupSentTo ? (
          <div
            className="toast-saved"
            style={{ display: "block", marginTop: 18 }}
          >
            ▸ REVISA TU CORREO_
            <div
              className="mono"
              style={{ color: "var(--ink-faint)", marginTop: 8, fontSize: 12 }}
            >
              Enviamos un enlace de confirmación a {signupSentTo}. Ábrelo para
              activar tu cuenta.
            </div>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={tab === "in" ? "on" : ""}
                onClick={() => {
                  setTab("in");
                  setError(null);
                }}
              >
                INICIAR SESIÓN
              </button>
              <button
                className={tab === "up" ? "on" : ""}
                onClick={() => {
                  setTab("up");
                  setError(null);
                }}
              >
                CREAR CUENTA
              </button>
            </div>

            <form onSubmit={submit}>
              {tab === "up" && (
                <div className="field slide-in">
                  <label>Nombre de jugador</label>
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="px_kai"
                    maxLength={10}
                  />
                </div>
              )}
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                />
              </div>
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <button
                className="btn lg"
                type="submit"
                style={{ width: "100%", marginTop: 8 }}
                disabled={pending}
              >
                {pending
                  ? "UN MOMENTO…"
                  : tab === "in"
                    ? "ENTRAR AL VAULT"
                    : "CREAR Y JUGAR"}
              </button>

              {error ? (
                <p className="contact-error" aria-live="polite">
                  {error}
                </p>
              ) : null}
            </form>

            {tab === "in" && (
              <div style={{ marginTop: 10, textAlign: "center" }}>
                {!forgotOpen ? (
                  <button
                    type="button"
                    className="btn ghost"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotEmail(email);
                    }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                ) : forgotSent ? (
                  <div className="toast-saved" style={{ display: "block" }}>
                    ▸ REVISA TU CORREO_
                    <div
                      className="mono"
                      style={{
                        color: "var(--ink-faint)",
                        marginTop: 8,
                        fontSize: 12,
                      }}
                    >
                      Enviamos un enlace para restablecer tu contraseña a{" "}
                      {forgotEmail}.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitForgot} className="slide-in">
                    <div className="field">
                      <label>Correo electrónico</label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="jugador@vault.gg"
                      />
                    </div>
                    <button
                      className="btn ghost"
                      type="submit"
                      style={{ width: "100%" }}
                      disabled={forgotPending}
                    >
                      {forgotPending ? "ENVIANDO…" : "ENVIAR ENLACE"}
                    </button>
                    {forgotError ? (
                      <p className="contact-error" aria-live="polite">
                        {forgotError}
                      </p>
                    ) : null}
                  </form>
                )}
              </div>
            )}

            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={playAsGuest}
            >
              JUGAR COMO INVITADO
            </button>

            <div className="auth-divider">O CONTINÚA CON</div>
            <div className="social">
              <button className="btn ghost" type="button">
                ◆ &nbsp;GOOGLE
              </button>
              <button className="btn ghost" type="button">
                ▣ &nbsp;GITHUB
              </button>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
