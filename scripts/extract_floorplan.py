#!/usr/bin/env python3
"""
Extract and optimize pure-vector architectural SVG layers from a Revit-exported PDF.
Aligns all 6 sheets into a unified architectural coordinate space (Master = First Floor,
where 1/4" = 1'-0" -> 18.0 SVG units = 1 foot) and strips title blocks, raster images,
and optional privacy-sensitive text boxes on the Site Plan.

Usage:
    python3 scripts/extract_floorplan.py --pdf /path/to/revised.pdf
"""
import argparse
import json
import os
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET

NS_SVG = "{http://www.w3.org/2000/svg}"
NS_XLINK = "{http://www.w3.org/1999/xlink}"
TOKEN_RE = re.compile(r"[A-Za-z]|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?")

# Default sheet configuration (verify page numbers & alignment offsets on new PDF revisions!)
DEFAULT_SHEETS = {
    "first": {
        "page": 3, "prefix": "f1", "title": "First Floor Plan (A2.0)",
        "scale": 1.0, "tx": 0.0, "ty": 0.0,
        "crop": (85, 210, 2382, 1285),
        "exclude_boxes": [],
        "text_scrub": [],
    },
    "second": {
        "page": 4, "prefix": "f2", "title": "Second Floor Plan (A2.1)",
        "scale": 1.0, "tx": -16.44, "ty": -98.58,
        "crop": (130, 410, 2382, 1265),
        "exclude_boxes": [],
        "text_scrub": [],
    },
    "roof": {
        "page": 5, "prefix": "rf", "title": "Roof Plan (A2.2)",
        "scale": 1.0, "tx": -8.04, "ty": -153.90,
        "crop": (115, 460, 2340, 1340),
        "exclude_boxes": [],
        "text_scrub": [],
    },
    "elec1": {
        "page": 14, "prefix": "e1", "title": "First Floor Electrical (E1.0)",
        "scale": 1.0, "tx": -25.56, "ty": 154.92,
        "crop": (150, 160, 2382, 1140),
        "exclude_boxes": [(180, 865, 480, 1650)],  # Sheet Electrical Symbols legend box
        "text_scrub": [],
    },
    "elec2": {
        "page": 15, "prefix": "e2", "title": "Second Floor Electrical (E1.2)",
        "scale": 1.0, "tx": 154.44, "ty": 98.34,
        "crop": (890, 210, 2270, 1075),
        "exclude_boxes": [],
        "text_scrub": [],
    },
    "site": {
        "page": 2, "prefix": "st", "title": "Site Plan (A1.0)",
        "scale": 2.0, "tx": -1409.82, "ty": -1311.00,
        "crop": (595, 575, 2345, 1525),
        "exclude_boxes": [],
        # Text-only privacy scrub boxes (street labels, survey bearings, local utility note)
        "text_scrub": [
            (1060, 1357, 1425, 1430),  # South street name
            (2180, 845,  2270, 1240),  # East street name
            (800,  755,  920,  786),   # North property survey bearing
            (795,  1285, 905,  1315),  # South property survey bearing
            (650,  825,  680,  935),   # West property survey bearing
            (1985, 822,  2018, 926),   # East property survey bearing
            (2145, 1372, 2345, 1430),  # Local utility note
        ],
    },
}


def fmt_num(v, prec=1):
    r = round(v, prec)
    return "0" if r == 0 else f"{r:.{prec}f}".rstrip("0").rstrip(".")


