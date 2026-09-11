import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "HORIZON Cyber Academy",
  description: "Immersive cybersecurity simulation game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}