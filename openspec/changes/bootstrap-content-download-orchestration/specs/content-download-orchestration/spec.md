# Content Download Orchestration Specification

## ADDED Requirements

### Requirement: queue ownership

The system SHALL persist and manage all novel and manga DownloadJobs in web-content-fetch.

#### Scenario: accepted URL

- **GIVEN** the configured Bridge reports support for the URL
- **WHEN** the user submits it
- **THEN** web-content-fetch SHALL create one persisted job
- **AND** SHALL NOT create a second queue inside chrome-bridge

#### Scenario: unsupported URL

- **WHEN** the Bridge reports no supported adapter
- **THEN** the job SHALL be rejected before opening a browser tab

### Requirement: novel output

The system SHALL combine all ordered chapters into one EPUB for a novel job.

#### Scenario: chapter next page

- **WHEN** a chapter has a declared next page
- **THEN** the Bridge SHALL follow it within the content session
- **AND** web-content-fetch SHALL merge the returned content into the same chapter spine item
- **AND** the chapter order SHALL remain stable after retry or WebSocket reconnect

### Requirement: manga output

The system SHALL store each manga chapter as an independent EPUB.

#### Scenario: manga page sequence

- **WHEN** a manga chapter contains next pages
- **THEN** all verified pages SHALL be ordered inside the same chapter EPUB
- **AND** the next chapter SHALL produce a different EPUB file

#### Scenario: same-chapter action pagination

- **GIVEN** a chapter keeps the same URL and changes its primary image through a declared next action
- **WHEN** an individual image asset is requested after discovery
- **THEN** the Bridge SHALL replay the bounded page index in the real tab before matching the image URL
- **AND** SHALL reject the asset if the requested image is not present on that page

### Requirement: supported content adapters

The Bridge content service SHALL use exact FQDN and path rules for supported adapters and SHALL expose only additive `content.fetch` operations.

#### Scenario: supported work

- **GIVEN** the URL is a supported Linovelib work or `m.manhuagui.com/comic/<id>/` work
- **WHEN** web-content-fetch requests `mode=chapters`
- **THEN** the Bridge SHALL return only same-work chapter URLs
- **AND** SHALL reject external, cross-work or unsupported chapter links

#### Scenario: existing feature isolation

- **WHEN** a content job is queued or running
- **THEN** the Bridge SHALL use a separate content queue and action path
- **AND** SHALL NOT mutate the existing Browser Read queue or Threads, X, YouTube site rules

### Requirement: lazy image evidence

The manga adapter SHALL collect loaded primary images from the real Chrome tab after bounded lazy-load handling.

#### Scenario: lazy image

- **GIVEN** an image is represented by `data-src`, `data-original`, `srcset` or `currentSrc`
- **WHEN** the adapter reads a chapter
- **THEN** it SHALL scroll within a bound, wait for the page to settle, await image decode when available, and return only images with positive natural dimensions
- **AND** it SHALL deduplicate repeated image URLs

#### Scenario: unresolved image

- **WHEN** a declared primary image never obtains usable dimensions
- **THEN** the job SHALL fail closed or mark the chapter incomplete
- **AND** SHALL NOT silently generate an EPUB with a missing page

### Requirement: overlay interference

The adapter SHALL handle only site-declared overlay and close selectors.

#### Scenario: blocking overlay

- **GIVEN** a declared overlay remains visible after the declared close action
- **THEN** the Bridge SHALL return `content_blocked` / `needs_user_action`
- **AND** web-content-fetch SHALL not mark the chapter complete

### Requirement: Kobo image XHTML

The manga EPUB writer SHALL emit an XHTML image sequence with inline dimensions on every image element.

#### Scenario: image page

- **GIVEN** verified image bytes have natural dimensions `w` and `h`
- **WHEN** web-content-fetch writes the chapter XHTML
- **THEN** it SHALL emit numeric inline `width="<w>"` and `height="<h>"` attributes
- **AND** SHALL preserve reading order
- **AND** SHALL include a bounded viewport suitable for Kobo
- **AND** SHALL not rely on CSS-only dimensions

#### Scenario: asset verification failure

- **WHEN** an asset response is not an image, exceeds the byte budget, has a digest mismatch, or cannot be decoded
- **THEN** the EPUB SHALL not be marked successful
- **AND** the failed asset SHALL be visible in the persisted diagnostic state

### Requirement: Kobo conversion

The service SHALL run the pinned open-source `kepubify` binary after every successful EPUB write.

#### Scenario: EPUB and KEPUB outputs

- **WHEN** a novel book or manga chapter EPUB is written successfully
- **THEN** the service SHALL create a matching `.kepub.epub` output
- **AND** SHALL retain the original `.epub`
- **AND** SHALL mark the job failed if conversion or output verification fails

### Requirement: reachable callback

The service SHALL reject loopback callback URLs and SHALL authenticate callback progress with a per-job token.

#### Scenario: callback from Bridge runtime

- **GIVEN** the configured callback URL is reachable from the Bridge runtime
- **WHEN** Bridge reports a job progress update
- **THEN** web-content-fetch SHALL accept only the matching job id and callback token
- **AND** SHALL update progress without accepting content bytes or credentials

#### Scenario: loopback callback rejection

- **WHEN** a callback URL uses `127.0.0.1`, `localhost`, `::1` or another loopback address
- **THEN** configuration SHALL be rejected

### Requirement: bounded browser navigation diagnostics

The Bridge content service SHALL distinguish bounded browser navigation failures from generic content extraction failures without exposing raw browser errors, page content or credentials.

#### Scenario: unreachable or browser-error page

- **WHEN** the real Chrome tab cannot load the requested page or cannot inject the content adapter into a browser error page
- **THEN** the Bridge SHALL return `browser_navigation_timeout` or `browser_navigation_failed`
- **AND** web-content-fetch SHALL persist the bounded diagnostic and SHALL NOT mark the job successful
- **AND** the response SHALL NOT include cookies, page HTML, raw error traces or image bytes

### Requirement: secure binding

The system SHALL require a one-time, expiring six-digit pairing flow before content operations.

#### Scenario: expired or reused code

- **WHEN** a pairing code is expired, reused, or bound to another service id
- **THEN** the Bridge SHALL reject it
- **AND** web-content-fetch SHALL not store a service token or open a content session

#### Scenario: no development pairing bypass

- **WHEN** a caller sends a retired no-code or development pairing action, even with a matching browser client id
- **THEN** the Bridge SHALL reject the action as authentication failure
- **AND** the caller SHALL still need an Extension-generated six-digit code

### Requirement: non-regression

The new client SHALL be additive and SHALL NOT disable or change existing Threads, X, or YouTube Bridge operations.

#### Scenario: existing Browser Read regression

- **WHEN** the new service is built, started, paired, or processing a job
- **THEN** existing Browser Read API and site-rule regression tests SHALL remain passing

### Requirement: reconnectable progress

The system SHALL expose persisted job snapshots and same-origin SSE/EventSource progress events.

#### Scenario: progress stream reconnect

- **WHEN** the UI reconnects after an SSE/EventSource interruption
- **THEN** it SHALL load the current persisted snapshot
- **AND** SHALL preserve the job status and counters
