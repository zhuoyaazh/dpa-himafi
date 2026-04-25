# Script untuk cleanup artifact LPJ files
$filesToDelete = @(
    "src/app/calon/lpj-at.tsx",
    "src/app/calon/lpj-at-page.tsx",
    "src/app/bantuan/lpj.tsx",
    "src/app/bantuan/lpj-page.tsx",
    "src/app/profil/lpj.tsx",
    "src/app/profil/lpj-routing-page.tsx",
    "src/app/profil/lpj-presensi.tsx",
    "src/app/profil/lpj-at.tsx",
    "src/app/setting/lpj-presensi.tsx",
    "src/app/hearing/lpj-at-page.tsx"
)

foreach ($file in $filesToDelete) {
    $path = Join-Path (Get-Location) $file
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "✓ Deleted: $file"
    } else {
        Write-Host "✗ Not found: $file"
    }
}

Write-Host "`n✓ Cleanup complete!"
