# PDF Field Helper

Prepare, fill and save PDF forms in your browser. Save your work as an editable PDF, export a finished PDF, or create a standalone form that someone else can fill without installing PDF Field Helper.

## Download

[**Download PDF Field Helper v1.4 — standalone HTML file**](https://github.com/nicklausFR/pdf-field-helper/releases/download/v1.4/PDF-Field-Helper-v1.4.html)

Open the downloaded file in Brave, Chrome or Edge. The standalone application works offline and requires no installation. Its interface is available in English and French.

## How it works

### Prepare and fill a document

Open a PDF in PDF Field Helper. Existing AcroForm text fields and checkboxes are imported when their positions can be confirmed from the page. You can also add text fields, checkboxes, images, drawing areas, white masks and Strike / Circle areas.

Use **Overlay creation mode** to place, move, resize and align fields. Automatic recognition helps match printed lines, character cells and table cells. Manual moves keep the position you choose. Green outlines and separators identify a placement preview before you confirm it.

Switch to **Edit mode** to enter text, check boxes, draw and mark printed choices. Font, size, bold, color, alignment and text baseline settings can apply to a selected field or throughout the document.

### Save your work in the PDF

**Save** and **Save as…** write an editable **PDF containing the fields, their values and the project data**. Reopen that PDF in PDF Field Helper to continue working with its saved fields and settings. There is no separate layout file to manage.

On the first save, choose a destination file. Subsequent saves update that chosen file during the session. **Save as…** always asks for another destination. If the browser does not support choosing and updating files directly, it downloads the PDF instead. These buttons save to a file, not browser storage.

Text fields and checkboxes are saved as standard **AcroForm fields**, so recipients can edit them in compatible PDF editors. Multiline text and character cells are supported; irregular character spacing may use separate fields for individual characters. Changes to standard field values made in another editor are read back when the PDF is reopened in PDF Field Helper.

Drawings, images, Strike / Circle marks and some layout settings are not standard AcroForm fields. The saved PDF includes their visible appearance and the project data needed to edit them fully in PDF Field Helper. The save dialog explains this compatibility limit.

### Generate a finished PDF

**Generate PDF** creates the final document with the entered content drawn onto its pages. The prepared form fields are flattened. Use **Save** first if you also want to keep an editable version for later changes.

### Share a form for someone else to fill

**Generate a fillable form** creates a separate, self-contained **HTML file** containing the PDF and its prepared fields. Response fields start empty. Send this file to the recipient, who can open it in a supported browser and fill it offline without installing PDF Field Helper.

The generated form opens directly for filling. It retains font, size, bold, color, alignment and baseline controls. Field creation tabs and the frame visibility toggle are omitted; field backgrounds and frames stay hidden. Zoom and page navigation remain at the top.

Its document actions are **Save**, **Save as…**, **Reset all values** and **Generate PDF**. Saving produces an editable PDF with the answers; generating a PDF produces the finished document.

In a drawing area, the recipient can choose **Draw** or **Import image** from a menu near that area. Imported images can be moved and resized; **Adjust image** returns to those controls after drawing. This choice menu belongs to the generated form. In the main editor, drawing areas accept drawing directly in Edit mode.

## Editing tools

- **Character cells:** recognize dates, amounts, codes and similar printed guides. Resizing a delimited field preserves existing cells and gaps while detecting additional cells in the enlarged area.
- **Tables:** use **+ Text** to place a field in a cell, **Align to cells** to fit selected fields, or **Detect tables** followed by **Place fields** to create fields in available cells. Selecting a field first limits recognition to its table. Escape cancels the preview.
- **Multiple selection:** use Ctrl+click or drag a selection rectangle from empty page space in creation or edit mode. Hold Ctrl to add to the selection, or Ctrl+click again to remove an item. Use Command on macOS. Selected groups can be copied, pasted, aligned or deleted.
- **Drawing areas:** add them with **+ Drawing area**, then draw with a mouse or pen in Edit mode. Their width and height can be resized independently in creation mode. Undo can remove individual strokes.
- **Strike / Circle:** place an area over printed text. Successive clicks in Edit mode strike through, circle and clear the mark. Marks use the selected text color. The placement tool stays ready for another area until you press Escape or switch modes.
- **Images and masks:** place an image with **+ Image**, or cover part of the page with **+ Mask**.
- **Undo and redo:** use the toolbar buttons or Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z.

**Delete all fields** removes the prepared fields and their contents from the document. **Reset all values** keeps the fields and clears entered text, checkboxes, drawings and marks.

## Technology

HTML, CSS and JavaScript using PDF.js and pdf-lib. A PWA version is also supported.

## Version

**v1.4** — [Release notes](https://github.com/nicklausFR/pdf-field-helper/releases/tag/v1.4)
