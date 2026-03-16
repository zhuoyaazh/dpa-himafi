import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import { MainNavbar } from "@/components/main-navbar";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "DPA HIMAFI ITB | The Grand Solitaire",
  description: "The Grand Solitaire: The Golden Shuffle - platform voting DPA HIMAFI ITB.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${cormorant.variable} antialiased`}
      >
        <div className="min-h-screen bg-background text-foreground">
          <MainNavbar />
          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
