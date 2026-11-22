# Đảo Đèn Lồng — cài / cập nhật trên VPS Windows, không cần Docker.
# Chạy được từ PowerShell 4.0 (Windows Server 2012 R2 / 2008 R2 + WMF 4) tới PowerShell 5.1 (Server 2016+).
#
# Mở PowerShell bằng "Run as Administrator":
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   .\install.ps1 -Domain game.example.com      # có tên miền (DNS A trỏ về VPS) → HTTPS tự động
#   .\install.ps1                               # chưa có tên miền → http://<IP VPS>
# Chạy lại đúng lệnh đó để cập nhật code mới nhất của nhánh (dữ liệu trong C:\ddl\data được giữ nguyên).
#
# Phiên bản theo hệ điều hành (Node 18+ và Go 1.21+ cần Windows 10 / Server 2016):
#   Server 2016+ (10.0)        → Node 22 LTS mới nhất, Caddy mới nhất
#   Server 2012 R2 / cũ hơn    → Node 16.20.2, Caddy 2.6.4 (bản cuối build bằng Go 1.20). Đã thử: server game chạy đúng trên Node 16.
#
# Cài gì:
#   C:\ddl\node   Node.js portable (zip chính thức từ nodejs.org)
#   C:\ddl\app    code game (zip của nhánh từ GitHub, bỏ android-app/ và docs/) + npm ci --omit=dev
#   C:\ddl\data   leaderboard.json, shop.json (lưu bằng file, không cần PostgreSQL)
#   C:\ddl\caddy  Caddy (reverse proxy, HTTPS Let's Encrypt), Windows service "caddy"
#   Tác vụ "DaoDenLong" (schtasks): chạy game lúc khởi động máy bằng SYSTEM, tự chạy lại khi lỗi
#   Firewall (netsh): mở 80, 443. Cổng game 5173 KHÔNG mở ra ngoài (chỉ Caddy gọi tới).
param(
  [string]$Domain = '',
  [string]$Branch = 'feature/boss-android',
  [string]$Repo = 'MaiVanThanhDev/K5-L3A-LAB-Day12-MaiVanThanh-2A202603696-AI-SDLC-Dao-Den-Long',
  [string]$Root = 'C:\ddl',
  [int]$GamePort = 5173,
  [string]$NodeVersion = '',    # e.g. v16.20.2; empty = chosen from the Windows version
  [string]$CaddyVersion = ''    # e.g. 2.6.4;   empty = chosen from the Windows version
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is very slow with the progress bar on PS 4/5
function Step($m) { Write-Host "==> $m" -ForegroundColor Yellow }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Hãy mở PowerShell bằng "Run as Administrator" rồi chạy lại.' }
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 }
catch { throw 'Máy thiếu TLS 1.2 trong .NET (cần .NET Framework 4.5 trở lên, nên cài 4.8) - không tải được từ GitHub/nodejs.org.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem   # .NET 4.5: unzip without Expand-Archive (PS 5+ only)

$os = [Environment]::OSVersion.Version
$modern = $os.Major -ge 10
if (-not $NodeVersion) { $NodeVersion = if ($modern) { 'latest-22' } else { 'v16.20.2' } }
if (-not $CaddyVersion) { $CaddyVersion = if ($modern) { 'latest' } else { '2.6.4' } }
Step "Windows $os · PowerShell $($PSVersionTable.PSVersion) · Node $NodeVersion · Caddy $CaddyVersion"

foreach ($d in 'node', 'data', 'caddy', 'logs', 'tmp') { New-Item -ItemType Directory -Force (Join-Path $Root $d) | Out-Null }
$tmp = Join-Path $Root 'tmp'
$nodeExe = Join-Path $Root 'node\node.exe'

function Get-File($url, $out) { Invoke-WebRequest $url -OutFile $out -UseBasicParsing }
function Expand-Zip($zip, $dest) {
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $dest)
}

