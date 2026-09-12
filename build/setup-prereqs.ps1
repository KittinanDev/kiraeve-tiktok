$ErrorActionPreference = "Stop"

$appDir = $args[0]
if (-not $appDir) {
    $appDir = "$PSScriptRoot\resources\app"
}

Write-Host "=========================================================="
Write-Host "  Kiraeve TikTok - Automatic Dependencies Installer"
Write-Host "=========================================================="

$pythonEmbedDir = Join-Path $appDir "python_embed"
if (-not (Test-Path $pythonEmbedDir)) {
    New-Item -ItemType Directory -Path $pythonEmbedDir -Force | Out-Null
}

# 1. Download and setup Python Embed 3.11
$pythonExe = Join-Path $pythonEmbedDir "python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Host "[1/3] Downloading Python 3.11 Runtime (~11MB)..."
    $pyZip = Join-Path $env:TEMP "python-3.11.9-embed-amd64.zip"
    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip" -OutFile $pyZip -UseBasicParsing
    
    Write-Host "Extracting Python Runtime..."
    Expand-Archive -Path $pyZip -DestinationPath $pythonEmbedDir -Force
    Remove-Item $pyZip -Force -ErrorAction SilentlyContinue

    # Configure ._pth
    $pth = Get-ChildItem $pythonEmbedDir -Filter "*._pth" | Select-Object -First 1
    if ($pth) {
        (Get-Content $pth.FullName) -replace '#import site', 'import site' | Set-Content $pth.FullName
        Add-Content $pth.FullName "Lib/site-packages"
    }

    # Install pip
    Write-Host "Bootstrapping pip..."
    $getPip = Join-Path $env:TEMP "get-pip.py"
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip -UseBasicParsing
    & $pythonExe $getPip --no-warn-script-location
    Remove-Item $getPip -Force -ErrorAction SilentlyContinue
}

# 2. Download standalone Node.js
$nodeExe = Join-Path $pythonEmbedDir "node.exe"
if (-not (Test-Path $nodeExe)) {
    Write-Host "[2/3] Downloading Node.js Runtime (~30MB)..."
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/win-x64/node.exe" -OutFile $nodeExe -UseBasicParsing
}

# 3. Install Python Dependencies
$reqFile = Join-Path $appDir "requirements.txt"
if (Test-Path $reqFile) {
    Write-Host "[3/3] Installing Python Dependencies (TikTokLive, aiohttp, etc.)..."
    & $pythonExe -m pip install -r $reqFile --no-warn-script-location
}

Write-Host "All dependencies installed successfully!"
