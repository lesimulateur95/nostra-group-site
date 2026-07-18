import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nostra Group",
  description: "Portail officiel Nostra Group sur Universe Life — Saint-Martin V2.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
