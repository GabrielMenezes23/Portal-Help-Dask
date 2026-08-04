[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path 'node_modules')) {
  throw 'Dependências não instaladas. Execute .\scripts\setup.ps1 primeiro.'
}

if (-not (Test-Path '.env.local')) {
  throw 'Arquivo .env.local ausente. Execute .\scripts\setup.ps1.'
}

& npm run dev
exit $LASTEXITCODE
