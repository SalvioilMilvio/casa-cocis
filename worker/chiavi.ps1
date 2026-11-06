# Chiede il token GitHub, lo prova e solo se funziona lo registra su Cloudflare. Nulla resta su disco.
Set-Location $PSScriptRoot
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

do {
  Write-Host ""
  Write-Host "  TOKEN GITHUB (inizia con github_pat_)" -ForegroundColor Yellow
  Write-Host "  Copia il token, clicca qui, premi il tasto destro del mouse, poi Invio."
  $s = Read-Host "  Token" -AsSecureString
  $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  $github = ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)).Trim()
  Write-Host "  Letti $($github.Length) caratteri."
  try {
    $r = Invoke-RestMethod -Uri "https://api.github.com/repos/SalvioilMilvio/casa-cocis" -Headers @{ Authorization = "Bearer $github"; 'User-Agent' = 'casa-cocis' }
    $ok = $r.permissions.push -eq $true
    if ($ok) { Write-Host "  TOKEN GITHUB OK" -ForegroundColor Green }
    else { Write-Host "  Il token legge ma non puo' scrivere: serve il permesso Contents in lettura e scrittura." -ForegroundColor Red }
  } catch { $ok = $false; Write-Host "  Non funziona, riprova." -ForegroundColor Red }
} until ($ok)

$file = Join-Path $env:TEMP ("cocis-" + [guid]::NewGuid() + ".json")
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($file, (@{ GITHUB_TOKEN = $github } | ConvertTo-Json), $utf8)
npx wrangler secret bulk $file
Remove-Item $file -Force

Write-Host ""
Write-Host "  FINITO: puoi chiudere questa finestra." -ForegroundColor Green
Read-Host "  Premi Invio per chiudere"
