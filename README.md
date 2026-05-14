# APEXRAD PDF Display (Oracle APEX 24.2+)

`APEXRAD PDF Display` is an Oracle APEX Region Plugin for rendering PDF files in a region with:

- BLOB or URL source support
- Page navigation (First/Prev/Next/Last with smart visibility)
- Optional search and word highlighting
- Multiple highlight styles
- Optional selectable text layer
- Optional zoom controls

## Plugin Info

- Name: `APEXRAD PDF Display`
- Internal Name: `INFO.APEXRAD.PDFDISPLAY`
- Version: `24.2.0`
- Project URL: [APEXRAD-PDF-Display](https://github.com/Saeed-Hassanpour/APEXRAD-PDF-Display)

## Files

Use only this file for import:

- `region_plugin_info_apexrad_pdfdisplay.sql`

It already includes:

- `apexrad-pdfdisplay.js`
- `pdf.js`
- `pdf.worker.js`
- `apexrad-pdfdisplay.css`

## Installation

1. In Oracle APEX, go to `Shared Components` -> `Plug-ins`.
2. Import `region_plugin_info_apexrad_pdfdisplay.sql`.
3. Create a region and choose region type `APEXRAD PDF Display`.

## Main Attributes

- `File Type`: `BLOB` / `URL`
- `Blob File SQL Code`: required when `File Type = BLOB`
- `File URL`: required when `File Type = URL`
- `Page Items to Submit`: submit bind items used in SQL
- `Display Search`: show Search Box + Search Type in region title
- `Display Zoom`: show `- 100% +` zoom controls
- `Selectable Text Layer`: enable selectable/copyable text layer
- `Find Words`: enable highlight flow
  - `SQL Query`
  - `JSON Words`
  - `Search Type`
  - `Multiple words in a line`
  - `Highlight`
  - `FillStyle Color`

## Source Examples

### BLOB SQL

```sql
select file_source
from tb_files
where id = :P2_ID
```

### URL

```text
#APP_FILES#test.pdf
https://test/file.pdf
```

### JSON Words

```json
[
  { "word": "OrderNumber" },
  { "word": "Date" }
]
```

## Notes

- For BLOB mode, the plugin converts BLOB to a Base64 data URL first.
- For local plugin assets, `pdf.js` and `pdf.worker.js` are bundled in plugin files.
- You can replace bundled `pdf.js` files in future versions when upgrading PDF.js.

## Pros

- Single-file plugin import (`region_plugin_info_apexrad_pdfdisplay.sql`) with bundled JS/CSS/PDF.js assets.
- Flexible source support: works with both database BLOB and direct URL PDF files.
- Better document navigation UX with smart button visibility and optional first/last page controls.
- Built-in search and highlight flow with multiple matching modes and highlight styles.
- Optional selectable text layer for copy/select use cases, while keeping read-only mode available.
- Optional zoom controls directly in the region title for quick in-page reading.
- APEX-friendly configuration with clear attributes and bind-item submit support.
