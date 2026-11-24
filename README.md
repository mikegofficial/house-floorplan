# Interactive Vector Floorplan

A 100% pure-vector architectural floorplan web viewer with aligned multi-floor overlays, real-world distance & area measurement tools, an interactive room directory, and searchable door/window schedules.

**Live site (GitHub Pages):** https://mikegofficial.github.io/house-floorplan/

## Included Vector Sheets (Unified Coordinate System)

All 6 sheets are native SVG vector drawings calibrated to exact architectural scale (`1/4" = 1'-0"` → `18.0 SVG units = 1 foot`):

- **A2.0 — First Floor Plan** (`layers/first.svg`): Main Residence (1,581 SF), 2-Car Garage (523 SF), 1-Car Carport, Screened Patio (154 SF), and ADU (607 SF)
- **A2.1 — Second Floor Plan** (`layers/second.svg`): Primary Suite, Primary Closet, Bath 3, Bath 2, Laundry, and Game Room (1,294 SF)
- **A1.0 — Site Plan** (`layers/site.svg`): Full 7,805 SF lot, Pool, Driveway, Setbacks, and Protected Pecan Trees
- **A2.2 — Roof Plan** (`layers/roof.svg`): Roof slopes, standing seam layout, overhangs, and skylight
- **E1.0 — First Floor Electrical** (`layers/elec1.svg`): Lighting circuits, switch legs, ceiling fans, outlets, surround sound, and landscape lighting
- **E1.2 — Second Floor Electrical** (`layers/elec2.svg`): Second-floor lighting, heated floors, towel warmers, and switches

## Running Locally

Zero build step or external CDN dependencies — open `index.html` directly or serve with any static HTTP server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

## Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Switch sheets (`A2.0`, `A2.1`, `A1.0`, `A2.2`, `E1.0`, `E1.2`) | `1` – `6` |
| Zoom In / Out / Fit to Screen | `+` / `-` / `0` |
| Measure Real-World Distance (`ft'-in"`) or Area (`SF`) | `M` |
| 90° Ortho Snap while measuring | Hold `Shift` |
| Toggle Sunlight & Shadows Daylighting Simulation | `S` |
| Toggle Aligned Vector Windows & Glazing Overlay | `W` |
| Toggle Electrical Overlay (`E1.0` / `E1.2`) | `E` |
| Toggle Adjacent Floor Ghost Overlay (`1st` ↔ `2nd`) | `G` |
| Toggle Interactive Room Footprints | `R` |
| Toggle Inspector Sidebar | `B` |

## Sunlight & Shadows Simulation (`S`) + Windows & Glazing Overlay (`W`)

- **True-North Solar Physics:** Calibrated directly to Sheet `A1.0` survey bearings (`True North = +10°` clockwise from right: Courtyard = East `080°`, Entry = North `350°`, ADU end = South `170°`, Heritage Pecan side = West `260°`) and Sheet `A2.3` window sill/head schedules.
- **3D Architectural & Seasonal Shading:** Models `2'-0"` roof overhangs, covered Screened Patio/Carport roofs, courtyard wing self-shading, diffused translucent Glass Block (`U` / `V`), Bath 3 overhead Skylight (`B3-T1`), exterior 2-story Pool/Courtyard shadows, and toggleable deciduous Pecan tree canopy filtering (leafy summer dappled shade vs. bare winter branches).
- **Aligned Vector Windows & Glazing (`<ROOM>-<MARK><NUM>`):** Toggle `Windows` (`W`) to highlight all 45 scheduled windows, glazed doors, and skylights (`DIN-D1`..`DIN-D4`, `LIV-D108`, `PRM-N1`, `B3-T1`, etc.), filter by glazing category, search/jump by ID, hover for live solar reach, or inspect direct-sun hours and click **Preview Peak Sun** inside any Room Card.

## Interactive Electrical Overlay & Device ID System

Expand **Electrical Legend & Notes** in the Layers sidebar (or press `E`) to toggle individual electrical symbol categories on both floors, read interactive General Electrical Notes, or jump directly to any device by ID.

Every outlet, switch, light fixture, and specialty device is assigned a deterministic human-friendly ID formatted as **`<ROOM>-<CODE><NUM>`** (sorted top-to-bottom in 1-foot rows, then left-to-right):

- **Examples:** `KIT-O1` (Kitchen 110V Outlet #1), `KIT-3W1` (Kitchen 3-Way Smart Switch #1), `AD-BED-SW1` (ADU Bedroom Smart Switch #1), `B3-SC1` (Bath 3 Vanity Sconce #1), `EXT-WP1` (Exterior Waterproof Outlet #1)
- **Locate & Share:** Search any ID in the Electrical Legend search box to zoom straight to it, hover any symbol to inspect its ID and callout, click any symbol to copy its ID to your clipboard, or expand **Device IDs** inside any Room Inspector Card.

## Updating from a Revised Architectural PDF

See **[`PDF-UPDATE-GUIDE.md`](PDF-UPDATE-GUIDE.md)** for the full step-by-step system instructions, CLI commands (`scripts/extract_floorplan.py`, `scripts/extract_electrical.py`, and `scripts/extract_windows.py`), privacy-scrubbing checklist, and a ready-to-paste AI agent prompt for processing future architect revisions.

