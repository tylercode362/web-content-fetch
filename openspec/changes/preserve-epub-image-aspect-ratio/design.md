# Design

## Image pipeline

`sharp` remains responsible for decoding, EXIF rotation, bounded `fit: inside` resizing, flattening, and JPEG encoding. The optimized metadata is compared with the oriented source dimensions. A ratio drift greater than one percent fails the asset instead of publishing a distorted image.

## XHTML layout

Novel inline images retain the optimized pixel dimensions as inline `width`, `height`, and fixed-pixel `style` values. Manga page XHTML follows the older epub-gen approach: the page contains an SVG with an exact `viewBox`, while its child `image` carries the verified dimensions and local image reference. The page viewport is written as the same width and height. Manga OPF metadata declares `pre-paginated` layout and `spread-none` spine items so Kobo scales each page uniformly: portrait pages maximize height and landscape pages maximize width. No `aspect-ratio`, `object-fit`, `width:100%`, or `height:auto` rule is required for manga pages.

## Compatibility

The change is additive to the existing EPUB writer. It does not alter image source validation, advertisement removal, Kobo maximum dimensions, filenames, chapter ordering, or KEPUB conversion.
