[CmdletBinding()]
param(
  [string]$EnvFile = '.env.local',
  [string]$ProductionUrl
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path $EnvFile)) { throw "Arquivo $EnvFile não encontrado." }

$values = @{}
Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $parts = $line -split '=', 2
  if ($parts.Count -eq 2) { $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'") }
}

$required = @(
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'MONDAY_API_TOKEN',
  'MONDAY_BOARD_ID',
  'MONDAY_WEBHOOK_SECRET',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL'
)

foreach ($name in $required) {
  $value = [string]$values[$name]
  if ([string]::IsNullOrWhiteSpace($value) -or $value -match 'SUBSTITUA|SEU-PROJETO|GERE_UM|SEU-DOMINIO') {
    throw "Variável não configurada: $name"
  }
}

foreach ($name in @('MONDAY_WEBHOOK_SECRET', 'CRON_SECRET')) {
  if (([string]$values[$name]).Length -lt 16) {
    throw "$name deve ter pelo menos 16 caracteres."
  }
}

Write-Host 'Variáveis obrigatórias validadas.' -ForegroundColor Green

& "$PSScriptRoot\check.ps1"
if ($LASTEXITCODE -ne 0) { throw 'Validação do projeto falhou.' }

& "$PSScriptRoot\test-monday-api.ps1" -EnvFile $EnvFile
if ($LASTEXITCODE -ne 0) { throw 'Validação do Monday falhou.' }

if ([string]::IsNullOrWhiteSpace($ProductionUrl)) {
  $ProductionUrl = [string]$values['NEXT_PUBLIC_APP_URL']
}
$ProductionUrl = $ProductionUrl.TrimEnd('/')

Write-Host "Consultando health check: $ProductionUrl/api/health" -ForegroundColor Cyan
$health = Invoke-RestMethod -Method Get -Uri "$ProductionUrl/api/health"
if ($health.status -ne 'ready') {
  throw "Health check não está ready. Estado: $($health.status)"
}

Write-Host 'Health check aprovado.' -ForegroundColor Green
Write-Host ''
Write-Host 'Validação automatizada concluída.' -ForegroundColor Green
Write-Host 'Finalize os testes humanos de docs/FINAL_HOMOLOGATION.md antes de desligar o legado.' -ForegroundColor Yellow
