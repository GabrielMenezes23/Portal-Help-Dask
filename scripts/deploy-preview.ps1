[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  throw "Vercel CLI não encontrada. Instale com 'npm install -g vercel' e execute 'vercel login'."
}

Write-Host 'Executando validação antes do preview...' -ForegroundColor Cyan
& "$PSScriptRoot\check.ps1"

Write-Host 'Criando deployment de preview...' -ForegroundColor Cyan
& vercel
if ($LASTEXITCODE -ne 0) {
  throw 'Falha ao publicar o preview na Vercel.'
}
