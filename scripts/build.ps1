[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path 'node_modules')) {
  throw 'Dependências não instaladas. Execute .\scripts\setup.ps1 primeiro.'
}

& npm run build
if ($LASTEXITCODE -ne 0) {
  throw 'O build de produção falhou.'
}

Write-Host 'Build de produção concluído.' -ForegroundColor Green
