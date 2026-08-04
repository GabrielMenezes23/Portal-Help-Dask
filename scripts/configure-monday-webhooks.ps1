[CmdletBinding()]
param(
  [string]$EnvFile = '.env.local',
  [switch]$AllowExistingEvents
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Read-EnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { throw "Arquivo $Path não encontrado." }
  $values = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
      $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }
  }
  return $values
}

function Invoke-MondayGraphQL {
  param(
    [string]$Query,
    [hashtable]$Variables,
    [hashtable]$Headers
  )
  $body = @{ query = $Query; variables = $Variables } | ConvertTo-Json -Depth 8
  $response = Invoke-RestMethod -Method Post -Uri 'https://api.monday.com/v2' -Headers $Headers -Body $body
  if ($response.errors) {
    throw ('Monday retornou erro: ' + (($response.errors | ForEach-Object { $_.message }) -join '; '))
  }
  return $response.data
}

$envValues = Read-EnvFile $EnvFile
$token = $envValues['MONDAY_API_TOKEN']
$version = $envValues['MONDAY_API_VERSION']
$boardId = $envValues['MONDAY_BOARD_ID']
$appUrl = $envValues['NEXT_PUBLIC_APP_URL']
$secret = $envValues['MONDAY_WEBHOOK_SECRET']

if ([string]::IsNullOrWhiteSpace($token) -or $token.StartsWith('SUBSTITUA')) { throw 'MONDAY_API_TOKEN não configurado.' }
if ([string]::IsNullOrWhiteSpace($version)) { $version = '2026-07' }
if ([string]::IsNullOrWhiteSpace($boardId)) { throw 'MONDAY_BOARD_ID não configurado.' }
if ([string]::IsNullOrWhiteSpace($appUrl) -or -not $appUrl.StartsWith('https://')) { throw 'NEXT_PUBLIC_APP_URL deve ser a URL HTTPS de produção.' }
if ([string]::IsNullOrWhiteSpace($secret) -or $secret.StartsWith('GERE_')) { throw 'MONDAY_WEBHOOK_SECRET não configurado.' }
if ($secret.Length -lt 16) { throw 'MONDAY_WEBHOOK_SECRET deve ter pelo menos 16 caracteres.' }

$appUrl = $appUrl.TrimEnd('/')
$encodedSecret = [uri]::EscapeDataString($secret)
$webhookUrl = "$appUrl/api/webhooks/monday?secret=$encodedSecret"
if ($webhookUrl.Length -gt 255) { throw 'A URL do webhook ultrapassa o limite de 255 caracteres do Monday.' }

$headers = @{
  Authorization = $token
  'API-Version' = $version
  'Content-Type' = 'application/json'
}

$queryExisting = @'
query ExistingWebhooks($boardId: ID!) {
  webhooks(board_id: $boardId) { id event board_id config }
}
'@
$existingData = Invoke-MondayGraphQL -Query $queryExisting -Variables @{ boardId = $boardId } -Headers $headers
$existingEvents = @($existingData.webhooks | ForEach-Object { [string]$_.event })

$events = @(
  'create_item',
  'change_column_value',
  'change_name',
  'item_moved_to_any_group',
  'item_archived',
  'item_deleted',
  'item_restored'
)

$mutation = @'
mutation CreateWebhook($boardId: ID!, $url: String!, $event: WebhookEventType!) {
  create_webhook(board_id: $boardId, url: $url, event: $event) {
    id
    board_id
    event
  }
}
'@

Write-Host "Endpoint: $webhookUrl" -ForegroundColor Cyan
foreach ($eventName in $events) {
  if (-not $AllowExistingEvents -and $existingEvents -contains $eventName) {
    Write-Host "Ignorado: já existe webhook para $eventName no board." -ForegroundColor Yellow
    continue
  }

  $created = Invoke-MondayGraphQL -Query $mutation -Variables @{
    boardId = $boardId
    url = $webhookUrl
    event = $eventName
  } -Headers $headers

  Write-Host "Criado: $eventName [ID $($created.create_webhook.id)]" -ForegroundColor Green
}

Write-Host 'Configuração concluída. Valide os eventos no painel administrativo.' -ForegroundColor Green
