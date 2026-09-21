# Design

工作編排器維持全域有限併行度與 normalized FQDN lock：同一 FQDN 同一時間只能有一個 job，不同 FQDN 可在全域上限內同時執行，每個工作使用獨立 BridgeClient secure session。Bridge 端仍依 browser client 與 FQDN 維持各自的 queue、間隔與資源限制，因此小說、漫畫、Threads、X、YouTube 等不同目標可使用不同 tab 並行；同一 FQDN 不會因 WCF 併行而繞過既有序列化。

## Ownership and identity

```text
web-content-fetch
  BindingStore: bindingId -> bridgeUrl, fingerprint, serviceClientId, credential, browserClientId
  JobStore: job -> bindingId + public bridge/browser/service identity + cancellation state
  Queue/Orchestrator: route every Bridge call through the job's immutable binding

chrome-bridge
  AuthStore: service credential and allowed browser binding
  ContentFetchService: active operation registry keyed by service/browser/operationKey
  Extension: closes only ephemeral tabs owned by the matching content operation
```

`browserClientId` 是 Chrome Extension 的瀏覽器識別；`serviceClientId` 是 WCF UI 在每個瀏覽器第一次載入時以 `crypto.randomUUID()` 產生、放入 localStorage 並固定使用的 service UUID；`bindingId` 是 web-content-fetch 本地 profile key。配對 API 接受這個瀏覽器 UUID，伺服器只在舊版 API 未提供時才產生相容 fallback。工作會同時保存三者，避免只顯示一個含義不清的「Bridge UUID」。

## Multiple bindings

Config canonical shape:

```json
{
  "activeBindingId": "uuid",
  "bindings": [{
    "bindingId": "uuid",
    "bridgeUrl": "http://host.docker.internal:8788",
    "expectedFingerprint": "...",
    "serviceClientId": "uuid",
    "serviceCredential": "redacted-at-boundary",
    "browserClientId": "uuid",
    "createdAt": "...",
    "updatedAt": "..."
  }],
  "callbackUrl": "http://host.docker.internal:8092/api/bridge/callback"
}
```

Pairing without a selected binding creates a fresh profile using the calling browser's fixed service UUID. Existing profiles remain valid, so browser A and browser B can pair to the same Bridge URL or to different URLs. A job receives `bindingId` at creation; changing the active UI profile never reroutes a queued or running job.

The six-digit pairing authorizes the service binding to its selected browser; it does not create a permanent per-site approval list. When a trusted local Extension reports a known additive site capability, Chrome Bridge SHALL synchronize that capability to enabled service bindings for the same browser. Existing service credentials, UUIDs, other browser bindings, and unrelated unknown capabilities remain unchanged; adding a new supported site SHALL NOT require another six-digit pairing.

The loader maps the previous flat `bridgeUrl`, `expectedFingerprint`, `serviceClientId`, `serviceCredential` and `browserClientId` fields to one profile. The public state keeps a top-level active binding projection for old UI/API readers, while exposing `bindings` for the new UI.

## Cancellation flow

```text
UI POST /api/jobs/:id/cancel
  -> JobStore marks queued=cancelled or running=cancelling
  -> AbortController aborts the WCF Bridge request
  -> WCF sends content.cancel(service/browser/operationKey)
  -> Bridge resolves active operation and sends cancelOperation with the lease
  -> Extension rejects pending relay, closes only operation ephemeral tabs
  -> Bridge releases lease; WCF marks job cancelled and emits persisted SSE snapshot
```

Cancellation is idempotent. A terminal job returns its existing snapshot. No output cleanup is performed. If a race completes before cancellation, the completed result remains authoritative and the cancel response reports the terminal state.

`operationKey` is a job-scoped opaque UUID, not a credential. Bridge maps it only while the authenticated content operation is active and deletes it in `finally`.

Pause is cooperative: the service aborts the current Bridge operation, preserves completed chapter checkpoints, and marks the job `paused`; resume requeues the same job and skips valid checkpoints. Cancellation is destructive for the job scope: it aborts the active operation and removes that job's checkpoint directory and staging output directory, while completed jobs and other jobs remain untouched. Novel chapter checkpoints contain sanitized HTML plus verified image assets; manga checkpoints contain completed chapter EPUB/Kepub paths.

## Protocol and compatibility

`content.fetch` remains unchanged except for optional `operationKey`; `content.cancel` is a new authenticated action. Its request is bounded to one operation key, one allowed browser and the caller's authenticated service principal. Unknown or missing keys return a safe no-op result rather than exposing active operations. Existing Browser Read and Browser Job actions do not use this registry.

## Failure and bounds

- Profile count is bounded by the existing service/job limits; malformed profiles are ignored during migration and never become active.
- Jobs store only one binding reference and immutable public identity; no credential is copied into a job.
- Cancellation has a bounded Bridge request timeout and falls back to cooperative cancellation if the Bridge is offline.
- A cancelled job cannot enter EPUB writing and cannot be changed back to queued or running by SSE reconnect.
- Callback progress after cancellation is ignored for terminal jobs.
