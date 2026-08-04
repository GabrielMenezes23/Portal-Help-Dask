[CmdletBinding()]
param(
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ProjectName = Split-Path -Leaf $ProjectRoot
$Parent = Split-Path -Parent $ProjectRoot

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $Parent 'CAF_Helpdesk_Final_Producao.zip'
}

$StagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("caf-helpdesk-package-" + [guid]::NewGuid())
$StagingProject = Join-Path $StagingRoot $ProjectName

New-Item -ItemType Directory -Path $StagingProject -Force | Out-Null

$ExcludedDirectories = @('.git', '.next', 'node_modules', 'coverage', '.vercel', 'package-output')
$ExcludeArgs = @()
foreach ($directory in $ExcludedDirectories) {
  $ExcludeArgs += '/XD'
  $ExcludeArgs += (Join-Path $ProjectRoot $directory)
}

$RobocopyArgs = @(
  $ProjectRoot,
  $StagingProject,
  '/E',
  '/COPY:DAT',
  '/R:1',
  '/W:1',
  '/NFL',
  '/NDL',
  '/NJH',
  '/NJS',
  '/NP'
) + $ExcludeArgs

& robocopy @RobocopyArgs | Out-Null
$RobocopyCode = $LASTEXITCODE
if ($RobocopyCode -gt 7) {
  throw "Robocopy falhou com código $RobocopyCode."
}

Get-ChildItem -Path $StagingProject -Recurse -Force -File |
  Where-Object {
    $_.Name -like '.env*' -and $_.Name -ne '.env.example'
  } |
  Remove-Item -Force

Get-ChildItem -Path $StagingProject -Recurse -Force -File |
  Where-Object {
    $_.Extension -in @('.log', '.zip')
  } |
  Remove-Item -Force

if (Test-Path $OutputPath) {
  Remove-Item $OutputPath -Force
}

Compress-Archive -Path $StagingProject -DestinationPath $OutputPath -CompressionLevel Optimal
Remove-Item $StagingRoot -Recurse -Force

Write-Host "Pacote limpo criado em: $OutputPath" -ForegroundColor Green