# ---- 1. Node.js (portable) ----
$wantNode = $NodeVersion
if ($NodeVersion -eq 'latest-22') {
  $all = Invoke-RestMethod 'https://nodejs.org/dist/index.json'   # store first, then pipe: PS 4/5 return the JSON array as ONE object
  $wantNode = ($all | Where-Object { $_.version -like 'v22.*' -and $_.lts } | Select-Object -First 1).version
}
$haveNode = if (Test-Path $nodeExe) { (& $nodeExe --version) } else { '' }
if ($haveNode -ne $wantNode) {
  Step "Tải Node.js $wantNode"
  $zip = Join-Path $tmp 'node.zip'
  Get-File "https://nodejs.org/dist/$wantNode/node-$wantNode-win-x64.zip" $zip
  Expand-Zip $zip (Join-Path $tmp 'node')
  Get-WmiObject Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.ExecutablePath -eq $nodeExe } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Remove-Item (Join-Path $Root 'node\*') -Recurse -Force
  Copy-Item (Join-Path $tmp "node\node-$wantNode-win-x64\*") (Join-Path $Root 'node') -Recurse -Force
}
Step "Node $(& $nodeExe --version)"

# ---- 2. stop the running game (update) ----
$task = 'DaoDenLong'
# via cmd: on PS 4/5 a native command's stderr (task not found yet) becomes a terminating error under 'Stop'
& cmd.exe /c "schtasks.exe /End /TN $task >nul 2>&1"
Get-WmiObject Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.ExecutablePath -eq $nodeExe } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# ---- 3. game code from GitHub (zip of the branch) ----
Step "Tải code nhánh $Branch"
$zip = Join-Path $tmp 'app.zip'
Get-File "https://github.com/$Repo/archive/refs/heads/$Branch.zip" $zip
# drop the zip's top folder and what the server never uses (android-app/, docs/): keeps paths short (260-char limit)
$app = Join-Path $Root 'app'
if (Test-Path $app) { Remove-Item $app -Recurse -Force }
$z = [IO.Compression.ZipFile]::OpenRead($zip)
try {
  foreach ($e in $z.Entries) {
    $rel = $e.FullName.Substring($e.FullName.IndexOf('/') + 1)
    if (-not $rel -or $rel -match '^(android-app|docs)/') { continue }
    $dest = Join-Path $app ($rel -replace '/', '\')
    if ($rel.EndsWith('/')) { New-Item -ItemType Directory -Force $dest | Out-Null; continue }
    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
  }
} finally { $z.Dispose() }
Step 'npm ci --omit=dev'
Push-Location $app
$env:Path = (Join-Path $Root 'node') + ';' + $env:Path
& (Join-Path $Root 'node\npm.cmd') ci --omit=dev --no-audit --no-fund
$npmExit = $LASTEXITCODE
Pop-Location
if ($npmExit -ne 0) { throw 'npm ci thất bại' }

# ---- 4. game as a scheduled task (startup, SYSTEM, restart on failure) ----
Step 'Đăng ký tác vụ chạy game'
$data = Join-Path $Root 'data'; $log = Join-Path $Root 'logs\game.log'
$cmd = Join-Path $Root 'run-game.cmd'
@"
@echo off
rem Generated by install.ps1 - starts the game server (only Caddy is reachable from outside).
set PORT=$GamePort
set LEADERBOARD_FILE=$data\leaderboard.json
set SHOP_FILE=$data\shop.json
cd /d "$app"
"$nodeExe" server.js >> "$log" 2>&1
"@ | Set-Content -Path $cmd -Encoding ASCII
# Task XML (schtasks /XML works on 2008 R2+, unlike Register-ScheduledTask): no time limit, restart every minute on failure.
$xml = Join-Path $tmp 'task.xml'
@"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Dao Den Long game server (install.ps1)</Description></RegistrationInfo>
  <Triggers><BootTrigger><Enabled>true</Enabled></BootTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author"><Exec><Command>cmd.exe</Command><Arguments>/c "$cmd"</Arguments></Exec></Actions>
</Task>
"@ | Set-Content -Path $xml -Encoding Unicode
& schtasks.exe /Create /TN $task /XML $xml /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'schtasks /Create thất bại' }
& schtasks.exe /Run /TN $task | Out-Null

