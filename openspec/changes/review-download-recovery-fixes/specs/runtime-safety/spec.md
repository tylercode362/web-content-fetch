## ADDED Requirements

### Requirement: Safe download responses
The service SHALL encode Unicode filenames as UTF-8 filename* and retain an ASCII fallback.

#### Scenario: Unicode download
- **GIVEN** a valid output with a Chinese filename
- **WHEN** the client downloads it
- **THEN** the service SHALL return the original bytes with a valid Content-Disposition header

#### Scenario: Malformed request
- **WHEN** the download path contains malformed percent encoding or the request URL is invalid
- **THEN** the service SHALL return 400 and remain available

### Requirement: Persistent stop intent
Recovery SHALL preserve pause and cancel requests and SHALL NOT fetch content for those jobs.

#### Scenario: Restart during pause or cancel
- **GIVEN** persisted pausing or cancelling state
- **WHEN** the service restarts
- **THEN** pausing SHALL become paused and cancelling SHALL continue cleanup without entering the queue
- **AND** cleanup failure SHALL retain a retryable cancelling state

### Requirement: Persistent CSRF expiry rejection
Unknown, expired or evicted CSRF tokens MUST be rejected even when their cookie matches.

#### Scenario: Repeated expired token
- **WHEN** the same expired token is submitted repeatedly or after purge or restart
- **THEN** every submission SHALL be rejected until the client obtains a new token
