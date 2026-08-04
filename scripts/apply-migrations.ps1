[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI não encontrada. Confirme com 'supabase --version'."
}

& supabase --version
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível executar Supabase CLI.' }

& supabase db push --help | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Atualize a CLI: o comando 'db push' não foi encontrado." }

Write-Host "Vinculando ao projeto $ProjectRef..." -ForegroundColor Cyan
& supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw 'Falha ao vincular o projeto Supabase.' }

Write-Host 'Aplicando migrations pendentes...' -ForegroundColor Cyan
& supabase db push
if ($LASTEXITCODE -ne 0) { throw 'Falha ao aplicar migrations.' }

Write-Host 'Migrations aplicadas.' -ForegroundColor Green
