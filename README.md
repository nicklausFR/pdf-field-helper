# PDF Field Helper

A lightweight browser-based tool for creating overlays on top of existing PDF documents, with automatic field detection and snapping.

## Download

[**Download PDF Field Helper v1.3 — standalone HTML file**](https://github.com/nicklausFR/pdf-field-helper/releases/download/v1.3/PDF-Field-Helper-v1.3.html)

No installation is required. Download the file, then open it with a double-click in Brave, Chrome or Edge. The standalone version works offline.

## Features

- Add editable text fields, checkboxes, images and masks
- Automatic detection of:
  - text baselines
  - field boundaries
  - delimited character boxes
  - printed checkboxes
- Recognition and import of reliable interactive fields already embedded in a PDF (AcroForm text fields and checkboxes)
- Automatic rejection of embedded widgets whose geometry or visual content cannot be confirmed reliably
- Snapping to detected PDF elements when placing fields
- Automatic width and height suggestions
- Move, resize and align overlay elements manually, including horizontal and vertical axes
- Undo and redo changes with buttons or keyboard shortcuts
- Per-field or document-wide font settings
- Per-field vertical text adjustment with document-wide application/reset
- Save and reload overlay layouts
- Generate a new PDF with the overlay applied
- English / French interface
- PWA support for a more app-like experience

## How it works

The original PDF remains untouched and acts as the background layer.

PDF Field Helper adds an overlay above it. When creating a field, the tool analyzes nearby PDF geometry and can automatically detect and snap to existing lines, boxes and other form structures.

When a PDF contains interactive AcroForm fields, the application also inspects their widget geometry and imports only fields that can be visually confirmed on the rendered page. Imported fields become regular overlay fields, so they can be edited, moved, resized and included in the generated PDF. Widgets that do not have reliable visual geometry are ignored rather than creating incorrect overlay fields.

This makes it possible to position fields quickly and accurately while keeping full manual control over their size, position and alignment.

The overlay can be saved separately and reused, or applied when generating a new PDF.

## Technology

HTML, CSS and JavaScript using PDF.js and pdf-lib.

## Status

**v1.3**
