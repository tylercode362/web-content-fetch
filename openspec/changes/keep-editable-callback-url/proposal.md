# Manage the callback address within the service

## Why

The callback field currently shows a persisted server setting, even when the
page is opened through a different IP, port, or Gateway path. A saved value can
also override the callback address supplied by the active deployment.

## Scope

- Remove callback address controls and details from the browser UI.
- Use the deployment callback endpoint for Bridge delivery, including Docker
  service DNS on NAS and host-gateway routing in local Compose.
- Select a Bridge-reachable callback address from deployment configuration.
- Prevent stale persisted settings and old UI clients from silently changing
  the deployment callback endpoint.
- Make Bridge requests use the exact Bridge Server URL supplied by the user;
  the Bridge client must not silently fall back when given a binding.
- Keep the existing callback protocol, origin, host, and endpoint checks.
