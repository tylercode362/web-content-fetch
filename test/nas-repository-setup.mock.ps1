param(
  [Parameter(Mandatory=$true)][string]$ModulePath,
  [string]$DeployPath = (Join-Path $PSScriptRoot '../scripts/Deploy-Nas.ps1')
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
Import-Module -Name $ModulePath -Force
$module = Get-Module Repository-DeploySetup
$quoted = & $module { ConvertTo-NasProcessArgument 'C:\NAS Identity\ssh key' }
if ($quoted -ne '"C:\NAS Identity\ssh key"') { throw "Identity argument quoting failed: $quoted" }
if ((Get-Command Initialize-NasRepositoryHostPin).Parameters.ContainsKey('Repository')) {
  throw 'Host-pin contract unexpectedly accepts Repository; review the strict binding test.'
}

# Parse the real entry point and execute its actual preflight assignments/calls.
# Do not construct alternate argument maps or remove unsupported parameters here.
$tokens=$null; $parseErrors=$null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($DeployPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw "Deployment script parse errors: $parseErrors" }
$first = @($ast.EndBlock.Statements | Where-Object {
  $_ -is [System.Management.Automation.Language.AssignmentStatementAst] -and
  $_.Left.Extent.Text -eq '$repositoryHostSetup'
})
$last = @($ast.FindAll({ param($node)
  $node -is [System.Management.Automation.Language.CommandAst] -and
  $node.GetCommandName() -eq 'Invoke-NasRepositorySetup'
}, $false))
if ($first.Count -ne 1 -or $last.Count -ne 1) { throw 'Expected one deployment preflight entry.' }
$source = [IO.File]::ReadAllText($DeployPath)
# Exercise the real missing-module guard without importing an alternate module.
$moduleStart = @($ast.EndBlock.Statements | Where-Object {
  $_ -is [System.Management.Automation.Language.AssignmentStatementAst] -and
  $_.Left.Extent.Text -eq '$modulePath'
})
$import = @($ast.FindAll({ param($node)
  $node -is [System.Management.Automation.Language.CommandAst] -and
  $node.GetCommandName() -eq 'Import-Module'
}, $false))
if ($moduleStart.Count -ne 1 -or $import.Count -ne 1) { throw 'Expected one module guard/import.' }
$moduleGuard = [scriptblock]::Create($source.Substring($moduleStart[0].Extent.StartOffset,
  $import[0].Extent.StartOffset - $moduleStart[0].Extent.StartOffset))
$RepositorySetupModule = Join-Path ([IO.Path]::GetTempPath()) ('wcf-missing-' + [Guid]::NewGuid().ToString('N') + '.psm1')
function Fail([string]$Message) { throw $Message }
$missingModuleError=$null
try { & $moduleGuard } catch { $missingModuleError=$_ }
if ($null -eq $missingModuleError -or $missingModuleError.Exception.Message -notmatch 'Shared repository setup module is missing') {
  throw 'Missing module did not fail at the actual entry-point guard.'
}
$preflight = [scriptblock]::Create($source.Substring($first[0].Extent.StartOffset,
  $last[0].Extent.EndOffset - $first[0].Extent.StartOffset))
$state = @{ Commands=[System.Collections.Generic.List[string]]::new(); Scenario='verified' }
$runRemote = {
  param([hashtable]$Transport, [string]$Command)
  if ($Transport.Project -cne 'web-content-fetch' -or $Transport.NasHost -cne 'nas.test') {
    throw 'Unexpected transport target.'
  }
  $state.Commands.Add($Command)
  if ($Command -match "'host-status'$") {
    if ($state.Scenario -eq 'missing-host') { return @{ExitCode=0;Output='{"ok":false,"status":"host_key_missing"}'} }
    if ($state.Scenario -eq 'mismatch-host') { return @{ExitCode=0;Output='{"ok":true,"status":"host_key_pinned","fingerprint":"SHA256:wrong"}'} }
    return @{ExitCode=0;Output='{"ok":true,"status":"host_key_pinned","fingerprint":"SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"}'}
  }
  if ($Command -match "'ensure-check' 'web-content-fetch' 'tylercode362/web-content-fetch'$") {
    if ($state.Scenario -eq 'missing-key') { return @{ExitCode=0;Output='{"ok":false,"status":"not_configured"}'} }
    return @{ExitCode=0;Output='{"ok":true,"status":"read_access_verified","project":"web-content-fetch","repository":"tylercode362/web-content-fetch","sha":"0123456789012345678901234567890123456789"}'}
  }
  throw "Unexpected remote command: $Command"
}.GetNewClosure()
# Replace the only transport boundary inside the imported module. No process,
# SSH, GitHub, NAS, key generation, or updater execution can occur in this test.
& $module { param($Fake) Set-Item Function:script:Invoke-NasRepositoryRemote -Value $Fake } $runRemote
$NasHost='nas.test'; $NasUser='operator'; $NasPort=34
$IdentityFile='C:\NAS Identity\ssh key'; $NasPassword=$null; $UseSudo=$false
$DockerPath='/usr/local/bin/docker'; $ComposePath='/usr/local/bin/docker-compose'
$ComposePlugin=$false; $RepositoryNonInteractive=$true
& $preflight
if ($state.Commands.Count -ne 2) { throw "Expected two synthetic calls; got $($state.Commands.Count)" }
if ($state.Commands[0] -notmatch "'host-status'$" -or
    $state.Commands[1] -notmatch "'ensure-check' 'web-content-fetch' 'tylercode362/web-content-fetch'$") {
  throw 'Wrong command order or repository binding.'
}
foreach ($scenario in @('missing-host','mismatch-host','missing-key')) {
  $state.Scenario=$scenario; $state.Commands.Clear(); $caught=$null
  try { & $preflight } catch { $caught=$_ }
  if ($null -eq $caught) { throw "Expected fail-closed rejection for $scenario" }
  if ($scenario -eq 'missing-host' -and
      ($state.Commands.Count -ne 1 -or $caught.Exception.Message -notmatch 'GitHub host pin is missing')) {
    throw 'Missing GitHub.com pin must stop with its diagnostic before repository check.'
  }
  if ($scenario -eq 'mismatch-host' -and
      ($state.Commands.Count -ne 1 -or $caught.Exception.Message -notmatch 'differs from the reviewed pin')) {
    throw 'Mismatched GitHub.com pin must stop before repository check.'
  }
  if ($scenario -eq 'missing-key' -and
      ($state.Commands.Count -ne 2 -or $caught.Exception.Message -notmatch 'Repository key is not configured')) {
    throw 'Missing key must stop after host and read-only checks.'
  }
  if (($state.Commands -join "`n") -match 'setup-confirmed|create-key|pin-host-key-confirmed|poll-once|enable') {
    throw 'Preflight attempted credential creation, trust mutation, or polling.'
  }
}
Write-Output 'PASS actual deployment preflight strict binding and mocked repository cases'
