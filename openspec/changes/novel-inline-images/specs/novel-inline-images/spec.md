# Novel inline images

## ADDED Requirements

### Requirement: verified novel images

The system SHALL preserve verified inline images in supported novel EPUB output.

#### Scenario: text and image in one chapter

- **GIVEN** a supported novel chapter contains a loaded image with positive natural dimensions
- **WHEN** the novel job fetches and writes the chapter
- **THEN** the Bridge SHALL return image evidence
- **AND** web-content-fetch SHALL fetch the image through the declared host allowlist
- **AND** the EPUB XHTML SHALL contain the chapter text and an internal image path
- **AND** the image element SHALL contain numeric inline `width` and `height`

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

### Requirement: advertisement exclusion

Novel and manga EPUB output SHALL exclude advertisement nodes, overlay content and advertisement image assets.

#### Scenario: advertisement markup in novel content

- **GIVEN** a chapter contains a DOM node or image marked as an advertisement, sponsor, banner, popup or equivalent marker
- **WHEN** content is extracted and written to EPUB
- **THEN** the marked node and its image SHALL be omitted
- **AND** ordinary chapter text and verified content images SHALL remain

#### Scenario: advertisement asset in manga content

- **GIVEN** a manga reader returns an image whose source, alt text or DOM ancestry identifies it as an advertisement
- **WHEN** the manga chapter EPUB is written
- **THEN** the advertisement image SHALL not be embedded
- **AND** the remaining page order and Kobo inline dimensions SHALL be preserved
