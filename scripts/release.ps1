# Kurulum dosyasını GitHub Releases'a yayımlar (otomatik güncelleme buradan okur).
# Önce: package.json'daki "version" artırılır ve `npm run dist` çalıştırılır.
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts/release.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot)
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$exe = "dist/OldricTalk-Kurulum-$version.exe"
if (-not (Test-Path $exe)) { throw "$exe yok; önce 'npm run dist' çalıştırın." }

$notes = @"
**Kurulum:** ``OldricTalk-Kurulum-$version.exe`` dosyasını indirip çalıştırın.
Windows "Bilgisayarınızı korudu" uyarısı gösterirse **Ek bilgi → Yine de çalıştır** deyin (uygulama imzasız olduğu için bu uyarı normaldir).

Kurulu uygulamalar bu sürümü kendiliğinden indirir.
"@

gh release create "v$version" $exe "$exe.blockmap" dist/latest.yml `
  --repo mstftkmyapayzeka-cyber/OldricTalk --target desktop `
  --title "OldricTalk $version" --notes $notes
Write-Host "`nYayımlandı: https://github.com/mstftkmyapayzeka-cyber/OldricTalk/releases/tag/v$version" -ForegroundColor Green
