#!/usr/bin/env python3
"""
Extract the interactive electrical symbol inventory from Revit electrical sheets (E1.0 & E1.2)
by diffing against architectural plans (A2.0 & A2.1), clustering polyline & Bezier symbols,
mapping each symbol to its room, and assigning deterministic human-friendly IDs (<ROOM>-<CODE><NUM>).

Usage:
    python3 scripts/extract_electrical.py --pdf /path/to/revised.pdf
"""
import argparse
import json
import math
import os
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

NS_SVG = "{http://www.w3.org/2000/svg}"
NUM_RE = re.compile(r"[-+]?\d*\.?\d+")

# Room bounding boxes in Master A2.0 coordinates (18.0 units = 1'-0")
ROOMS_FIRST = [
    ("kitchen",        1390, 520, 1636, 854),
    ("living",         1636, 520, 1966, 888),
    ("dining",         1390, 854, 1645, 1085),
    ("screened-patio", 1150, 692, 1390, 932),
    ("mud-room",       1150, 520, 1390, 692),
    ("entry",          1964, 598, 2262, 922),
    ("office",         1964, 370, 2178, 598),
    ("bath-1",         1794, 370, 1964, 534),
    ("reading-nook",   2090, 900, 2262, 1086),
    ("powder",         1960, 922, 2090, 1086),
    ("garage",         730,  520, 1150, 936),
    ("carport",        505,  550, 730,  960),
    ("adu-living",     158,  630, 508,  985),
    ("adu-bdrm",       158,  368, 392,  630),
    ("adu-bath",       392,  368, 508,  630),
]

ROOMS_SECOND = [
    ("primary-bdrm",   1142, 640, 1492, 932),
    ("primary-clst",   1142, 518, 1492, 640),
    ("bath-3",         1492, 518, 1742, 868),
    ("bath-2",         1742, 518, 1894, 708),
    ("laundry",        1680, 708, 1894, 868),
    ("hallway-2",      1492, 868, 1894, 932),
    ("game-room",      1894, 518, 2224, 932),
]

BATH_ROOMS = {"bath-1", "bath-2", "bath-3", "adu-bath", "powder"}

# Intuitive Room Prefixes for Human-Friendly IDs (<ROOM>-<CODE><NUM>)
ROOM_CODES = {
    "kitchen":        "KIT",
    "living":         "LIV",
    "dining":         "DIN",
    "screened-patio": "PAT",
    "mud-room":       "MUD",
    "entry":          "ENT",
    "office":         "OFF",
    "bath-1":         "B1",
    "reading-nook":   "RDG",
    "powder":         "PWD",
    "garage":         "GAR",
    "carport":        "CPT",
    "adu-living":     "AD-LIV",
    "adu-bdrm":       "AD-BED",
    "adu-bath":       "AD-BTH",
    "exterior":       "EXT",
    "primary-bdrm":   "PRM",
    "primary-clst":   "PCL",
    "bath-3":         "B3",
    "bath-2":         "B2",
    "laundry":        "LND",
    "hallway-2":      "H2",
    "game-room":      "GAM",
}

# Standard Electrical Device Codes
TYPE_CODES = {
    "outlet_110":     "O",    # 110V Duplex Outlet (e.g. KIT-O1)
    "outlet_ext":     "WP",   # Exterior Flush Waterproof Outlet (e.g. EXT-WP1)
    "special_outlet": "SO",   # Floor / Island P.B. / Drawer / Upper Cab Outlet
    "power_220":      "PW",   # 220V Appliance / Garage Door Opener
    "switch":         "SW",   # Single-Pole Smart Switch ($)
    "switch_3way":    "3W",   # 3-Way Smart Switch ($3)
    "recessed_can":   "C",    # Recessed Can Fixture
    "ceiling_fan":    "F",    # Ceiling Fan
    "pendant":        "PD",   # Hanging / Pendant / Chandelier
    "sconce":         "SC",   # Wall / Vanity / Exterior Sconce
    "uc_light":       "UC",   # Under-Cabinet LED
    "accent_light":   "AC",   # Toe-Kick / Undershelf / Railing / Soffit LED
    "landscape":      "LS",   # Landscape Lighting
    "tv_media":       "TV",   # TV / Surround Sound
    "data_cat6":      "NET",  # CAT 6 Ethernet Drop
    "doorbell":       "DB",   # Doorbell Push-Button
    "exhaust_fan":    "EX",   # Timer Exhaust Fan
    "specialty":      "SP",   # Heated Floors / Towel Warmers / Electric FP
}


