import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Through Line — One Change. Every Impact. Zero Blind Spots.",
  description: "Enterprise change impact agent over your Company Brain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
