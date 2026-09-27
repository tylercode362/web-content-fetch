# Tasks

- [x] Remove the Bridge URL input and request/config mutability from WCF UI/API.
- [x] Normalize saved Bridge endpoints to the fixed Docker service DNS without
  rotating persisted binding identity or credentials.
- [x] Make callback validation/resolution use the fixed WCF service DNS only.
- [x] Remove WCF host port publication and attach local/NAS Compose services to
  the shared Local Gateway Chrome Bridge internal network.
- [x] Update local and NAS deploy health checks to avoid host-published WCF
  ports, and require the Gateway integration network to exist before WCF starts.
- [x] Update callback, binding, UI, deploy, and security tests; validate
  Compose, full tests, OpenSpec, formatter, and dependency/privacy gates.
