import {
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { getFirebaseAuth, db } from "@/lib/firebase";
import { getVoterIdentityError, normalizeNim } from "@/lib/voter-identity";

type SubmitVotePayload = {
  nim: string;
  candidateId: string;
};

function normalizeVoteWeight(rawWeight: unknown): 1 | 1.5 | 2 {
  const parsedWeight = Number(rawWeight);

  if (parsedWeight === 1 || parsedWeight === 1.5 || parsedWeight === 2) {
    return parsedWeight;
  }

  return 1;
}

export async function submitVote(payload: SubmitVotePayload) {
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Kamu harus login dulu sebelum voting.");
  }

  const sanitizedNim = normalizeNim(payload.nim);
  if (!sanitizedNim) {
    throw new Error("NIM tidak valid.");
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

  const userRef = doc(db, "users", sanitizedNim);
  const userSnapshot = await getDoc(userRef);
  const existingData = userSnapshot.data();

  if (existingData?.sudahVote || existingData?.sudah_vote) {
    throw new Error("NIM ini sudah melakukan voting sebelumnya.");
  }

  const voteRef = doc(db, "suara_masuk", sanitizedNim);

  await runTransaction(db, async (transaction) => {
    const freshUserSnapshot = await transaction.get(userRef);
    const freshUserData = freshUserSnapshot.data();
    const freshVoteSnapshot = await transaction.get(voteRef);
    const voteWeight = normalizeVoteWeight(freshUserData?.bobotSuara);

    if (freshUserData?.sudahVote || freshUserData?.sudah_vote) {
      throw new Error("NIM ini sudah melakukan voting sebelumnya.");
    }

    if (freshVoteSnapshot.exists()) {
      throw new Error("NIM ini sudah tercatat melakukan voting.");
    }

    transaction.set(
      userRef,
      {
        nim: sanitizedNim,
        statusHearing: voteWeight > 1,
        sudahVote: true,
        bobotSuara: voteWeight,
        voterUid: currentUser.uid,
        voterEmail: currentUser.email,
        votedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(voteRef, {
      nim: sanitizedNim,
      voterUid: currentUser.uid,
      voterEmail: currentUser.email,
      candidateId: payload.candidateId,
      statusHearing: voteWeight > 1,
      bobotSuara: voteWeight,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}