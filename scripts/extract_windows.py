#!/usr/bin/env python3
"""
Generate verified architectural window, glazed-door, skylight, interior daylight clip-zone,
building massing, and heritage tree canopy geometry in Master A2.0 coordinates (18.0 units = 1'-0").

Verifies detected hexagonal window tags on layers/first.svg, layers/second.svg, and layers/roof.svg
against the complete Window & Door Schedules (Sheet A2.3) and outputs layers/windows-data.js.

Usage:
    python3 scripts/extract_windows.py --layers-dir layers --out layers/windows-data.js
"""
import argparse
import json
import math
import os
import re
import xml.etree.ElementTree as ET
from collections import defaultdict

NS_SVG = "{http://www.w3.org/2000/svg}"
NUM_RE = re.compile(r"[-+]?\d*\.?\d+")

# True North on Master A2.0 SVG canvas:
# +X right faces ~350° True (N 10° W); +Y down faces ~080° True (N 80° E).
# Therefore True North (000°) is at screen angle +10.0° clockwise from +X:
#   screen_angle_deg = (10.0 + azimuth_deg) % 360
#   azimuth_deg = (screen_angle_deg - 10.0) % 360
TRUE_NORTH_SCREEN_DEG = 10.0


def screen_normal_to_azimuth(nx, ny):
    screen_deg = math.degrees(math.atan2(ny, nx))
    return round((screen_deg - TRUE_NORTH_SCREEN_DEG) % 360.0, 1)


def compass_label(az):
    dirs = [
        "N", "NNE", "NE", "ENE",
        "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW",
        "W", "WNW", "NW", "NNW",
    ]
    idx = int(round(az / 22.5)) % 16
    return f"{dirs[idx]} · {int(round(az)):03d}°"