def is_exterior_1st(x, y):
    interiors = [
        (168, 376, 500, 968),
        (738, 528, 1148, 926),
        (1152, 528, 1388, 926),
        (1390, 528, 1964, 882),
        (1394, 855, 1638, 1068),
        (1800, 378, 2166, 598),
        (1966, 600, 2252, 916),
        (1966, 916, 2252, 1074),
    ]
    return not any(x1 <= x <= x2 and y1 <= y <= y2 for x1, y1, x2, y2 in interiors)


def is_landscape_zone(x, y):
    return (y > 1130 and 1120 <= x <= 2120) or (1140 <= x <= 1220 and 1000 <= y <= 1160)


def assign_room(floor, x, y):
    if floor == "first" and (is_landscape_zone(x, y) or y > 1085):
        return "exterior"
    boxes = ROOMS_FIRST if floor == "first" else ROOMS_SECOND
    for rid, x1, y1, x2, y2 in boxes:
        if x1 <= x <= x2 and y1 <= y <= y2:
            return rid
    best_rid, best_d = "exterior", 18.0
    for rid, x1, y1, x2, y2 in boxes:
        dx = max(x1 - x, 0, x - x2)
        dy = max(y1 - y, 0, y - y2)
        d = math.hypot(dx, dy)
        if d < best_d:
            best_d, best_rid = d, rid
    return best_rid


def ensure_raw_svg(pdf_path, raw_dir, page):
    p = os.path.join(raw_dir, f"page_{page}.svg")
    if not os.path.exists(p):
        subprocess.check_call(["pdftocairo", "-svg", "-f", str(page), "-l", str(page), pdf_path, p])
    return p


def get_words(pdf_path, page, dx, dy, crop, excl=None):
    out = subprocess.check_output(["pdftotext", "-bbox", "-f", str(page), "-l", str(page), pdf_path, "-"])
    root = ET.fromstring(out)
    xns = "{http://www.w3.org/1999/xhtml}"
    words = []
    for w in root.iter(xns + "word"):
        x1, y1, x2, y2 = float(w.attrib["xMin"]), float(w.attrib["yMin"]), float(w.attrib["xMax"]), float(w.attrib["yMax"])
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if not (crop[0] <= mx <= crop[2] and crop[1] <= my <= crop[3]):
            continue
        if excl and (excl[0] <= mx <= excl[2] and excl[1] <= my <= excl[3]):
            continue
        words.append((w.text, mx + dx, my + dy, x1 + dx, y1 + dy, x2 + dx, y2 + dy))
    return words


def load_segments(svg_path, dx, dy, crop, excl=None):
    tree = ET.parse(svg_path)
    root = tree.getroot()
    segs, red_pts = [], []
    for el in root.iter(NS_SVG + "path"):
        st = el.attrib.get("stroke", "none")
        fl = el.attrib.get("fill", "none")
        is_red = "50.19" in st and ", 0%, 0%)" in st
        sc = 0.06 if "0.06" in el.attrib.get("transform", "") else 1.0
        d = el.attrib.get("d", "")
        nums = [float(x) for x in NUM_RE.findall(d)]
        if len(nums) < 4:
            continue
        xs = [n * sc for n in nums[0::2]]
        ys = [n * sc for n in nums[1::2]]
        x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if not (crop[0] <= mx <= crop[2] and crop[1] <= my <= crop[3]):
            continue
        if excl and (excl[0] <= mx <= excl[2] and excl[1] <= my <= excl[3]):
            continue
        if is_red:
            red_pts.append((nums[0] * sc + dx, nums[1] * sc + dy))
            red_pts.append((nums[-2] * sc + dx, nums[-1] * sc + dy))
            continue
        if "100%" in fl and st == "none":
            continue
        if "50.19" in fl and "50.19%, 50.19%" in fl:
            continue
        if "83.13" in fl:
            continue
        if (x2 - x1) > 200 or (y2 - y1) > 200:
            continue
        segs.append((x1 + dx, y1 + dy, x2 + dx, y2 + dy, mx + dx, my + dy, fl != "none", "C" in d))
    return segs, red_pts