# ---- 5. Caddy (reverse proxy + automatic HTTPS) as a Windows service ----
$caddyExe = Join-Path $Root 'caddy\caddy.exe'
$caddyfile = Join-Path $Root 'caddy\Caddyfile'
$svc = Get-Service caddy -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') { Stop-Service caddy -Force; Start-Sleep -Seconds 2 }
$haveCaddy = if (Test-Path $caddyExe) { (& $caddyExe version) -replace '^v?(\S+).*$', '$1' } else { '' }
$api = 'https://api.github.com/repos/caddyserver/caddy/releases/' + $(if ($CaddyVersion -eq 'latest') { 'latest' } else { "tags/v$CaddyVersion" })
$rel = Invoke-RestMethod $api -Headers @{ 'User-Agent' = 'ddl-install' }
$wantCaddy = $rel.tag_name.TrimStart('v')
if ($haveCaddy -ne $wantCaddy) {
  Step "Tải Caddy $wantCaddy (GitHub release chính thức)"
  $asset = $rel.assets | Where-Object { $_.name -like '*_windows_amd64.zip' } | Select-Object -First 1
  $czip = Join-Path $tmp 'caddy.zip'
  Get-File $asset.browser_download_url $czip
  Expand-Zip $czip (Join-Path $tmp 'caddy')
  Copy-Item (Join-Path $tmp 'caddy\caddy.exe') $caddyExe -Force
}
$site = if ($Domain) { $Domain } else { ':80' }
@"
# Generated by install.ps1. A domain gets an automatic Let's Encrypt certificate; :80 = plain HTTP on the IP.
$site {
	encode gzip
	reverse_proxy 127.0.0.1:$GamePort
}
"@ | Set-Content -Path $caddyfile -Encoding ASCII
& $caddyExe validate --config $caddyfile --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddyfile không hợp lệ' }
if (-not $svc) {
  Step 'Tạo service caddy'
  New-Service -Name caddy -DisplayName 'Caddy (Dao Den Long)' -StartupType Automatic -BinaryPathName ('"{0}" run --config "{1}" --adapter caddyfile' -f $caddyExe, $caddyfile) | Out-Null
  & sc.exe failure caddy reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
}
Start-Service caddy

# ---- 6. firewall: only 80/443 ----
foreach ($p in 80, 443) {
  & netsh.exe advfirewall firewall show rule name="DaoDenLong $p" | Out-Null
  if ($LASTEXITCODE -ne 0) { & netsh.exe advfirewall firewall add rule name="DaoDenLong $p" dir=in action=allow protocol=TCP localport=$p | Out-Null }
}

# ---- 7. check ----
Step 'Kiểm tra'
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  Start-Sleep -Seconds 1
  try { $ok = (Invoke-WebRequest "http://127.0.0.1:$GamePort/api/leaderboard" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { }
}
if (-not $ok) { if (Test-Path $log) { Get-Content $log -Tail 20 }; throw "Game không trả lời ở cổng $GamePort - xem log ở trên ($log)" }
$viaCaddy = $false
try { $viaCaddy = (Invoke-WebRequest 'http://127.0.0.1/' -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } catch { }
$ip = (Get-WmiObject Win32_NetworkAdapterConfiguration -Filter 'IPEnabled = true' | ForEach-Object { $_.IPAddress } | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' -and $_ -notlike '169.254.*' } | Select-Object -First 1)
Write-Host ''
Write-Host 'Đảo Đèn Lồng đã chạy.' -ForegroundColor Green
if ($Domain) { Write-Host "  https://$Domain   (lần đầu Caddy cần ~30 s để lấy chứng chỉ; DNS A phải trỏ về VPS)" }
else { Write-Host "  http://<IP public của VPS>   (IP trong máy: $ip)" }
if (-not $viaCaddy -and -not $Domain) { Write-Host '  Cảnh báo: cổng 80 chưa trả lời qua Caddy - có thể IIS đang chiếm cổng 80 (tắt IIS hoặc dùng cổng khác).' -ForegroundColor Red }
Write-Host "  Log game: $log   ·  Dữ liệu: $data"
Write-Host '  Nhớ mở cổng 80/443 ở tường lửa của nhà cung cấp VPS (security group) nếu có.'
