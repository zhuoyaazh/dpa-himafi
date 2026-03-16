import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseAuth, db, storage } from "@/lib/firebase";
import { getVoterIdentityError, normalizeNim } from "@/lib/voter-identity";

type SubmitVotePayload = {
  nim: string;
  candidateId: string;
  hearingWeight: 1 | 2;
  selfieFile?: File;
  selfieUrl?: string;
};

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

  let selfieUrl = payload.selfieUrl;

  if (!selfieUrl && payload.selfieFile) {
    const selfieRef = ref(
      storage,
      `verifikasi-selfie/${sanitizedNim}/${Date.now()}-${payload.selfieFile.name}`,
    );

    await uploadBytes(selfieRef, payload.selfieFile);
    selfieUrl = await getDownloadURL(selfieRef);
  }

  if (!selfieUrl) {
    throw new Error("URL selfie tidak ditemukan.");
  }

  const voteRef = doc(collection(db, "suara_masuk"));

  await runTransaction(db, async (transaction) => {
    const freshUserSnapshot = await transaction.get(userRef);
    const freshUserData = freshUserSnapshot.data();

    if (freshUserData?.sudahVote || freshUserData?.sudah_vote) {
      throw new Error("NIM ini sudah melakukan voting sebelumnya.");
    }

    transaction.set(
      userRef,
      {
        nim: sanitizedNim,
        selfieUrl,
        statusHearing: payload.hearingWeight === 2,
        sudahVote: true,
        voterUid: currentUser.uid,
        voterEmail: currentUser.email,
        votedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(voteRef, {
      candidateId: payload.candidateId,
      bobotSuara: payload.hearingWeight,
      createdAt: serverTimestamp(),
    });
  });
}