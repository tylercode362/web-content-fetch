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
- **AND** the layout MUST NOT depend on `aspect-ratio`, `object-fit`, `width:100%`, or `height:auto`
