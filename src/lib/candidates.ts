export type CandidateProfile = {
  id: string;
  ballotNumber: string;
  nim: string;
  name: string;
  photoUrl?: string;
  title: string;
  tagline: string;
  vision: string;
  missions: string[];
  accent: string;
  suit: string;
  draftUrl?: string;
  pptUrl?: string;
};

export const CANDIDATES: CandidateProfile[] = [
  {
    id: "calon-1",
    ballotNumber: "01",
    nim: "10223075",
    name: "Muhammad Syamsuddiin",
    photoUrl: "/candidates/calon-1.png",
    title: "10223075",
    tagline: "#BergerakBersama",
    vision:
      "Menciptakan HIMAFI ITB sebagai ruang yang apresiatif serta inkusif sehingga dapat menjadi wadah transformasi yang progresif bagi anggota serta lingkungan sekitarnya.",
    missions: [
      "Membangun sarana pemenuhan akademik serta advokasi kebutuhan finansial dan mental anggota yang proaktif, integratif, dan inklusif.",
      "Menjadikan HIMAFI ITB sebagai sarana pengembangan potensi serta media ekspresi yang inklusif, representatif, dan progresif.",
      "Menjaga hubungan dengan eksternal dan alumni HIMAFI ITB sehingga tercapai hubungan yang kolaboratif yang dapat bermanfaat bagi anggota HIMAFI ITB.",
      "Mengembangkan sistem regenerasi yang inklusif, progresif, dan apresiatif.",
      "Membangun HIMAFI ITB menjadi media yang inovatif dan kritis terhadap massa HIMAFI ITB serta kritis terhadap perkembangan isu terkini.",
      "Membangun dan meningkatkan efektivitas dan efisiensi kerja pada Badan Pengurus HIMAFI ITB yang adaptif dan akuntabel.",
    ],
    accent: "from-[#1A1A1A] via-[#2b2b2b] to-[#C49A6C]",
    suit: "♠",
    draftUrl: "/drafts/calon-1.pdf",
    pptUrl: "/ppt/calon-1.pdf",
  },
  {
    id: "calon-2",
    ballotNumber: "02",
    nim: "10223060",
    name: "Adrian Pandjie Ramdhani",
    photoUrl: "/candidates/calon-2.png",
    title: "10223060",
    tagline: "#MerdekaBerkarya",
    vision:
      "HIMAFI ITB sebagai ruang berkarya yang merdeka dan berdampak.",
    missions: [
      "Membangun individu yang merdeka melalui pembentukan kesadaran diri, pemaknaan personal, dan pengalaman berhimpun yang bermakna, guna menumbuhkan motivasi intrinsik serta keberanian dalam berpikir dan bertindak secara mandiri.",
      "Menghadirkan ruang berkarya yang inklusif-kolaboratif melalui penyediaan program pengembangan diri yang terstruktur dan relevan mencakup aspek akademik dan kesiapan karir serta mendorong keterlibatan aktif seluruh massa dalam menciptakan karya yang inovatif dan berdampak.",
      "Mewujudkan tata kelola dan sistem organisasi yang terintegrasi melalui penguatan struktur yang efisien, pengelolaan sumber daya yang optimal, serta keberlanjutan program guna mendukung terciptanya lingkungan berkarya yang sehat dan konsisten serta mendukung kesejahteraan massa.",
      "Menjaga relevansi HIMAFI ITB melalui adaptasi terhadap kebutuhan massa yang berkembang, penguatan aspek kaderisasi, serta pemantapan legalitas dan posisi strategis organisasi dalam lingkup internal maupun eksternal.",
    ],
    accent: "from-[#380609] via-[#5f0d12] to-[#D4AF37]",
    suit: "♦",
    draftUrl: "/drafts/calon-2.pdf",
    pptUrl: "/ppt/calon-2.pdf",
  },
];

export function getCandidateById(candidateId: string) {
  return CANDIDATES.find((candidate) => candidate.id === candidateId);
}