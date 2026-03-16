import { CANDIDATES } from "@/lib/candidates";

export default function CalonPage() {
  return (
    <section className="page-shell">
      <header className="space-y-2">
        <p className="section-kicker">Candidate Deck</p>
        <h1 className="section-title">Profil Calon</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
        Daftar calon, visi-misi, serta informasi pendukung sebelum pemilih
        melakukan voting.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        {CANDIDATES.map((candidate) => (
          <article key={candidate.id} className="gold-card overflow-hidden p-6">
            <div className={`rounded-[1.75rem] bg-linear-to-br ${candidate.accent} p-6 text-[#fffaf0]`}>
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.35em] opacity-80">
                    Candidate {candidate.ballotNumber}
                  </p>
                  <h2 className="font-display mt-3 break-words text-4xl">{candidate.name}</h2>
                  <p className="mt-2 break-words text-sm opacity-85">{candidate.title}</p>
                </div>
                <span className="font-display shrink-0 text-5xl">{candidate.suit}</span>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-sm text-foreground/80">
              <div>
                <p className="subtitle-strong">Tagline</p>
                <p className="mt-2 leading-7">{candidate.tagline}</p>
              </div>
              <div>
                <p className="subtitle-strong">Visi</p>
                <p className="mt-2 leading-7">{candidate.vision}</p>
              </div>
              <div>
                <p className="subtitle-strong">Misi Utama</p>
                <ul className="mt-2 space-y-2 leading-7">
                  {candidate.missions.map((mission) => (
                    <li key={mission} className="rounded-2xl border border-[--gold-soft] bg-white/70 px-4 py-3 break-words">
                      {mission}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="gold-card overflow-hidden p-6 md:p-8">
        <div className="space-y-2">
          <p className="section-kicker">Comparative Snapshot</p>
          <h2 className="font-display text-3xl text-[--maroon]">Perbandingan Ringkas</h2>
          <p className="text-sm text-foreground/75">
            Ringkasan cepat fokus kerja tiap kandidat agar pemilih lebih mudah membandingkan sebelum submit suara.
          </p>
        </div>

        <div className="mt-5 max-w-full overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm text-foreground/80">
            <thead>
              <tr className="border-b border-[--gold-soft] text-xs uppercase tracking-[0.18em] text-[--maroon]">
                <th className="px-3 py-3">Kandidat</th>
                <th className="px-3 py-3">Karakter Kepemimpinan</th>
                <th className="px-3 py-3">Fokus Utama</th>
              </tr>
            </thead>
            <tbody>
              {CANDIDATES.map((candidate) => (
                <tr key={`${candidate.id}-summary`} className="border-b border-[rgb(196_154_108/0.25)]">
                  <td className="break-words px-3 py-4 font-semibold text-[--maroon]">
                    {candidate.ballotNumber}. {candidate.name}
                  </td>
                  <td className="break-words px-3 py-4">{candidate.title}</td>
                  <td className="break-words px-3 py-4">{candidate.tagline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}