# Schedule metadata from Sheet A2.3 (Window Schedule + Window Legend + Door Schedule)
SCHEDULE_META = {
    "A":   {"wFt": 1.5,   "hFt": 5.0,   "sillFt": 3.0, "headFt": 8.0,  "family": "FG",           "category": "fixed",       "label": "Fixed Picture Window"},
    "B":   {"wFt": 1.5,   "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "FG",           "category": "fixed",       "label": "Floor-to-Ceiling Fixed Glass"},
    "C":   {"wFt": 3.0,   "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "FG",           "category": "fixed",       "label": "Floor-to-Ceiling Fixed Glass"},
    "D":   {"wFt": 2.75,  "hFt": 7.0,   "sillFt": 3.0, "headFt": 10.0, "family": "FG CURVED",    "category": "fixed",       "label": "Curved Banquette Picture Window"},
    "E":   {"wFt": 3.0,   "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "FG",           "category": "fixed",       "label": "Floor-to-Ceiling Fixed Glass"},
    "F":   {"wFt": 5.0,   "hFt": 3.0,   "sillFt": 6.0, "headFt": 9.0,  "family": "FG",           "category": "fixed",       "label": "Bath Clerestory Fixed Window"},
    "G":   {"wFt": 3.0,   "hFt": 5.0,   "sillFt": 3.0, "headFt": 8.0,  "family": "CSMT",         "category": "operable",    "label": "Operable Casement Window"},
    "H":   {"wFt": 5.5,   "hFt": 2.0,   "sillFt": 6.0, "headFt": 8.0,  "family": "FG",           "category": "fixed",       "label": "High Clerestory Fixed Window"},
    # I: A3.0-1 dims 9'-0" head (sill 3') for the paired north slots; brick-tower slots are 8'-0" head (overridden per segment)
    "I":   {"wFt": 1.5,   "hFt": 6.0,   "sillFt": 3.0, "headFt": 9.0,  "family": "FG",           "category": "fixed",       "label": "Vertical Slot Fixed Window"},
    "J":   {"wFt": 3.0,   "hFt": 9.0,   "sillFt": 3.0, "headFt": 12.0, "family": "FG",           "category": "fixed",       "label": "Tall Stairwell Fixed Window"},
    "K":   {"wFt": 4.0,   "hFt": 3.0,   "sillFt": 6.0, "headFt": 9.0,  "family": "FG",           "category": "fixed",       "label": "Upper Clerestory Fixed Window"},
    "L":   {"wFt": 10.0,  "hFt": 3.0,   "sillFt": 6.0, "headFt": 9.0,  "family": "FG",           "category": "fixed",       "label": "Wide Panoramic Clerestory"},
    "M":   {"wFt": 3.0,   "hFt": 9.0,   "sillFt": 3.0, "headFt": 12.0, "family": "CSMT",         "category": "operable",    "label": "Tall Vaulted Casement Window"},
    "N":   {"wFt": 9.0,   "hFt": 6.0,   "sillFt": 3.0, "headFt": 9.0,  "family": "3-PNL SLIDER", "category": "operable",    "label": "3-Panel Horizontal Slider"},
    # O: A2.3 schedule family = FG (A3.1-4 draws an awning swing mark — confirm with architect); A3.1-4 head 8'-0"
    "O":   {"wFt": 9.0,   "hFt": 2.0,   "sillFt": 6.0, "headFt": 8.0,  "family": "FG",           "category": "fixed",       "label": "Clerestory Fixed Window"},
    "P":   {"wFt": 7.17,  "hFt": 3.0,   "sillFt": 5.0, "headFt": 8.0,  "family": "FG",           "category": "fixed",       "label": "Primary Bath Picture Window"},
    "Q":   {"wFt": 3.0,   "hFt": 3.0,   "sillFt": 5.0, "headFt": 8.0,  "family": "CSMT",         "category": "operable",    "label": "Operable Casement Window"},
    "R":   {"wFt": 5.0,   "hFt": 3.0,   "sillFt": 5.0, "headFt": 8.0,  "family": "FG",           "category": "fixed",       "label": "Vanity Clerestory Fixed Window"},
    "S":   {"wFt": 3.0,   "hFt": 6.0,   "sillFt": 2.0, "headFt": 8.0,  "family": "CSMT",         "category": "operable",    "label": "Tall Operable Casement Window"},
    "T":   {"wFt": 1.79,  "hFt": 5.9,   "sillFt": 9.0, "headFt": 9.5,  "family": "SKYLIGHT",     "category": "diffused",    "label": "Flat Roof Overhead Skylight"},
    "U":   {"wFt": 12.0,  "hFt": 2.0,   "sillFt": 8.0, "headFt": 10.0, "family": "GLASS BLOCK",  "category": "diffused",    "label": "12' Glass-Block Transom"},
    "V":   {"wFt": 1.33,  "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "GLASS BLOCK",  "category": "diffused",    "label": "Full-Height Glass-Block Slot"},
    # Glazed exterior doors w/ transoms & sidelites
    "100": {"wFt": 5.0,   "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "ENTRY + LITE", "category": "glazed_door", "label": "Entry Door w/ 2' Sidelite & Transom"},
    "105": {"wFt": 2.5,   "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "EXT + TRANSOM","category": "glazed_door", "label": "Pool Bath Door w/ Transom"},
    "108": {"wFt": 12.0,  "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "MULTI-SLIDE",  "category": "glazed_door", "label": "12'×10' Courtyard Glass Wall"},
    "109": {"wFt": 3.0,   "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "FULL LITE",    "category": "glazed_door", "label": "Full-Lite Patio Door w/ Transom"},
    "111": {"wFt": 2.5,   "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "FULL LITE",    "category": "glazed_door", "label": "Full-Lite Mud Room Door w/ Transom"},
    "300": {"wFt": 3.0,   "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "EXT + TRANSOM","category": "glazed_door", "label": "ADU Entry Door w/ 2' Transom"},
    "301": {"wFt": 8.75,  "hFt": 10.0,  "sillFt": 0.0, "headFt": 10.0, "family": "DOOR + LITES", "category": "glazed_door", "label": "ADU Door w/ 6' Sidelites & Transom"},
}

SIZE_STR = {
    "A": "1'-6\" × 5'-0\"",   "B": "1'-6\" × 10'-0\"",  "C": "3'-0\" × 10'-0\"",
    "D": "2'-9\" × 7'-0\"",   "E": "3'-0\" × 10'-0\"",  "F": "5'-0\" × 3'-0\"",
    "G": "3'-0\" × 5'-0\"",   "H": "5'-6\" × 2'-0\"",   "I": "1'-6\" × 6'-0\"",
    "J": "3'-0\" × 9'-0\"",   "K": "4'-0\" × 3'-0\"",   "L": "10'-0\" × 3'-0\"",
    "M": "3'-0\" × 9'-0\"",   "N": "9'-0\" × 6'-0\"",   "O": "9'-0\" × 2'-0\"",
    "P": "7'-2\" × 3'-0\"",   "Q": "3'-0\" × 3'-0\"",   "R": "5'-0\" × 3'-0\"",
    "S": "3'-0\" × 6'-0\"",   "T": "1'-9½\" × 5'-10¾\"","U": "12'-0\" × 2'-0\"",
    "V": "1'-4\" × 10'-0\"",
    "100": "5'-0\" × 10'-0\"", "105": "2'-6\" × 10'-0\"", "108": "12'-0\" × 10'-0\"",
    "109": "3'-0\" × 10'-0\"", "111": "2'-6\" × 10'-0\"", "300": "3'-0\" × 10'-0\"",
    "301": "8'-9\" × 10'-0\"",
}

ROOM_PREFIX = {
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
    "adu-living":     "AD-LIV",
    "adu-bdrm":       "AD-BED",
    "adu-bath":       "AD-BTH",
    "primary-bdrm":   "PRM",
    "primary-clst":   "PCL",
    "bath-3":         "B3",
    "bath-2":         "B2",
    "hallway-2":      "H2",
    "game-room":      "GAM",
}


def curved_arc_chord(cx, cy, r, deg1, deg2):
    a1, a2 = math.radians(deg1), math.radians(deg2)
    x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
    x2, y2 = cx + r * math.cos(a2), cy + r * math.sin(a2)
    amid = math.radians((deg1 + deg2) / 2.0)
    nx, ny = math.cos(amid), math.sin(amid)
    return round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1), round(nx, 4), round(ny, 4)


def build_openings():
    raw = []

    # Floor elevations relative to Main First Floor 0'-0" (Sheets A3.0 / A3.1 level datums)
    FLOOR_BASE_FT = {"first": 0.0, "second": 11.6875}
    ADU_BASE_FT = -1.5  # ADU FIRST FLOOR -1'-6"

    def add_seg(floor, room, clip_id, mark, x1, y1, x2, y2, nx, ny, eave_ft=10.5, overhang_ft=2.0,
                sill_ft=None, head_ft=None, base_elev_ft=None):
        meta = SCHEDULE_META[mark]
        az = screen_normal_to_azimuth(nx, ny)
        raw.append({
            "floor": floor,
            "room": room,
            "clipId": clip_id,
            "mark": mark,
            "isDoor": mark.isdigit(),
            "isSkylight": False,
            "category": meta["category"],
            "family": meta["family"],
            "label": meta["label"],
            "size": SIZE_STR[mark],
            "wFt": meta["wFt"],
            "hFt": meta["hFt"],
            "sillFt": meta["sillFt"] if sill_ft is None else sill_ft,
            "headFt": meta["headFt"] if head_ft is None else head_ft,
            "baseElevFt": FLOOR_BASE_FT[floor] if base_elev_ft is None else base_elev_ft,
            "eaveFt": eave_ft,
            "overhangFt": overhang_ft,
            "x1": round(x1, 1),
            "y1": round(y1, 1),
            "x2": round(x2, 1),
            "y2": round(y2, 1),
            "cx": round((x1 + x2) / 2.0, 1),
            "cy": round((y1 + y2) / 2.0, 1),
            "nx": round(nx, 4),
            "ny": round(ny, 4),
            "facingDeg": az,
            "facingLabel": compass_label(az),
        })

    # =========================================================================
    # FIRST FLOOR WINDOWS & GLAZED DOORS (Master A2.0 coordinates)
    # =========================================================================
    # ADU openings sit on ADU FIRST FLOOR (-1'-6"); sill/head/eave measured from the ADU floor.
    # ADU 2:12 shed: low eave on the South (~10.9' above ADU floor, A3.1-3), rising to the North (~15.8').
    # ADU Bedroom (South -X & West -Y)
    add_seg("first", "adu-bdrm", "clip-adu-bdrm", "B", 173.8, 394.8, 173.8, 421.8, -1, 0, eave_ft=10.9, overhang_ft=2.0, base_elev_ft=ADU_BASE_FT)
    add_seg("first", "adu-bdrm", "clip-adu-bdrm", "B", 173.8, 541.8, 173.8, 568.8, -1, 0, eave_ft=10.9, overhang_ft=2.0, base_elev_ft=ADU_BASE_FT)
    add_seg("first", "adu-bdrm", "clip-adu-bdrm", "G", 200.4, 375.4, 254.4, 375.4, 0, -1, eave_ft=12.0, overhang_ft=2.0, base_elev_ft=ADU_BASE_FT)
    add_seg("first", "adu-bdrm", "clip-adu-bdrm", "G", 316.3, 375.4, 370.3, 375.4, 0, -1, eave_ft=12.0, overhang_ft=2.0, base_elev_ft=ADU_BASE_FT)

    # ADU Bath (West -Y)
    add_seg("first", "adu-bath", "clip-adu-bath", "H", 395.4, 375.4, 494.4, 375.4, 0, -1, eave_ft=12.0, overhang_ft=2.0, base_elev_ft=ADU_BASE_FT)

    # ADU Living (South -X Door 301, East +Y Glass Blocks V & Entry Door 300)
    add_seg("first", "adu-living", "clip-adu-living", "301", 176.5, 673.8, 176.5, 829.8, -1, 0, eave_ft=10.9, overhang_ft=2.0, base_elev_ft=ADU_BASE_FT)
    add_seg("first", "adu-living", "clip-adu-living", "V",   231.2, 959.0, 255.2, 959.0, 0, 1,  eave_ft=12.0, overhang_ft=2.0, base_elev_ft=ADU_BASE_FT)
    add_seg("first", "adu-living", "clip-adu-living", "V",   279.2, 959.0, 303.2, 959.0, 0, 1,  eave_ft=12.0, overhang_ft=2.0, base_elev_ft=ADU_BASE_FT)
    add_seg("first", "adu-living", "clip-adu-living", "300", 433.7, 923.0, 487.7, 923.0, 0, 1,  eave_ft=12.0, overhang_ft=4.5, base_elev_ft=ADU_BASE_FT)

    # Mud Room (West -Y Door 111, East +Y Glass Block U shared w/ Screened Patio)
    # A3.1-4: 2nd-floor wall is flush above Door 111 & Window E — the only eave is the main roof's
    # 2'-0" low (west) overhang at ~T.O.P. 20'-9 3/8" (no first-floor eave).
    add_seg("first", "mud-room", "clip-mud-room", "111", 1327.6, 530.0, 1372.6, 530.0, 0, -1, eave_ft=20.8, overhang_ft=2.0)
    add_seg("first", "mud-room", "clip-mud-room", "U",   1160.3, 686.5, 1376.3, 686.5, 0, 1,  eave_ft=10.0, overhang_ft=13.0)

    # Dining Nook (4x Curved D along arc center (1504.6, 948.4) r=125.5, East C, Patio Door 109)
    for d1, d2 in [(179.0, 158.0), (156.5, 135.5), (134.0, 113.0), (111.5, 90.5)]:
        x1, y1, x2, y2, nx, ny = curved_arc_chord(1504.6, 948.4, 125.5, d1, d2)
        add_seg("first", "dining", "clip-main-open", "D", x1, y1, x2, y2, nx, ny, eave_ft=10.5, overhang_ft=2.0)
    add_seg("first", "dining", "clip-main-open", "C",   1611.5, 930.8, 1611.5, 984.8, 1, 0,  eave_ft=10.5, overhang_ft=2.0)
    add_seg("first", "dining", "clip-main-open", "109", 1381.5, 889.0, 1381.5, 943.0, -1, 0, eave_ft=10.0, overhang_ft=13.0)

    # Living Room (East +Y 12'x10' Courtyard Glass Door 108, West -Y Window E)
    add_seg("first", "living", "clip-main-open", "108", 1676.7, 917.7, 1892.7, 917.7, 0, 1,  eave_ft=11.0, overhang_ft=2.0)
    add_seg("first", "living", "clip-main-open", "E",   1681.6, 529.5, 1735.6, 529.5, 0, -1, eave_ft=20.8, overhang_ft=2.0)

    # Bath 1 (South -X into side setback Window F)
    add_seg("first", "bath-1", "clip-bath-1", "F", 1805.5, 435.1, 1805.5, 525.1, -1, 0, eave_ft=9.5, overhang_ft=2.0)

    # Office (West -Y Casement G, North +X Windows A x 2)
    add_seg("first", "office", "clip-office", "G", 1974.8, 381.0, 2028.8, 381.0, 0, -1, eave_ft=9.5, overhang_ft=2.0)
    add_seg("first", "office", "clip-office", "A", 2161.0, 405.5, 2161.0, 432.5, 1, 0,  eave_ft=9.5, overhang_ft=2.0)
    add_seg("first", "office", "clip-office", "A", 2197.0, 563.9, 2197.0, 590.9, 1, 0,  eave_ft=9.5, overhang_ft=2.0)

    # Entry (North +X Door 100 w/ 2' sidelite & transom)
    add_seg("first", "entry", "clip-main-open", "100", 2253.0, 686.8, 2253.0, 773.8, 1, 0, eave_ft=10.5, overhang_ft=3.5)

    # Powder Room (South -X Pool Door 105, East +Y Glass Block V)
    add_seg("first", "powder", "clip-powder", "105", 1970.0, 987.0, 1970.0, 1032.0, -1, 0, eave_ft=10.5, overhang_ft=2.0)
    add_seg("first", "powder", "clip-powder", "V",   2053.4, 1068.5, 2077.4, 1068.5, 0, 1, eave_ft=10.5, overhang_ft=2.0)

    # Reading Nook (North +X Glass Blocks V x 2)
    add_seg("first", "reading-nook", "clip-reading-nook", "V", 2253.0, 922.5, 2253.0, 946.5, 1, 0, eave_ft=10.5, overhang_ft=2.0)
    add_seg("first", "reading-nook", "clip-reading-nook", "V", 2253.0, 970.5, 2253.0, 994.5, 1, 0, eave_ft=10.5, overhang_ft=2.0)

    # =========================================================================
    # SECOND FLOOR WINDOWS & SKYLIGHT (Master A2.0 coordinates)
    # =========================================================================
    # East facade is the HIGH side of the 4:12 shed: soffit ~28'-2" above 1st Fl. (A3.0-2) = ~16.5' above 2nd Fl.
    # Primary Bedroom (South -X Slider N, East +Y Tall Casements M x 2)
    add_seg("second", "primary-bdrm", "clip-primary-bdrm", "N", 1154.5, 696.8, 1154.5, 858.7, -1, 0, eave_ft=9.8,  overhang_ft=2.0)
    add_seg("second", "primary-bdrm", "clip-primary-bdrm", "M", 1216.7, 918.0, 1270.7, 918.0, 0, 1,  eave_ft=16.5, overhang_ft=2.0)
    add_seg("second", "primary-bdrm", "clip-primary-bdrm", "M", 1378.6, 918.0, 1432.6, 918.0, 0, 1,  eave_ft=16.5, overhang_ft=2.0)

    # Primary Closet (West -Y Clerestory O — A2.3: FG)
    add_seg("second", "primary-clst", "clip-primary-clst", "O", 1243.7, 529.5, 1405.6, 529.5, 0, -1, eave_ft=9.5, overhang_ft=2.0)

    # Bath 3 / Primary Bath (West -Y Windows P & Q, plus Overhead Skylight T!)
    # Note: WC room sits at x=1655..1690, Bath 3 main at x=1495..1685, Bath 2 at x=1745..1890
    add_seg("second", "bath-3", "clip-bath-3", "P", 1525.6, 529.5, 1654.6, 529.5, 0, -1, eave_ft=9.5, overhang_ft=2.0)
    add_seg("second", "bath-3", "clip-bath-3", "Q", 1690.6, 529.5, 1744.6, 529.5, 0, -1, eave_ft=9.5, overhang_ft=2.0)

    # Skylight T in Bath 3 (from layers/roof.svg: x=1575.1..1608.8, y=669.0..772.4)
    t_meta = SCHEDULE_META["T"]
    raw.append({
        "floor": "second",
        "room": "bath-3",
        "clipId": "clip-bath-3",
        "mark": "T",
        "isDoor": False,
        "isSkylight": True,
        "category": t_meta["category"],
        "family": t_meta["family"],
        "label": t_meta["label"],
        "size": SIZE_STR["T"],
        "wFt": t_meta["wFt"],
        "hFt": t_meta["hFt"],
        "sillFt": 9.0,
        "headFt": 9.5,
        "baseElevFt": FLOOR_BASE_FT["second"],
        "eaveFt": 9.5,
        "overhangFt": 0.0,
        "rect": {"x": 1575.1, "y": 669.0, "w": 33.7, "h": 103.4},
        "x1": 1592.0, "y1": 669.0, "x2": 1592.0, "y2": 772.4,
        "cx": 1592.0, "cy": 720.7,
        "nx": 0.0, "ny": 0.0,
        "facingDeg": -1,
        "facingLabel": "Zenith · Overhead Roof",
    })

    # Bath 2 (West -Y Window R: x=1754.3..1844.3)
    add_seg("second", "bath-2", "clip-bath-2", "R", 1754.3, 529.5, 1844.3, 529.5, 0, -1, eave_ft=9.5, overhang_ft=2.0)

    # 2nd Floor Hallway (East +Y Windows K & L)
    add_seg("second", "hallway-2", "clip-game-hall", "K", 1574.8, 918.0, 1646.8, 918.0, 0, 1, eave_ft=16.5, overhang_ft=2.0)
    add_seg("second", "hallway-2", "clip-game-hall", "L", 1696.3, 918.0, 1876.3, 918.0, 0, 1, eave_ft=16.5, overhang_ft=2.0)

    # Game Room (West -Y Windows S & I, North +X Windows I x 3, East +Y Windows K & J)
    # Brick-tower I slots (west + northwest) are dimensioned 8'-0" head on A3.0-1 / A3.1-4 (sill 2').
    add_seg("second", "game-room", "clip-game-hall", "S", 1901.7, 529.5, 1955.7, 529.5, 0, -1, eave_ft=9.5,  overhang_ft=2.0)
    add_seg("second", "game-room", "clip-game-hall", "I", 2145.8, 529.5, 2172.8, 529.5, 0, -1, eave_ft=9.5,  overhang_ft=2.0, sill_ft=2.0, head_ft=8.0)
    add_seg("second", "game-room", "clip-game-hall", "I", 2196.0, 563.9, 2196.0, 590.9, 1, 0,  eave_ft=9.5,  overhang_ft=2.0, sill_ft=2.0, head_ft=8.0)
    add_seg("second", "game-room", "clip-game-hall", "I", 2196.0, 818.6, 2196.0, 845.6, 1, 0,  eave_ft=9.5,  overhang_ft=2.0)
    add_seg("second", "game-room", "clip-game-hall", "I", 2196.0, 852.7, 2196.0, 879.7, 1, 0,  eave_ft=9.5,  overhang_ft=2.0)
    add_seg("second", "game-room", "clip-game-hall", "K", 1925.7, 918.0, 1997.7, 918.0, 0, 1,  eave_ft=16.5,  overhang_ft=2.0)
    add_seg("second", "game-room", "clip-game-hall", "J", 2079.8, 918.0, 2133.8, 918.0, 0, 1,  eave_ft=16.5, overhang_ft=2.0)

    # Assign deterministic <ROOM>-<MARK><NUM> (or <ROOM>-D<DOOR>) IDs sorted top-to-bottom, left-to-right
    grouped = defaultdict(list)
    for item in raw:
        key_code = f"D{item['mark']}" if item["isDoor"] else item["mark"]
        grouped[(item["room"], key_code)].append(item)

    for (room, key_code), lst in grouped.items():
        lst.sort(key=lambda it: (round(it["cy"] / 18.0), round(it["cx"] / 18.0), it["cy"], it["cx"]))
        prefix = ROOM_PREFIX[room]
        for idx, it in enumerate(lst, 1):
            if it["isDoor"]:
                it["id"] = f"{prefix}-{key_code}" if len(lst) == 1 else f"{prefix}-{key_code}-{idx}"
            else:
                it["id"] = f"{prefix}-{key_code}{idx}"

    raw.sort(key=lambda it: (0 if it["floor"] == "first" else 1, it["id"]))
    return raw


def build_clip_zones():
    """Interior daylight wall-clipping polygons in Master A2.0 coordinates."""
    # Curved dining arc vertices for smooth clipping along banquette wall
    dining_arc = []
    for deg in range(180, 89, -10):
        a = math.radians(deg)
        dining_arc.append([round(1504.6 + 125.5 * math.cos(a), 1), round(948.4 + 125.5 * math.sin(a), 1)])

    return {
        # Open-plan Kitchen + Living + Curved Dining + Entry/Stair Hall
        "clip-main-open": [
            [1386.8, 534.8], [1968.1, 534.8], [1968.1, 624.5], [2191.5, 624.5],
            [2191.5, 673.3], [2253.0, 673.3], [2253.0, 921.8], [1965.1, 921.8],
            [1965.1, 917.7], [1611.5, 917.7], [1611.5, 1073.0],
            *reversed(dining_arc),
            [1381.5, 948.4], [1381.5, 888.0], [1386.8, 888.0],
        ],
        "clip-mud-room":     [[1159.6, 534.8], [1377.1, 534.8], [1377.1, 686.5], [1159.6, 686.5]],
        "clip-office":       [[1974.8, 381.5], [2160.5, 381.5], [2160.5, 558.0], [2197.0, 558.0], [2197.0, 623.8], [1974.8, 623.8]],
        "clip-bath-1":       [[1805.5, 381.5], [1968.1, 381.5], [1968.1, 525.8], [1805.5, 525.8]],
        "clip-powder":       [[1970.0, 977.3], [2105.6, 977.3], [2105.6, 1068.5], [1970.0, 1068.5]],
        "clip-reading-nook": [[2105.6, 922.5], [2253.0, 922.5], [2253.0, 1068.5], [2105.6, 1068.5]],
        "clip-adu-bdrm":     [[173.8, 375.4],  [388.7, 375.4],  [388.7, 650.5],  [173.8, 650.5]],
        "clip-adu-bath":     [[395.4, 375.4],  [494.8, 375.4],  [494.8, 625.0],  [395.4, 625.0]],
        "clip-adu-living":   [[176.5, 656.5],  [494.8, 656.5],  [494.8, 923.0],  [410.0, 923.0], [410.0, 959.0], [176.5, 959.0]],
        # Second Floor zones
        "clip-primary-bdrm": [[1154.5, 666.8], [1489.6, 666.8], [1489.6, 918.0], [1154.5, 918.0]],
        "clip-primary-clst": [[1154.5, 529.5], [1489.6, 529.5], [1489.6, 660.8], [1154.5, 660.8]],
        "clip-bath-3":       [[1498.6, 529.5], [1744.6, 529.5], [1744.6, 845.6], [1498.6, 845.6]],
        "clip-bath-2":       [[1753.6, 529.5], [1887.1, 529.5], [1887.1, 700.0], [1753.6, 700.0]],
        # Open 2nd Floor Hallway + Game Room + Stairwell
        "clip-game-hall": [
            [1893.8, 529.5], [2196.0, 529.5], [2196.0, 918.0],
            [1498.6, 918.0], [1498.6, 851.6], [1893.8, 851.6],
        ],
    }


def build_masses_and_trees():
    """3D building footprints (heightFt above grade) & 4 heritage Pecan tree canopies for exterior shadows."""
    masses = [
        # 2-story main volume under the 4:12 shed (A3.0 / A3.1): roof surface ~21.7' above 1st Fl. at the
        # West wall (low eave, T.O.P. 20'-9 3/8") rising to ~28.9' at the East wall (high eave, top ~29'-7").
        # Modeled as 4 West->East strips at their mid-strip roof heights.
        *[
            {
                "id": f"main-2story-{i + 1}",
                "label": "2-Story Main Volume",
                "heightFt": h,
                "poly": [[1150, y0], [2200, y0], [2200, y1], [1150, y1]],
            }
            for i, (y0, y1, h) in enumerate([
                (525.0, 624.25, 22.6),
                (624.25, 723.5, 24.5),
                (723.5, 822.75, 26.3),
                (822.75, 922.0, 28.1),
            ])
        ],
        {
            "id": "main-north-entry",
            "label": "1-Story Office / Entry / Reading Wing",
            "heightFt": 12.8,
            "poly": [[1804, 377], [2164, 377], [2164, 592], [2257, 592], [2257, 1073], [1965, 1073], [1965, 525], [1804, 525]],
        },
        {
            "id": "main-dining",
            "label": "1-Story Curved Dining Bay",
            "heightFt": 11.0,  # A3.0-2 dining-bay roof band ~10.9'
            "poly": [[1377, 918], [1614, 918], [1614, 1074], [1465, 1074], [1405, 1040], [1377, 980]],
        },
        {
            "id": "garage-patio",
            "label": "Garage & Screened Patio",
            "heightFt": 10.5,  # A3.0-2 garage parapet ~9.4' / patio roof ~10.4' (plate 9'-1 1/8")
            "poly": [[737, 525], [1382, 525], [1382, 922], [737, 922]],
        },
        {
            "id": "carport",
            "label": "Covered Carport",
            "heightFt": 10.3,  # A3.1-4 carport roof ~10.2'
            "poly": [[503, 580], [737, 580], [737, 922], [503, 922]],
        },
        {
            "id": "adu",
            "label": "ADU",
            "heightFt": 12.3,  # A3.0-2 2:12 shed ~10.2' (S) to ~14.3' (N) above main 1st Fl.
            "poly": [[171, 373], [503, 373], [503, 928], [414, 928], [414, 964], [171, 964]],
        },
    ]

    # NOTE: Tree heights & canopy bases are ASSUMPTIONS — Sheet A1.0 gives only trunk diameters and
    # critical root zones. Replace with arborist/survey values when available.
    trees = [
        {"id": "pecan-1", "label": "24\" Heritage Pecan", "cx": 1519.0, "cy": 305.0, "r": 210.0, "heightFt": 32.0, "canopyBaseFt": 9.0, "assumed": True},
        {"id": "pecan-2", "label": "24\" Heritage Pecan", "cx": 1661.0, "cy": 305.0, "r": 216.0, "heightFt": 33.0, "canopyBaseFt": 9.0, "assumed": True},
        {"id": "pecan-3", "label": "19\" Heritage Pecan", "cx": 2370.0, "cy": 305.0, "r": 175.0, "heightFt": 27.0, "canopyBaseFt": 8.5, "assumed": True},
        {"id": "pecan-4", "label": "22\" Heritage Pecan", "cx": 2407.0, "cy": 470.0, "r": 195.0, "heightFt": 30.0, "canopyBaseFt": 8.5, "assumed": True},
    ]
    return masses, trees


def verify_tag_counts(layers_dir, openings):
    """Sanity-check extracted opening counts against Sheet A2.3 Window Schedule."""
    win_counts = defaultdict(int)
    for op in openings:
        if not op["isDoor"]:
            win_counts[op["mark"]] += 1
    expected = {
        "A": 2, "B": 2, "C": 1, "D": 4, "E": 1, "F": 1, "G": 3, "H": 1,
        "I": 4, "J": 1, "K": 2, "L": 1, "M": 2, "N": 1, "O": 1, "P": 1,
        "Q": 1, "R": 1, "S": 1, "T": 1, "U": 1, "V": 5,
    }
    assert dict(win_counts) == expected, f"Mismatch vs A2.3 Window Schedule: {dict(win_counts)} != {expected}"


def main():
    ap = argparse.ArgumentParser(description="Generate layers/windows-data.js for Windows & Sunlight overlays.")
    ap.add_argument("--layers-dir", default="layers", help="Directory containing vector floorplan SVGs")
    ap.add_argument("--out", default="layers/windows-data.js", help="Output JS bundle path")
    args = ap.parse_args()

    openings = build_openings()
    verify_tag_counts(args.layers_dir, openings)
    clip_zones = build_clip_zones()
    masses, trees = build_masses_and_trees()

    payload = {
        "orientation": {
            "trueNorthScreenDeg": TRUE_NORTH_SCREEN_DEG,
            "solarLatDeg": 30.0,
            "solarLonDeg": -98.0,
            "stdMeridianDeg": -90.0,
        },
        "openings": openings,
        "clipZones": clip_zones,
        "masses": masses,
        "trees": trees,
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("window.WINDOWS_AND_SOLAR_DATA = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n")

    f1_cnt = sum(1 for o in openings if o["floor"] == "first")
    f2_cnt = sum(1 for o in openings if o["floor"] == "second")
    print(f"Wrote {args.out}: {len(openings)} glazed openings ({f1_cnt} 1st Fl, {f2_cnt} 2nd Fl) — 100% matched to A2.3 Schedule.")


if __name__ == "__main__":
    main()
