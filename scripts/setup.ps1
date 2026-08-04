[CmdletBinding()]
param([switch]$SkipInstall)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Assert-Command {
  param([Parameter(Mandatory)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando '$Name' não encontrado. Instale-o e abra um novo PowerShell."
  }
}

Assert-Command node
Assert-Command npm

$nodeVersionText = (& node -p "process.versions.node").Trim()
$nodeVersion = [version]$nodeVersionText
$minimumNode = [version]'22.13.0'
if ($nodeVersion -lt $minimumNode) {
  throw "Node.js $minimumNode ou superior é obrigatório. Encontrado: $nodeVersionText"
}

Write-Host "Node.js validado: $nodeVersionText" -ForegroundColor Green

if (-not (Test-Path '.env.local')) {
  Copy-Item '.env.example' '.env.local'
  Write-Host 'Criado .env.local a partir do exemplo.' -ForegroundColor Yellow
}

if (-not $SkipInstall) {
  if (Test-Path 'package-lock.json') {
    Write-Host 'Instalando dependências com npm ci...' -ForegroundColor Cyan
    & npm ci
  } else {
    Write-Host 'Instalando dependências e criando package-lock.json...' -ForegroundColor Cyan
    & npm install
  }
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências.' }
}

Write-Host ''
Write-Host 'Projeto final preparado.' -ForegroundColor Green
Write-Host '1. Preencha .env.local'
Write-Host '2. Execute .\scripts\apply-migrations.ps1 -ProjectRef SEU_PROJECT_REF'
Write-Host '3. Execute .\scripts\test-monday-api.ps1'
Write-Host '4. Execute .\scripts\check.ps1'
Write-Host '5. Execute .\scripts\dev.ps1'
