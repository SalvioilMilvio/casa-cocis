# Finestra per le due chiavi: finiscono solo su Cloudflare.
Set-Location $PSScriptRoot
Write-Host ""
Write-Host "  PRIMA CHIAVE: ANTHROPIC" -ForegroundColor Yellow
Write-Host "  Incolla con il tasto destro del mouse, poi premi Invio. Potresti non vedere nulla: e' normale."
npx wrangler secret put ANTHROPIC_API_KEY
Write-Host ""
Write-Host "  SECONDA CHIAVE: GITHUB" -ForegroundColor Yellow
Write-Host "  Incolla con il tasto destro del mouse, poi premi Invio."
npx wrangler secret put GITHUB_TOKEN
Write-Host ""
Write-Host "  FINITO: puoi chiudere questa finestra." -ForegroundColor Green
Read-Host "  Premi Invio per chiudere"
