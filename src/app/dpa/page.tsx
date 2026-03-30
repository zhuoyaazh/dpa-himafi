type CommissionMember = {
  role: string;
  name: string;
};

type CommissionGroup = {
  key: string;
  title: string;
  head: string;
  interns: string[];
};

const LEADER: CommissionMember = {
  role: "Pimpinan Dewan",
  name: "Arum Sari Mufada (10222013)",
};

const COMMISSIONS: CommissionGroup[] = [
  {
    key: "aspirasi",
    title: "Komisi Aspirasi",
    head: "Kaesya Paradilla (10223078)",
    interns: ["Sulthan (10224049)", "Farah (10224070)"],
  },
  {
    key: "regenerasi",
    title: "Komisi Regenerasi",
    head: "Vincent Constantine D (10223072)",
    interns: ["Abyan (10224028)", "Agym (10224075)"],
  },
  {
    key: "pubdok",
    title: "Komisi Publikasi & Dokumentasi",
    head: "Nashwan Iqbal R (10223078)",
    interns: ["Joyy (10224056)", "Faiz (10224081)"],
  },
];

export default function DpaProfilePage() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-8 overflow-x-hidden">
      <header className="space-y-2">
        <p className="section-kicker">Council Profile</p>
        <h1 className="section-title">Profil DPA</h1>
        <p className="text-sm text-foreground/75">
          Kabinet Aloka Karsa
        </p>
      </header>

      <section className="gold-card space-y-4 p-5 sm:p-6">
        <div className="rounded-2xl border border-dashed border-[--gold-soft] bg-white/60 p-6 text-center text-sm text-foreground/70">
          Organogram (Soon)
        </div>
      </section>

      <section className="gold-card space-y-4 p-5 sm:p-6">
        <h2 className="subtitle-strong">Struktur Inti DPA</h2>
        <div className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-foreground/60">{LEADER.role}</p>
          <p className="mt-1 text-base font-semibold text-[--maroon]">{LEADER.name}</p>
        </div>
      </section>

      <section className="gold-card space-y-4 p-5 sm:p-6">
        <h2 className="subtitle-strong">Komisi</h2>

        <div className="grid gap-4 lg:grid-cols-3">
          {COMMISSIONS.map((commission) => (
            <article key={commission.key} className="rounded-2xl border border-[--gold-soft] bg-white/70 p-4">
              <h3 className="font-semibold text-[--maroon]">{commission.title}</h3>

              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-foreground/60">Kepala Komisi</p>
                  <p className="font-medium text-foreground/90">{commission.head}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-foreground/60">Intern</p>
                  <ul className="mt-1 space-y-1 text-foreground/85">
                    {commission.interns.map((intern) => (
                      <li key={intern}>- {intern}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
