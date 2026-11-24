# Architectural PDF Revision & Rebuild System Guide

This document contains the complete technical pipeline and system instructions for processing a **revised architectural PDF** from the architect and updating this interactive vector floorplan viewer (and its sibling `house-exterior` elevations viewer) **without starting from scratch**.

> **Strict Privacy Rule (Mandatory Before Every Push)**
> This repository is hosted publicly on GitHub Pages. **Never** commit or include owner names, family names, street addresses, street names, city/ZIP codes, survey lot bearings, local utility provider initials, or architect / interior-designer / builder names, phone numbers, or emails in any SVG, JS, script, commit message, or markdown file.

---

## 1. Prerequisites

Install the following CLI tools (Ubuntu/Debian example):

```bash
sudo apt-get update && sudo apt-get install -y poppler-utils librsvg2-bin python3
# Optional for automated headless browser visual verification:
pip install playwright && playwright install chromium
```

Key binaries used:
- `pdfinfo` / `pdftotext` — inspect sheet index, page count, and page size.
- `pdftocairo -svg` — convert vector PDF pages into exact native SVG paths (preserving every Revit CAD line and vector glyph).
- `rsvg-convert` — rasterize verification PNGs from generated SVGs.

---

## 2. Step-by-Step Pipeline for a Revised PDF

Place the new architectural PDF outside the git repo (for example `/tmp/revised_plans.pdf` — **never** commit the source PDF into the repo!).

### Step 1: Inspect the New PDF Sheet Index & Scale

```bash
pdfinfo /tmp/revised_plans.pdf
for p in $(seq 1 $(pdfinfo /tmp/revised_plans.pdf | awk '/Pages:/{print $2}')); do
  echo "=== Page $p ==="
  pdftotext -f "$p" -l "$p" /tmp/revised_plans.pdf - | grep -E "A[0-9]\.[0-9]|E[0-9]\.[0-9]|FIRST FLOOR|SECOND FLOOR|SITE PLAN|ROOF PLAN|ELEVATION|ELECTRICAL|SCHEDULE" | head -n 6
done
```

Verify the following baseline properties:
1. **Page dimensions:** ARCH D landscape (`2592 × 1728 pt`).
2. **Unified Coordinate System:** Master space is **A2.0 First Floor Plan** at `1/4" = 1'-0"` → **`18.0 SVG units = 1'-0"`** (1.5 units = 1 inch).
   - Revit exports path coordinates inside a `matrix(0.06, 0, 0, 0.06, 0, 0)` group; `scripts/extract_floorplan.py` folds this scale directly into path numbers so every layer lives in clean `pt` coordinates.
3. **Sheet page numbers:** Check whether the page numbers for `A1.0` (Site), `A2.0` (1st Floor), `A2.1` (2nd Floor), `A2.2` (Roof), `A2.3` (Schedules), `A3.0` / `A3.1` (Elevations), `E1.0` (1st Electrical), and `E1.2` (2nd Electrical) changed. If they did, update `DEFAULT_SHEETS` in [`scripts/extract_floorplan.py`](scripts/extract_floorplan.py) and the `--elec1-page` / `--elec2-page` / `--first-page` / `--second-page` flags in [`scripts/extract_electrical.py`](scripts/extract_electrical.py).

---

### Step 2: Verify or Recalculate Inter-Sheet Alignment Offsets (`scale`, `tx`, `ty`)

Every layer (`first`, `second`, `roof`, `site`, `elec1`, `elec2`) is mathematically aligned onto **A2.0 First Floor** coordinates so overlays stack pixel-perfectly.

Current baseline transforms (from `DEFAULT_SHEETS` in `scripts/extract_floorplan.py`):