def transform_path_d(d, scale_factor, prec=1):
    tokens = TOKEN_RE.findall(d)
    out, xs, ys = [], [], []
    cmd, idx, n = None, 0, len(tokens)
    while idx < n:
        tok = tokens[idx]
        if tok.isalpha():
            cmd = tok
            out.append(cmd)
            idx += 1
            if cmd in ("Z", "z"):
                continue
        else:
            if cmd in ("M", "L", "T"):
                x, y = float(tokens[idx]) * scale_factor, float(tokens[idx + 1]) * scale_factor
                xs.append(x); ys.append(y)
                out.extend([fmt_num(x, prec), fmt_num(y, prec)])
                idx += 2
            elif cmd == "C":
                for _ in range(3):
                    x, y = float(tokens[idx]) * scale_factor, float(tokens[idx + 1]) * scale_factor
                    xs.append(x); ys.append(y)
                    out.extend([fmt_num(x, prec), fmt_num(y, prec)])
                    idx += 2
            elif cmd in ("S", "Q"):
                for _ in range(2):
                    x, y = float(tokens[idx]) * scale_factor, float(tokens[idx + 1]) * scale_factor
                    xs.append(x); ys.append(y)
                    out.extend([fmt_num(x, prec), fmt_num(y, prec)])
                    idx += 2
            elif cmd == "H":
                x = float(tokens[idx]) * scale_factor
                xs.append(x); out.append(fmt_num(x, prec)); idx += 1
            elif cmd == "V":
                y = float(tokens[idx]) * scale_factor
                ys.append(y); out.append(fmt_num(y, prec)); idx += 1
            else:
                out.append(fmt_num(float(tokens[idx]) * scale_factor, prec))
                idx += 1
    if not xs or not ys:
        return None, None
    s = re.sub(r"([A-Za-z])\s+", r"\1", re.sub(r"\s+([A-Za-z])", r"\1", " ".join(out))).replace(" -", "-")
    return s, (min(xs), min(ys), max(xs), max(ys))


def in_boxes(x, y, boxes):
    return any(x1 <= x <= x2 and y1 <= y <= y2 for x1, y1, x2, y2 in boxes)


def bbox_in_crop(bb, crop, exclude_boxes):
    if bb is None:
        return False
    x1, y1, x2, y2 = bb
    cx1, cy1, cx2, cy2 = crop
    if (x2 - x1) > 2250 or (y2 - y1) > 1550:
        return False
    mx, my = (x1 + x2) * 0.5, (y1 + y2) * 0.5
    if not (cx1 <= mx <= cx2 and cy1 <= my <= cy2):
        return False
    return not in_boxes(mx, my, exclude_boxes)


def classify_color(val, is_stroke=True):
    if not val or val == "none":
        return None
    v = val.replace(" ", "")
    if "50.19" in v and ",0%,0%)" in v:
        return "s-elec" if is_stroke else "f-elec"
    if "0%,0%,0%)" in v:
        return "s-ink" if is_stroke else "f-ink"
    if "100%,100%,100%)" in v:
        return "s-paper" if is_stroke else "f-paper"
    if "66.66" in v:
        return "s-dim" if is_stroke else "f-dim"
    if "50.19" in v or "39.21" in v:
        return "s-mid" if is_stroke else "f-wall"
    if "75.29" in v or "83.13" in v:
        return "s-light" if is_stroke else "f-shade"
    if "93.33" in v:
        return "s-light" if is_stroke else "f-tint"
    return "s-ink" if is_stroke else "f-ink"


