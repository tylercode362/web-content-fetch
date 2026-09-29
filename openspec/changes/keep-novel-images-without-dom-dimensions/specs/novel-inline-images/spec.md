# Novel inline images

## MODIFIED Requirements

### Requirement: verified novel images

The system SHALL preserve verified inline images in supported novel EPUB output even when a continuation document does not expose DOM dimensions for the image.

#### Scenario: continuation image has no DOM dimensions

- **GIVEN** a supported novel continuation document contains a verified allowlisted image URL without `width` or `height` metadata
- **WHEN** the novel job fetches the image and writes the chapter
- **THEN** the Bridge SHALL preserve the verified image evidence
- **AND** web-content-fetch SHALL fetch the image through the declared host allowlist
- **AND** the EPUB writer SHALL derive safe inline `width` and `height` values from the verified image bytes
- **AND** the EPUB XHTML SHALL contain the chapter text and an internal image path

#### Scenario: image evidence is incomplete

- **GIVEN** chapter HTML contains an image but no verified matching asset is available
- **WHEN** the EPUB is written
- **THEN** the job SHALL fail closed
- **AND** SHALL NOT mark a text-only EPUB as successful

### Requirement: novel image security

Novel image retrieval SHALL remain limited to site-declared image host suffixes and SHALL preserve existing content queue and binding isolation.

#### Scenario: non-allowlisted image

- **WHEN** a novel page references an image outside the rule allowlist
- **THEN** Bridge SHALL reject the asset request
- **AND** Threads, X, YouTube and Browser Read contracts SHALL remain unchanged
