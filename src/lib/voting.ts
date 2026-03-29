import {
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { getFirebaseAuth, db } from "@/lib/firebase";
import {
  extractNimFromCampusEmail,
  getVoterIdentityError,
  normalizeNim,
} from "@/lib/voter-identity";

type SubmitVotePayload = {
  nim: string;
  candidateId: string;
};

type SubmitVoteContext = {
  sanitizedNim: string;
  candidateId: string;
  voterUid: string;
  voterEmail: string;
};

function normalizeVoteWeight(rawWeight: unknown): 1 | 1.5 | 2 {
  const parsedWeight = Number(rawWeight);

  if (parsedWeight === 1 || parsedWeight === 1.5 || parsedWeight === 2) {
    return parsedWeight;
  }

  return 1;
}

async function performVoteTransaction(context: SubmitVoteContext) {
  const userRef = doc(db, "users", context.sanitizedNim);
  const voteRef = doc(db, "suara_masuk", context.sanitizedNim);

  await runTransaction(db, async (transaction) => {
    const freshUserSnapshot = await transaction.get(userRef);
    const freshUserData = freshUserSnapshot.data();
    const freshVoteSnapshot = await transaction.get(voteRef);
    const voteWeight = normalizeVoteWeight(freshUserData?.bobotSuara);

    if (freshVoteSnapshot.exists()) {
      throw new Error("NIM ini sudah tercatat melakukan voting.");
    }

    transaction.set(
      userRef,
      {
        nim: context.sanitizedNim,
        statusHearing: voteWeight > 1,
        sudahVote: true,
        bobotSuara: voteWeight,
        voterUid: context.voterUid,
        voterEmail: context.voterEmail,
        votedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(voteRef, {
      nim: context.sanitizedNim,
      voterUid: context.voterUid,
      voterEmail: context.voterEmail,
      candidateId: context.candidateId,
      statusHearing: voteWeight > 1,
      bobotSuara: voteWeight,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function submitVote(payload: SubmitVotePayload) {
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Kamu harus login dulu sebelum voting.");
  }

  const nimFromEmail = extractNimFromCampusEmail(currentUser.email);
  const sanitizedNim = normalizeNim(payload.nim || nimFromEmail);
  if (!sanitizedNim) {
    throw new Error("NIM tidak valid. Pastikan email login memakai format NIM kampus ITB.");
  }

  if (!payload.candidateId?.trim()) {
    throw new Error("Kandidat harus dipilih sebelum submit voting.");
  }

  const votingGateRef = doc(db, "site_settings", "voting_gate");
  const votingGateSnapshot = await getDoc(votingGateRef);
  const votingGateData = votingGateSnapshot.exists()
    ? (votingGateSnapshot.data() as { isOpen?: boolean })
    : undefined;

  if (votingGateData?.isOpen === false) {
    throw new Error("Voting sedang ditutup oleh panitia. Tunggu gate dibuka.");
  }

  const voterIdentityError = getVoterIdentityError(sanitizedNim, currentUser.email);
  if (voterIdentityError) {
    throw new Error(voterIdentityError);
  }

  const context: SubmitVoteContext = {
    sanitizedNim,
    candidateId: payload.candidateId,
    voterUid: currentUser.uid,
    voterEmail: currentUser.email,
  };

  try {
    await performVoteTransaction(context);
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      try {
        // Refresh token once and retry so users usually don't need manual re-login.
        await currentUser.getIdToken(true);
        await performVoteTransaction(context);
        return;
      } catch (retryError) {
        if (retryError instanceof FirebaseError && retryError.code === "permission-denied") {
          throw new Error(
            "Izin voting ditolak. Coba refresh halaman dulu. Jika masih gagal, logout-login sekali lalu coba lagi.",
          );
        }

        throw retryError;
      }
    }

    throw error;
  }
}