def process_sheet(pdf_path, raw_dir, out_dir, key, cfg):
    page, prefix = cfg["page"], cfg["prefix"]
    raw_svg = os.path.join(raw_dir, f"page_{page}.svg")
    if not os.path.exists(raw_svg):
        subprocess.check_call(["pdftocairo", "-svg", "-f", str(page), "-l", str(page), pdf_path, raw_svg])

    tree = ET.parse(raw_svg)
    root = tree.getroot()
    defs = root.find(NS_SVG + "defs")

    glyph_map, clip_map = {}, {}
    if defs is not None:
        for el in defs.iter(NS_SVG + "g"):
            gid = el.attrib.get("id", "")
            if gid.startswith("glyph-"):
                p = el.find(NS_SVG + "path")
                if p is not None and p.attrib.get("d"):
                    dc, _ = transform_path_d(p.attrib["d"], 1.0, prec=2)
                    if dc:
                        glyph_map[gid] = dc
        for cp in defs.findall(NS_SVG + "clipPath"):
            cid = cp.attrib.get("id", "")
            p = cp.find(NS_SVG + "path")
            if cid and p is not None and p.attrib.get("d"):
                dc, bb = transform_path_d(p.attrib["d"], 1.0, prec=1)
                if dc:
                    clip_map[cid] = (dc, p.attrib.get("clip-rule"), bb)

    crop, excl, tscrub = cfg["crop"], cfg["exclude_boxes"], cfg["text_scrub"]
    used_glyphs, used_clips, items = set(), set(), []
    scrubbed = 0

    def parse_path_el(el):
        d = el.attrib.get("d", "")
        if not d:
            return None
        scale = 0.06 if "0.06" in el.attrib.get("transform", "") else 1.0
        dc, bb = transform_path_d(d, scale, prec=1)
        if not bbox_in_crop(bb, crop, excl):
            return None
        fc = classify_color(el.attrib.get("fill", "none"), False)
        sc = classify_color(el.attrib.get("stroke", "none"), True)
        if not fc and not sc:
            return None
        sw = fmt_num(float(el.attrib.get("stroke-width", "1")) * scale, 2) if sc else None
        fr = "evenodd" if el.attrib.get("fill-rule") == "evenodd" else None
        return ((fc, sc, sw, fr), dc)

    for child in root:
        tag = child.tag.replace(NS_SVG, "")
        if tag in ("defs", "use"):
            continue
        elif tag == "path":
            res = parse_path_el(child)
            if res:
                items.append(("path", res[0], res[1]))
        elif tag == "g":
            cp_attr = child.attrib.get("clip-path", "")
            if cp_attr:
                m = re.search(r"#(clip-\d+)", cp_attr)
                if not m or m.group(1) not in clip_map:
                    continue
                cid = m.group(1)
                if any("source-" in u.attrib.get(NS_XLINK + "href", "") for u in child.iter(NS_SVG + "use")):
                    continue
                inner = []
                for sub in child:
                    stag = sub.tag.replace(NS_SVG, "")
                    if stag == "path":
                        res = parse_path_el(sub)
                        if res:
                            inner.append(res)
                    elif stag == "g":
                        fcls = classify_color(sub.attrib.get("fill", "rgb(0%,0%,0%)"), False) or "f-ink"
                        for u in sub.findall(NS_SVG + "use"):
                            href = u.attrib.get(NS_XLINK + "href", "")
                            if href.startswith("#glyph-"):
                                gid = href[1:]
                                ux, uy = float(u.attrib.get("x", "0")), float(u.attrib.get("y", "0"))
                                if in_boxes(ux, uy, tscrub):
                                    scrubbed += 1
                                    continue
                                if bbox_in_crop((ux, uy, ux, uy), crop, excl) and gid in glyph_map:
                                    used_glyphs.add(gid)
                                    inner.append(("use", fcls, gid, fmt_num(ux, 1), fmt_num(uy, 1)))
                if inner:
                    used_clips.add(cid)
                    items.append(("clip_g", cid, inner))
            else:
                fcls = classify_color(child.attrib.get("fill", "rgb(0%,0%,0%)"), False) or "f-ink"
                for u in child.findall(NS_SVG + "use"):
                    href = u.attrib.get(NS_XLINK + "href", "")
                    if href.startswith("#glyph-"):
                        gid = href[1:]
                        ux, uy = float(u.attrib.get("x", "0")), float(u.attrib.get("y", "0"))
                        if in_boxes(ux, uy, tscrub):
                            scrubbed += 1
                            continue
                        if bbox_in_crop((ux, uy, ux, uy), crop, excl) and gid in glyph_map:
                            used_glyphs.add(gid)
                            items.append(("use", fcls, gid, fmt_num(ux, 1), fmt_num(uy, 1)))
                for p in child.findall(NS_SVG + "path"):
                    res = parse_path_el(p)
                    if res:
                        items.append(("path", res[0], res[1]))

    def style_attrs(skey):
        fc, sc, sw, fr = skey
        cls = [c for c in (fc, sc) if c]
        parts = []
        if cls:
            parts.append(f'class="{" ".join(cls)}"')
        if sw:
            parts.append(f'stroke-width="{sw}"')
        if fr:
            parts.append('fill-rule="evenodd"')
        return " ".join(parts)

    defs_out = [f'<path id="{prefix}-{gid}" d="{glyph_map[gid]}"/>' for gid in sorted(used_glyphs)]
    for cid in sorted(used_clips):
        cd, crule, _ = clip_map[cid]
        cr = f' clip-rule="{crule}"' if crule and crule != "nonzero" else ""
        defs_out.append(f'<clipPath id="{prefix}-{cid}"><path{cr} d="{cd}"/></clipPath>')

    body_out, i, n = [], 0, len(items)
    while i < n:
        kind = items[i][0]
        if kind == "path":
            skey, ds, j = items[i][1], [items[i][2]], i + 1
            while j < n and items[j][0] == "path" and items[j][1] == skey:
                ds.append(items[j][2]); j += 1
            body_out.append(f'<path {style_attrs(skey)} d="{"".join(ds)}"/>')
            i = j
        elif kind == "use":
            fcls, uses, j = items[i][1], [], i
            while j < n and items[j][0] == "use" and items[j][1] == fcls:
                _, _, gid, ux, uy = items[j]
                uses.append(f'<use href="#{prefix}-{gid}" x="{ux}" y="{uy}"/>')
                j += 1
            body_out.append(f'<g class="{fcls}">{"".join(uses)}</g>')
            i = j
        elif kind == "clip_g":
            _, cid, inner = items[i]
            ih = []
            for sub in inner:
                if sub[0] == "use":
                    _, fcls, gid, ux, uy = sub
                    ih.append(f'<use class="{fcls}" href="#{prefix}-{gid}" x="{ux}" y="{uy}"/>')
                else:
                    ih.append(f'<path {style_attrs(sub[0])} d="{sub[1]}"/>')
            body_out.append(f'<g clip-path="url(#{prefix}-{cid})">{"".join(ih)}</g>')
            i += 1

    sc, tx, ty = cfg["scale"], cfg["tx"], cfg["ty"]
    if sc == 1.0 and tx == 0.0 and ty == 0.0:
        tf = ""
    elif sc == 1.0:
        tf = f' transform="translate({fmt_num(tx, 2)},{fmt_num(ty, 2)})"'
    else:
        tf = f' transform="translate({fmt_num(tx, 2)},{fmt_num(ty, 2)}) scale({fmt_num(sc, 4)})"'

    layer_defs = "".join(defs_out)
    layer_body = f'<g id="layer-{key}" fill="none"{tf}>{"".join(body_out)}</g>'

    vb = "-240 -180 3560 1940" if key == "site" else "50 180 2360 1160"
    svg_str = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">'
        "<style>svg{background:#faf8f4;stroke-linecap:round;stroke-linejoin:round}"
        ".s-ink{stroke:#1a1c1e}.s-dim{stroke:#8b9096}.s-mid{stroke:#5a6068}.s-light{stroke:#b4b9bf}.s-elec{stroke:#c62828}"
        ".f-ink{fill:#1a1c1e}.f-paper{fill:#faf8f4}.f-wall{fill:#7a8088}.f-shade{fill:#c8cdd2}.f-tint{fill:#e8eaec}.f-elec{fill:#c62828}</style>"
        f"<defs>{layer_defs}</defs>{layer_body}</svg>"
    )
    with open(os.path.join(out_dir, f"{key}.svg"), "w") as f:
        f.write(svg_str)
    print(f"{key:6s} (p.{page:2d}): {len(svg_str)/1024:6.1f} KB | scrubbed_glyphs={scrubbed}")
    return {"defs": layer_defs, "body": layer_body, "title": cfg["title"]}


def main():
    parser = argparse.ArgumentParser(description="Extract pure-vector floorplan SVGs from architectural PDF.")
    parser.add_argument("--pdf", required=True, help="Path to architectural Revit PDF file")
    parser.add_argument("--out", default="layers", help="Output layers directory (default: layers)")
    parser.add_argument("--raw-dir", default=None, help="Optional cached raw SVG directory")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    raw_dir = args.raw_dir or tempfile.mkdtemp(prefix="floorplan_raw_")
    os.makedirs(raw_dir, exist_ok=True)

    bundle = {}
    for key, cfg in DEFAULT_SHEETS.items():
        bundle[key] = process_sheet(args.pdf, raw_dir, args.out, key, cfg)

    out_js = os.path.join(args.out, "plan-data.js")
    with open(out_js, "w") as f:
        f.write("window.FLOORPLAN_LAYERS = ")
        json.dump(bundle, f, separators=(",", ":"))
        f.write(";\n")
    print(f"Wrote {out_js} ({os.path.getsize(out_js)/1024:.1f} KB)")


if __name__ == "__main__":
    main()
