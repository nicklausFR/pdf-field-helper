# PDF Field Helper

A lightweight browser-based tool for creating overlays on top of existing PDF documents, with automatic field detection and snapping.

## Features

- Add editable text fields, checkboxes, images and masks
- Automatic detection of:
  - text baselines
  - field boundaries
  - delimited character boxes
  - printed checkboxes
- Snapping to detected PDF elements when placing fields
- Automatic width and height suggestions
- Move, resize and align overlay elements manually
- Per-field or document-wide font settings
- Per-field vertical text adjustment with document-wide application/reset
- Save and reload overlay layouts
- Generate a new PDF with the overlay applied
- English / French interface
- PWA support for a more app-like experience

## How it works

The original PDF remains untouched and acts as the background layer.

PDF Field Helper adds an overlay above it. When creating a field, the tool analyzes nearby PDF geometry and can automatically detect and snap to existing lines, boxes and other form structures.

This makes it possible to position fields quickly and accurately while keeping full manual control over their size, position and alignment.

The overlay can be saved separately and reused, or applied when generating a new PDF.

## Technology

HTML, CSS and JavaScript using PDF.js and pdf-lib.

## Status

**v1.2**
