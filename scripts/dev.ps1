# Local dev launcher when npm/node are not on PATH (common in fresh Cursor terminals).
$NodeDir = "C:\Program Files\nodejs"
if (-not (Test-Path "$NodeDir\npm.cmd")) {
  Write-Error "Node.js not found at $NodeDir. Install from https://nodejs.org/ then reopen the terminal."
  exit 1
}

$env:Path = "$NodeDir;" + $env:Path
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".\node_modules")) {
  Write-Host "Running npm install (first time)..." -ForegroundColor Cyan
  & "$NodeDir\npm.cmd" install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Starting dev server..." -ForegroundColor Cyan
& "$NodeDir\npm.cmd" run dev
