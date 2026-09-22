# Preserve EPUB image aspect ratio

## Why

EPUB and KEPUB readers may interpret image dimensions differently. The content pipeline must preserve the optimized image's verified aspect ratio while still allowing Kobo to fit the image to the reading viewport.

## What changes

- Validate that image optimization does not change the source aspect ratio, including EXIF-oriented images.
- Keep verified inline `width` and `height` attributes in novel and manga XHTML.
- Use legacy Kobo-compatible fixed dimensions for inline `img` and SVG page wrappers; do not depend on modern responsive CSS.
- Keep the existing Kobo maximum dimensions, advertisement filtering, output names, and EPUB/KEPUB contracts unchanged.
