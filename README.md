# APEXRAD PDF Display Plugin v24.2.0
> A feature-rich `PDF Display` Region plugin Oracle APEX for rendering PDF files in a region.
 
**Author:** Saeed Hassanpour — Paya Shetaban Andisheh (APEXRAD)  
**Version:** 24.2.0 
**License:** MIT  
**Repository:** [APEXRAD-PDF-Display](https://github.com/Saeed-Hassanpour/APEXRAD-PDF-Display)

---

![](https://raw.githubusercontent.com/Saeed-Hassanpour/APEXRAD-Super-ShuttleItem/master/PDFDisplayPlugin.gif)

![](https://github.com/Saeed-Hassanpour/APEXRAD-PDF-Display/blob/main/images/APEXRAD-PDF-Display-settings.png)

## DEMO ##

[https://oracleapex.com/ords/r/saeedhassanpour/oac/](https://oracleapex.com/ords/r/saeedhassanpour/oac/pdf-display-plugin?)

---

## Features

- Single-file plugin import (`region_plugin_info_apexrad_pdfdisplay.sql`) with bundled JS/CSS/PDF.js assets.
- Flexible source support: works with both database BLOB and direct URL PDF files.
- Better document navigation UX with smart button visibility and optional first/last page controls.
- Built-in search and highlight flow with multiple matching modes and highlight styles.
- Optional selectable text layer for copy/select use cases, while keeping read-only mode available.
- Optional zoom controls directly in the region title for quick in-page reading.
- APEX-friendly configuration with clear attributes and bind-item submit support.



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
https://test.com/file.pdf
```

### JSON Words

```json
[
  { "word": "OrderNumber" },
  { "word": "Date" }
]
```
## Changelog
