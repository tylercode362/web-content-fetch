<#
.SYNOPSIS
  將目前 web-content-fetch 工作目錄部署到 Synology NAS。

.DESCRIPTION
  這是 WCF 專用的 NAS 部署入口。預設只驗證 Compose 並顯示目標；
  只有指定 -ConfirmDeploy 才會建立 staging、保留設定 recovery 資料、建置並替換
  web-content-fetch。預設不會上傳 .env；首次部署可另外指定
  -InitializeRemoteConfig，明確傳送被忽略的本機 .env 到遠端 staging。
  腳本不會上傳 exports、EPUB、Secrets 或 Git 資料，也不會刪除 named volume。

  WCF 僅透過 Local Gateway 管理的 internal Docker networks 存取，
  Bridge 與 callback 使用固定的 Compose service DNS，不需要 .env URL 設定。

.EXAMPLE
  .\scripts\Deploy-Nas.ps1 -NasHost '<NAS 區網主機名或 IP>'

.EXAMPLE
  .\scripts\Deploy-Nas.ps1 -NasHost '<NAS 區網主機名或 IP>' -UseSudo -ConfirmDeploy

.EXAMPLE
  .\scripts\Deploy-Nas.ps1 -NasHost '<NAS 區網主機名或 IP>' -UseSudo `
    -InitializeRemoteConfig -ConfirmDeploy
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^(?!-)[A-Za-z0-9._-]+$')]
  [string]$NasHost,

  [ValidatePattern('^(?!-)[A-Za-z0-9._-]+$')]
  [string]$NasUser = 'admin',

  [ValidateRange(1, 65535)]
  [int]$NasPort = 34,

  [ValidatePattern('^/[A-Za-z0-9._/-]+$')]
  [string]$DockerPath = '/usr/local/bin/docker',

  [ValidatePattern('^/[A-Za-z0-9._/-]+$')]
  [string]$ComposePath = '/usr/local/bin/docker-compose',

  [switch]$ComposePlugin,

  [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh\synology_925'),

  [Security.SecureString]$NasPassword,

  [ValidatePattern('^/volume1/docker$')]
  [string]$RemoteRoot = '/volume1/docker',

  [ValidatePattern('^(?!-)[A-Za-z0-9._-]+$')]
  [string]$ProjectName = 'web-content-fetch',

  [ValidatePattern('^(?!-)[A-Za-z0-9._-]+$')]
  [string]$ComposeProject = 'web-content-fetch',

  [ValidateRange(30, 900)]
  [int]$HealthTimeoutSeconds = 180,

  [switch]$UseSudo,
  [switch]$InitializeRemoteConfig,
  [switch]$SkipLocalComposeValidation,
  [switch]$KeepStaging,
  [switch]$ConfirmDeploy
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$Message) {
  throw "WCF NAS 部署停止：$Message"
}

function Get-NasPassword {
  if ($null -ne $NasPassword) {
    if ($NasPassword.Length -eq 0) { Fail 'NAS sudo 密碼不可為空白。' }
    return $NasPassword
  }
  $value = Read-Host 'NAS sudo 密碼' -AsSecureString
  if ($value.Length -eq 0) { Fail 'NAS sudo 密碼不可為空白。' }
  return $value
}

function ConvertFrom-SecureInput {
  param([Parameter(Mandatory = $true)][Security.SecureString]$Value)
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Assert-NasSudo {
  $plain = ConvertFrom-SecureInput (Get-NasPassword)
  $sshArguments = @(
    # Synology sudo requires a PTY; disable echo before feeding stdin so the
    # password is accepted without appearing in the PowerShell terminal.
    '-tt', '-i', $IdentityFile, '-p', $NasPort.ToString(),
    '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new',
    ("{0}@{1}" -f $NasUser, $NasHost), "stty -echo; trap 'stty echo 2>/dev/null || true' 0; sudo -k -S -p '' -v"
  )
  try {
    $plain | & ssh @sshArguments | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "NAS sudo 密碼驗證失敗（exit code $LASTEXITCODE）。" }
  } finally {
    $plain = $null
  }
  Write-Host 'NAS sudo 密碼驗證完成；後續部署不會再次詢問。' -ForegroundColor Green
}

function Invoke-CheckedNative {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "命令失敗：$File $($Arguments -join ' ')"
  }
}

function Assert-RemotePath([string]$Path, [string]$Root) {
  if ($Path -notmatch '^/[A-Za-z0-9._/-]+$' -or $Path -match '(^|/)\.\.?(/|$)' -or $Path -match '//') {
    Fail "遠端路徑格式不安全：$Path"
  }
  $normalRoot = $Root.TrimEnd('/')
  if (-not ($Path.StartsWith("$normalRoot/", [StringComparison]::Ordinal) -or $Path -eq $normalRoot)) {
    Fail "遠端路徑超出部署根目錄：$Path"
  }
}

function Quote-RemoteArg([string]$Value) {
  if ($Value -notmatch '^[A-Za-z0-9._:/-]+$') {
    Fail "遠端參數格式不安全：$Value"
  }
  return "'$Value'"
}

function Invoke-RemoteDeploy {
  param([Parameter(Mandatory = $true)][string]$Command)
  $sshArguments = @(
    '-i', $IdentityFile,
    '-p', $NasPort.ToString(),
    '-o', 'ConnectTimeout=10',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=4',
    '-o', 'StrictHostKeyChecking=accept-new'
  )
  $requiresSudo = $UseSudo -and $Command.StartsWith('sudo -n ', [StringComparison]::Ordinal)
  if ($requiresSudo) {
    $Command = "stty -echo; trap 'stty echo 2>/dev/null || true' 0; sudo -S -p '' -v && $Command"
    $sshArguments += '-tt'
  } elseif ($UseSudo) {
    $sshArguments += '-tt'
  } else {
    $sshArguments += @('-T', '-o', 'BatchMode=yes')
  }
  $sshArguments += @(("{0}@{1}" -f $NasUser, $NasHost), $Command)
  if ($requiresSudo) {
    $plain = ConvertFrom-SecureInput $NasPassword
    try {
      $plain | & ssh @sshArguments
    } finally {
      $plain = $null
    }
  } else {
    & ssh @sshArguments
  }
  if ($LASTEXITCODE -ne 0) {
    Fail '遠端部署命令失敗；staging 與 recovery 資料會保留供檢查。'
  }
}

$localRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $localRoot

if (-not $ConfirmDeploy) {
  Write-Host '這是 WCF NAS 部署預覽；請加上 -ConfirmDeploy 才會建立 staging、備份並替換服務。' -ForegroundColor Yellow
  Write-Host ("目標：{0}@{1}:{2}/{3}；服務：web-content-fetch" -f $NasUser, $NasHost, $RemoteRoot, $ProjectName)
  return
}

if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
  Fail 'USERPROFILE 不存在，無法解析 SSH identity file。'
}
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) {
  Fail "找不到 SSH identity file：$IdentityFile"
}
$IdentityFile = (Resolve-Path -LiteralPath $IdentityFile).Path
$localConfig = Join-Path $localRoot '.env'
$NasPassword = Get-NasPassword
if ($UseSudo) { Assert-NasSudo }
if ($InitializeRemoteConfig -and -not (Test-Path -LiteralPath $localConfig -PathType Leaf)) {
  Fail '-InitializeRemoteConfig 需要本機被忽略的 .env 檔案。'
}

foreach ($required in @('compose.yaml', 'compose.nas.example.yaml', 'Dockerfile', 'server.js', 'scripts/Deploy-Nas.ps1')) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    Fail "缺少必要檔案：$required"
  }
}

if (-not $SkipLocalComposeValidation) {
  Invoke-CheckedNative -File 'docker' -Arguments @('compose', '-f', 'compose.yaml', 'config', '--quiet')
  Write-Host '本機 Compose 設定驗證通過。' -ForegroundColor Green
}

$runId = "{0}-{1}" -f (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss'), ([Guid]::NewGuid().ToString('N').Substring(0, 8))
$remoteArchive = "/tmp/web-content-fetch-$runId.tar"
$remoteHelper = "/tmp/web-content-fetch-$runId-remote.sh"
$remoteProjectRoot = "$($RemoteRoot.TrimEnd('/'))/$ProjectName"
$remoteStage = "$($RemoteRoot.TrimEnd('/'))/.staging/$ProjectName-$runId"
$remoteBackup = "$($RemoteRoot.TrimEnd('/'))/.backups/$ProjectName-$runId"
$remoteConfig = if ($InitializeRemoteConfig) { "$remoteStage/.env" } else { 'none' }
foreach ($path in @($remoteProjectRoot, $remoteStage, $remoteBackup)) {
  Assert-RemotePath $path $RemoteRoot
}

$archive = Join-Path ([IO.Path]::GetTempPath()) "web-content-fetch-$runId.tar"
$temporaryConfig = $null
$temporaryHelper = Join-Path ([IO.Path]::GetTempPath()) "web-content-fetch-$runId-remote.sh"
$configToUpload = $localConfig
$helperSource = Join-Path $localRoot 'scripts\Deploy-Nas-remote.sh'
$archiveRemote = "{0}@{1}:{2}" -f $NasUser, $NasHost, $remoteArchive
$helperRemote = "{0}@{1}:{2}" -f $NasUser, $NasHost, $remoteHelper
$deployed = $false

try {
  if (-not (Test-Path -LiteralPath $helperSource -PathType Leaf)) {
    Fail "找不到遠端部署 helper：$helperSource"
  }

  $helperContent = [IO.File]::ReadAllText($helperSource).Replace("`r`n", "`n").Replace("`r", "`n")
  [IO.File]::WriteAllText($temporaryHelper, $helperContent, [Text.UTF8Encoding]::new($false))

  if ($InitializeRemoteConfig) {
    $temporaryConfig = Join-Path ([IO.Path]::GetTempPath()) "web-content-fetch-$runId-nas.env"
    Copy-Item -LiteralPath $localConfig -Destination $temporaryConfig
    $configToUpload = $temporaryConfig
    Write-Host '建立 NAS 專用環境設定副本；不修改本機 .env。' -ForegroundColor Cyan
  }

  Write-Host '建立目前工作目錄的部署封裝；排除 Git、.env、exports、EPUB 與本機依賴。' -ForegroundColor Cyan
  Invoke-CheckedNative -File 'tar.exe' -Arguments @(
    '--format=ustar',
    '--exclude=.git',
    '--exclude=.codex',
    '--exclude=node_modules',
    '--exclude=.pnpm-store',
    '--exclude=secrets',
    '--exclude=exports',
    '--exclude=exports/**',
    '--exclude=.env',
    '--exclude=.env.*',
    '--exclude=*.epub',
    '--exclude=*.zip',
    '-cf', $archive,
    '-C', $localRoot,
    '.'
  )
  $archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host "部署封裝 SHA-256：$archiveHash" -ForegroundColor DarkCyan

  Write-Host '上傳部署封裝與遠端 helper；這兩步不需要 sudo。' -ForegroundColor Cyan
  Invoke-CheckedNative -File 'scp' -Arguments @('-O', '-i', $IdentityFile, '-P', $NasPort.ToString(), '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', $archive, $archiveRemote)
  Invoke-CheckedNative -File 'scp' -Arguments @('-O', '-i', $IdentityFile, '-P', $NasPort.ToString(), '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', $temporaryHelper, $helperRemote)

  if ($InitializeRemoteConfig) {
    Invoke-RemoteDeploy "set -eu; mkdir -p '$remoteStage'; chmod 700 '$remoteStage'"
    Invoke-CheckedNative -File 'scp' -Arguments @('-O', '-i', $IdentityFile, '-P', $NasPort.ToString(), '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', $configToUpload, ("{0}@{1}:{2}" -f $NasUser, $NasHost, $remoteConfig))
    Invoke-RemoteDeploy "chmod 600 '$remoteConfig'"
  }

  $composePluginFlag = if ($ComposePlugin) { '1' } else { '0' }
  $keepFlag = if ($KeepStaging) { '1' } else { '0' }
  $remoteArguments = @(
    $remoteArchive, $archiveHash, $RemoteRoot, $ProjectName, $ComposeProject,
    $DockerPath, $ComposePath, $composePluginFlag, $runId, $remoteConfig,
    $HealthTimeoutSeconds, $keepFlag
  ) | ForEach-Object { Quote-RemoteArg $_ }
  $helperInvocation = "/bin/sh $(Quote-RemoteArg $remoteHelper) $($remoteArguments -join ' ')"
  $remoteCommand = if ($UseSudo) {
    "sudo -n $helperInvocation"
  } else {
    $helperInvocation
  }

  if ($UseSudo) {
    Write-Host 'NAS 遠端操作使用部署開始時驗證的 sudo 密碼；後續不會再次詢問。' -ForegroundColor Yellow
  } else {
    Write-Host 'NAS 遠端操作使用目前 SSH 使用者權限。' -ForegroundColor Yellow
  }
  Invoke-RemoteDeploy $remoteCommand
  $deployed = $true
  Write-Host "WCF NAS 部署完成：$remoteProjectRoot" -ForegroundColor Green
} catch {
  Write-Host "部署未完成；遠端 staging/recovery 資料會保留供檢查：$remoteStage" -ForegroundColor Yellow
  throw
} finally {
  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
  if ($temporaryConfig -and (Test-Path -LiteralPath $temporaryConfig)) {
    Remove-Item -LiteralPath $temporaryConfig -Force
  }
  if (Test-Path -LiteralPath $temporaryHelper) {
    Remove-Item -LiteralPath $temporaryHelper -Force
  }
  if (-not $deployed) {
    Write-Host '部署狀態：未完成。未執行全域 Docker 清理，也未刪除遠端 recovery 資料。' -ForegroundColor Yellow
  }
}
