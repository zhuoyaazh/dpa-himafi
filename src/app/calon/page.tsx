"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { CANDIDATES } from "@/lib/candidates";

export default function CalonPage() {
  const [selectedDraftCandidateId, setSelectedDraftCandidateId] = useState<string | null>(
    null,
  );
  const draftViewerRef = useRef<HTMLElement | null>(null);

  function onSelectDraft(candidateId: string) {
    setSelectedDraftCandidateId(candidateId);

    // Ensure preview section is visible immediately after choosing a candidate draft.
    window.requestAnimationFrame(() => {
      draftViewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const selectedDraft = useMemo(() => {
    if (!selectedDraftCandidateId) {
      return null;
    }

    const foundCandidate = CANDIDATES.find(
      (candidate) => candidate.id === selectedDraftCandidateId,
    );

    if (!foundCandidate?.draftUrl) {
      return null;
    }

    return {
      id: foundCandidate.id,
      name: foundCandidate.name,
      draftUrl: foundCandidate.draftUrl,
    };
  }, [selectedDraftCandidateId]);

  return (
    <section className="page-shell overflow-x-hidden">
      <header className="space-y-2">
        <p className="section-kicker">Candidate Deck</p>
        <h1 className="section-title">Profil Calon</h1>
        <p className="max-w-2xl text-sm text-foreground/75">
        Daftar calon, visi-misi, serta informasi pendukung sebelum pemilih
        melakukan voting.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {CANDIDATES.map((candidate) => (
          <article key={candidate.id} className="gold-card overflow-hidden p-6">
            <div className={`relative h-56 overflow-hidden rounded-[1.75rem] bg-linear-to-br ${candidate.accent} p-6 text-[#fffaf0] sm:h-64`}>
              <div className="min-w-0 pr-28 sm:pr-44">
                  <p className="text-xs font-bold uppercase tracking-[0.35em] opacity-80">
                    Candidate {candidate.ballotNumber}
                  </p>
                  <h2 className="font-display mt-3 wrap-break-word text-3xl sm:text-4xl">{candidate.name}</h2>
                  <p className="mt-2 wrap-break-word text-sm opacity-85">{candidate.nim}</p>
              </div>

              {candidate.photoUrl ? (
                <div
                  className={`pointer-events-none absolute bottom-0 h-46 w-30 sm:h-60 sm:w-40 ${candidate.id === "calon-1" ? "-right-1 sm:-right-2" : "right-0"}`}
                >
                  <div className="absolute inset-x-2 bottom-2 h-16 rounded-full bg-[rgb(255_232_188/0.34)] blur-2xl sm:inset-x-3 sm:h-22" />
                  <div className="absolute inset-x-6 bottom-0 h-5 rounded-full bg-black/20 blur-md" />
                  <Image
                    src={candidate.photoUrl}
                    alt={`Foto ${candidate.name}`}
                    fill
                    className="object-contain object-bottom opacity-95 drop-shadow-[0_16px_24px_rgba(0,0,0,0.32)]"
                    sizes="(max-width: 640px) 120px, 160px"
                  />
                </div>
              ) : (
                <span className="font-display pointer-events-none absolute right-5 bottom-2 text-5xl sm:text-6xl">
                  {candidate.suit}
                </span>
              )}
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
                    <li key={mission} className="rounded-2xl border border-[--gold-soft] bg-white/70 px-4 py-3 wrap-break-word">
                      {mission}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="subtitle-strong">Dokumen Calon</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {candidate.draftUrl ? (
                    <button
                      type="button"
                      onClick={() => onSelectDraft(candidate.id)}
                      className={
                        selectedDraftCandidateId === candidate.id
                          ? "button-gold inline-flex w-full items-center justify-center"
                          : "button-outline inline-flex w-full items-center justify-center"
                      }
                    >
                      Lihat Draft
                    </button>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center rounded-full border border-[--gold-soft] bg-white/50 px-5 py-3 text-center text-xs font-semibold text-foreground/55">
                      Draft Belum Tersedia
                    </span>
                  )}

                  {candidate.pptUrl ? (
                    <a
                      href={candidate.pptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button-outline inline-flex w-full items-center justify-center"
                    >
                      Lihat PPT
                    </a>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center rounded-full border border-[--gold-soft] bg-white/50 px-5 py-3 text-center text-xs font-semibold text-foreground/55">
                      PPT Belum Tersedia
                    </span>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section ref={draftViewerRef} className="gold-card overflow-hidden p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="section-kicker">Draft Preview</p>
            <h2 className="font-display text-3xl text-[--maroon]">Viewer Draft Calon</h2>
            <p className="text-sm text-foreground/75">
              Klik tombol &quot;Lihat Draft&quot; pada kartu calon untuk menampilkan PDF di sini.
            </p>
          </div>
          {selectedDraft ? (
            <a
              href={selectedDraft.draftUrl}
              target="_blank"
              rel="noreferrer"
              className="button-outline inline-flex w-full items-center justify-center sm:w-fit"
            >
              Buka Di Tab Baru
            </a>
          ) : null}
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[--gold-soft] bg-white/70">
          {selectedDraft ? (
            <>
              <div className="border-b border-[--gold-soft] bg-white/80 px-4 py-3 text-sm font-semibold text-[--maroon]">
                Sedang ditampilkan: {selectedDraft.name}
              </div>
              <iframe
                key={selectedDraft.id}
                src={`${selectedDraft.draftUrl}#toolbar=1&navpanes=0&view=FitH`}
                title={`Draft ${selectedDraft.name}`}
                className="w-full"
                style={{ height: "clamp(360px, 68vh, 860px)" }}
              />
            </>
          ) : (
            <div className="grid min-h-60 place-items-center px-4 py-10 text-center text-sm text-foreground/65">
              Belum ada draft yang dipilih. Klik Lihat Draft pada salah satu calon.
            </div>
          )}
        </div>
      </section>

      <section className="gold-card overflow-hidden p-6 md:p-8">
        <div className="space-y-2">
          <p className="section-kicker">Comparative Snapshot</p>
          <h2 className="font-display text-3xl text-[--maroon]">Perbandingan Ringkas</h2>
          <p className="text-sm text-foreground/75">
            Ringkasan cepat fokus kerja tiap kandidat agar pemilih lebih mudah membandingkan sebelum submit suara.
          </p>
        </div>

        <div className="mt-5 max-w-full overflow-x-auto">
          <table className="min-w-215 table-fixed text-left text-sm text-foreground/80 md:min-w-full">
            <thead>
              <tr className="border-b border-[--gold-soft] text-xs uppercase tracking-[0.18em] text-[--maroon]">
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3">Calon 1</th>
                <th className="px-3 py-3">Calon 2</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[rgb(196_154_108/0.25)] align-top">
                <td className="wrap-break-word px-3 py-4 font-semibold text-[--maroon]">Kandidat</td>
                <td className="wrap-break-word px-3 py-4">Muhammad Syamsuddiin</td>
                <td className="wrap-break-word px-3 py-4">Adrian Pandjie Ramdhani</td>
              </tr>
              <tr className="border-b border-[rgb(196_154_108/0.25)] align-top">
                <td className="wrap-break-word px-3 py-4 font-semibold text-[--maroon]">NIM</td>
                <td className="wrap-break-word px-3 py-4">10223075</td>
                <td className="wrap-break-word px-3 py-4">10223060</td>
              </tr>
              <tr className="border-b border-[rgb(196_154_108/0.25)] align-top">
                <td className="wrap-break-word px-3 py-4 font-semibold text-[--maroon]">Fokus Utama</td>
                <td className="wrap-break-word px-3 py-4">
                  Mentransformasi HIMAFI menjadi wadah yang apresiatif dan inklusif untuk mendukung pertumbuhan anggota secara progresif di bidang akademik, kesejahteraan, dan karier.
                </td>
                <td className="wrap-break-word px-3 py-4">
                  Mewujudkan HIMAFI yang merdeka dalam berpikir, berbasis karya yang sistematis melalui kerangka project-based, serta memberikan dampak nyata bagi anggota dan masyarakat.
                </td>
              </tr>
              <tr className="border-b border-[rgb(196_154_108/0.25)] align-top">
                <td className="wrap-break-word px-3 py-4 font-semibold text-[--maroon]">Strategi/Metode Kerja</td>
                <td className="wrap-break-word px-3 py-4">
                  Desentralisasi Taktikal: sentralisasi pada strategi namun otonomi penuh pada unit eksekutor agar menghindari micromanaging dan mempercepat pergerakan.
                </td>
                <td className="wrap-break-word px-3 py-4">
                  Sapere Aude dan Closed Loop: perencanaan, eksekusi, evaluasi, dan dokumentasi yang utuh agar setiap proyek tidak sporadis.
                </td>
              </tr>
              <tr className="border-b border-[rgb(196_154_108/0.25)] align-top">
                <td className="wrap-break-word px-3 py-4 font-semibold text-[--maroon]">Pilar Strategis/Klaster Program</td>
                <td className="wrap-break-word px-3 py-4">
                  Tata Kelola dan Dinamisasi Internal, Kesejahteraan dan Keilmuan, serta Relasi dan Komunikasi.
                </td>
                <td className="wrap-break-word px-3 py-4">
                  Riset dan Keilmuan, Sosial Masyarakat, serta Minat dan Bakat.
                </td>
              </tr>
              <tr className="border-b border-[rgb(196_154_108/0.25)] align-top">
                <td className="wrap-break-word px-3 py-4 font-semibold text-[--maroon]">Inovasi Program Unggulan</td>
                <td className="wrap-break-word px-3 py-4">
                  Psi-Fin untuk advokasi mental dan finansial anggota, serta Phi-lumnee Hub untuk data alumni pendukung karier dan riset.
                </td>
                <td className="wrap-break-word px-3 py-4">
                  Tiga Pilar Karya sebagai standar output nyata anggota, seperti majalah riset dan program pengabdian publik terukur.
                </td>
              </tr>
              <tr className="align-top">
                <td className="wrap-break-word px-3 py-4 font-semibold text-[--maroon]">Pendekatan Kepemimpinan</td>
                <td className="wrap-break-word px-3 py-4">
                  Profil INTJ-A (Arsitek): rasional, taktis, tegas, dan berorientasi hasil.
                </td>
                <td className="wrap-break-word px-3 py-4">
                  Pendekatan dominan Coaching, Democratic, dan Affiliative.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}