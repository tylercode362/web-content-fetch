# WCF Network Endpoints

## MODIFIED Requirements

### Requirement: WCF uses fixed internal Bridge and callback endpoints
WCF SHALL use Compose service DNS for Bridge requests and callbacks, and SHALL
NOT ask the user to provide either endpoint.

#### Scenario: User opens WCF connection settings
- **WHEN** the WCF settings UI is displayed
- **THEN** it SHALL NOT show an editable Bridge URL or callback URL
- **AND** it SHALL show only user-relevant binding and Extension status

#### Scenario: WCF executes a Bridge task
- **WHEN** WCF submits a Bridge request
- **THEN** it SHALL connect to `nas-bridge:8788` over the internal Docker
  network
- **AND** callback delivery SHALL target
  `web-content-fetch:8092/api/bridge/callback` over that network
- **AND** the callback endpoint SHALL NOT depend on the browser's Gateway
  hostname or a hardcoded LAN IP
- **AND** callback authentication SHALL use `Authorization: Bearer` while
  accepting the former callback-token header only for migration compatibility

#### Scenario: Browser opens WCF
- **WHEN** a browser accesses the WCF UI or API
- **THEN** it SHALL do so through Local Gateway
- **AND** WCF SHALL NOT publish its application port on the host
- **AND** Gateway, WCF and Chrome Bridge SHALL share
  `local-gateway-chrome-bridge` rather than a second WCF proxy network

#### Scenario: Existing saved configuration contains a Bridge URL
- **WHEN** WCF migrates its saved configuration to fixed service DNS
- **THEN** it SHALL preserve the existing service UUID, Extension UUID,
  credential, and binding identity
- **AND** it SHALL NOT expose the migrated internal endpoint in public state
