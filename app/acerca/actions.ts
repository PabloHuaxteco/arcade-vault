"use server";

import { Resend } from "resend";

// Forma del estado que devuelve la Server Action y consume `useActionState` en
// `app/_components/contact-form.tsx`.
export type ContactState =
  | { ok: false; error?: string } // estado inicial y errores
  | { ok: true; name?: string }; // envío correcto (name para el mensaje de la terminal)

const FROM = "Arcade Vault <onboarding@resend.dev>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALIDATION_ERROR =
  "Revisa los campos: nombre, correo válido y mensaje son obligatorios.";
const SEND_ERROR =
  "No se pudo enviar el mensaje. Inténtalo de nuevo en un momento.";

export async function sendContactMessage(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const msg = String(formData.get("msg") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();

  // Honeypot: un bot rellenó el campo oculto. Se descarta en silencio
  // fingiendo éxito, sin enviar nada.
  if (company) {
    return { ok: true };
  }

  if (!name || !email || !msg || !EMAIL_RE.test(email)) {
    return { ok: false, error: VALIDATION_ERROR };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  if (!apiKey || !to) {
    console.error(
      "[contacto] Falta configuración: define RESEND_API_KEY y CONTACT_TO en .env.local",
    );
    return { ok: false, error: SEND_ERROR };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      replyTo: email,
      subject: `Arcade Vault · Nuevo mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}\n`,
    });

    if (error) {
      console.error("[contacto] Resend devolvió un error:", error);
      return { ok: false, error: SEND_ERROR };
    }
  } catch (err) {
    console.error("[contacto] Fallo al enviar con Resend:", err);
    return { ok: false, error: SEND_ERROR };
  }

  return { ok: true, name };
}
