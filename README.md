# DPA HIMAFI ITB Web

Starter web utama DPA HIMAFI ITB dengan menu Home, Profil Calon, Profil User, Voting, Setting, dan Login/Logout.

## Stack

- Next.js (App Router)
- Tailwind CSS
- Firebase (Auth, Firestore, Storage)

## Getting Started

1) Install dependencies:

```bash
pnpm install
```

2) Siapkan environment variable Firebase:

```bash
cp .env.example .env.local
```

Lalu isi semua value Firebase Web App ke `.env.local`.

3) Jalankan development server:

```bash
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Struktur Route

- `/` → Home DPA HIMAFI
- `/calon` → Profil calon
- `/profile` → Profil user
- `/voting` → Halaman voting
- `/setting` → Pengaturan
- `/login` → Login/logout

## Konsep Data Voting (Anonim)

- Koleksi `users`: `nim`, `selfieUrl`, `statusHearing`, `sudahVote`
- Koleksi `suara_masuk`: `candidateId`, `bobotSuara`, `createdAt`

Identitas pemilih dan suara dipisah agar panitia bisa verifikasi tanpa melihat pilihan suara per NIM.

## Catatan Implementasi

- Inisialisasi Firebase ada di `lib/firebase.ts`.
- Helper submit voting ada di `lib/voting.ts` (`submitVote`).
- Untuk production, validasi `sudahVote` dan bobot hearing sebaiknya dilakukan via server/API agar tidak bisa dimanipulasi dari client.

## Contoh Rule Minimum (Firestore)

Gunakan sebagai titik awal, lalu perketat sesuai mekanisme auth panitia:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{nim} {
      allow read, write: if request.auth != null;
    }

    match /suara_masuk/{voteId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null;
      allow update, delete: if false;
    }
  }
}
```

## Rules Firebase untuk MVP (Voting Wajib Login)

Project ini sudah disiapkan dengan file rules berikut:

- `firestore.rules`
- `storage.rules`

Cara pakai cepat (via Firebase Console):

1) Buka **Firestore Database → Rules** lalu paste isi `firestore.rules`.
2) Buka **Storage → Rules** lalu paste isi `storage.rules`.
3) Klik **Publish** di masing-masing halaman.

Catatan:

- Submit voting sekarang mensyaratkan `request.auth != null` (user harus login).
- Submit voting hanya menerima email kampus terverifikasi (`@student.itb.ac.id`, `@mahasiswa.itb.ac.id`, atau `@itb.ac.id`).
- NIM pada form voting harus sama dengan bagian awal email kampus.
- Read data profil di `/profile` tetap bisa tanpa login.
- Ini **belum final untuk production**. Setelah auth panitia/user aktif penuh, rules tetap perlu diperketat lagi.

Catatan implementasi MVP saat ini:

- Login `NIM + Token` memakai Firebase Auth Email/Password.
- Untuk alur ini, rules tidak mewajibkan `email_verified == true` agar upload selfie dan submit vote tidak tertolak.

## Setup Firebase Auth (NIM + Password)

1) Buka **Firebase Console → Authentication → Sign-in method**.
2) Aktifkan provider **Email/Password**.
3) Di **Authentication → Settings → Authorized domains**, pastikan `localhost` sudah terdaftar.
4) Buat akun user pemilih (manual/import) dengan format email kampus berbasis NIM, contoh: `10224000@mahasiswa.itb.ac.id`.
5) Gunakan halaman `/login` untuk masuk pakai `NIM + Password`.

Catatan paket gratis (Spark):

- Email/Password bisa dipakai di Spark.
- Error `auth/operation-not-allowed` biasanya berarti provider belum diaktifkan di langkah 2.

## Fitur yang Sudah Aktif

- Form voting di `/voting` (NIM, kandidat, checkbox hearing, upload selfie)
- Gate login di `/voting` (wajib login sebelum submit)
- Login/logout NIM + Password di `/login`
- Submit ke Firebase via `submitVote()` dengan anti double-vote sederhana (`sudahVote`)
- Cek status user di `/profile` berdasarkan NIM

## Next Step

- finalisasi daftar calon dari data riil
- buat halaman admin terpisah untuk rekap hasil