def assign_deterministic_ids(items):
    """Assign human-friendly IDs (<ROOM>-<CODE><NUM>) sorted top-to-bottom (1ft bands), left-to-right."""
    grouped = defaultdict(list)
    for it in items:
        grouped[(it["room"], it["type"])].append(it)

    for (room, typ), bucket in grouped.items():
        # Sort top-to-bottom in 1-foot bands (18 units), then left-to-right
        bucket.sort(key=lambda it: (round(it["y"] / 18.0), round(it["x"] / 18.0), it["y"], it["x"]))
        rc = ROOM_CODES.get(room, room.upper()[:4])
        tc = TYPE_CODES.get(typ, "E")
        for idx, it in enumerate(bucket, start=1):
            it["id"] = f"{rc}-{tc}{idx}"

    # Sort master list cleanly by room, type, and ID
    items.sort(key=lambda it: (it["room"], it["type"], it["id"]))
    return items


def extract_floor(pdf_path, raw_dir, floor, arch_page, arch_dx, arch_dy, arch_crop, elec_page, elec_dx, elec_dy, elec_crop, elec_excl=None):
    arch_svg = ensure_raw_svg(pdf_path, raw_dir, arch_page)
    elec_svg = ensure_raw_svg(pdf_path, raw_dir, elec_page)
    arch_segs, _ = load_segments(arch_svg, arch_dx, arch_dy, arch_crop)
    elec_segs, red_pts = load_segments(elec_svg, elec_dx, elec_dy, elec_crop, elec_excl)
    words = get_words(pdf_path, elec_page, elec_dx, elec_dy, elec_crop, elec_excl)

    def near_red(x, y, r=14.0):
        r2 = r * r
        return any((rx - x) ** 2 + (ry - y) ** 2 <= r2 for rx, ry in red_pts)

    def nearby_words(cx, cy, radius=28.0):
        res = [(math.hypot(wx - cx, wy - cy), wt, wx, wy) for wt, wx, wy, *_ in words if math.hypot(wx - cx, wy - cy) <= radius]
        res.sort()
        return res

    arch_hash = set()
    for x1, y1, x2, y2, mx, my, _, _ in arch_segs:
        for px, py in ((x1, y1), (x2, y2), (mx, my)):
            gx, gy = int(round(px / 1.5)), int(round(py / 1.5))
            for ox in (-1, 0, 1):
                for oy in (-1, 0, 1):
                    arch_hash.add((gx + ox, gy + oy))

    only_elec = []
    for s in elec_segs:
        x1, y1, x2, y2, mx, my, is_fill, has_c = s
        if max(x2 - x1, y2 - y1) > 65:
            continue
        if ((int(round(x1 / 1.5)), int(round(y1 / 1.5))) in arch_hash and
                (int(round(x2 / 1.5)), int(round(y2 / 1.5))) in arch_hash and
                (int(round(mx / 1.5)), int(round(my / 1.5))) in arch_hash):
            continue
        only_elec.append(s)

    n = len(only_elec)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    buckets = defaultdict(list)
    for i, s in enumerate(only_elec):
        for bx in range(int(s[0] // 10) - 1, int(s[2] // 10) + 2):
            for by in range(int(s[1] // 10) - 1, int(s[3] // 10) + 2):
                buckets[(bx, by)].append(i)

    pad = 1.3
    for idxs in buckets.values():
        for a_i in range(len(idxs)):
            i = idxs[a_i]
            ax1, ay1, ax2, ay2 = only_elec[i][:4]
            for b_i in range(a_i + 1, len(idxs)):
                j = idxs[b_i]
                bx1, by1, bx2, by2 = only_elec[j][:4]
                if ax1 - pad <= bx2 and bx1 - pad <= ax2 and ay1 - pad <= by2 and by1 - pad <= ay2:
                    union(i, j)

    clusters = defaultdict(list)
    for i in range(n):
        clusters[find(i)].append(only_elec[i])

    items = []
    dedup_r = {
        "exhaust_fan": 32.0, "power_220": 28.0, "tv_media": 24.0,
        "special_outlet": 24.0, "pendant": 14.0, "landscape": 14.0, "sconce": 11.0,
    }

    def add_item(typ, x, y, note):
        rad = dedup_r.get(typ, 7.5)
        for it in items:
            if it["type"] == typ and math.hypot(it["x"] - x, it["y"] - y) < rad:
                return
        if floor == "first" and typ in ("sconce", "outlet_ext", "landscape", "doorbell") and is_exterior_1st(x, y):
            room = "exterior"
        else:
            room = assign_room(floor, x, y)
        if typ == "pendant" and room in BATH_ROOMS:
            typ = "sconce"
            note = "Vanity Wall Sconce Fixture (Dimmable)"
        items.append({"id": "", "floor": floor, "type": typ, "x": round(x, 1), "y": round(y, 1), "room": room, "note": note})

    for seg_list in clusters.values():
        x1 = min(s[0] for s in seg_list); y1 = min(s[1] for s in seg_list)
        x2 = max(s[2] for s in seg_list); y2 = max(s[3] for s in seg_list)
        w, h = x2 - x1, y2 - y1
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        nsg = len(seg_list)
        nfill = sum(1 for s in seg_list if s[6])
        ncurve = sum(1 for s in seg_list if s[7])

        nw = nearby_words(cx, cy, 28.0)
        nw_texts = [t for _, t, _, _ in nw]
        nw_close = [t for d, t, _, _ in nw if d < 18.0]

        if 50 <= w <= 72 and 50 <= h <= 72 and nsg >= 40:
            add_item("ceiling_fan", cx, cy, "Ceiling Fan (Dimmable / Smart Switch)")
            continue
        if (nfill > 0 and 6 <= max(w, h) <= 16 and nsg >= 6) or ("EXH." in nw_close and max(w, h) <= 16 and nsg >= 6):
            add_item("exhaust_fan", cx, cy, "Timer Exhaust Fan (EXH.)")
            continue
        if 4.5 <= w <= 8.5 and 4.5 <= h <= 8.5 and (8 <= nsg <= 24 or (ncurve >= 1 and nsg >= 4)):
            if "FLOOR" in nw_texts:
                add_item("special_outlet", cx, cy, "Recessed Floor Receptacle")
            elif floor == "first" and is_landscape_zone(cx, cy):
                add_item("landscape", cx, cy, "Landscape Lighting Fixture")
            else:
                add_item("recessed_can", cx, cy, "Recessed Can Fixture (Dimmable)")
            continue
        if ((3.5 <= w <= 8.5 and 13.0 <= h <= 18.5) or (13.0 <= w <= 18.5 and 3.5 <= h <= 8.5)) and (nsg >= 10 or (ncurve >= 1 and nsg >= 3)):
            is_3way = any(t == "3" and d < 18.0 for d, t, _, _ in nw)
            add_item("switch_3way" if is_3way else "switch", cx, cy,
                     "3-Way Smart Switch (Google Home)" if is_3way else "Single-Pole Smart Switch (Google Home)")
            continue
        if ((8.5 <= w <= 36.0 and 13.5 <= h <= 19.0) or (13.5 <= w <= 19.0 and 8.5 <= h <= 36.0)) and (nsg >= 24 or (ncurve >= 3 and nsg >= 6)):
            k = min(4, max(2, int(round(max(w, h) / 7.5))) if ncurve >= 3 else max(2, int(round(nsg / 16.0))))
            is_3way = any(t == "3" and d < 24.0 for d, t, _, _ in nw)
            for gi in range(k):
                frac = (gi + 0.5) / k
                gx = x1 + w * frac if w > h else cx
                gy = cy if w > h else y1 + h * frac
                add_item("switch_3way" if is_3way else "switch", gx, gy,
                         ("3-Way" if is_3way else "Single-Pole") + " Smart Switch (Multi-Gang)")
            continue
        if 9.0 <= min(w, h) <= 28.0 and 9.0 <= max(w, h) <= 36.0 and abs(w - h) <= 3.0 and (nsg >= 10 or ncurve >= 1) and near_red(cx, cy, 15.0):
            if "G.D.O." in nw_texts:
                add_item("power_220", cx, cy, "Garage Door Opener (G.D.O.)")
            elif "FLOOR" in nw_texts:
                add_item("special_outlet", cx, cy, "Recessed Floor Receptacle")
            elif floor == "first" and is_landscape_zone(cx, cy):
                add_item("landscape", cx, cy, "Landscape Lighting Fixture")
            else:
                add_item("pendant", cx, cy, "Hanging / Pendant Fixture (Dimmable)")
            continue
        if 5.0 <= max(w, h) <= 22.0 and nsg >= 2 and near_red(cx, cy, 15.0):
            if floor == "first" and is_landscape_zone(cx, cy):
                add_item("landscape", cx, cy, "Landscape Lighting Fixture"); continue
            if floor == "first" and is_exterior_1st(cx, cy):
                add_item("sconce", cx, cy, "Exterior Wall Sconce (Dimmable)"); continue
            if ncurve >= 1 and max(w, h) <= 15.0:
                add_item("sconce", cx, cy, "Wall Mounted Sconce (Dimmable)"); continue
        if 8.5 <= min(w, h) <= 20.0 and 10.5 <= max(w, h) <= 23.0 and (10 <= nsg <= 34 or (ncurve >= 1 and nsg >= 3)):
            if "G.D.O." in nw_texts:
                add_item("power_220", cx, cy, "Garage Door Opener (G.D.O.)")
            elif "220" in nw_texts:
                add_item("power_220", cx, cy, "220V Appliance Receptacle")
            elif "FLOOR" in nw_texts:
                add_item("special_outlet", cx, cy, "Recessed Floor Receptacle")
            elif "P.B." in nw_texts:
                add_item("special_outlet", cx, cy, "Island Pop-Up / Bench Outlet (P.B.)")
            elif "DRAWER" in nw_texts:
                add_item("special_outlet", cx, cy, "In-Drawer Vanity Outlet")
            elif floor == "first" and is_landscape_zone(cx, cy):
                add_item("landscape", cx, cy, "Landscape Lighting Fixture")
            elif floor == "first" and is_exterior_1st(cx, cy):
                if near_red(cx, cy, 15.0):
                    add_item("sconce", cx, cy, "Exterior Wall Sconce (Dimmable)")
                else:
                    add_item("outlet_ext", cx, cy, "Flush-Mount Exterior Waterproof Outlet (WP)")
            else:
                note = '110V Duplex Receptacle (12" AFF)' if '12"' in nw_texts else "110V Duplex Receptacle"
                add_item("outlet_110", cx, cy, note)
            continue

    for x1, y1, x2, y2, mx, my, is_fill, has_c in only_elec:
        w, h = x2 - x1, y2 - y1
        if has_c and 5.5 <= w <= 13.5 and 5.5 <= h <= 13.5 and abs(w - h) <= 1.5 and near_red(mx, my, 15.0):
            if any(math.hypot(it["x"] - mx, it["y"] - my) < 12.0 for it in items):
                continue
            if floor == "first" and is_landscape_zone(mx, my):
                add_item("landscape", mx, my, "Landscape Lighting Fixture")
            elif floor == "first" and is_exterior_1st(mx, my):
                add_item("sconce", mx, my, "Exterior Wall Sconce (Dimmable)")
            else:
                add_item("sconce", mx, my, "Wall Mounted Sconce (Dimmable)")

    for x1, y1, x2, y2, mx, my, is_fill, has_c in only_elec:
        w, h = x2 - x1, y2 - y1
        if ((w < 0.6 and 14.8 <= h <= 16.4) or (h < 0.6 and 14.8 <= w <= 16.4)) and near_red(mx, my, 24.0):
            if any(it["type"] in ("switch", "switch_3way") and math.hypot(it["x"] - mx, it["y"] - my) < 5.5 for it in items):
                continue
            nw = nearby_words(mx, my, 22.0)
            is_3way = any(t == "3" and d < 18.0 for d, t, _, _ in nw)
            add_item("switch_3way" if is_3way else "switch", mx, my,
                     "3-Way Smart Switch (Google Home)" if is_3way else "Single-Pole Smart Switch (Google Home)")

    if floor == "first":
        add_item("recessed_can", 206.5, 862.5, "Recessed Can Fixture (Dimmable)")
        for py in (674.0, 725.0, 776.0):
            if not any(it["type"] == "pendant" and math.hypot(it["x"] - 1546.0, it["y"] - py) < 16.0 for it in items):
                add_item("pendant", 1546.0, py, "Kitchen Island Pendant Fixture (Dimmable)")

    for wt, wx, wy, x1, y1, x2, y2 in words:
        if wt == "TV":
            nw = nearby_words(wx, wy, 42.0)
            nw_t = [t for _, t, _, _ in nw]
            if "BEHIND" in nw_t and any(d < 22.0 and t == "BEHIND" for d, t, _, _ in nw):
                continue
            note = "TV Outlet w/ Concealed Conduit to Cabinetry" if "CONDUIT" in nw_t else ("Hi/Lo TV Wall Outlet" if "HI/LO" in nw_t else "TV / Cable Wall Outlet")
            add_item("tv_media", wx, wy, note)
        elif wt == "SURROUND":
            add_item("tv_media", wx + 25, wy, "Surround Sound System Prewire")
        elif wt == "CAT":
            add_item("data_cat6", wx + 8, wy, "CAT 6 Ethernet Data Drop")
        elif wt == "DOORBELL":
            add_item("doorbell", wx, wy, "Doorbell Push-Button")
        elif wt == "U.C.L." or (wt == "LED" and any(t == "U.C." for _, t, _, _ in nearby_words(wx, wy, 20.0))):
            add_item("uc_light", wx, wy, "Under-Cabinet LED Light (U.C.L.)")
        elif wt == "TOE":
            add_item("accent_light", wx + 15, wy + 4, "Toe Kick Accent Lighting")
        elif wt == "UNDERSHELF":
            add_item("accent_light", wx, wy, "Undershelf Accent Lighting")
        elif wt == "VANITY":
            add_item("accent_light", wx, wy, "Under-Vanity Accent Lighting")
        elif wt == "RAILING":
            add_item("accent_light", wx, wy + 5, "Stair Railing Accent Lighting")
        elif wt == "SOFFIT":
            add_item("accent_light", wx, wy, "Recessed LED @ Entry Soffit")
        elif wt == "HEATED":
            add_item("specialty", wx, wy + 5, "Electric Heated Bathroom Floors")
        elif wt == "TOWEL":
            add_item("specialty", wx, wy, "Electric Towel Warmers")
        elif wt == "FP":
            add_item("specialty", wx, wy, "Electric Fireplace Power")
        elif wt == "UPPER":
            add_item("special_outlet", wx, wy, "Outlets Under Upper Cabinets (GFI)")
        elif wt == "P.B.":
            add_item("special_outlet", wx + 12, wy, "Island Pop-Up / Bench Outlet (P.B.)")
        elif wt == "FLOOR":
            add_item("special_outlet", wx, wy + 6, "Recessed Floor Receptacle")
        elif wt == "DRAWER":
            add_item("special_outlet", wx, wy + 5, "In-Drawer Vanity Outlet")
        elif wt == "G.D.O.":
            add_item("power_220", wx, wy, "Garage Door Opener (G.D.O.)")
        elif wt == "220":
            add_item("power_220", wx, wy, "220V Appliance Receptacle")

    return assign_deterministic_ids(items)


def main():
    parser = argparse.ArgumentParser(description="Extract electrical inventory with deterministic <ROOM>-<CODE><NUM> IDs.")
    parser.add_argument("--pdf", required=True, help="Path to architectural Revit PDF file")
    parser.add_argument("--out", default="layers/elec-inventory.js", help="Output JS file path")
    parser.add_argument("--raw-dir", default=None, help="Optional cached raw SVG directory")
    args = parser.parse_args()

    raw_dir = args.raw_dir or tempfile.mkdtemp(prefix="elec_raw_")
    os.makedirs(raw_dir, exist_ok=True)

    e1 = extract_floor(args.pdf, raw_dir, "first", 3, 0, 0, (85, 210, 2382, 1285), 14, -25.56, 154.92, (150, 160, 2382, 1140), (180, 865, 480, 1650))
    e2 = extract_floor(args.pdf, raw_dir, "second", 4, -16.44, -98.58, (130, 410, 2382, 1265), 15, 154.44, 98.34, (890, 210, 2270, 1075))

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as f:
        f.write("window.ELECTRICAL_INVENTORY = ")
        json.dump({"first": e1, "second": e2}, f, separators=(",", ":"))
        f.write(";\n")
    print(f"1st Floor: {len(e1)} items | 2nd Floor: {len(e2)} items -> wrote {args.out} ({os.path.getsize(args.out)/1024:.1f} KB)")
    print("Sample 1st Floor IDs:", [it["id"] for it in e1 if it["room"] == "kitchen"][:12])
    print("Sample 2nd Floor IDs:", [it["id"] for it in e2 if it["room"] == "bath-3"][:12])


if __name__ == "__main__":
    main()
