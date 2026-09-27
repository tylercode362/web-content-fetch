# Proposal: Use Docker-Network Bridge Configuration in WCF

Remove the user-editable Bridge URL and callback settings from Web Content
Fetch. WCF will use the Chrome Bridge and callback service names over the
shared internal Docker network, while the browser reaches WCF only through
Local Gateway.

## Scope

- Remove the Bridge URL input and manual endpoint update behavior from WCF UI.
- Use a fixed Compose service DNS endpoint for Bridge API calls.
- Use the WCF service DNS endpoint for Bridge callbacks.
- Remove WCF's host-published application port.
- Join the existing `local-gateway-chrome-bridge` integration network for
  Gateway ingress, Bridge API and callback traffic.
- Stop requiring deployment-specific host IPs for callback origins.

## Out of scope

- Changing the Chrome Bridge Extension's independent, user-editable API URL.
- Exposing WCF or Bridge application ports on the host.
- Changing pairing, queue, or EPUB behavior.
- Adding a callback host allowlist or another product-specific Docker network.
