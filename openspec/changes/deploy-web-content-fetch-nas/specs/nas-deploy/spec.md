# WCF NAS deployment

## ADDED Requirements

### Requirement: Use the NAS Bridge network
The NAS overlay SHALL connect WCF to local-gateway-chrome-bridge and use
nas-bridge:8788 as the in-network Bridge endpoint. WCF callback delivery SHALL
use the WCF service name on that shared network.

#### Scenario: WCF reaches NAS Bridge
- WHEN WCF is deployed after the Local Gateway and Chrome Bridge networks exist
- THEN the WCF container can resolve and connect to nas-bridge:8788
- AND the Chrome Bridge container can resolve web-content-fetch:8092

### Requirement: Accept the Gateway callback URL
WCF SHALL accept the exact Gateway-prefixed callback path and normalize it to
the configured in-network callback endpoint before saving or sending it to
Chrome Bridge.

#### Scenario: Save the NAS Gateway callback URL
- WHEN the operator saves http://<allowed-gateway-host>:8088/web-content-fetch/api/bridge/callback
- THEN WCF stores and sends http://web-content-fetch:8092/api/bridge/callback
- AND arbitrary callback paths or unconfigured gateway hosts are rejected

### Requirement: Preserve private deployment data
The deployment script SHALL exclude .env, secrets, exports, EPUB files and Git
metadata from the uploaded archive, SHALL preserve the remote named volumes,
and SHALL preserve an existing NAS .env. For a first deployment it MAY transfer
the ignored local .env only when the operator explicitly supplies
-InitializeRemoteConfig.

#### Scenario: Private files stay on NAS
- WHEN the deployment archive is created
- THEN .env, secrets, exports, EPUB files and Git metadata are absent
- AND the remote named volumes are not removed

#### Scenario: Explicit first-deployment configuration
- WHEN the remote project has no .env and the operator supplies
  -InitializeRemoteConfig with a local ignored .env
- THEN the local .env is transferred outside the source archive
- AND the staged config uses nas-bridge:8788 and the web-content-fetch callback host
- AND the staged config allows only the configured NAS Gateway callback origin
- AND the staged project receives it with owner-only permissions

#### Scenario: Missing configuration fails closed
- WHEN the remote project has no .env and -InitializeRemoteConfig is not supplied
- THEN deployment stops before the service cutover
- AND no existing service or named volume is removed

### Requirement: Bounded verification
The deployment script SHALL verify WCF /healthz and the Gateway-proxied
/web-content-fetch/healthz before reporting success.

#### Scenario: Health checks pass before success
- WHEN the deployment command reports success
- THEN both bounded health checks have returned a successful response
