import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "HORIZON Cyber Academy",
  description:
    "Simulation pédagogique immersive de cybersécurité — apprenez en résolvant de vrais incidents dans une entreprise virtuelle.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-hz-bg text-hz-text antialiased">{children}</body>
    </html>
  );
}
