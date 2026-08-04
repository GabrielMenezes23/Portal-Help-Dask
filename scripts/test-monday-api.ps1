[CmdletBinding()]
param([string]$EnvFile = '.env.local')

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Test-Path $EnvFile)) {
  throw "Arquivo $EnvFile não encontrado. Execute .\scripts\setup.ps1."
}

$Values = @{}
Get-Content $EnvFile | ForEach-Object {
  $Line = $_.Trim()
  if (-not $Line -or $Line.StartsWith('#')) { return }
  $Parts = $Line -split '=', 2
  if ($Parts.Count -eq 2) {
    $Values[$Parts[0].Trim()] = $Parts[1].Trim().Trim('"').Trim("'")
  }
}

$Token = $Values['MONDAY_API_TOKEN']
$Version = $Values['MONDAY_API_VERSION']
$BoardId = $Values['MONDAY_BOARD_ID']

if ([string]::IsNullOrWhiteSpace($Token)) { throw 'MONDAY_API_TOKEN não configurado.' }
if ([string]::IsNullOrWhiteSpace($Version)) { $Version = '2026-07' }
if ([string]::IsNullOrWhiteSpace($BoardId)) { throw 'MONDAY_BOARD_ID não configurado.' }

$Query = @"
query VerifyMonday(`$boardIds: [ID!]!) {
  version { kind value }
  me { id name }
  boards(ids: `$boardIds) { id name }
}
"@

$Body = @{
  query = $Query
  variables = @{ boardIds = @($BoardId) }
} | ConvertTo-Json -Depth 6

$Headers = @{
  Authorization = $Token
  'API-Version' = $Version
  'Content-Type' = 'application/json'
}

Write-Host 'Testando o Monday sem gravar dados...' -ForegroundColor Cyan
$Response = Invoke-RestMethod -Method Post -Uri 'https://api.monday.com/v2' -Headers $Headers -Body $Body

if ($Response.errors) {
  throw ('Monday retornou erro: ' + ($Response.errors.message -join '; '))
}
if (-not $Response.data.boards -or $Response.data.boards.Count -eq 0) {
  throw 'O token respondeu, mas o board não foi localizado.'
}

Write-Host ('Usuário/API: ' + $Response.data.me.name) -ForegroundColor Green
Write-Host ('Versão: ' + $Response.data.version.value + ' (' + $Response.data.version.kind + ')') -ForegroundColor Green
Write-Host ('Board: ' + $Response.data.boards[0].name + ' [' + $Response.data.boards[0].id + ']') -ForegroundColor Green
Write-Host 'Conexão validada. Nenhum dado foi alterado.' -ForegroundColor Green
