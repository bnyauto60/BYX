import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BYX — Carnet de Santé Technique",
  description: "Carnet de santé technique intelligent pour véhicules — BNY Auto"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-base text-text font-body">{children}</body>
    </html>
  );
}
