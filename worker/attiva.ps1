# Pubblica il servizio e registra i segreti. Le chiavi si incollano qui, non si vedono mentre si scrive.
Set-Location $PSScriptRoot
npx wrangler deploy
if (-not (Test-Path .tokens.json)) { node crea-link.mjs }
Get-Content .tokens.json -Raw | npx wrangler secret put TOKENS
Write-Host "`nIncolla la chiave ANTHROPIC e premi Invio"
npx wrangler secret put ANTHROPIC_API_KEY
Write-Host "`nIncolla il token GITHUB e premi Invio"
npx wrangler secret put GITHUB_TOKEN
Write-Host "`nFINITO"
