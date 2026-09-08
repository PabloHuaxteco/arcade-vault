import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono, Courier_Prime } from "next/font/google";
import "./globals.css";
import { Nav } from "./_components/nav";
import { SessionProvider } from "./_components/session-provider";
import { SiteFooter } from "./_components/site-footer";

// Retro display face used for headings, nav, buttons and HUD text.
const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pixel",
});

// Primary body / data font. Variable font, so no explicit weight needed.
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

// First fallback for the mono stack, matching the reference styles.
const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-courier-prime",
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Plataforma de arcade online donde los jugadores compiten por puntos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${pressStart2P.variable} ${jetBrainsMono.variable} ${courierPrime.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="av-bg" aria-hidden="true" />
        <div className="av-noise" aria-hidden="true" />
        <SessionProvider>
          <div className="av-root">
            <Nav />
            <main className="av-main">{children}</main>
            <SiteFooter />
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
