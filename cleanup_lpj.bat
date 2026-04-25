@echo off
cd /d "C:\Users\Najatunnisa S\dpa-himafi"

REM Create the new folder
mkdir "src\app\lpj-presensi" 2>nul

REM Delete artifact files
echo Deleting artifact files...
del /f /q "src\app\calon\lpj-at.tsx" 2>nul
del /f /q "src\app\calon\lpj-at-page.tsx" 2>nul
del /f /q "src\app\bantuan\lpj.tsx" 2>nul
del /f /q "src\app\bantuan\lpj-page.tsx" 2>nul
del /f /q "src\app\profil\lpj.tsx" 2>nul
del /f /q "src\app\profil\lpj-routing-page.tsx" 2>nul
del /f /q "src\app\profil\lpj-presensi.tsx" 2>nul
del /f /q "src\app\profil\lpj-at.tsx" 2>nul
del /f /q "src\app\setting\lpj-presensi.tsx" 2>nul
del /f /q "src\app\hearing\lpj-at-page.tsx" 2>nul
del /f /q "src\app\hearing\lpj-page.tsx" 2>nul

REM Verify the folder exists
echo.
echo Verifying folder creation...
if exist "src\app\lpj-presensi" (
    echo [SUCCESS] Folder created: src\app\lpj-presensi
    dir "src\app\lpj-presensi"
) else (
    echo [FAILED] Folder was not created
)

echo.
echo Cleanup completed!
