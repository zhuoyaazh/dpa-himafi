"use client";

import Link from "next/link";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  console.error("Global app error:", error);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-8">
          <section className="gold-card w-full space-y-3 p-6">
            <p className="section-kicker">Terjadi Kendala</p>
            <h1 className="section-title text-3xl">Aplikasi mengalami error</h1>
            <p className="text-sm text-foreground/75">
              Coba refresh halaman. Jika tetap blank, buka lewat Safari biasa lalu coba lagi.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={reset} className="button-gold">
                Muat Ulang
              </button>
              <Link href="/login" className="button-outline">
                Ke Login
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
