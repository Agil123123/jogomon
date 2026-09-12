import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "JOGO-MON — OLT Monitoring",
  description: "Real-time GPON/FTTH monitoring dashboard for JOGLONET NOC operations",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-base text-text-primary">
        {/* Ambient glow orbs — purely decorative, hidden from the a11y tree */}
        <div aria-hidden="true" className="ambient-glow ambient-glow-cyan" style={{ width: 600, height: 600, top: '-10%', right: '-5%' }} />
        <div aria-hidden="true" className="ambient-glow ambient-glow-emerald" style={{ width: 500, height: 500, bottom: '10%', left: '-8%' }} />
        <div aria-hidden="true" className="ambient-glow ambient-glow-rose" style={{ width: 400, height: 400, top: '40%', right: '30%' }} />
        {children}
      </body>

    </html>
  );
}
