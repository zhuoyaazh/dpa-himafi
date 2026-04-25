@echo off
cd /d "C:\Users\Najatunnisa S\dpa-himafi"

REM Create folder
mkdir src\app\lpj-presensi

REM Delete all artifact files
del "src\app\calon\lpj-at.tsx" /F /Q 2>nul
del "src\app\calon\lpj-at-page.tsx" /F /Q 2>nul
del "src\app\bantuan\lpj.tsx" /F /Q 2>nul
del "src\app\bantuan\lpj-page.tsx" /F /Q 2>nul
del "src\app\profil\lpj.tsx" /F /Q 2>nul
del "src\app\profil\lpj-routing-page.tsx" /F /Q 2>nul
del "src\app\profil\lpj-presensi.tsx" /F /Q 2>nul
del "src\app\profil\lpj-at.tsx" /F /Q 2>nul
del "src\app\setting\lpj-presensi.tsx" /F /Q 2>nul
del "src\app\hearing\lpj-at-page.tsx" /F /Q 2>nul
del "src\app\hearing\lpj-page.tsx" /F /Q 2>nul

echo ✓ Cleanup done - Folder lpj-presensi created
