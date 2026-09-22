# EPUB image layout

## MODIFIED Requirements

### Requirement: preserve image aspect ratio in generated books

The service MUST preserve the verified source image aspect ratio when optimizing and embedding novel or manga images in EPUB and KEPUB output.

#### Scenario: optimized image remains ratio-safe

- **GIVEN** an image with valid bytes, dimensions, and optional EXIF orientation
- **WHEN** the service resizes it within the configured Kobo maximum width and height
- **THEN** the optimized image MUST use proportional scaling and MUST fail closed if its aspect ratio drifts by more than one percent

#### Scenario: Kobo-compatible XHTML embeds exact image dimensions

- **GIVEN** an optimized image with verified width and height
- **WHEN** the service writes novel or manga XHTML
- **THEN** a novel inline `img` MUST include inline `width`, `height`, and fixed-pixel style values matching the optimized bytes
- **AND** a manga page MUST use an SVG `viewBox` and child `image` whose width and height match the optimized bytes
- **AND** the XHTML viewport MUST use the same verified width and height
- **AND** each manga XHTML page MUST use its own verified dimensions; the first page's dimensions MUST NOT be reused for later pages
- **AND** fixed-layout manga XHTML MUST link a bundled legacy stylesheet that sets `html`, `body`, and `svg` margins and padding to zero
- **AND** a manga EPUB MUST declare `rendition:layout` as `pre-paginated` and `rendition:spread` as `none`
- **AND** each manga page spine item MUST declare `rendition:spread-none`
- **AND** the layout MUST NOT depend on `aspect-ratio`, `object-fit`, `width:100%`, or `height:auto`