| Layer | Sheet | Page | Scale | `tx` | `ty` | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `first` | A2.0 First Floor | 3 | `1.0` | `0.00` | `0.00` | Master coordinate reference (`18.0 units/ft`) |
| `second` | A2.1 Second Floor | 4 | `1.0` | `-16.44` | `-98.58` | Aligns exterior perimeter & stair walls to A2.0 |
| `roof` | A2.2 Roof Plan | 5 | `1.0` | `-8.04` | `-153.90` | Aligns main & ADU exterior walls under overhangs |
| `elec1` | E1.0 1st Electrical | 14 | `1.0` | `-25.56` | `154.92` | Aligns electrical sheet walls directly onto A2.0 |
| `elec2` | E1.2 2nd Electrical | 15 | `1.0` | `154.44` | `98.34` | Aligns 2nd-floor electrical walls onto A2.1 (in A2.0 space) |
| `site` | A1.0 Site Plan | 2 | `2.0` | `-1409.82` | `-1311.00` | `1/8" = 1'-0"` scaled `× 2.0` to match `1/4" = 1'-0"` |

**How to recalibrate if the architect shifted a sheet viewport:**
1. Export raw SVGs once to a temporary directory:
   ```bash
   mkdir -p /tmp/raw_svg
   for p in 2 3 4 5 14 15; do
     pdftocairo -svg -f "$p" -l "$p" /tmp/revised_plans.pdf "/tmp/raw_svg/page_${p}.svg"
   done
   ```
2. Pick two unmistakable matching exterior wall corners (for example the outer NW corner of the Main Residence and the outer SW corner of the Garage or ADU) in both `A2.0` and the target sheet:
   - `scale = (master_x2 - master_x1) / (target_x2 - target_x1)` (usually exact `1.0` or `2.0`).
   - `tx = master_x1 - scale * target_x1`
   - `ty = master_y1 - scale * target_y1`
3. Update `tx`, `ty`, `scale`, and `crop` in `DEFAULT_SHEETS` inside `scripts/extract_floorplan.py` (and matching `ELEC1_TRANSFORM` / `ELEC2_TRANSFORM` in `scripts/extract_electrical.py`).
4. **Verify alignment visually:** Render `first.svg` + `elec1.svg` (or `second.svg` + `elec2.svg`) overlaid in the browser — exterior wall lines should overlap cleanly to within `< 0.5 SVG units` (`< 1/3 inch`).

---

### Step 3: Privacy Scrubbing & Crop Boxes

