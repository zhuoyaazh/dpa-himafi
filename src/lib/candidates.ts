export type CandidateProfile = {
  id: string;
  ballotNumber: string;
  name: string;
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
    name: "Calon 1",
    title: "Ace of Vision",
    tagline: "Mengarahkan organisasi dengan ritme kerja yang solid, presisi, dan berkelas.",
    vision:
      "Mewujudkan DPA HIMAFI yang tertata, adaptif, dan dekat dengan kebutuhan massa melalui tata kelola yang elegan dan tegas.",
    missions: [
      "Menguatkan ritme koordinasi internal yang transparan dan disiplin.",
      "Mendorong evaluasi program berbasis data serta kebutuhan massa aktual.",
      "Menjaga kultur representatif yang profesional namun tetap hangat.",
    ],
    accent: "from-[#380609] via-[#5f0d12] to-[#D4AF37]",
    suit: "♠",
    draftUrl: "",
    pptUrl: "",
  },
  {
    id: "calon-2",
    ballotNumber: "02",
    name: "Calon 2",
    title: "King of Governance",
    tagline: "Membawa stabilitas, keberanian mengambil keputusan, dan pelayanan organisasi yang matang.",
    vision:
      "Membangun sistem representasi yang kokoh, elegan, dan dapat dipercaya sebagai fondasi gerak DPA HIMAFI.",
    missions: [
      "Menata standardisasi kebijakan dan pengawalan program secara lebih akuntabel.",
      "Menghadirkan kanal aspirasi yang rapi dan mudah dijangkau massa.",
      "Menjaga kesinambungan antarperiode melalui dokumentasi dan audit internal yang kuat.",
    ],
    accent: "from-[#1A1A1A] via-[#2b2b2b] to-[#C49A6C]",
    suit: "♦",
    draftUrl: "",
    pptUrl: "",
  },
];

export function getCandidateById(candidateId: string) {
  return CANDIDATES.find((candidate) => candidate.id === candidateId);
}