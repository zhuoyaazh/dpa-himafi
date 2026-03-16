import Link from "next/link";

export default function Home() {
  return (
    <section className="page-shell">
      <header className="gold-card space-y-5 p-8 md:p-10">
        <h1 className="section-title max-w-4xl">
          DPA HIMAFI
        </h1>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/login"
            className="button-gold"
          >
            Login Pemilih
          </Link>
          <Link
            href="/voting"
            className="button-outline"
          >
            Lanjut ke Voting
          </Link>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <article className="gold-card p-6">
          <p className="subtitle-strong">Pemilihan Aktif</p>
          <h2 className="mt-2 font-display text-3xl text-[--maroon]">Satu akun, satu suara</h2>
          <p className="mt-3 text-sm leading-7 text-foreground/75">
            Voting digital dibuka setelah hearing dan ditutup pada 1 April 2026.
          </p>
          <Link
            href="/voting"
            className="button-gold mt-5 inline-flex"
          >
            Buka Halaman Voting
          </Link>
        </article>

        <article className="gold-card p-6">
          <p className="subtitle-strong">Status Pemilih</p>
          <h2 className="mt-2 font-display text-3xl text-[--maroon]">Audit dan transparansi</h2>
          <p className="mt-3 text-sm leading-7 text-foreground/75">
            Cek status akun, bobot suara hearing, dan riwayat submit di halaman
            profil pengguna.
          </p>
          <Link
            href="/profile"
            className="button-outline mt-5 inline-flex"
          >
            Buka Profil Saya
          </Link>
        </article>
      </div>
    </section>
  );
}
