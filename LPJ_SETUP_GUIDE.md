# LPJ Presensi AT - SETUP GUIDE

## ✅ What's Done

### 1. Frontend Page
- **Location**: `src/app/profil/lpj-at.tsx`
- **Route**: `/profil/lpj-at`
- **Features**:
  - 2-mode attendance (awal/akhir)
  - NIM confirmation + Nama input
  - Photo upload (JPG, PNG, WebP • max 5MB)
  - Cloudinary integration
  - Edit allowed (update existing records)

### 2. Navigation
- Added "Presensi LPJ AT" link in navbar
- Accessible to all authenticated users
- Properly hidden BP selection components still intact

### 3. Feature Flag
- `BP_SELECTION_ACTIVE` env var controls visibility of BP pages
- Set in `.env.local`: `NEXT_PUBLIC_BP_SELECTION_ACTIVE=false`

---

## 🔥 Firebase Setup (DO THIS FIRST)

### Step 1: Create Collections

Go to Firebase Console → Firestore → Create Collections:

#### Collection 1: `lpj_sessions`

**First document (Auto ID):**
```
name: "LPJ AT 2025"
isActive: true
presensiAwalAktif: true
presensiAkhirAktif: false
createdAt: (let Firestore auto-set)
updatedAt: (let Firestore auto-set)
```

#### Collection 2: `lpj_attendance`

- **Leave empty** (it will be auto-populated when users submit)
- Document IDs will be: `{sessionId}_{nim}_{mode}`

### Step 2: Update Firestore Rules

Go to Firestore → Rules → Replace with:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Existing rules...
    
    // LPJ Sessions - Read by authenticated, Write by admin only
    match /lpj_sessions/{sessionId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid in get(/databases/$(database)/documents/admin_users/data).adminUsers;
    }

    // LPJ Attendance - Authenticated can read/create/update, admin can delete
    match /lpj_attendance/{recordId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth.uid in get(/databases/$(database)/documents/admin_users/data).adminUsers;
    }
  }
}
```

**Publish Rules!**

---

## 🚀 Test It

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Login** as a test user

3. **Navigate** to `/profil/lpj-at`

4. **Should see**:
   - "Presensi Awal" & "Presensi Akhir" buttons (both active because `presensiAwalAktif` and `presensiAkhirAktif` are both true in Firebase)
   - NIM input
   - Nama input
   - Photo upload zone

5. **Try submitting**:
   - Fill NIM, Nama, upload photo
   - Click "Simpan Presensi Awal"
   - Should succeed and show success message
   - Check Firebase Console → `lpj_attendance` collection for new document

---

## 🎛️ Controlling Gates (For Admin)

**Edit Firestore document** `lpj_sessions/{documentId}`:

- `presensiAwalAktif: true/false` → Opens/closes early attendance
- `presensiAkhirAktif: true/false` → Opens/closes final attendance
- `isActive: true/false` → Enables/disables entire session

Users will see:
- ❌ Error message if their mode is closed
- ❌ Session inactive message if session is not active

---

## 📋 Next: Admin Panel (Optional)

Can be added later to admin page with:
- Create/manage LPJ sessions
- Toggle gates
- View attendance summary
- Export data

For now, manage manually via Firebase Console.

---

## 🐛 Troubleshooting

**Photo upload fails:**
- Check Cloudinary is configured in `.env.local`
- Check upload preset exists in Cloudinary

**"Session not active" message:**
- Make sure document exists in `lpj_sessions` collection
- Check `isActive` is `true`

**Data not saving:**
- Check Firestore Rules are updated
- Check your user is authenticated
- Check mode (awal/akhir) is active in session config

**"Presensi belum dibuka":**
- Toggle the correct flag in Firebase (`presensiAwalAktif` or `presensiAkhirAktif`)

