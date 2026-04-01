"use client";

import Link from "next/link";
import { useEffect } from "react";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <div className="gold-card space-y-3 p-6">
        <p className="section-kicker">Terjadi Kendala</p>
        <h1 className="section-title text-3xl">Halaman gagal dimuat</h1>
        <p className="text-sm text-foreground/75">
          Coba muat ulang halaman. Kalau masih sama, buka lagi lewat Safari atau hubungi admin.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <button type="button" onClick={reset} className="button-gold">
            Coba Lagi
          </button>
          <Link href="/login" className="button-outline">
            Ke Login
          </Link>
        </div>
      </div>
    </section>
  );
}
