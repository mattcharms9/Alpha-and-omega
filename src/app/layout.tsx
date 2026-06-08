import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientShell } from "@/components/layout/ClientShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Alpha & Omega — Emotional Utility Empire",
  description: "The autonomous AI-native publishing and emotional utility platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg-page)",
          margin: 0,
        }}
      >
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
