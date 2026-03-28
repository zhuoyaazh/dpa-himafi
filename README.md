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
- `/profile` → Cek status pemilih
- `/profil` → Profil user (akun login)
- `/hearing` → Presensi hearing (check-in/check-out)
- `/voting` → Halaman voting
- `/setting` → Pengaturan
- `/login` → Login/logout
- `/admin` → Panel admin

## Konsep Data Voting (Operasional Panitia)

- Koleksi `users/{nim}`: `nim`, `statusHearing`, `sudahVote`, `voterUid`, `voterEmail`, `votedAt`
- Koleksi `suara_masuk/{nim}`: `nim`, `candidateId`, `bobotSuara`, `statusHearing`, `voterUid`, `voterEmail`, `createdAt`

Dokumen `suara_masuk` sekarang memakai ID dokumen = NIM agar anti-duplikat per pemilih dan mudah direkap oleh panitia.
Field `bobotSuara` dikelola manual oleh admin di panel `/admin` dengan nilai yang diizinkan: `1`, `1.5`, atau `2`.
Jika bobot belum diisi untuk suatu NIM, sistem otomatis memakai default `1` saat submit vote.

## Catatan Implementasi

- Inisialisasi Firebase ada di `lib/firebase.ts`.
- Helper submit voting ada di `lib/voting.ts` (`submitVote`).
- Untuk production, validasi `sudahVote` dan bobot suara sebaiknya dilakukan via server/API agar tidak bisa dimanipulasi dari client.

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

### Publish Rules Setelah Fitur Presensi Hearing

Setelah update terbaru, kamu **wajib publish ulang** Firestore Rules agar fitur ini aktif:

- `hearing_settings/current` (admin set aktif/nonaktif, token, jadwal)
- `hearing_attendance/{nim}` (peserta kirim check-in/check-out + bukti)

Langkah cepat:

1) Buka **Firestore Database → Rules**.
2) Paste isi file `firestore.rules` terbaru dari project ini.
3) Klik **Publish**.
4) Tunggu status publish sukses.

Catatan: tanpa publish ulang rules, halaman `/hearing` atau simpan pengaturan di `/admin` bisa kena `permission-denied`.

## Checklist Uji Cepat Presensi Hearing

### A. Uji sebagai Admin

1) Login akun admin (akun yang ada di `admin_users/{uid}` dengan `active: true`).
2) Buka `/admin`.
3) Isi:
  - toggle `Presensi hearing aktif`
  - `Token Check-in`
  - `Token Check-out`
  - window waktu check-in/check-out
4) Klik **Simpan Pengaturan Presensi**.
5) Pastikan muncul status berhasil.

### B. Uji sebagai Peserta

1) Login akun peserta.
2) Buka `/hearing`.
3) Pilih **Check-in Awal**, isi token check-in yang benar, lalu **Upload Bukti Kehadiran** dan submit.
4) Ulangi untuk **Check-out Akhir** dengan token check-out.
5) Cek dokumen `hearing_attendance/{nim}` di Firestore, pastikan field ini terisi:
  - `checkInAt`, `checkOutAt`
  - `checkInProofUrl`, `checkOutProofUrl`
  - `classification` (`awal_akhir`)
  - `statusHearing` dan `status_hearing` menjadi `true`

### C. Uji Skenario Gagal

- Token salah → harus ditolak.
- Presensi nonaktif → harus ditolak.
- Di luar window waktu → harus ditolak.
- Submit check-in/check-out dua kali → harus ditolak.

Jika semua lolos, fitur presensi hearing siap dipakai operasional.

Catatan:

- Submit voting sekarang mensyaratkan `request.auth != null` (user harus login).
- Submit voting hanya menerima email kampus terverifikasi (`@student.itb.ac.id`, `@mahasiswa.itb.ac.id`, atau `@itb.ac.id`).
- NIM pada form voting harus sama dengan bagian awal email kampus.
- Read data profil di `/profile` tetap bisa tanpa login.
- Ini **belum final untuk production**. Setelah auth panitia/user aktif penuh, rules tetap perlu diperketat lagi.

Catatan implementasi MVP saat ini:

- Login `NIM + Token` memakai Firebase Auth Email/Password.
- Untuk alur ini, rules tidak mewajibkan `email_verified == true` agar submit vote tidak tertolak.

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

- Form voting di `/voting` (NIM, kandidat)
- Gate login di `/voting` (wajib login sebelum submit)
- Login/logout NIM + Password di `/login`
- Submit ke Firebase via `submitVote()` dengan anti double-vote sederhana (`sudahVote`)
- Cek status user di `/profile` berdasarkan NIM

## Next Step

- finalisasi daftar calon dari data riil
- buat halaman admin terpisah untuk rekap hasil

## Rekap Akhir Masa Voting

Jalankan command berikut setelah voting selesai:

```bash
pnpm recap:voting
```

Output akan dibuat di folder `exports/`:

- `voting-recap-<timestamp>.json`
- `voting-recap-<timestamp>.csv`

Data rekap mencakup NIM, kandidat yang dipilih, bobot suara, status hearing, email/uid voter, timestamp voting, dan indikator sinkronisasi dokumen `users` vs `suara_masuk`.
