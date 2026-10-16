[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$OfficialProfile,
  [Parameter(Mandatory)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
# https://raw.githubusercontent.com/microsoft/playwright/v1.64.0/utils/docker/seccomp_profile.json
$expected = 'CC3E61CABDA6BBC1E53E54D27BA4D55A9D3BE829B6DD1A596F4A7B31B1CC7849'
if ((Get-FileHash -LiteralPath $OfficialProfile -Algorithm SHA256).Hash -ne $expected) { throw 'Unexpected official Playwright profile' }
if (Test-Path -LiteralPath $OutputPath) { throw 'OutputPath already exists' }
$profile = Get-Content -LiteralPath $OfficialProfile -Raw | ConvertFrom-Json
if ($profile.defaultAction -ne 'SCMP_ACT_ERRNO') { throw 'Unexpected default seccomp policy' }
# Chromium gains namespace-local capabilities after unshare. Docker otherwise
# removes this syscall rule because the outer container drops CAP_SYS_CHROOT.
$profile.syscalls += [pscustomobject]@{ names = @('chroot'); action = 'SCMP_ACT_ALLOW'; args = @() }
$profile | ConvertTo-Json -Depth 25 | Set-Content -LiteralPath $OutputPath -Encoding utf8