`scripts/extract_floorplan.py` automatically enforces privacy in three ways:
1. **Title block exclusion (`crop`):** Each sheet's `crop = (xmin, ymin, xmax, ymax)` in raw PDF points excludes the right-hand title block (owner name, address, architect stamp, revision block) and sheet margins.
2. **Raster image removal:** All `<image>` tags (architect logos, embedded raster stamps) are stripped.
3. **Site Plan text-only scrub (`text_scrub`):** On A1.0 Site Plan, street names, survey bearings, and utility labels sit *inside* the lot crop box. The `text_scrub` boxes remove `<use>` glyph paths inside those rectangles while **preserving** solid lot boundary lines, setbacks, and dimension ticks.
   - **Important:** When adjusting `text_scrub` boxes on a revised Site Plan, check the south lot edge carefully so you don't clip setback dimensions (like `23'-5"` / `12'-2"`) immediately north of the street name.

---

### Step 4: Rebuild Vector Floorplan Layers (`layers/*.svg` & `layers/plan-data.js`)

Run the floorplan extractor:

```bash
python3 scripts/extract_floorplan.py \
  --pdf /tmp/revised_plans.pdf \
  --raw-dir /tmp/raw_svg \
  --out layers
```

This generates:
- `layers/first.svg`, `layers/second.svg`, `layers/site.svg`, `layers/roof.svg`, `layers/elec1.svg`, `layers/elec2.svg` (standalone clean SVGs)
- `layers/plan-data.js` (bundled inline data for instant zero-CORS local & GitHub Pages loading)

**Critical CSS / SVG rule to never break:**
- Never add a global `path { fill: none; }` CSS rule. Revit text glyphs are rendered via `<use href="#glyph-..."/>` whose shadow `<path>` inherits `.f-ink` fill from its parent `<g>`. Instead, keep `fill="none"` on `<g id="layer-...">` groups only.

---

### Step 5: Rebuild Electrical Inventory & Deterministic Device IDs (`layers/elec-inventory.js`)

Run the electrical symbol extractor:

```bash
python3 scripts/extract_electrical.py \
  --pdf /tmp/revised_plans.pdf \
  --raw-dir /tmp/raw_svg \
  --out layers/elec-inventory.js
```

**How detection works:**
1. Diffs `E1.0` against `A2.0` (1st floor) and `E1.2` against `A2.1` (2nd floor) in unified coordinates to isolate electrical-only geometry (eliminating walls, doors, windows, and cabinetry).
2. Classifies both polyline and Bezier-drawn Revit symbols (recessed cans, ceiling fans, sconces, switches `$` / `$3`, 110V outlets, exterior waterproof `WP` outlets, specialty outlets, landscape lighting, CAT 6 data, TV/surround, exhaust fans, heated floors, towel warmers, electric fireplace, etc.).
3. Maps every symbol to its room using `ROOMS_FIRST` / `ROOMS_SECOND` bounding boxes.
4. Assigns every device a **deterministic, human-friendly ID** in the format `<ROOM>-<CODE><NUM>`.

#### Electrical ID Naming Convention (`<ROOM>-<CODE><NUM>`)

Devices within each `(room, type)` group are sorted **top-to-bottom in 1-foot horizontal bands (North → South)**, then **left-to-right (West → East)**:
```python
key = lambda it: (round(it["y"] / 18.0), round(it["x"] / 18.0), it["y"], it["x"])
```
This keeps numbering intuitive and predictable when discussing a room wall-by-wall.

**Room Prefixes (`ROOM_CODES`):**

| Prefix | Room | Floor | Prefix | Room | Floor |
| --- | --- | --- | --- | --- | --- |
| `KIT` | Kitchen | 1F | `AD-LIV` | ADU Living / Kitchen | 1F |
| `LIV` | Living Room | 1F | `AD-BED` | ADU Bedroom | 1F |
| `DIN` | Dining Room | 1F | `AD-BTH` | ADU Bath | 1F |
| `PAT` | Screened Patio | 1F | `EXT` | Exterior / Courtyard | 1F |
| `MUD` | Mud Room | 1F | `PRM` | Primary Bedroom | 2F |
| `ENT` | Entry & Stairs | 1F | `PCL` | Primary Closet | 2F |
| `OFF` | Office / Guest Bed | 1F | `B3` | Bath 3 (Primary Bath) | 2F |
| `B1` | Bath 1 | 1F | `B2` | Bath 2 | 2F |
| `RDG` | Reading Nook | 1F | `LND` | Laundry | 2F |
| `PWD` | Powder Room | 1F | `H2` | 2nd Floor Hallway | 2F |
| `GAR` | 2-Car Garage | 1F | `GAM` | Game Room | 2F |
| `CPT` | 1-Car Carport | 1F | | | |

**Device Type Codes (`TYPE_CODES`):**

| Code | Device Type | Example ID | Code | Device Type | Example ID |
| --- | --- | --- | --- | --- | --- |
| `O` | 110V Duplex Outlet | `KIT-O1` | `SC` | Wall / Vanity / Exterior Sconce | `B3-SC1` |
| `WP` | Exterior Flush Waterproof Outlet | `EXT-WP1` | `UC` | Under-Cabinet LED | `KIT-UC1` |
| `SO` | Specialty Outlet (Floor / Island / Drawer) | `LIV-SO1` | `AC` | Accent / Toe-Kick / Railing / Soffit LED | `KIT-AC1` |
| `PW` | 220V Power / G.D.O. | `GAR-PW1` | `LS` | Landscape Lighting | `EXT-LS1` |
| `SW` | Single-Pole Smart Switch (`$`) | `AD-BED-SW1` | `TV` | TV / Surround Sound | `LIV-TV1` |
| `3W` | 3-Way Smart Switch (`$3`) | `KIT-3W1` | `NET` | CAT 6 Data Drop | `OFF-NET1` |
| `C` | Recessed Can Fixture | `KIT-C1` | `DB` | Doorbell Push-Button | `ENT-DB1` |
| `F` | Ceiling Fan | `PRM-F1` | `EX` | Timer Exhaust Fan | `B3-EX1` |
| `PD` | Hanging / Pendant / Chandelier | `DIN-PD1` | `SP` | Heated Floors / Towel Warmers / Elec FP | `B3-SP1` |

> **When electrical callouts or general notes change:** Review any new text annotations on `E1.0` / `E1.2` (e.g., new specialty switches, heated floors, island outlets, or general notes 1–5) and update the note classifiers in `scripts/extract_electrical.py` and `ELEC_GENERAL_NOTES` / `ELEC_GROUPS` in `app.js`.

---

### Step 5b: Rebuild Windows, Glazing IDs & Solar Shading Geometry (`layers/windows-data.js`)

If any windows, exterior glazed doors, skylights, interior walls, roof overhangs, or tree locations changed on `A2.0`, `A2.1`, `A2.2`, `A2.3`, or `A1.0`, update [`scripts/extract_windows.py`](scripts/extract_windows.py) (`SCHEDULE_META`, `build_openings()`, `build_clip_zones()`, and `build_masses_and_trees()`) and run:

```bash
python3 scripts/extract_windows.py \
  --layers-dir layers \
  --out layers/windows-data.js
```

This verifies that extracted window counts match the `A2.3` Window Schedule (`A`–`V`) and regenerates:
- All **glazed openings** with deterministic `<ROOM>-<MARK><NUM>` / `<ROOM>-D<DOOR>` IDs (e.g., `DIN-D1`..`DIN-D4`, `LIV-D108`, `PRM-N1`, `B3-T1`), exact sill/head heights, overhang depths, and True-North outward normal vectors (`trueNorthScreenDeg = 10.0°`).
- **Interior wall clip zones (`clipZones`)** so sunbeams stop cleanly at interior walls.
- **3D building massing (`masses`) & heritage tree canopies (`trees`)** for outdoor Pool/Courtyard shadows and seasonal Pecan canopy filtering.
- **Privacy note:** Keep solar position constants rounded to generic integers (`solarLatDeg: 30.0`, `solarLonDeg: -98.0`) with zero GPS decimals, street names, or city labels.

---

### Step 6: Update Metadata Only If Architectural Layout Changed

Check if the revised PDF modified any of the following metadata in `app.js` / `index.html`:

1. **Room bounding boxes & ceiling heights:**
   - Update `ROOMS` in `app.js` (`rect: { x, y, w, h }`, `ceiling`, `desc`, `tags`).
   - Keep `ROOMS_FIRST` and `ROOMS_SECOND` in `scripts/extract_electrical.py` and `clipZones` in `scripts/extract_windows.py` synchronized with `ROOMS` in `app.js`.
2. **Door & Window Schedules (Sheet A2.3):**
   - Run `pdftotext -f <A2.3_page> -l <A2.3_page> /tmp/revised_plans.pdf -` and update `DOOR_SCHEDULE` and `WINDOW_SCHEDULE` arrays in `app.js` (plus sill/head heights in `scripts/extract_windows.py`).
3. **Site Area, FAR & Impervious Cover Totals (Sheet A0.0 / A1.0):**
   - Run `pdftotext -f 1 -l 2 /tmp/revised_plans.pdf -` and update the Project Summary cards in `index.html` and sheet descriptions in `README.md`.
4. **Exterior Elevations (Sibling repo `house-exterior`, Sheets A3.0 & A3.1):**
   - Extract the 4 elevation viewports (North, East, South, West) from Pages A3.0 and A3.1 via `pdftocairo -svg`.
   - Normalize each elevation's vertical origin so **`y = 0` = First Floor `0'-0"`** (all 4 roof peaks should align at the exact same negative `y`, e.g., `y = -533.2` for `+29'-7½"`).
   - Strip title blocks, embedded `<image>` elements, and any identifying callouts, regenerate `layers/*.svg` and `layers/elev-data.js`, and push to `mikegofficial/house-exterior`.

---

### Step 7: Visual Verification & Privacy Audit (Required Before Pushing)

#### 1. Start a local test server and verify in a browser (or Playwright)
```bash
python3 -m http.server 8123
```
Verify:
- Zero JavaScript console errors and zero 404 network errors.
- All 6 sheets (`A2.0`, `A2.1`, `A1.0`, `A2.2`, `E1.0`, `E1.2`) render sharp vector lines and crisp text.
- Overlay alignment: `A2.0 + E1.0` and `A2.1 + E1.2` walls overlap cleanly; `A2.0 + A2.1 Ghost` aligns stairs and exterior perimeter.
- Sunlight & Shadows (`S`) and Windows & Glazing (`W`): verify indoor sunbeams clip cleanly at interior walls, exterior shadows stay strictly outside indoor rooms, window `<ROOM>-<MARK><NUM>` ID pills align onto wall openings, and Room Cards report accurate direct-sun hours.
- Electrical Legend drawer (`E`): toggling Outlets (`O`), Switches (`SW` / `3W`), Recessed Cans (`C`), etc. highlights the correct symbols and displays readable `<ROOM>-<CODE><NUM>` ID pills.

#### 2. Run a Privacy Audit Before `git commit`
Check every file in the repository for accidental leaks (replace the placeholders below with the actual owner surname, street name, street number, and firm names from the new PDF's title block):

```bash
rg -i "(OWNER_LAST_NAME|STREET_NAME|ARCHITECT_FIRM|BUILDER_NAME|512\.)" \
  --glob '!layers/*.svg' --glob '!layers/plan-data.js' .
```
Also render `layers/site.svg` and `layers/first.svg` to PNGs with `rsvg-convert` and visually inspect the edges and street margins to confirm zero identifying text survived cropping:
```bash
rsvg-convert -w 2200 layers/site.svg -o /tmp/verify_site.png
rsvg-convert -w 2200 layers/first.svg -o /tmp/verify_first.png
```

#### 3. Bump Asset Cache-Buster & Publish to GitHub Pages
Before committing, increment the `?v=<N>` version query string on `styles.css`, `layers/plan-data.js`, `layers/elec-inventory.js`, `layers/windows-data.js`, and `app.js` in `index.html` so browsers immediately load the updated CSS/JS instead of serving cached subresources:

```bash
git status
git add index.html styles.css app.js layers/ scripts/ README.md PDF-UPDATE-GUIDE.md
git commit -m "Update vector floorplan, windows/sunlight geometry, and electrical inventory"
git push origin main
```
GitHub Pages automatically rebuilds `https://mikegofficial.github.io/house-floorplan/` within ~30–60 seconds.

---

## 3. Ready-to-Paste AI Agent System Prompt (For Future Revisions)

When you receive a revised PDF from your architect in a future session, attach or link the new PDF and paste the prompt below:

```text
We received a revised architectural PDF from our architect. Please update our
public GitHub Pages vector floorplan viewer (`mikegofficial/house-floorplan`)
and exterior elevations viewer (`mikegofficial/house-exterior`) by following
`PDF-UPDATE-GUIDE.md` in the `house-floorplan` repository.

Requirements:
1. Keep the repository 100% privacy-scrubbed (zero owner/family names, street
   address, street names, survey lot bearings, local utility hints, or
   architect/designer/builder names anywhere in SVGs, JS, scripts, docs, or
   commit messages). Do NOT commit the source PDF.
2. Verify all sheet page numbers and recalibrate any shifted inter-sheet
   alignment offsets (`tx`, `ty`, `scale`) relative to Master A2.0 (`18.0 units/ft`).
3. Re-run `scripts/extract_floorplan.py`, `scripts/extract_electrical.py`, and
   `scripts/extract_windows.py` to regenerate `layers/*.svg`, `layers/plan-data.js`,
   `layers/elec-inventory.js`, and `layers/windows-data.js` preserving the
   `<ROOM>-<CODE><NUM>` electrical IDs and `<ROOM>-<MARK><NUM>` window IDs.
4. Update `ROOMS`, `DOOR_SCHEDULE`, `WINDOW_SCHEDULE`, General Electrical Notes,
   and FAR/IC site metrics if any values changed in the revision, and bump the
   `?v=<N>` cache-buster in `index.html`.
5. Update `house-exterior` if elevations (A3.0 / A3.1) changed, keeping `y = 0`
   normalized to First Floor `0'-0"`.
6. Verify zero browser console errors, visually verify overlay alignment,
   sunlight clipping, and scrubbed Site Plan margins, run a privacy grep audit,
   and summarize what changed compared to the previous revision before/after
   pushing to `main`.
```
