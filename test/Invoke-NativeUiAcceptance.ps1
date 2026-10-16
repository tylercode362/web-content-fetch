[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$WcfImage,
  [Parameter(Mandatory)][string]$BridgeImage,
  [Parameter(Mandatory)][string]$SeccompProfile,
  [Parameter(Mandatory)][string]$EvidenceDirectory,
  [switch]$SeparateConfig,
  [string]$BrowserImage = 'mcr.microsoft.com/playwright@sha256:bc6ab0d6d44ff4826e4cb8c1e6d801e185bfc42bb0753f8e2a30efc70db054c7'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$profilePath = (Resolve-Path -LiteralPath $SeccompProfile).Path
$null = New-Item -ItemType Directory -Path $EvidenceDirectory -Force
$evidence = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
if ($evidence.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'EvidenceDirectory must be outside the repository'
}
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
$name = 'wcf-native-ui-' + $suffix
$image = 'wcf-native-ui:' + $suffix
$fixtures = Join-Path $root 'test/fixtures'
$createdNetwork = $false
$createdService = $false
function Invoke-DockerChecked {
  param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed ($LASTEXITCODE): $($Arguments[0])" }
}
try {
  Invoke-DockerChecked @('build', '--file', (Join-Path $root 'test/Dockerfile.native-ui'), '--build-arg', "WCF_IMAGE=$WcfImage", '--build-arg', "BRIDGE_IMAGE=$BridgeImage", '--tag', $image, $root)
  Invoke-DockerChecked @('network', 'create', '--internal', '--label', "codex.native-ui=$suffix", $name)
  $createdNetwork = $true
  Invoke-DockerChecked @('run', '--detach', '--name', $name, '--label', "codex.native-ui=$suffix", '--network', $name,
    '--add-host', 'nas-bridge:127.0.0.1', '--add-host', 'web-content-fetch:127.0.0.1', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--user', '10001:10001', '--memory', '768m', '--pids-limit', '128',
    '--tmpfs', '/tmp:size=128m,mode=1777', '-e', "UI_ORIGIN=http://${name}:8092", '-e', "UI_SEPARATE_CONFIG=$([int]$SeparateConfig.IsPresent)",
    '--mount', "type=bind,source=$fixtures,target=/fixtures,readonly", '--entrypoint', 'node', $image, '/fixtures/native-ui-service.cjs')
  $createdService = $true
  Invoke-DockerChecked @('run', '--rm', '--network', $name, '--read-only', '--user', 'pwuser', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--security-opt', "seccomp=$profilePath", '--memory', '1g', '--pids-limit', '256',
    '--shm-size', '256m', '--tmpfs', '/tmp:size=256m,mode=1777', '-e', 'HOME=/tmp', '-e', 'XDG_CONFIG_HOME=/tmp/config',
    '-e', 'XDG_CACHE_HOME=/tmp/cache', '-e', 'CHROME_PATH=/ms-playwright/chromium-1243/chrome-linux64/chrome',
    '-e', "UI_URL=http://${name}:8092", '-e', "UI_CONTROL_URL=http://${name}:8790",
    '--mount', "type=bind,source=$fixtures,target=/fixtures,readonly", '--entrypoint', 'node', $BrowserImage,
    '/fixtures/native-ui-browser.cjs') *>&1 | Tee-Object -FilePath (Join-Path $evidence 'native-ui.log')
} finally {
  if ($createdService) {
    & docker logs $name *>&1 | Set-Content (Join-Path $evidence 'native-ui-service.log')
    $label = & docker inspect --format '{{index .Config.Labels "codex.native-ui"}}' $name
    if ($label -eq $suffix) { Invoke-DockerChecked @('stop', $name); Invoke-DockerChecked @('rm', $name) }
  }
  if ($createdNetwork) {
    $label = & docker network inspect --format '{{index .Labels "codex.native-ui"}}' $name
    if ($label -eq $suffix) { Invoke-DockerChecked @('network', 'rm', $name) }
  }
}
