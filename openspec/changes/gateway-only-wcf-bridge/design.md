# Design: WCF Docker-Network Bridge Endpoints

WCF owns one canonical Bridge service endpoint (`http://nas-bridge:8788`) on
the shared internal `local-gateway-chrome-bridge` network, and one canonical
callback endpoint (`http://web-content-fetch:8092/api/bridge/callback`). The
Callback URL is no longer selected from the browser-visible WCF page origin or
from a manually entered Bridge URL. Chrome Bridge validates this as an
internal Compose service URL; deployment does not maintain a callback host
allowlist.

The WCF container joins only `local-gateway-chrome-bridge` for Gateway ingress,
Bridge API and callback traffic. The internal network is owned by Local
Gateway; WCF publishes no host port. The Local Gateway container
serves the WCF UI/API and preserves its existing subpath cookie, CSRF, SSE,
download, and Origin rewriting behavior.

Persisted legacy Bridge URLs are normalized to the canonical service endpoint
without rotating service or browser UUIDs, service credentials, or binding
identity. The public WCF state and job UI do not reveal Docker-internal URLs.

WCF health checks run from inside the container. Browser-facing health checks
must use the Local Gateway route; deployments must not rely on `127.0.0.1:8092`
being published on the host.

Chrome Bridge sends callback credentials as `Authorization: Bearer`. WCF
accepts that canonical header and temporarily accepts the former
`x-bridge-callback-token` header so an in-flight request from an older Bridge
can finish without losing checkpoint progress.
