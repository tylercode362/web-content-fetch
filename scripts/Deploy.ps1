<#
.SYNOPSIS
  以固定 Compose 專案可重複部署 web-content-fetch。

.DESCRIPTION
  預設只執行 Compose 設定驗證並顯示部署目標。只有指定
  -ConfirmDeploy 才會 build、啟動固定的 web-content-fetch service，並等待
  容器內的 healthz 通過。腳本不讀取 secrets、不管理遠端主機、不刪除
  named volume，也不執行全域 Docker cleanup。

.EXAMPLE
  .\scripts\Deploy.ps1

.EXAMPLE
  .\scripts\Deploy.ps1 -ConfirmDeploy

.EXAMPLE
  .\scripts\Deploy.ps1 -ConfirmDeploy -SkipBuild -SkipTests
#>
[CmdletBinding()]
param(
  [ValidateRange(30, 900)]
  [int]$HealthTimeoutSeconds = 180,

  [switch]$SkipBuild,
  [switch]$SkipTests,
  [switch]$ConfirmDeploy
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string]$Message) {
  throw "Web Content Fetch 部署停止：$Message"
}

function Invoke-CheckedDocker {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "Docker 命令失敗：docker $($Arguments -join ' ')"
  }
}

$localRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $localRoot
$composeArguments = @('compose', '--project-directory', $localRoot, '-f', (Join-Path $localRoot 'compose.yaml'))
$service = 'web-content-fetch'

Invoke-CheckedDocker ($composeArguments + @('config', '--quiet'))
Write-Host 'Compose 設定驗證通過。' -ForegroundColor Green
Write-Host ("目標：{0}；服務：{1}；健康檢查逾時：{2} 秒" -f $localRoot, $service, $HealthTimeoutSeconds)

if (-not $ConfirmDeploy) {
  Write-Host '這是部署預覽；請加上 -ConfirmDeploy 才會 build 或啟動服務。' -ForegroundColor Yellow
  return
}

if (-not $SkipBuild) {
  Write-Host '建立 web-content-fetch 映像。' -ForegroundColor Cyan
  Invoke-CheckedDocker ($composeArguments + @('build', $service))
} else {
  Write-Host '略過映像建立。' -ForegroundColor Yellow
}

if (-not $SkipTests) {
  Write-Host '執行容器內測試。' -ForegroundColor Cyan
  Invoke-CheckedDocker ($composeArguments + @('run', '--rm', '--no-deps', '--entrypoint', 'node', $service, '--test', 'test/epub-writer.test.js', 'test/job-orchestrator.test.js', 'test/job-view.test.js'))
} else {
  Write-Host '略過測試。' -ForegroundColor Yellow
}

Write-Host '啟動 web-content-fetch service。' -ForegroundColor Cyan
Invoke-CheckedDocker ($composeArguments + @('up', '-d', $service))

$deadline = (Get-Date).ToUniversalTime().AddSeconds($HealthTimeoutSeconds)
$healthy = $false
while ((Get-Date).ToUniversalTime() -lt $deadline) {
  try {
    & docker @($composeArguments + @('exec', '-T', $service, 'node', '-e', "fetch('http://127.0.0.1:8092/healthz').then(response=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"))
    if ($LASTEXITCODE -eq 0) {
      $healthy = $true
      break
    }
  } catch {
    # Container startup can fail before exec is available; keep polling until the bounded deadline.
  }
  Start-Sleep -Seconds 2
}

if (-not $healthy) {
  Write-Host '健康檢查逾時；保留現場供診斷，不執行清理。' -ForegroundColor Yellow
  & docker @($composeArguments + @('ps', $service))
  Fail "web-content-fetch healthz 未在 $HealthTimeoutSeconds 秒內通過。"
}

Write-Host 'Web Content Fetch 部署完成，healthz 通過。' -ForegroundColor Green
Invoke-CheckedDocker ($composeArguments + @('ps', $service))
