[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path 'node_modules')) {
  throw 'Dependências não instaladas. Execute .\scripts\setup.ps1 primeiro.'
}

Write-Host 'Executando testes, lint, typecheck e build...' -ForegroundColor Cyan
& npm run quality
if ($LASTEXITCODE -ne 0) { throw 'A validação encontrou erros.' }

$migrationsPath = 'supabase/migrations'
if (-not (Test-Path $migrationsPath)) {
  throw "Diretório obrigatório ausente: $migrationsPath"
}

$requiredMigrationSuffixes = @(
  'phase0_foundation.sql',
  'phase1_monday_mirror.sql',
  'final_helpdesk.sql',
  'advisor_hardening.sql'
)

foreach ($suffix in $requiredMigrationSuffixes) {
  $matches = @(Get-ChildItem -Path $migrationsPath -File -Filter "*_$suffix")

  if ($matches.Count -eq 0) {
    throw "Migration obrigatória ausente: *_$suffix"
  }

  if ($matches.Count -gt 1) {
    throw "Mais de uma migration encontrada para *_$suffix"
  }
}

$requiredFiles = @(
  'docs/FINAL_HOMOLOGATION.md',
  'docs/CUTOVER.md',
  'docs/MONDAY_WEBHOOK_SETUP.md'
)
foreach ($file in $requiredFiles) {
  if (-not (Test-Path $file)) { throw "Arquivo obrigatório ausente: $file" }
}

$forbiddenFiles = Get-ChildItem -Recurse -Force -File | Where-Object {
  $_.FullName -notmatch '[\\/](node_modules|\.next|\.git|\.vercel)[\\/]' -and
  $_.Name -match '^\.env(\..+)?$' -and
  $_.Name -ne '.env.example'
}
if ($forbiddenFiles) {
  Write-Host 'Aviso: arquivos locais de ambiente existem e devem permanecer ignorados:' -ForegroundColor Yellow
  $forbiddenFiles | ForEach-Object { Write-Host " - $($_.FullName)" -ForegroundColor Yellow }
}

Write-Host 'Validação concluída sem erros.' -ForegroundColor Green
