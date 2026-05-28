# LaptopStore JMeter load test runner (Windows PowerShell)
# Usage (repo root): .\jmeter\scripts\run-load-test.ps1 [-ExportCsv] [-Host localhost] [-Port 5000]

param(
    [switch]$ExportCsv,
    [string]$HostName = "localhost",
    [int]$Port = 0,
  # Duong dan thu muc goc Apache JMeter (co thu muc bin\jmeter.bat)
    [string]$JmeterHome = ""
)

function Resolve-JMeterExecutable {
    param([string]$HomeOverride)

    $candidates = @()
    if ($HomeOverride) {
        $candidates += Join-Path $HomeOverride "bin\jmeter.bat"
    }
    if ($env:JMETER_HOME) {
        $candidates += Join-Path $env:JMETER_HOME "bin\jmeter.bat"
    }
    foreach ($bat in $candidates) {
        if ($bat -and (Test-Path $bat)) { return $bat }
    }

    foreach ($name in @("jmeter.bat", "jmeter")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }

    $searchRoots = @(
        (Join-Path $env:USERPROFILE "Downloads"),
        (Join-Path $env:USERPROFILE "tools"),
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)}
    )
    foreach ($root in $searchRoots) {
        if (-not $root -or -not (Test-Path $root)) { continue }
        $found = Get-ChildItem -Path $root -Filter "jmeter.bat" -Recurse -Depth 4 -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match '\\bin\\jmeter\.bat$' } |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    return $null
}

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $RepoRoot

$JmeterDir = Join-Path $RepoRoot "jmeter"
$CsvPath = Join-Path $JmeterDir "data\variation_ids.csv"
$ResultsDir = Join-Path $JmeterDir "results"
$ReportDir = Join-Path $JmeterDir "report\load"
$JmxPath = Join-Path $JmeterDir "product-list-v2-load.jmx"
$JtlPath = Join-Path $ResultsDir "load.jtl"
$ExportScript = Join-Path $JmeterDir "scripts\export-variation-ids.js"
$EnvFile = Join-Path $RepoRoot "server\.env"

function Get-ServerPort {
    if ($Port -gt 0) { return $Port }
    if (Test-Path $EnvFile) {
        foreach ($line in Get-Content $EnvFile) {
            if ($line -match '^\s*PORT\s*=\s*(\d+)\s*$') {
                return [int]$Matches[1]
            }
        }
    }
    return 5000
}

$EffectivePort = Get-ServerPort

New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$needExport = $ExportCsv -or -not (Test-Path $CsvPath)
if ($needExport) {
    Write-Host "Export variation_ids.csv ..."
    node $ExportScript
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Export CSV thất bại. Kiểm tra server/.env (NEON_DATABASE_URL) và dữ liệu DB."
    }
}

$jmeterExe = Resolve-JMeterExecutable -HomeOverride $JmeterHome
if (-not $jmeterExe) {
    Write-Host ""
    Write-Host "LOI: Khong tim thay Apache JMeter tren may nay." -ForegroundColor Red
    Write-Host "  - JMETER_HOME hien tai: $(if ($env:JMETER_HOME) { $env:JMETER_HOME } else { '(chua dat)' })"
    Write-Host "  - Lenh 'jmeter' / 'jmeter.bat' khong co trong PATH."
    Write-Host ""
    Write-Host "Cach xu ly (chon 1):" -ForegroundColor Yellow
    Write-Host "  1. Tai JMeter 5.6+: https://jmeter.apache.org/download_jmeter.cgi"
    Write-Host "     Giai nen (vd. C:\tools\apache-jmeter-5.6.3)"
    Write-Host "     Chay lai: .\jmeter\scripts\run-load-test.ps1 -JmeterHome C:\tools\apache-jmeter-5.6.3"
    Write-Host "  2. Hoac dat bien:  `$env:JMETER_HOME = 'C:\tools\apache-jmeter-5.6.3'"
    Write-Host "     Them PATH:       `$env:JMETER_HOME\bin"
    Write-Host "  3. Hoac go truc tiep:"
    Write-Host "     & 'C:\tools\apache-jmeter-5.6.3\bin\jmeter.bat' -n -t jmeter\product-list-v2-load.jmx ..."
    Write-Host ""
    exit 1
}
Write-Host "JMeter: $jmeterExe"

Write-Host ""
Write-Host "=== Điều kiện trước khi chạy load test ===" -ForegroundColor Yellow
Write-Host "  1. Node server:  cd server; npm run dev   (PORT=$EffectivePort)"
Write-Host "  2. Flask reco:   cd recommendation_service; python app.py  (RECO_API_BASE mặc định http://127.0.0.1:8000)"
Write-Host "  3. CSV:          $CsvPath"
Write-Host ""

Write-Host "Chạy JMeter (non-GUI) ..."
Set-Location $JmeterDir
& $jmeterExe -n -t "product-list-v2-load.jmx" `
    -JHOST=$HostName -JPORT=$EffectivePort `
    -l "results\load.jtl" -e -o "report\load"

if ($LASTEXITCODE -ne 0) {
    Set-Location $RepoRoot
    exit $LASTEXITCODE
}

Set-Location $RepoRoot
Write-Host ""
Write-Host "Hoàn tất. JTL: jmeter/results/load.jtl" -ForegroundColor Green
Write-Host "HTML report: jmeter/report/load/index.html" -ForegroundColor Green
