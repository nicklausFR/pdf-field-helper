# PDF Field Helper

A lightweight browser-based tool for creating overlays on top of existing PDF documents, with automatic field detection and snapping.

## Download

[**Download PDF Field Helper v1.4 — standalone HTML file**](https://github.com/nicklausFR/pdf-field-helper/releases/download/v1.4/PDF-Field-Helper-v1.4.html)

No installation is required. Download the file, then open it with a double-click in Brave, Chrome or Edge. The standalone version works offline.

## Features

- Add editable text fields, checkboxes, images, masks and drawing areas
- Draw with a mouse or pen in Edit mode; undo individual strokes
- Select multiple areas with Ctrl+click or a dashed drag rectangle in creation and edit modes (Ctrl adds to the selection)
- Copy, paste, align and delete groups of areas while preserving their content
- Automatic detection of:
  - text baselines
  - field boundaries
  - delimited character boxes
  - printed checkboxes
- Recognition and import of reliable interactive fields already embedded in a PDF (AcroForm text fields and checkboxes)
- Automatic rejection of embedded widgets whose geometry or visual content cannot be confirmed reliably
- Snapping to detected PDF elements when placing fields
- Top-aligned multiline text with consistent screen and PDF line spacing
- Recognition of text-based date and amount cells, including printed separators
- Automatic width and height suggestions
- Move, resize and align overlay elements manually, including horizontal and vertical axes
- Snap text areas to printed table cells and align selected fields to their rows and columns
- Preview empty table cells and create their fields together, excluding printed labels and occupied cells
- Undo and redo changes with buttons or keyboard shortcuts
- Per-field or document-wide font settings
- Per-field vertical text adjustment with document-wide application/reset
- Save editable AcroForm PDFs with embedded project data
- Generate standalone HTML forms for offline filling and saving without installation
- Generate a new PDF with the overlay applied
- English / French interface
- PWA support for a more app-like experience

## How it works

The original PDF remains untouched and acts as the background layer.

PDF Field Helper adds an overlay above it. When creating a field, the tool analyzes nearby PDF geometry and can automatically detect and snap to existing lines, boxes and other form structures.

When a PDF contains interactive AcroForm fields, the application also inspects their widget geometry and imports only fields that can be visually confirmed on the rendered page. Imported fields become regular overlay fields, so they can be edited, moved, resized and included in the generated PDF. Widgets that do not have reliable visual geometry are ignored rather than creating incorrect overlay fields.

This makes it possible to position fields quickly and accurately while keeping full manual control over their size, position and alignment.

The overlay is preserved in editable PDF projects, or applied when generating the final PDF.

**Save** writes the fields, entered values and complete project data into an editable PDF. The first save asks for a file; subsequent saves update that chosen file during the session. **Save as…** always asks for another destination. When the browser cannot provide file handles, the PDF is downloaded instead. Neither button saves the document in browser storage.

**Save as…** creates an editable PDF. Text, multiline text, regular character cells and checkboxes become standard AcroForm fields with their current values. Irregularly spaced character cells are exported as separate character fields to preserve their positions. Drawings, images and strike/circle marks are visible graphics; a compatibility dialog explains that these are not standard editable form fields in other PDF editors. The PDF embeds the original document and project data in a JSON attachment so PDF Field Helper can restore the complete project. If a recipient changes the standard fields in another editor, reopening the PDF in PDF Field Helper imports their new values.

**Generate PDF** produces the final PDF with the entries drawn on its pages. Download warnings follow the selected interface language. **Generate a fillable form** creates a separate, self-contained HTML file with empty response areas. It embeds the document, prepared fields, PDF libraries and worker, and works offline in desktop Chrome or Edge. The HTML opens directly in Edit mode and retains the text formatting controls, including fonts, alignment and baseline adjustments. The creation tabs and frame toggle are omitted; field highlights stay hidden. The top action row contains only **Save**, **Save as…**, **Reset all values** and **Generate PDF**. Zoom and page navigation remain in their usual top toolbar. **Save** and **Save as…** write editable PDFs here too.

**Delete all fields** removes the overlay areas and their contents throughout the document without automatically reimporting native fields. **Reset all values** keeps the areas and clears entered text, checkboxes, drawings and strike/circle marks. Undo and redo are available in the top Document toolbar.

Extending a delimited text area preserves its recognized cells and gaps while detecting additional cells in the enlarged area.

For tables, **+ Text** snaps to the cell under the pointer. To correct existing fields, select them with Ctrl+click and choose **Align to cells**; their values are preserved. **Detect tables** previews available cells, then **Place fields** confirms their creation. Selecting a field first limits detection to its table; otherwise, tables on the current page are considered. Escape cancels the preview. Green borders appear only before placement is confirmed.

Manual moves keep text fields and checkboxes exactly where they are dropped, including after reloading.

Choose **+ Strike / Circle** to place empty areas over printed choices. During placement, vertical detection aligns the area to the printed text line with vertical padding. For Oui/Non choices, recognition fits each complete word separately; other line widths remain manual. Manual moves remain free. After each placement the tool stays ready with the same area size; press Escape or switch to Edit mode to stop. In **Edit mode**, successive clicks on the area strike through, circle, then clear the mark. The mark uses the font color and can be moved or resized in overlay creation mode. Saved projects keep the chosen mark; reusable overlays contain empty areas. **+ Mask** remains the white masking tool.

Choose **+ Drawing area** and place the area, then draw directly in Edit mode. Only the generated fillable file offers **Draw** or **Import image** from a menu next to the selected area. The menu follows the area when scrolling or zooming. An imported image can be dragged and resized using its handle in Edit mode; **Adjust image** returns to those controls after drawing. Drawing areas can also be moved and resized in overlay creation mode, with independent width and height. Strokes and imported images, including their positions and sizes, remain editable in PDF projects and generated fillable forms and are included in the generated PDF. Reusable forms contain empty drawing areas.

To select several areas in creation or edit mode, Ctrl+click individual areas or drag from an empty part of the page, with no placement tool active. Ctrl+click again removes an area from the selection; hold Ctrl while dragging to add areas, or Escape to cancel the selection rectangle. On macOS, use Command instead of Ctrl. Selection gestures do not change text, checkboxes, marks or drawings. Copy/paste keeps the relative positions of a selected group; Delete removes the selected areas. A normal click inside a field still edits its content.

## Technology

HTML, CSS and JavaScript using PDF.js and pdf-lib.

## Status

**v1.4**
