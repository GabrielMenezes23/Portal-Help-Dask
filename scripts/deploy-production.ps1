[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  throw "Vercel CLI não encontrada. Instale com 'npm install -g vercel' e execute 'vercel login'."
}

Write-Host 'Executando validação completa antes da produção...' -ForegroundColor Cyan
& "$PSScriptRoot\check.ps1"
if ($LASTEXITCODE -ne 0) { throw 'Validação pré-produção falhou.' }

Write-Host 'Publicando em produção...' -ForegroundColor Cyan
& vercel --prod
if ($LASTEXITCODE -ne 0) { throw 'Falha ao publicar em produção.' }

Write-Host 'Deployment de produção concluído.' -ForegroundColor Green
