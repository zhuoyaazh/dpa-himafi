"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CANDIDATES } from "@/lib/candidates";

export default function CalonPage() {
  const [selectedDocumentCandidateId, setSelectedDocumentCandidateId] = useState<string | null>(
    null,
  );
  const [selectedDocumentType, setSelectedDocumentType] = useState<"draft" | "ppt" | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const documentViewerRef = useRef<HTMLElement | null>(null);

  function onSelectDocument(candidateId: string, docType: "draft" | "ppt") {
    setSelectedDocumentCandidateId(candidateId);
    setSelectedDocumentType(docType);

    // Ensure preview section is visible immediately after selecting a document.
    window.requestAnimationFrame(() => {
      documentViewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const selectedDocument = useMemo(() => {
    if (!selectedDocumentCandidateId || !selectedDocumentType) {
      return null;
    }

    const foundCandidate = CANDIDATES.find(
      (candidate) => candidate.id === selectedDocumentCandidateId,
    );

    if (!foundCandidate) {
      return null;
    }

    const documentUrl = selectedDocumentType === "draft" ? foundCandidate.draftUrl : foundCandidate.pptUrl;

    if (!documentUrl) {
      return null;
    }

    return {
      id: foundCandidate.id,
      name: foundCandidate.name,
      documentUrl,
      documentType: selectedDocumentType,
    };
  }, [selectedDocumentCandidateId, selectedDocumentType]);

  useEffect(() => {
    const onResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };

    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const documentViewerSrc = useMemo(() => {
    if (!selectedDocument) {
      return "";
    }

    const desktopUrl = `${selectedDocument.documentUrl}#toolbar=1&navpanes=0&view=FitH`;
    if (!isMobileViewport || typeof window === "undefined") {
      return desktopUrl;
    }

    const absoluteDocumentUrl = selectedDocument.documentUrl.startsWith("http")
      ? selectedDocument.documentUrl
      : `${window.location.origin}${selectedDocument.documentUrl}`;

    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(absoluteDocumentUrl)}`;
  }, [isMobileViewport, selectedDocument]);

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
            <div className={`relative h-56 overflow-hidden rounded-[1.75rem] bg-linear-to-br ${candidate.accent} p-6 text-[#fffaf0] sm:h-64`} style={{ isolation: "isolate" }}>
              <div className="min-w-0 pr-24 sm:pr-44">
                  <p className="text-xs font-bold uppercase tracking-[0.35em] opacity-80">
                    Candidate {candidate.ballotNumber}
                  </p>
                  <h2 className="font-display mt-3 hidden wrap-break-word text-4xl sm:block">{candidate.name}</h2>
                  <h2 className="font-display mt-3 wrap-break-word text-3xl leading-tight sm:hidden">
                    {candidate.name
                      .split(" ")
                      .filter(Boolean)
                      .map((namePart, index) => (
                        <span key={`${candidate.id}-name-${index}`} className="block">
                          {namePart}
                        </span>
                      ))}
                  </h2>
                  <p className="mt-2 wrap-break-word text-sm opacity-85">{candidate.nim}</p>
              </div>

              {candidate.photoUrl ? (
                <div
                  className={`pointer-events-none absolute bottom-0 h-40 w-24 sm:h-60 sm:w-40 ${candidate.id === "calon-1" ? "right-0 sm:-right-2" : "right-0"}`}
                  style={{ overflow: "clip" }}
                >
                  <div className="absolute inset-x-2 bottom-2 h-12 rounded-full bg-[rgb(255_232_188/0.34)] blur-2xl sm:inset-x-3 sm:h-22" />
                  <div className="absolute inset-x-4 bottom-0 h-4 rounded-full bg-black/20 blur-md sm:inset-x-6 sm:h-5" />
                  <Image
                    src={candidate.photoUrl}
                    alt={`Foto ${candidate.name}`}
                    fill
                    className="object-contain object-bottom opacity-95 drop-shadow-[0_16px_24px_rgba(0,0,0,0.32)]"
                    sizes="(max-width: 640px) 96px, 160px"
                  />
                </div>
              ) : (
                <span className="font-display pointer-events-none absolute right-4 bottom-2 text-4xl sm:right-5 sm:text-6xl">
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
                      onClick={() => onSelectDocument(candidate.id, "draft")}
                      className={
                        selectedDocumentCandidateId === candidate.id && selectedDocumentType === "draft"
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
                    <button
                      type="button"
                      onClick={() => onSelectDocument(candidate.id, "ppt")}
                      className={
                        selectedDocumentCandidateId === candidate.id && selectedDocumentType === "ppt"
                          ? "button-gold inline-flex w-full items-center justify-center"
                          : "button-outline inline-flex w-full items-center justify-center"
                      }
                    >
                      Lihat PPT
                    </button>
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

      <section ref={documentViewerRef} className="gold-card overflow-hidden p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="section-kicker">Document Preview</p>
            <h2 className="font-display text-3xl text-[--maroon]">Viewer Dokumen Calon</h2>
            <p className="text-sm text-foreground/75">
              Klik tombol &quot;Lihat Draft&quot; atau &quot;Lihat PPT&quot; pada kartu calon untuk menampilkan PDF di sini.
            </p>
          </div>
          {selectedDocument ? (
            <a
              href={selectedDocument.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="button-outline inline-flex w-full items-center justify-center sm:w-fit"
            >
              Buka Di Tab Baru
            </a>
          ) : null}
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[--gold-soft] bg-white/70">
          {selectedDocument ? (
            <>
              <div className="border-b border-[--gold-soft] bg-white/80 px-4 py-3 text-sm font-semibold text-[--maroon]">
                Sedang ditampilkan: {selectedDocument.name} ({selectedDocument.documentType === "draft" ? "Draft" : "PPT"})
              </div>
              {isMobileViewport ? (
                <iframe
                  key={`${selectedDocument.id}-mobile`}
                  src={documentViewerSrc}
                  title={`${selectedDocument.documentType === "draft" ? "Draft" : "PPT"} ${selectedDocument.name}`}
                  className="block w-full"
                  style={{ height: "clamp(280px, 60vh, 800px)" }}
                  sandbox="allow-same-origin"
                />
              ) : (
                <embed
                  key={`${selectedDocument.id}-desktop`}
                  src={documentViewerSrc}
                  type="application/pdf"
                  className="block w-full"
                  style={{ height: "clamp(280px, 60vh, 800px)" }}
                />
              )}
              {isMobileViewport ? (
                <div className="border-t border-[--gold-soft] bg-white/80 px-4 py-3 text-xs text-foreground/70">
                  Jika preview belum muncul di perangkat kamu, gunakan tombol berikut:
                  <a
                    href={selectedDocument.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button-outline mt-2 inline-flex w-full items-center justify-center"
                  >
                    Buka File {selectedDocument.documentType === "draft" ? "Draft" : "PPT"}
                  </a>
                </div>
              ) : null}
            </>
          ) : (
            <div className="grid min-h-60 place-items-center px-4 py-10 text-center text-sm text-foreground/65">
              Belum ada dokumen yang dipilih. Klik Lihat Draft atau Lihat PPT pada salah satu calon.
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