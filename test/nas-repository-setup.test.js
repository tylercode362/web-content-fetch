const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts', 'Deploy-Nas.ps1'), 'utf8');

test('WCF preflights fixed repository before deployment side effects and never activates polling', () => {
  assert.match(source, /\$repositorySetup\.Repository\s*=\s*'tylercode362\/web-content-fetch'/);
  const hostIndex = source.indexOf('Initialize-NasRepositoryHostPin @repositoryHostSetup');
  const repoIndex = source.indexOf('Invoke-NasRepositorySetup @repositorySetup');
  assert.ok(hostIndex >= 0 && repoIndex > hostIndex);
  assert.ok(repoIndex < source.indexOf("Invoke-CheckedNative -File 'docker'"));
  assert.doesNotMatch(source, /poll-once|updater.*enable/i);
});

test('actual host-pin argument map excludes repository and uses only supported fields', () => {
  const match = source.match(/\$repositoryHostSetup\s*=\s*@\{([^}]+)\}/);
  assert.ok(match, 'Explicit host-pin parameter map is required');
  const keys = [...match[1].matchAll(/^\s*(\w+)\s*=/gm)].map((entry) => entry[1]).sort();
  assert.deepEqual(keys, ['Project', 'NasHost', 'NasUser', 'NasPort', 'IdentityFile', 'NasPassword', 'UseSudo', 'DockerPath', 'ComposePath', 'ComposePlugin', 'NonInteractive'].sort());
  assert.match(match[1], /Project\s*=\s*'web-content-fetch'/);
  assert.match(source, /Initialize-NasRepositoryHostPin @repositoryHostSetup -AllowMissingUpdater -AllowRepositorySetupSkip[ \t]*\r?\n\$repositorySetup = \$repositoryHostSetup\.Clone\(\)[ \t]*\r?\n\$repositorySetup\.Repository = 'tylercode362\/web-content-fetch'[ \t]*\r?\nInvoke-NasRepositorySetup @repositorySetup -AllowMissingUpdater -AllowRepositorySetupSkip[ \t]*\r?\n/);
  const mock = fs.readFileSync(path.join(__dirname, 'nas-repository-setup.mock.ps1'), 'utf8');
  assert.doesNotMatch(mock, /\.Remove\(['"]Repository['"]\)/);
  assert.match(mock, /Parser\]::ParseFile\(\$DeployPath/);
});

const modulePath = process.env.WCF_REPOSITORY_SETUP_MODULE;
const powershell = process.env.WCF_POWERSHELL || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
const probe = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8', timeout: 10000 });
const missingRuntime = probe.error?.code === 'ENOENT';
test('actual deployment preflight and shared module mock cases', { skip: missingRuntime ? 'PowerShell runtime unavailable' : false }, () => {
  assert.equal(probe.status, 0, `${probe.stdout}\n${probe.stderr}`);
  assert.ok(modulePath && fs.existsSync(modulePath), 'Set WCF_REPOSITORY_SETUP_MODULE to the reviewed shared module path');
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'nas-repository-setup.mock.ps1'), '-ModulePath', modulePath], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS actual deployment preflight strict binding and mocked repository cases/);
});

test('strict binding rejects the original unsupported Repository argument regression', { skip: missingRuntime ? 'PowerShell runtime unavailable' : false }, () => {
  assert.ok(modulePath && fs.existsSync(modulePath), 'Reviewed shared module is required');
  const temporary = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'wcf-binding-mutation-'));
  try {
    const mutatedPath = path.join(temporary, 'Deploy-Nas.ps1');
    fs.writeFileSync(mutatedPath, source.replace('$repositoryHostSetup = @{', "$repositoryHostSetup = @{\n  Repository = 'tylercode362/web-content-fetch'"));
    const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'nas-repository-setup.mock.ps1'), '-ModulePath', modulePath, '-DeployPath', mutatedPath], { encoding: 'utf8', timeout: 30000 });
    assert.notEqual(result.status, 0, 'Unsupported host-pin parameter must be rejected');
    assert.match(`${result.stdout}\n${result.stderr}`, /parameter.*Repository/s);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
