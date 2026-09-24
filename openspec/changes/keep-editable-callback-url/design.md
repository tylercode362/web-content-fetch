# Design

The browser does not ask for, display, or submit a callback URL. The page may
be reached at the local root or through the Gateway prefix; neither browser
address is assumed to be reachable from Chrome Bridge.

The URL sent in Chrome Bridge content requests is a separate delivery
address. The explicit WEB_CONTENT_FETCH_CALLBACK_URL deployment setting takes
precedence over any persisted legacy value. NAS deployment sets the Docker
service URL; local Compose sets host.docker.internal. The delivery address is
validated on startup. Loopback page addresses
are never passed to a Docker Bridge as delivery addresses.

Saving Bridge settings does not send a callback override. Legacy clients that
submit an equivalent callback URL are accepted; a different destination is
rejected before any settings are changed. The WCF receiver remains
/api/bridge/callback, reached directly within the Docker network.

Bridge Server URL is separate from callback routing. Pairing, regular
authenticated requests, and cancellation must all use the binding's
`bridgeUrl` as the Bridge client's base URL. The client also accepts
`baseUrl` for direct callers; it may use its default only when neither is
provided. It must not rewrite a user-supplied Gateway URL to an internal DNS
name.
