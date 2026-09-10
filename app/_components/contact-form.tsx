"use client";

// Isla Client de la página /acerca: el <form className="contact-form"> portado de
// references/templates/home-about/about.jsx, pero con envío real. El estado lo
// gestiona `useActionState` sobre la Server Action `sendContactMessage`
// (app/acerca/actions.ts):
//   - pending            → botón "ENVIANDO…" deshabilitado
//   - campo vacío         → clase `shake` 400 ms, sin enviar (validación cliente)
//   - state.ok            → bloque `terminal-success` con "ENVIAR OTRO MENSAJE"
//   - state.error         → <p className="contact-error"> bajo el botón

import { useActionState, useRef, useState } from "react";
import { sendContactMessage, type ContactState } from "@/app/acerca/actions";

const INITIAL_STATE: ContactState = { ok: false };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    sendContactMessage,
    INITIAL_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [shake, setShake] = useState(false);
  // Tras "ENVIAR OTRO MENSAJE" volvemos al formulario aunque el último estado
  // siga siendo `ok: true`.
  const [dismissed, setDismissed] = useState(false);

  const success = state.ok && !dismissed;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const data = new FormData(e.currentTarget);
    const empty =
      !String(data.get("name") ?? "").trim() ||
      !String(data.get("email") ?? "").trim() ||
      !String(data.get("msg") ?? "").trim();

    if (empty) {
      e.preventDefault(); // no dispara la Server Action
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setDismissed(false);
  };

  const sendAnother = () => {
    setDismissed(true);
    formRef.current?.reset();
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      className={"contact-form" + (shake ? " shake" : "")}
    >
      {!success ? (
        <>
          <div className="field">
            <label>NOMBRE</label>
            <input name="name" placeholder="px_kai" />
          </div>
          <div className="field">
            <label>CORREO ELECTRÓNICO</label>
            <input type="email" name="email" placeholder="jugador@vault.gg" />
          </div>
          <div className="field">
            <label>MENSAJE</label>
            <textarea
              name="msg"
              rows={5}
              placeholder="Cuéntanos qué tienes en mente…"
            />
          </div>

          {/* Honeypot: invisible para el usuario, cebo para bots. */}
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            hidden
            aria-hidden="true"
          />

          <button
            className="btn xl press"
            type="submit"
            style={{ width: "100%" }}
            disabled={pending}
          >
            {pending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
          </button>

          {!state.ok && state.error ? (
            <p className="contact-error" aria-live="polite">
              {state.error}
            </p>
          ) : null}
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message
              --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
              {(state.ok && state.name ? state.name : "").toUpperCase()}.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={sendAnother}
              >
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
