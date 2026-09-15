// Restablecer contraseña — Server Component que monta la isla Client
// <ResetPasswordForm>. Llegada tras seguir el enlace de recuperación de correo
// (app/auth/callback/route.ts redirige aquí con una sesión temporal activa).

import { ResetPasswordForm } from "@/app/_components/reset-password-form";

export default function RestablecerPage() {
  return <ResetPasswordForm />;
}
