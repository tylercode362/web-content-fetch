# Bridge URL binding state

## ADDED Requirements

### Requirement: changing the Bridge URL invalidates the previous pairing

The service MUST NOT keep credentials or browser identity from one Bridge URL when the configured URL changes.

#### Scenario: save a different Bridge URL

- **GIVEN** the active binding is paired to Bridge URL A
- **WHEN** the user saves Bridge URL B
- **THEN** the service MUST clear the stored service credential, browser client UUID, and expected fingerprint
- **AND** the binding MUST report that it is not paired
- **AND** the response MUST indicate that re-pairing is required
- **AND** the service and binding UUIDs MUST remain stable

#### Scenario: save the same Bridge URL

- **GIVEN** the active binding is paired to Bridge URL A
- **WHEN** the user saves Bridge URL A again
- **THEN** the service MUST preserve the existing pairing
- **AND** the response MUST not require re-pairing
