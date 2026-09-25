# Almanac one-line installer for Windows. From PowerShell:
#
#   irm https://almanac.bar/install.ps1 | iex
#
# or from cmd:
#
#   powershell -c "irm https://almanac.bar/install.ps1 | iex"
#
# Downloads Almanac into .\almanac-crm (or $env:ALMANAC_DIR), installs its
# dependencies and runs the setup wizard (scripts/setup.mjs). Re-running
# it updates an existing copy and keeps your settings.

$ErrorActionPreference = 'Stop'
$Repo = if ($env:ALMANAC_REPO) { $env:ALMANAC_REPO } else { 'https://github.com/trulytuhin/almanac-crm.git' }
$Dir = if ($env:ALMANAC_DIR) { $env:ALMANAC_DIR } else { 'almanac-crm' }

function Step($text) { Write-Host "`n> $text" -ForegroundColor Green }
function Fail($text) { Write-Host "`nx $text`n" -ForegroundColor Red; exit 1 }

Write-Host "`nAlmanac installer" -ForegroundColor White

Step "Checking what's installed"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail 'git is missing. Install it with "winget install Git.Git" (or from https://git-scm.com), open a new window and run this again.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail 'Node.js is missing. Install it with "winget install OpenJS.NodeJS.LTS" (or from https://nodejs.org), open a new window and run this again.'
}
$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]") | Out-String).Trim()
if ($nodeMajor -lt 20) { Fail "Node.js $(node -v) is too old. Install version 20 or newer from https://nodejs.org." }
Write-Host "  $(git --version), node $(node -v)"

if (Test-Path (Join-Path $Dir '.git')) {
  Step "Updating $Dir"
  git -C $Dir pull --ff-only
  if ($LASTEXITCODE -ne 0) { Fail 'Could not update. Check the output above.' }
} else {
  if (Test-Path $Dir) { Fail "$Dir already exists and isn't an Almanac checkout. Set ALMANAC_DIR to another folder." }
  Step "Downloading Almanac into $Dir"
  git clone --depth 1 $Repo $Dir
  if ($LASTEXITCODE -ne 0) { Fail 'Download failed. Check the output above.' }
}
Set-Location $Dir

Step 'Installing dependencies (a minute or two)'
npm ci --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { Fail 'npm install failed. Check the output above.' }

node scripts/setup.mjs @args
