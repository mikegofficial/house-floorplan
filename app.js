/* ==========================================================================
   Interactive Vector Floorplan Viewer Engine
   Calibrated to Revit 1/4" = 1'-0" Master Space (18.0 SVG units = 1 foot)
   ========================================================================== */
(function () {
  "use strict";

  const UNITS_PER_FOOT = 18.0; // Exact Revit 1/4" = 1'-0" scale (18 PDF pts = 1 ft)
  const SVG_NS = "http://www.w3.org/2000/svg";

  // Sheet metadata & default fit bounding boxes (in Master A2.0 coordinates)
  const SHEET_META = {
    first:  { code: "A2.0", name: "FIRST FLOOR",       scaleLabel: '1/4" = 1\'-0"', box: { x: 65,   y: 205,  w: 2335, h: 1105 } },
    second: { code: "A2.1", name: "SECOND FLOOR",      scaleLabel: '1/4" = 1\'-0"', box: { x: 100,  y: 315,  w: 2285, h: 860  } },
    site:   { code: "A1.0", name: "SITE PLAN",         scaleLabel: '1/8" = 1\'-0"', box: { x: -245, y: -185, w: 3560, h: 1940 } },
    roof:   { code: "A2.2", name: "ROOF PLAN",         scaleLabel: '1/4" = 1\'-0"', box: { x: 95,   y: 295,  w: 2265, h: 920  } },
    elec1:  { code: "E1.0", name: "1ST FL ELECTRICAL", scaleLabel: '1/4" = 1\'-0"', box: { x: 110,  y: 295,  w: 2270, h: 1020 } },
    elec2:  { code: "E1.2", name: "2ND FL ELECTRICAL", scaleLabel: '1/4" = 1\'-0"', box: { x: 1040, y: 295,  w: 1385, h: 890  } },
  };

  // Quick-zoom zone presets in Master A2.0 coordinates
  const ZONES = {
    full:    null, // dynamic per active sheet
    main:    { sheet: null, box: { x: 1130, y: 310, w: 1240, h: 840 } },
    adu:     { sheet: "first",  box: { x: 85,   y: 300, w: 510,  h: 740 } },
    garage:  { sheet: "first",  box: { x: 540,  y: 450, w: 880,  h: 650 } },
    primary: { sheet: "second", box: { x: 1100, y: 455, w: 720,  h: 530 } },
    pool:    { sheet: "site",   box: { x: 960,  y: 520, w: 1520, h: 980 } },
  };

  // Verified Room Directory & Clickable Footprints (Master A2.0 coordinates)
  const ROOMS = [
    // First Floor — Main Residence
    {
      id: "kitchen", floor: "first", group: "First Floor — Main Residence",
      name: "Kitchen", ceiling: "10' CLG",
      rect: { x: 1396, y: 534, w: 235, h: 315 },
      desc: "Central galley kitchen with oversized curved-end island, 36\" refrigerator, wall oven & microwave, 18\" ice maker, under-counter ref, and dishwasher.",
      tags: ["36\" Ref", "Oven & Micro", "Ice Maker", "U.C. Ref", "Island", "Door 110/111"]
    },
    {
      id: "living", floor: "first", group: "First Floor — Main Residence",
      name: "Living Room", ceiling: "10' CLG",
      rect: { x: 1635, y: 534, w: 325, h: 345 },
      desc: "Open living room overlooking the south pool courtyard through the 12'×10' full glass opening (Door 108), with recessed floor outlet and TV conduit to cabinetry.",
      tags: ["Door 108 (12'×10')", "Floor Outlet", "Ceiling Fan", "Window E"]
    },
    {
      id: "dining", floor: "first", group: "First Floor — Main Residence",
      name: "Dining Nook", ceiling: "10' CLG",
      rect: { x: 1396, y: 855, w: 245, h: 218 },
      desc: "Signature curved banquette dining alcove with four curved fixed-glass windows (Type D) wrapping the courtyard view.",
      tags: ["4× Curved Win D", "Window C", "Door 109", "Curved Banquette"]
    },
    {
      id: "screened-patio", floor: "first", group: "First Floor — Main Residence",
      name: "Screened Patio", ceiling: "10' CLG · 154 SF",
      rect: { x: 1156, y: 696, w: 235, h: 224 },
      desc: "Covered screened outdoor lounge between the garage and dining area with electric fireplace, ceiling fan, TV outlet, and exterior screen door.",
      tags: ["154 SF", "Electric FP", "Door 109 & 110", "Window U (Glass Block)"]
    },
    {
      id: "mud-room", floor: "first", group: "First Floor — Main Residence",
      name: "Mud Room", ceiling: "10' CLG",
      rect: { x: 1156, y: 534, w: 235, h: 158 },
      desc: "Direct entry from the 2-car garage featuring built-in coats/shoes storage, mops/brooms cabinet, under-counter dog kennel, and secondary 30\" refrigerator.",
      tags: ["U.C. Dog Kennel", "30\" Ref", "Coats/Shoes", "Door 111 & 112"]
    },
    {
      id: "entry", floor: "first", group: "First Floor — Main Residence",
      name: "Entry & Stairs", ceiling: "10' CLG",
      rect: { x: 1966, y: 602, w: 278, h: 252 },
      desc: "Grand east entry (Door 100 w/ 2' sidelite & transom), full-height cabinetry, bench/shoe storage, twin 8' deep archways, and curved-landing main staircase.",
      tags: ["Door 100", "Deep Archways", "Bench Storage", "Stairs UP", "Door 107"]
    },
    {
      id: "office", floor: "first", group: "First Floor — Main Residence",
      name: "Office", ceiling: "9' CLG",
      rect: { x: 1968, y: 382, w: 190, h: 215 },
      desc: "Private northeast study accessed via arched Door 101, with direct pocket-door access (102) to Bath 1, ceiling fan, and curved corner window detail.",
      tags: ["Arched Door 101", "Pocket Door 102", "Windows G & A", "Ceiling Fan"]
    },
    {
      id: "bath-1", floor: "first", group: "First Floor — Main Residence",
      name: "Bath 1", ceiling: "9' CLG",
      rect: { x: 1802, y: 382, w: 162, h: 146 },
      desc: "First-floor full bath serving the Office / guest flex room with walk-in tiled shower, bench, and vanity.",
      tags: ["Walk-in Shower", "Door 102 & 103", "Window F", "Timer Exhaust"]
    },
    {
      id: "reading-nook", floor: "first", group: "First Floor — Main Residence",
      name: "Reading Nook", ceiling: "10' CLG",
      rect: { x: 2096, y: 904, w: 150, h: 166 },
      desc: "Curved southeast reading lounge featuring a linear electric fireplace, floor-to-ceiling bookshelves, and 10' tall glass-block accent windows (Type V).",
      tags: ["Linear Elec. FP", "Built-in Shelves", "2× Glass Block V"]
    },
    {
      id: "powder", floor: "first", group: "First Floor — Main Residence",
      name: "Powder Room", ceiling: "10' CLG",
      rect: { x: 1966, y: 944, w: 126, h: 126 },
      desc: "Dual-access powder bath with pocket door (104) from the main hall and direct exterior pool door (105) from the courtyard.",
      tags: ["Pocket Door 104", "Pool Door 105", "Glass Block V"]
    },

    // First Floor — Garage, Carport & ADU
    {
      id: "garage", floor: "first", group: "Garage, Carport & ADU (607 SF)",
      name: "2-Car Garage", ceiling: "9' CLG · 523 SF",
      rect: { x: 742, y: 534, w: 408, h: 386 },
      desc: "23'-5\" × 22'-0\" two-car garage with 16'×8' overhead door (113), water softener location (WS), and breezeway access to the carport (Door 114).",
      tags: ["523 SF", "16'×8' Door 113", "Water Softener", "Door 114"]
    },
    {
      id: "carport", floor: "first", group: "Garage, Carport & ADU (607 SF)",
      name: "1-Car Carport", ceiling: "Covered · 13'-0\" Wide",
      rect: { x: 508, y: 585, w: 230, h: 350 },
      desc: "Covered 13'-0\" breezeway carport connecting the main garage and ADU, with twin concrete driveway strips and recessed overhead lighting.",
      tags: ["13'-0\" Clear", "Driveway Strips", "Covered Breezeway"]
    },
    {
      id: "adu-living", floor: "first", group: "Garage, Carport & ADU (607 SF)",
      name: "ADU Living & Kitchenette", ceiling: "10' CLG · 607 SF ADU",
      rect: { x: 172, y: 635, w: 325, h: 326 },
      desc: "Full accessory dwelling unit living room and kitchenette with 24\" range, 30\" ref, 18\" dishwasher, U.C. ref, surround sound, curved corner, and glass block windows.",
      tags: ["607 SF ADU", "24\" Range & 18\" DW", "30\" Ref", "Doors 300/301", "2× Glass Block V"]
    },
    {
      id: "adu-bdrm", floor: "first", group: "Garage, Carport & ADU (607 SF)",
      name: "ADU Bedroom", ceiling: "10' CLG",
      rect: { x: 172, y: 382, w: 215, h: 248 },
      desc: "Private ADU bedroom with built-in closet, 2-in-1 washer/dryer alcove, ceiling fan, and casement/fixed perimeter windows.",
      tags: ["2-1 W/D Closet", "Windows B & G", "Doors 302/303/304"]
    },
    {
      id: "adu-bath", floor: "first", group: "Garage, Carport & ADU (607 SF)",
      name: "ADU Bath", ceiling: "10' CLG",
      rect: { x: 392, y: 382, w: 104, h: 192 },
      desc: "ADU full bathroom with walk-in tiled shower, vanity, linen closet (305), and clerestory window (H).",
      tags: ["Walk-in Shower", "Door 306", "Window H"]
    },

    // Second Floor — 1,294 SF
    {
      id: "primary-bdrm", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Primary Bedroom", ceiling: "Vaulted CLG",
      rect: { x: 1152, y: 644, w: 334, h: 274 },
      desc: "Vaulted-ceiling primary bedroom with curved southwest facade, 9'×6' 3-panel slider window (N), dual 9' tall casement windows (M), and motorized shade prewire.",
      tags: ["Vaulted Ceiling", "9'×6' Slider N", "2× Casement M", "Pocket Doors 207/208"]
    },
    {
      id: "primary-clst", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Primary Closet", ceiling: "9' CLG",
      rect: { x: 1152, y: 528, w: 334, h: 114 },
      desc: "Walk-in primary dressing closet running the full width behind the bed wall, with clerestory window (O) and dual-side hanging/shelving.",
      tags: ["Window O (9'×2')", "Pocket Door 208", "Dual-Side Built-ins"]
    },
    {
      id: "bath-3", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Bath 3 (Primary Bath)", ceiling: "9' CLG",
      rect: { x: 1492, y: 528, w: 248, h: 332 },
      desc: "Spa primary bath with dual vanity, soaking tub, oversized shower with bench & arched niche, private WC (Door 205), heated floors, and electric towel warmers.",
      tags: ["Heated Floors", "Towel Warmers", "Soaking Tub", "Private WC 205", "Windows P/Q/R"]
    },
    {
      id: "bath-2", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Bath 2", ceiling: "9' CLG",
      rect: { x: 1744, y: 528, w: 146, h: 178 },
      desc: "Second-floor full bath serving the Game Room / guest suite, with tiled walk-in shower, vanity, and linen closet (Door 202).",
      tags: ["Walk-in Shower", "Door 201 & 202", "Window S"]
    },
    {
      id: "laundry", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Laundry Room", ceiling: "9' CLG",
      rect: { x: 1684, y: 710, w: 206, h: 150 },
      desc: "Upstairs laundry room with side-by-side washer/dryer, floor drain (F.D.), wall-mounted ironing board, under-counter hamper, and adjacent water heater closet.",
      tags: ["Wash / Dry + F.D.", "Ironing Board", "U.C. Hamper", "W.H. Closet", "Doors 203/204"]
    },
    {
      id: "game-room", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Game Room", ceiling: "9' CLG",
      rect: { x: 1894, y: 528, w: 308, h: 332 },
      desc: "Spacious east-end game room / media lounge featuring built-in dual desk workstation along the stair wall, Hi/Lo TV wall, ceiling fan, and panoramic glazing.",
      tags: ["Dual Desk Built-in", "Hi/Lo TV", "Door 200", "Windows I/J/K/L", "Stairs DN"]
    },

    // Site Features
    {
      id: "pool", floor: "site", group: "Site & Outdoor (7,805 SF Lot)",
      name: "Pool & South Courtyard", ceiling: "Outdoor",
      rect: { x: 1640, y: 970, w: 300, h: 330 },
      desc: "Arched-end courtyard pool framed directly between the Dining Nook, Living Room, and Powder Room, enclosed by a garden wall and decorative fence along the south street.",
      tags: ["Courtyard Pool", "Pool Equip Pad (24 SF)", "Garden Wall (50 SF)", "Landscape Lighting"]
    },
    {
      id: "pecans", floor: "site", group: "Site & Outdoor (7,805 SF Lot)",
      name: "Protected Pecan Trees", ceiling: "CRZ Tree Zones",
      rect: { x: 1200, y: 90, w: 1480, h: 520 },
      desc: "Four heritage protected pecan trees (24\", 24\", 22\", and 19\") along the north and east sides with critical root zone (CRZ) protection fencing.",
      tags: ["2× 24\" Pecan", "22\" Pecan", "19\" Pecan", "CRZ Protection"]
    }
  ];

  // Complete Door Schedule verbatim from Sheet A2.3
  const DOOR_SCHEDULE = [
    ["100", "3'-0\"", "8'-0\"", "W/ 2' side lite & 2' transom (see A3.0-1)"],
    ["101", "3'-0\"", "8'-0\"", "Arched door"],
    ["102", "2'-6\"", "8'-0\"", "Pocket door"],
    ["103", "3'-0\"", "8'-0\"", "Double door"],
    ["104", "3'-0\"", "8'-0\"", "Pocket door w/ transom"],
    ["105", "2'-6\"", "8'-0\"", "Exterior door w/ transom"],
    ["107", "2'-0\"", "6'-8\"", "Angled w/ stair ceiling slope"],
    ["108", "6'-0\"", "8'-0\"", "Full dimensions 12' × 10' (see A3.0-2)"],
    ["109", "3'-0\"", "8'-0\"", "Full lite exterior door w/ transom"],
    ["110", "3'-0\"", "8'-0\"", "Screen door"],
    ["110b","3'-0\"", "8'-0\"", "Double door w/ transom (Mud/Kitchen)"],
    ["111", "2'-6\"", "8'-0\"", "Full lite exterior door w/ transom"],
    ["112", "3'-0\"", "8'-0\"", "Garage to Mud Room"],
    ["113", "16'-0\"","8'-0\"", "2-Car Garage door"],
    ["114", "3'-0\"", "8'-0\"", "Garage to Carport"],
    ["200", "2'-8\"", "6'-8\"", "W/ transom (Game Room)"],
    ["201", "2'-6\"", "6'-8\"", "W/ transom (Bath 2)"],
    ["202", "3'-0\"", "6'-8\"", "Double door (Linen)"],
    ["203", "3'-0\"", "6'-8\"", "W/ transom (Laundry)"],
    ["204", "2'-8\"", "6'-8\"", "Pocket door w/ transom (W.H.)"],
    ["205", "2'-8\"", "6'-8\"", "W/ transom (Primary WC)"],
    ["206", "2'-8\"", "6'-8\"", "Pocket door w/ transom"],
    ["207", "2'-8\"", "6'-8\"", "Primary Bedroom"],
    ["208", "2'-8\"", "6'-8\"", "Pocket door w/ transom (Primary Clst)"],
    ["209", "3'-0\"", "6'-8\"", "Pocket door w/ transom (Primary Entry)"],
    ["300", "3'-0\"", "8'-0\"", "ADU Entry w/ 2' transom"],
    ["301", "2'-9\"", "8'-0\"", "W/ 6' sidelites & 2' transom, integrated blinds"],
    ["302", "2'-8\"", "8'-0\"", "ADU W/D closet"],
    ["303", "3'-0\"", "8'-0\"", "ADU Bedroom"],
    ["304", "3'-0\"", "8'-0\"", "ADU Closet"],
    ["305", "3'-0\"", "8'-0\"", "ADU Linen / Pantry"],
    ["306", "3'-0\"", "8'-0\"", "ADU Bath"],
  ];

  // Complete Window Schedule verbatim from Sheet A2.3
  const WINDOW_SCHEDULE = [
    ["A", "1'-6\"",    "5'-0\"",    "2", "FG",          "Fixed glass"],
    ["B", "1'-6\"",    "10'-0\"",   "2", "FG",          "ADU west wall tall fixed"],
    ["C", "3'-0\"",    "10'-0\"",   "1", "FG",          "Dining east"],
    ["D", "2'-9\"",    "7'-0\"",    "4", "FG",          "CURVED (Dining alcove)"],
    ["E", "3'-0\"",    "10'-0\"",   "1", "FG",          "Living north"],
    ["F", "5'-0\"",    "3'-0\"",    "1", "FG",          "Bath 1"],
    ["G", "3'-0\"",    "5'-0\"",    "3", "CSMT",        "Casement (ADU & Office)"],
    ["H", "5'-6\"",    "2'-0\"",    "1", "FG",          "ADU Bath clerestory"],
    ["I", "1'-6\"",    "6'-0\"",    "4", "FG",          "Game Room vertical"],
    ["J", "3'-0\"",    "9'-0\"",    "1", "FG",          "Stair / Game Room"],
    ["K", "4'-0\"",    "3'-0\"",    "2", "FG",          "2nd Fl. south"],
    ["L", "10'-0\"",   "3'-0\"",    "1", "FG",          "2nd Fl. south wide"],
    ["M", "3'-0\"",    "9'-0\"",    "2", "CSMT",        "Primary Bedroom tall casements"],
    ["N", "9'-0\"",    "6'-0\"",    "1", "3-PNL SLIDER","Primary Bedroom west"],
    ["O", "9'-0\"",    "2'-0\"",    "1", "AWN",         "Primary Closet awning"],
    ["P", "7'-2\"",    "3'-0\"",    "1", "FG",          "Bath 3 north"],
    ["Q", "3'-0\"",    "3'-0\"",    "1", "CSMT",        "Bath 3 WC"],
    ["R", "5'-0\"",    "3'-0\"",    "1", "FG",          "Bath 3 / Hall"],
    ["S", "3'-0\"",    "6'-0\"",    "1", "CSMT",        "Bath 2"],
    ["T", "1'-9½\"",   "5'-10¾\"",  "1", "Skylight",    "Flat roof skylight"],
    ["U", "12'-0\"",   "2'-0\"",    "1", "GLASS BLOCK", "Mud Room / Patio transom"],
    ["V", "1'-4\"",    "10'-0\"",   "5", "GLASS BLOCK", "Reading Nook, Powder & ADU"],
  ];

  // Interactive Electrical Legend Taxonomy (Grouped, Color-Coded, Active-Only per Floor)
  const ELEC_GROUPS = [
    {
      id: "lighting",
      label: "Lighting",
      color: "#d97706",
      items: [
        { type: "recessed_can", label: "Recessed Can Fixture", short: "Recessed Cans", color: "#d97706", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="11" height="11"/><circle cx="8" cy="8" r="3.5"/></svg>' },
        { type: "ceiling_fan",  label: "Ceiling Fan",          short: "Ceiling Fans",  color: "#0284c7", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="1.5"/><path d="M8 6.5C7 3 9 3 8 6.5M9.5 8C13 7 13 9 9.5 8M8 9.5C9 13 7 13 8 9.5M6.5 8C3 9 3 7 6.5 8"/></svg>' },
        { type: "pendant",      label: "Hanging / Pendant",    short: "Pendants / Chandeliers", color: "#ea580c", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.2"/></svg>' },
        { type: "sconce",       label: "Wall / Vanity Sconce", short: "Wall Sconces",  color: "#b45309", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6.5" r="3.8"/><line x1="8" y1="10.3" x2="8" y2="14"/><line x1="5" y1="14" x2="11" y2="14"/></svg>' },
        { type: "uc_light",     label: "Under-Cabinet LED",    short: "U.C. Lights",   color: "#ca8a04", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="12" height="4" rx="1"/><line x1="5" y1="12.5" x2="5" y2="14"/><line x1="8" y1="12.5" x2="8" y2="14"/><line x1="11" y1="12.5" x2="11" y2="14"/></svg>' },
        { type: "accent_light", label: "Accent / Toe-Kick LED",short: "Accent Lighting",color: "#eab308", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v2M8 12v2M2 8h2M12 8h2M4 4l1.4 1.4M10.6 10.6L12 12M12 4l-1.4 1.4M5.4 10.6L4 12"/><circle cx="8" cy="8" r="2"/></svg>' },
        { type: "landscape",    label: "Landscape Lighting",   short: "Landscape Lights", color: "#65a30d", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2.5L13 8H3l5-5.5z"/><line x1="8" y1="8" x2="8" y2="14"/><line x1="5" y1="14" x2="11" y2="14"/></svg>' },
      ],
    },
    {
      id: "outlets",
      label: "Outlets & Power",
      color: "#2563eb",
      items: [
        { type: "outlet_110",     label: "110V Duplex Outlet",      short: "110V Outlets",      color: "#2563eb", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="4.5"/><line x1="6.3" y1="2.5" x2="6.3" y2="13.5"/><line x1="9.7" y1="2.5" x2="9.7" y2="13.5"/></svg>' },
        { type: "outlet_ext",     label: "Exterior Flush Outlet (WP)", short: "Exterior WP Outlets", color: "#0369a1", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="8.5" r="4"/><line x1="5.6" y1="3.5" x2="5.6" y2="13.5"/><line x1="8.4" y1="3.5" x2="8.4" y2="13.5"/><path d="M12 3.5l1.5 3.5-1.5 1-1.5-1z" fill="currentColor" stroke="none"/></svg>' },
        { type: "special_outlet", label: "Floor / Island / Cab. Outlet", short: "Specialty Outlets", color: "#4f46e5", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/></svg>' },
        { type: "power_220",      label: "220V / G.D.O. Power",     short: "220V / G.D.O.",     color: "#7c3aed", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="4.5"/><line x1="5.5" y1="2.5" x2="5.5" y2="13.5"/><line x1="8" y1="2.5" x2="8" y2="13.5"/><line x1="10.5" y1="2.5" x2="10.5" y2="13.5"/></svg>' },
      ],
    },
    {
      id: "switches",
      label: "Switches & Wiring",
      color: "#059669",
      items: [
        { type: "switch",      label: "Single-Pole Smart Switch ($)", short: "Smart Switches",   color: "#059669", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10.5 5.2C10.5 4 9.4 3.5 8 3.5S5.5 4.2 5.5 5.4c0 2.5 5 1.8 5 4.8 0 1.3-1.1 2.2-2.5 2.2s-2.5-.8-2.5-2"/><line x1="8" y1="2" x2="8" y2="14"/></svg>' },
        { type: "switch_3way", label: "3-Way Smart Switch ($3)",      short: "3-Way Switches",   color: "#10b981", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8.5 5.2C8.5 4.2 7.6 3.7 6.5 3.7S4.5 4.3 4.5 5.4c0 2.2 4 1.6 4 4.2 0 1.2-.9 2-2 2s-2-.7-2-1.8"/><line x1="6.5" y1="2.2" x2="6.5" y2="13.8"/><text x="11.5" y="13" font-size="7" font-family="monospace" fill="currentColor" stroke="none" font-weight="bold">3</text></svg>' },
        { type: "wiring",      label: "Switch-Leg Wiring Arcs",       short: "Switch-Leg Wiring",color: "#dc2626", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2"><path d="M2 12C5 4 11 4 14 12"/></svg>', isWiringToggle: true },
      ],
    },
    {
      id: "media",
      label: "Media & Low-Voltage",
      color: "#9333ea",
      items: [
        { type: "tv_media",  label: "TV & Surround Sound", short: "TV / Audio",  color: "#9333ea", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3.5" width="12" height="8" rx="1.2"/><line x1="5.5" y1="13.5" x2="10.5" y2="13.5"/></svg>' },
        { type: "data_cat6", label: "CAT 6 Ethernet Data", short: "CAT 6 Drops", color: "#a855f7", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8,3 13.5,12.5 2.5,12.5"/></svg>' },
        { type: "doorbell",  label: "Doorbell Push-Button",short: "Doorbells",   color: "#c026d3", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3a3.5 3.5 0 0 1 3.5 3.5V10l1.2 1.5H3.3L4.5 10V6.5A3.5 3.5 0 0 1 8 3z"/><line x1="6.5" y1="13.5" x2="9.5" y2="13.5"/></svg>' },
      ],
    },
    {
      id: "specialty",
      label: "HVAC & Specialty",
      color: "#0d9488",
      items: [
        { type: "exhaust_fan", label: "Timer Exhaust Fan (EXH.)",       short: "Timer Exhaust Fans", color: "#0d9488", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="5.2"/><path d="M8 8c0-2.5 2.5-3 3.5-1.5S10 10 8 8z" fill="currentColor"/></svg>' },
        { type: "specialty",   label: "Heated Floors / Warmers / FP",   short: "Specialty Loads",    color: "#14b8a6", icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11c0-2 2-2 2-4s-2-2-2-4M8 11c0-2 2-2 2-4s-2-2-2-4M12 11c0-2 2-2 2-4s-2-2-2-4"/></svg>' },
      ],
    },
  ];

  const ELEC_META_BY_TYPE = {};
  ELEC_GROUPS.forEach((g) => g.items.forEach((it) => { ELEC_META_BY_TYPE[it.type] = { ...it, group: g.label }; }));

  const ELEC_GENERAL_NOTES = [
    { num: 1, text: "Electric for motorized shades @ all windows", action: "shades" },
    { num: 2, text: "Smart switches compatible w/ Google Home",    types: ["switch", "switch_3way"] },
    { num: 3, text: "Flush mount exterior outlets",                types: ["outlet_ext"] },
    { num: 4, text: "All lighting dimmable",                       types: ["recessed_can", "ceiling_fan", "pendant", "sconce", "uc_light", "accent_light", "landscape"] },
    { num: 5, text: "Timer exhaust fans",                          types: ["exhaust_fan"] },
  ];

  // Application State
  const state = {
    sheet: "first",
    theme: "paper",
    overlays: {
      elec: false,
      elecOpacity: 0.9,
      ghost: false,
      ghostOpacity: 0.55,
      site: false,
      roof: false,
      hotspots: false,
    },
    // Interactive Electrical Legend & Spotlight state
    elecDrawerOpen: false,
    elecNotesOpen: false,
    elecShowIds: true,
    elecSelectedTypes: new Set(), // empty = clean CAD default
    elecHoverType: null,
    elecHoverId: null,
    elecFocusId: null,
    elecRoomSpotlightId: null,
    elecActiveNoteIdx: null,
    roomIdsOpen: false,
    vb: { x: 65, y: 205, w: 2335, h: 1105 },
    activeRoomId: null,
    schedTab: "doors",
    // Measurement state
    measuring: false,
    measureMode: "dist", // 'dist' | 'area'
    measureDraft: [],    // points in world coords
    mouseWorld: null,
    shiftDown: false,
    measurements: [],    // [{ type:'dist'|'area', pts:[{x,y},...] }]
  };

  // DOM References
  const svg = document.getElementById("plan-svg");
  const viewport = document.getElementById("viewport");
  const defsEl = document.getElementById("plan-defs");
  const slots = {
    site: document.getElementById("slot-site"),
    first: document.getElementById("slot-first"),
    second: document.getElementById("slot-second"),
    roof: document.getElementById("slot-roof"),
    elec1: document.getElementById("slot-elec1"),
    elec2: document.getElementById("slot-elec2"),
  };
  const hotspotsSlot = document.getElementById("slot-hotspots");
  const elecHighlightsSlot = document.getElementById("slot-elec-highlights");
  const elecTooltipEl = document.getElementById("elec-tooltip");
  const measureSlot = document.getElementById("slot-measurements");

  // ========================================================================
  // 1. Mount Pure Vector SVG Layers
  // ========================================================================
  function mountVectorLayers() {
    const data = window.FLOORPLAN_LAYERS;
    if (!data) {
      console.error("Missing window.FLOORPLAN_LAYERS vector data.");
      return;
    }
    let allDefs = "";
    Object.keys(slots).forEach((key) => {
      if (!data[key]) return;
      allDefs += data[key].defs;
      slots[key].innerHTML = data[key].body;
    });
    defsEl.innerHTML = allDefs;
  }

  // ========================================================================
  // 2. Architectural Unit Formatting (18.0 units = 1 foot)
  // ========================================================================
  function formatFeetInches(units) {
    const totalInches = (Math.abs(units) / UNITS_PER_FOOT) * 12;
    const quarters = Math.round(totalInches * 4);
    const feet = Math.floor(quarters / 48);
    const remQ = quarters % 48;
    const inches = Math.floor(remQ / 4);
    const fracQ = remQ % 4;
    const fracStr = fracQ === 1 ? "¼" : fracQ === 2 ? "½" : fracQ === 3 ? "¾" : "";
    const sign = units < 0 ? "-" : "";
    return `${sign}${feet}'-${inches}${fracStr}"`;
  }

  function polygonAreaSF(pts) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum * 0.5) / (UNITS_PER_FOOT * UNITS_PER_FOOT);
  }

  // ========================================================================
  // 3. ViewBox Camera (Smooth Pan, Zoom to Cursor, Fly-To Animation)
  // ========================================================================
  let animRaf = null;

  function applyViewBox() {
    const { x, y, w, h } = state.vb;
    svg.setAttribute("viewBox", `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    updateZoomAndScaleHUD();
    renderMeasurements(); // keep measurement label scale crisp at every zoom
    renderElecHighlights();
  }

  function fitBox(targetBox, animate = true) {
    const rect = viewport.getBoundingClientRect();
    const vw = Math.max(rect.width, 300);
    const vh = Math.max(rect.height, 200);
    const aspect = vw / vh;
    const pad = 1.06;
    let w = targetBox.w * pad;
    let h = targetBox.h * pad;
    if (w / h > aspect) {
      h = w / aspect;
    } else {
      w = h * aspect;
    }
    const cx = targetBox.x + targetBox.w / 2;
    const cy = targetBox.y + targetBox.h / 2;
    const dest = { x: cx - w / 2, y: cy - h / 2, w, h };

    if (!animate) {
      if (animRaf) cancelAnimationFrame(animRaf);
      state.vb = dest;
      applyViewBox();
      return;
    }
    animateToViewBox(dest, 280);
  }

  function animateToViewBox(dest, duration = 280) {
    if (animRaf) cancelAnimationFrame(animRaf);
    const start = { ...state.vb };
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      state.vb.x = start.x + (dest.x - start.x) * ease;
      state.vb.y = start.y + (dest.y - start.y) * ease;
      state.vb.w = start.w + (dest.w - start.w) * ease;
      state.vb.h = start.h + (dest.h - start.h) * ease;
      applyViewBox();
      if (p < 1) {
        animRaf = requestAnimationFrame(step);
      } else {
        animRaf = null;
      }
    }
    animRaf = requestAnimationFrame(step);
  }

  function screenToWorld(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;
    return {
      x: state.vb.x + rx * state.vb.w,
      y: state.vb.y + ry * state.vb.h,
    };
  }

  function zoomAt(factor, clientX, clientY) {
    if (animRaf) cancelAnimationFrame(animRaf);
    const rect = viewport.getBoundingClientRect();
    const cx = clientX != null ? clientX : rect.left + rect.width / 2;
    const cy = clientY != null ? clientY : rect.top + rect.height / 2;
    const before = screenToWorld(cx, cy);

    const baseW = SHEET_META[state.sheet].box.w;
    const minW = baseW / 18; // up to ~1800% zoom
    const maxW = baseW * 3.2;

    let newW = state.vb.w * factor;
    newW = Math.max(minW, Math.min(maxW, newW));
    const ratio = newW / state.vb.w;
    const newH = state.vb.h * ratio;

    const rx = (cx - rect.left) / rect.width;
    const ry = (cy - rect.top) / rect.height;

    state.vb.w = newW;
    state.vb.h = newH;
    state.vb.x = before.x - rx * newW;
    state.vb.y = before.y - ry * newH;
    applyViewBox();
  }

  function updateZoomAndScaleHUD() {
    const rect = viewport.getBoundingClientRect();
    if (!rect.width) return;

    // Zoom % relative to active sheet's fit width
    const baseW = SHEET_META[state.sheet].box.w * 1.06;
    const pct = Math.round((baseW / state.vb.w) * 100);
    document.getElementById("zoom-readout").textContent = `${pct}%`;

    // Live Dynamic Architectural Scale Bar
    const pxPerUnit = rect.width / state.vb.w;
    const pxPerFoot = pxPerUnit * UNITS_PER_FOOT;
    const niceFeet = [1, 2, 4, 5, 10, 20, 25, 40, 50, 100];
    let chosenFt = 10;
    for (const ft of niceFeet) {
      const px = ft * pxPerFoot;
      if (px >= 75 && px <= 185) {
        chosenFt = ft;
        break;
      }
      if (px < 75) chosenFt = ft;
    }
    const barPx = Math.max(44, Math.min(200, Math.round(chosenFt * pxPerFoot)));
    document.getElementById("scale-bar-graphic").style.width = `${barPx}px`;
    document.getElementById("scale-bar-mid").textContent = `${chosenFt / 2}'`;
    document.getElementById("scale-bar-max").textContent = `${chosenFt} ft`;
  }

  // ========================================================================
  // 4. Layer Visibility & Synchronized Overlay Composition
  // ========================================================================
  function syncLayers() {
    const s = state.sheet;
    const ov = state.overlays;

    // Reset all layer classes and inline opacities
    Object.values(slots).forEach((el) => {
      el.className.baseVal = "plan-layer";
      el.style.opacity = "";
    });

    // 1. Primary sheet
    slots[s].classList.add("visible");

    // 2. Site & Pool Context Underlay (when viewing floors, roof, or electrical)
    if (ov.site && s !== "site") {
      slots.site.classList.add("visible", "mode-underlay");
    }

    // 3. Adjacent Floor Ghost Overlay (1st <-> 2nd floor)
    if (ov.ghost) {
      if (s === "first" || s === "elec1") {
        slots.second.classList.add("visible", "mode-ghost");
        slots.second.style.opacity = String(ov.ghostOpacity);
      } else if (s === "second" || s === "elec2") {
        slots.first.classList.add("visible", "mode-ghost");
        slots.first.style.opacity = String(ov.ghostOpacity);
      }
    }

    // 4. Roof Plan Overlay
    if (ov.roof && s !== "roof") {
      slots.roof.classList.add("visible", "mode-ghost");
      slots.roof.style.opacity = "0.55";
    }

    // 5. Electrical Overlay (E1.0 over 1st floor/site, E1.2 over 2nd floor)
    if (ov.elec) {
      if (s === "first" || s === "site" || s === "roof") {
        slots.elec1.classList.add("visible", "mode-elec-overlay");
        slots.elec1.style.opacity = String(ov.elecOpacity);
      } else if (s === "second") {
        slots.elec2.classList.add("visible", "mode-elec-overlay");
        slots.elec2.style.opacity = String(ov.elecOpacity);
      }
    }

    // Update HUD & Quick Dock button states
    const meta = SHEET_META[s];
    document.getElementById("hud-sheet").textContent = `${meta.code} · ${meta.name}`;
    document.getElementById("hud-scale").textContent = `${meta.scaleLabel} · TRUE VECTOR`;

    document.querySelectorAll(".sheet-tab").forEach((btn) => {
      const active = btn.dataset.sheet === s;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    document.getElementById("toggle-elec").checked = ov.elec;
    document.getElementById("toggle-ghost").checked = ov.ghost;
    document.getElementById("toggle-site").checked = ov.site;
    document.getElementById("toggle-roof").checked = ov.roof;
    document.getElementById("toggle-hotspots").checked = ov.hotspots;
    document.getElementById("btn-quick-elec").classList.toggle("active", ov.elec || s === "elec1" || s === "elec2");
    document.getElementById("btn-quick-ghost").classList.toggle("active", ov.ghost);

    renderRoomHotspots();
    buildElecLegend();
    renderElecHighlights();
  }

  function setSheet(sheetKey, shouldFit = true) {
    if (!SHEET_META[sheetKey]) return;
    const prev = state.sheet;
    state.sheet = sheetKey;
    if (sheetKey === "elec1" || sheetKey === "elec2") {
      setElecDrawerOpen(true);
    }
    if (state.activeRoomId) {
      const room = ROOMS.find((r) => r.id === state.activeRoomId);
      const nextFloor = sheetKey === "elec1" ? "first" : sheetKey === "elec2" ? "second" : sheetKey;
      if (room && room.floor !== nextFloor) closeRoomCard();
    }
    state.elecRoomSpotlightId = null;
    state.elecFocusId = null;
    syncLayers();
    // Keep camera position if switching between aligned 1st<->elec1 or 2nd<->elec2!
    const alignedPair =
      (prev === "first" && sheetKey === "elec1") ||
      (prev === "elec1" && sheetKey === "first") ||
      (prev === "second" && sheetKey === "elec2") ||
      (prev === "elec2" && sheetKey === "second");
    if (shouldFit && !alignedPair) {
      fitBox(SHEET_META[sheetKey].box, true);
    } else {
      updateZoomAndScaleHUD();
    }
  }

  // ========================================================================
  // 4b. Interactive Electrical Legend, Canvas Spotlights & Symbol Tooltips
  // ========================================================================
  function getActiveElecFloor() {
    return (state.sheet === "second" || state.sheet === "elec2") ? "second" : "first";
  }

  function isElecVisible() {
    return state.overlays.elec || state.sheet === "elec1" || state.sheet === "elec2";
  }

  function getFloorElecItems(floor) {
    const inv = window.ELECTRICAL_INVENTORY;
    if (!inv || !inv[floor]) return [];
    return inv[floor];
  }

  function getRoomNameById(roomId) {
    if (roomId === "exterior") return "Exterior / Courtyard";
    if (roomId === "hallway-2") return "2nd Floor Hallway";
    const r = ROOMS.find((x) => x.id === roomId);
    return r ? r.name : roomId;
  }

  function setElecDrawerOpen(open) {
    state.elecDrawerOpen = open;
    const btn = document.getElementById("btn-expand-elec");
    const drawer = document.getElementById("elec-legend-drawer");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (drawer) drawer.classList.toggle("open", open);
  }

  function ensureElecActive() {
    if (!isElecVisible()) {
      state.overlays.elec = true;
    }
  }

  function toggleElecType(typeKey) {
    ensureElecActive();
    state.elecRoomSpotlightId = null;
    state.elecFocusId = null;
    state.elecActiveNoteIdx = null;
    if (state.elecSelectedTypes.has(typeKey)) {
      state.elecSelectedTypes.delete(typeKey);
    } else {
      state.elecSelectedTypes.add(typeKey);
    }
    syncLayers();
    if (state.activeRoomId) {
      const r = ROOMS.find((x) => x.id === state.activeRoomId);
      if (r) renderRoomElecSummary(r);
    }
  }

  function buildElecLegend() {
    const floor = getActiveElecFloor();
    const items = getFloorElecItems(floor);
    const counts = {};
    items.forEach((it) => { counts[it.type] = (counts[it.type] || 0) + 1; });

    const floorTag = document.getElementById("elec-legend-floor-tag");
    if (floorTag) {
      floorTag.textContent = floor === "second"
        ? `2nd Floor · E1.2 (${items.length})`
        : `1st Floor · E1.0 (${items.length})`;
    }

    const expandLabel = document.getElementById("elec-expand-label");
    if (expandLabel) {
      const activeCnt = state.elecSelectedTypes.size;
      if (state.elecFocusId) {
        expandLabel.textContent = `Electrical Legend · ${state.elecFocusId}`;
      } else if (state.elecRoomSpotlightId) {
        expandLabel.textContent = `Electrical Legend · ${getRoomNameById(state.elecRoomSpotlightId)}`;
      } else if (activeCnt > 0) {
        expandLabel.textContent = `Electrical Legend · ${activeCnt} highlighted`;
      } else {
        expandLabel.textContent = "Electrical Legend & Notes";
      }
    }

    const container = document.getElementById("elec-legend-groups");
    if (!container) return;

    let html = "";
    ELEC_GROUPS.forEach((group) => {
      const present = group.items.filter((it) => it.isWiringToggle || (counts[it.type] || 0) > 0);
      if (!present.length) return;
      html += `<div class="elec-group"><div class="elec-group-head"><span>${group.label}</span></div><div class="elec-group-items">`;
      present.forEach((it) => {
        const active = state.elecSelectedTypes.has(it.type) ? " active" : "";
        const countBadge = it.isWiringToggle ? "CIRCUITS" : String(counts[it.type] || 0);
        html += `
          <button type="button" class="elec-item-btn${active}" data-elec-type="${it.type}" style="--item-color:${it.color}">
            <span class="elec-item-left">
              <span class="elec-sym-icon">${it.icon}</span>
              <span class="elec-item-label">${it.label}</span>
            </span>
            <span class="elec-item-count">${countBadge}</span>
          </button>`;
      });
      html += `</div></div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll(".elec-item-btn").forEach((btn) => {
      const typeKey = btn.dataset.elecType;
      btn.addEventListener("click", () => toggleElecType(typeKey));
      btn.addEventListener("mouseenter", () => {
        state.elecHoverType = typeKey;
        renderElecHighlights();
      });
      btn.addEventListener("mouseleave", () => {
        if (state.elecHoverType === typeKey) {
          state.elecHoverType = null;
          renderElecHighlights();
        }
      });
    });

    // Build collapsible General Electrical Notes (5)
    const notesList = document.getElementById("elec-notes-list");
    if (notesList) {
      notesList.innerHTML = ELEC_GENERAL_NOTES.map((n, idx) => {
        const active = state.elecActiveNoteIdx === idx ? " active" : "";
        return `
          <button type="button" class="elec-note-btn${active}" data-note-idx="${idx}">
            <span class="elec-note-num">${n.num}.</span>
            <span>${n.text}</span>
          </button>`;
      }).join("");

      notesList.querySelectorAll(".elec-note-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.noteIdx);
          const note = ELEC_GENERAL_NOTES[idx];
          if (state.elecActiveNoteIdx === idx) {
            state.elecActiveNoteIdx = null;
            state.elecSelectedTypes.clear();
            if (note.action === "shades") state.overlays.hotspots = false;
          } else {
            state.elecActiveNoteIdx = idx;
            state.elecRoomSpotlightId = null;
            state.elecFocusId = null;
            state.elecSelectedTypes.clear();
            ensureElecActive();
            if (note.action === "shades") {
              state.overlays.hotspots = true;
            } else if (note.types) {
              note.types.forEach((t) => state.elecSelectedTypes.add(t));
            }
          }
          syncLayers();
        });
      });
    }
  }

  function copyElecId(id) {
    if (!id) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    const hint = document.getElementById("elec-tooltip-hint");
    if (hint) {
      hint.textContent = `Copied ${id} to clipboard`;
      setTimeout(() => {
        if (hint.textContent.startsWith("Copied")) hint.textContent = "Click symbol to copy ID";
      }, 1600);
    }
  }

  function focusElecItemById(id, zoomTo = true) {
    const inv = window.ELECTRICAL_INVENTORY;
    if (!inv) return;
    let found = null;
    for (const fl of ["first", "second"]) {
      const m = (inv[fl] || []).find((it) => it.id === id);
      if (m) { found = m; break; }
    }
    if (!found) return;

    const curFloor = getActiveElecFloor();
    if (curFloor !== found.floor) {
      state.sheet = found.floor;
    }
    state.overlays.elec = true;
    state.elecFocusId = found.id;
    state.elecRoomSpotlightId = null;
    state.elecActiveNoteIdx = null;
    syncLayers();

    if (zoomTo) {
      fitBox({ x: found.x - 190, y: found.y - 130, w: 380, h: 260 }, true);
    }
  }

  function handleElecIdSearch(query) {
    const resEl = document.getElementById("elec-id-results");
    if (!resEl) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      resEl.classList.remove("open");
      resEl.innerHTML = "";
      return;
    }
    const inv = window.ELECTRICAL_INVENTORY;
    const all = [...(inv?.first || []), ...(inv?.second || [])];
    const matches = all.filter((it) => {
      const meta = ELEC_META_BY_TYPE[it.type] || { label: it.type };
      const hay = `${it.id} ${meta.label} ${getRoomNameById(it.room)} ${it.note}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 24);

    if (!matches.length) {
      resEl.innerHTML = `<div style="padding:7px;font-size:11px;color:var(--ui-text-muted);">No devices match "${query}"</div>`;
      resEl.classList.add("open");
      return;
    }

    resEl.innerHTML = matches.map((it) => {
      const meta = ELEC_META_BY_TYPE[it.type] || { short: it.type, color: "#2563eb" };
      const fl = it.floor === "second" ? "2F" : "1F";
      return `
        <button type="button" class="elec-id-result-btn" data-jump-id="${it.id}">
          <span class="elec-id-code" style="--item-color:${meta.color}">${it.id}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-text-secondary);">${meta.short} · ${getRoomNameById(it.room)}</span>
          <span style="font-family:var(--font-mono);font-size:9.5px;color:var(--ui-text-muted);">${fl}</span>
        </button>`;
    }).join("");
    resEl.classList.add("open");

    resEl.querySelectorAll(".elec-id-result-btn").forEach((btn) => {
      const id = btn.dataset.jumpId;
      btn.addEventListener("mouseenter", () => {
        state.elecHoverId = id;
        renderElecHighlights();
      });
      btn.addEventListener("mouseleave", () => {
        if (state.elecHoverId === id) { state.elecHoverId = null; renderElecHighlights(); }
      });
      btn.addEventListener("click", () => {
        state.elecHoverId = null;
        focusElecItemById(id, true);
        copyElecId(id);
        resEl.classList.remove("open");
      });
    });
  }

  function showElecTooltip(item, clientX, clientY) {
    const meta = ELEC_META_BY_TYPE[item.type] || { label: item.type, color: "#dc2626", group: "" };
    document.getElementById("elec-tooltip-dot").style.background = meta.color;
    document.getElementById("elec-tooltip-id").textContent = item.id || "";
    document.getElementById("elec-tooltip-title").textContent = meta.label;
    const noteText = (item.note && item.note !== meta.label) ? item.note : meta.group;
    document.getElementById("elec-tooltip-note").textContent = noteText;
    const floorLbl = item.floor === "second" ? "2nd Floor" : "1st Floor";
    document.getElementById("elec-tooltip-room").textContent = `${getRoomNameById(item.room)} · ${floorLbl}`;
    document.getElementById("elec-tooltip-hint").textContent = "Click symbol to copy ID";

    const rect = viewport.getBoundingClientRect();
    let left = clientX - rect.left + 14;
    let top = clientY - rect.top - 12;
    elecTooltipEl.classList.add("visible");
    const tw = elecTooltipEl.offsetWidth || 210;
    const th = elecTooltipEl.offsetHeight || 84;
    if (left + tw > rect.width - 12) left = clientX - rect.left - tw - 14;
    if (top + th > rect.height - 12) top = rect.height - th - 12;
    if (top < 12) top = 12;
    elecTooltipEl.style.left = `${Math.max(12, left)}px`;
    elecTooltipEl.style.top = `${top}px`;
  }

  function hideElecTooltip() {
    elecTooltipEl.classList.remove("visible");
  }

  function renderElecHighlights() {
    elecHighlightsSlot.innerHTML = "";
    const activeElecSlot = getActiveElecFloor() === "second" ? slots.elec2 : slots.elec1;
    slots.elec1.classList.remove("elec-dimmed", "spotlight-wiring");
    slots.elec2.classList.remove("elec-dimmed", "spotlight-wiring");

    const floor = getActiveElecFloor();
    const allItems = getFloorElecItems(floor);
    const hasHoverId = Boolean(state.elecHoverId);
    const hasFocusId = Boolean(state.elecFocusId);
    const hasHover = Boolean(state.elecHoverType);
    const hasSelected = state.elecSelectedTypes.size > 0;
    const hasRoomSpot = Boolean(state.elecRoomSpotlightId);
    const anySpotlight = hasHoverId || hasFocusId || hasHover || hasSelected || hasRoomSpot;

    if (!isElecVisible() && !anySpotlight) {
      hideElecTooltip();
      return;
    }

    // Highlight switch-leg wiring arcs if 'wiring' is toggled or hovered
    const wiringSpot = state.elecHoverType === "wiring" || state.elecSelectedTypes.has("wiring");
    if (wiringSpot) {
      activeElecSlot.classList.add("spotlight-wiring");
    } else if (anySpotlight) {
      activeElecSlot.classList.add("elec-dimmed");
    }

    const rect = viewport.getBoundingClientRect();
    const unitPerPx = rect.width ? state.vb.w / rect.width : 1.8;
    const baseR = Math.max(7.5, Math.min(18, 9.5 * unitPerPx));
    const dotR = Math.max(2.6, Math.min(6, 3.2 * unitPerPx));
    const idFontSize = Math.max(5.5, Math.min(12, 9.2 * unitPerPx));

    // Render highlighted symbols first, then ID pills on top so tags never get buried under halos
    const labelSpecs = [];

    allItems.forEach((item) => {
      const meta = ELEC_META_BY_TYPE[item.type] || { color: "#dc2626", label: item.type };
      const isSingleFocus = item.id === state.elecHoverId || item.id === state.elecFocusId;
      let highlighted = false;
      if (hasHoverId) {
        highlighted = item.id === state.elecHoverId;
      } else if (hasHover) {
        highlighted = item.type === state.elecHoverType;
      } else if (hasFocusId) {
        highlighted = item.id === state.elecFocusId;
      } else if (hasRoomSpot) {
        highlighted = item.room === state.elecRoomSpotlightId;
      } else if (hasSelected) {
        highlighted = state.elecSelectedTypes.has(item.type);
      }

      if (!highlighted && anySpotlight) return;

      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "elec-marker-group");

      const r = item.type === "ceiling_fan" ? baseR * 1.65 : baseR;
      if (highlighted) {
        const halo = document.createElementNS(SVG_NS, "circle");
        halo.setAttribute("cx", item.x);
        halo.setAttribute("cy", item.y);
        halo.setAttribute("r", r.toFixed(1));
        halo.setAttribute("fill", meta.color);
        halo.setAttribute("stroke", meta.color);
        halo.setAttribute("class", "elec-marker-halo");
        g.appendChild(halo);

        if (isSingleFocus) {
          const ring = document.createElementNS(SVG_NS, "circle");
          ring.setAttribute("cx", item.x);
          ring.setAttribute("cy", item.y);
          ring.setAttribute("r", (r * 1.55).toFixed(1));
          ring.setAttribute("stroke", meta.color);
          ring.setAttribute("class", "elec-marker-focus-ring");
          g.appendChild(ring);
        }

        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", item.x);
        dot.setAttribute("cy", item.y);
        dot.setAttribute("r", dotR.toFixed(1));
        dot.setAttribute("fill", meta.color);
        dot.setAttribute("class", "elec-marker-dot");
        g.appendChild(dot);

        if (item.id && (state.elecShowIds || isSingleFocus)) {
          labelSpecs.push({ item, meta, r });
        }
      } else {
        const hit = document.createElementNS(SVG_NS, "circle");
        hit.setAttribute("cx", item.x);
        hit.setAttribute("cy", item.y);
        hit.setAttribute("r", Math.max(8, r).toFixed(1));
        hit.setAttribute("class", "elec-marker-hit");
        g.appendChild(hit);
      }

      g.addEventListener("pointerenter", (e) => showElecTooltip(item, e.clientX, e.clientY));
      g.addEventListener("pointermove", (e) => showElecTooltip(item, e.clientX, e.clientY));
      g.addEventListener("pointerleave", hideElecTooltip);
      g.addEventListener("click", (e) => {
        if (state.measuring || wasDragging) return;
        e.stopPropagation();
        showElecTooltip(item, e.clientX, e.clientY);
        copyElecId(item.id);
      });

      elecHighlightsSlot.appendChild(g);
    });

    // Draw crisp ID tags above highlighted symbols (only when zoomed in enough or <= 45 tags so whole-floor stays uncluttered)
    const showAllTags = labelSpecs.length <= 45 || unitPerPx < 1.15;
    if (showAllTags && labelSpecs.length > 0) {
      const labelLayer = document.createElementNS(SVG_NS, "g");
      labelLayer.setAttribute("pointer-events", "none");
      const placedBoxes = [];
      const padX = idFontSize * 0.45;
      const boxH = idFontSize * 1.45;
      const gap = idFontSize * 0.22;

      const overlaps = (x1, y1, w1, h1) =>
        placedBoxes.some((b) => !(x1 + w1 + gap < b.x || b.x + b.w + gap < x1 || y1 + h1 + gap < b.y || b.y + b.h + gap < y1));

      labelSpecs.forEach(({ item, meta, r }) => {
        const boxW = item.id.length * idFontSize * 0.62 + padX * 2;
        // Candidate positions: directly above, directly below, right, left, stacked higher/lower
        const candidates = [
          [item.x, item.y - r - boxH * 0.65],
          [item.x, item.y + r + boxH * 0.65],
          [item.x + r + boxW * 0.55, item.y],
          [item.x - r - boxW * 0.55, item.y],
          [item.x, item.y - r - boxH * 1.85],
          [item.x, item.y + r + boxH * 1.85],
          [item.x + r + boxW * 0.55, item.y - boxH * 1.15],
          [item.x - r - boxW * 0.55, item.y + boxH * 1.15],
        ];
        let lx = candidates[0][0];
        let ly = candidates[0][1];
        for (const [cx, cy] of candidates) {
          if (!overlaps(cx - boxW / 2, cy - boxH / 2, boxW, boxH)) {
            lx = cx;
            ly = cy;
            break;
          }
        }
        placedBoxes.push({ x: lx - boxW / 2, y: ly - boxH / 2, w: boxW, h: boxH });

        const bg = document.createElementNS(SVG_NS, "rect");
        bg.setAttribute("x", (lx - boxW / 2).toFixed(1));
        bg.setAttribute("y", (ly - boxH / 2).toFixed(1));
        bg.setAttribute("width", boxW.toFixed(1));
        bg.setAttribute("height", boxH.toFixed(1));
        bg.setAttribute("rx", (idFontSize * 0.3).toFixed(1));
        bg.setAttribute("stroke", meta.color);
        bg.setAttribute("class", "elec-id-bg");
        labelLayer.appendChild(bg);

        const txt = document.createElementNS(SVG_NS, "text");
        txt.setAttribute("x", lx.toFixed(1));
        txt.setAttribute("y", ly.toFixed(1));
        txt.setAttribute("font-size", idFontSize.toFixed(1));
        txt.setAttribute("class", "elec-id-text");
        txt.textContent = item.id;
        labelLayer.appendChild(txt);
      });
      elecHighlightsSlot.appendChild(labelLayer);
    }
  }

  function renderRoomElecSummary(room) {
    const sec = document.getElementById("room-elec-section");
    if (!sec) return;
    if (room.floor !== "first" && room.floor !== "second") {
      sec.style.display = "none";
      return;
    }
    sec.style.display = "block";

    const items = getFloorElecItems(room.floor).filter((it) => it.room === room.id);
    document.getElementById("room-elec-total").textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;

    // Aggregate counts by symbol type preserving ELEC_GROUPS order
    const counts = {};
    items.forEach((it) => { counts[it.type] = (counts[it.type] || 0) + 1; });
    const chipsEl = document.getElementById("room-elec-chips");
    const chipHtml = [];
    ELEC_GROUPS.forEach((g) => {
      g.items.forEach((meta) => {
        const c = counts[meta.type] || 0;
        if (c > 0) {
          chipHtml.push(`
            <button type="button" class="room-elec-chip" data-chip-type="${meta.type}" style="--chip-color:${meta.color}" title="Click to spotlight ${meta.label} across floor">
              <span class="room-elec-chip-dot"></span>
              <span><strong>${c}×</strong> ${meta.short}</span>
            </button>`);
        }
      });
    });
    chipsEl.innerHTML = chipHtml.length
      ? chipHtml.join("")
      : `<span style="font-size:11px;color:var(--ui-text-muted);">No dedicated symbols inside room bounds.</span>`;

    chipsEl.querySelectorAll(".room-elec-chip").forEach((chip) => {
      const t = chip.dataset.chipType;
      chip.addEventListener("mouseenter", () => {
        state.elecHoverType = t;
        renderElecHighlights();
      });
      chip.addEventListener("mouseleave", () => {
        if (state.elecHoverType === t) {
          state.elecHoverType = null;
          renderElecHighlights();
        }
      });
      chip.addEventListener("click", () => {
        ensureElecActive();
        setElecDrawerOpen(true);
        state.elecRoomSpotlightId = null;
        state.elecFocusId = null;
        state.elecSelectedTypes = new Set([t]);
        syncLayers();
        renderRoomElecSummary(room);
      });
    });

    // Collect notable room-specific electrical callouts (unique specialty notes)
    const genericNotes = new Set([
      "Recessed Can Fixture (Dimmable)",
      "110V Duplex Receptacle",
      "Single-Pole Smart Switch (Google Home)",
      "3-Way Smart Switch (Google Home)",
      "Single-Pole Smart Switch (Multi-Gang)",
      "3-Way Smart Switch (Multi-Gang)",
      "Ceiling Fan (Dimmable / Smart Switch)",
    ]);
    const specialNotes = [];
    const seen = new Set();
    items.forEach((it) => {
      if (it.note && !genericNotes.has(it.note) && !seen.has(it.note)) {
        seen.add(it.note);
        specialNotes.push(it.note);
      }
    });
    if (room.id !== "garage" && room.id !== "carport") {
      specialNotes.push("All lighting dimmable · Motorized shade prewire @ windows");
    }
    const notesEl = document.getElementById("room-elec-notes");
    notesEl.innerHTML = specialNotes.slice(0, 5).map((n) => `<li>${n}</li>`).join("");

    // Populate collapsible Room Device IDs list (hover spotlights that exact device, click jumps & copies ID!)
    const idsToggleLbl = document.getElementById("room-ids-toggle-label");
    const idsListEl = document.getElementById("room-ids-list");
    if (idsToggleLbl && idsListEl) {
      idsToggleLbl.textContent = `Device IDs (${items.length}) — hover to locate, click to copy`;
      idsListEl.classList.toggle("open", state.roomIdsOpen);
      document.getElementById("btn-room-ids-toggle").setAttribute("aria-expanded", state.roomIdsOpen ? "true" : "false");
      idsListEl.innerHTML = items.map((it) => {
        const meta = ELEC_META_BY_TYPE[it.type] || { label: it.type, color: "#64748b" };
        const act = state.elecFocusId === it.id ? " active" : "";
        return `<button type="button" class="room-id-pill${act}" data-device-id="${it.id}" style="--pill-color:${meta.color}" title="${it.id}: ${meta.label} — ${it.note}">${it.id}</button>`;
      }).join("");

      idsListEl.querySelectorAll(".room-id-pill").forEach((pill) => {
        const devId = pill.dataset.deviceId;
        pill.addEventListener("mouseenter", () => {
          ensureElecActive();
          state.elecHoverId = devId;
          syncLayers();
        });
        pill.addEventListener("mouseleave", () => {
          if (state.elecHoverId === devId) {
            state.elecHoverId = null;
            renderElecHighlights();
          }
        });
        pill.addEventListener("click", () => {
          state.elecHoverId = null;
          if (state.elecFocusId === devId) {
            state.elecFocusId = null;
            syncLayers();
          } else {
            focusElecItemById(devId, false);
            copyElecId(devId);
          }
          renderRoomElecSummary(room);
        });
      });
    }

    // Spotlight Room Electrical button state
    const spotBtn = document.getElementById("btn-room-elec-spotlight");
    const spotLbl = document.getElementById("btn-room-elec-label");
    const isSpot = state.elecRoomSpotlightId === room.id;
    spotBtn.classList.toggle("active", isSpot);
    spotLbl.textContent = isSpot ? "Clear Room Electrical Spotlight" : "Spotlight Room Electrical";
  }

  function toggleElecRoomSpotlight() {
    if (!state.activeRoomId) return;
    const room = ROOMS.find((r) => r.id === state.activeRoomId);
    if (!room) return;
    if (state.elecRoomSpotlightId === room.id) {
      state.elecRoomSpotlightId = null;
    } else {
      ensureElecActive();
      state.elecSelectedTypes.clear();
      state.elecFocusId = null;
      state.elecActiveNoteIdx = null;
      state.elecRoomSpotlightId = room.id;
    }
    syncLayers();
    renderRoomElecSummary(room);
  }

  // ========================================================================
  // 5. Interactive Room Hotspots & Room Directory
  // ========================================================================
  function renderRoomHotspots() {
    hotspotsSlot.innerHTML = "";
    hotspotsSlot.classList.toggle("hotspots-visible", state.overlays.hotspots);

    const floorMatch =
      state.sheet === "elec1" ? "first" :
      state.sheet === "elec2" ? "second" :
      state.sheet;

    ROOMS.filter((r) => r.floor === floorMatch).forEach((room) => {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", room.rect.x);
      rect.setAttribute("y", room.rect.y);
      rect.setAttribute("width", room.rect.w);
      rect.setAttribute("height", room.rect.h);
      rect.setAttribute("rx", "6");
      rect.setAttribute("class", "room-hotspot" + (state.activeRoomId === room.id ? " active" : ""));
      rect.setAttribute("data-room-id", room.id);

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `${room.name} (${room.ceiling}) — Click to inspect`;
      rect.appendChild(title);

      rect.addEventListener("click", (e) => {
        if (state.measuring || wasDragging) return;
        e.stopPropagation();
        selectRoom(room.id, false);
      });

      hotspotsSlot.appendChild(rect);
    });
  }

  function selectRoom(roomId, zoomTo = true) {
    const room = ROOMS.find((r) => r.id === roomId);
    if (!room) return;

    state.activeRoomId = roomId;

    // Switch sheet if room belongs to another floor
    const curFloor =
      state.sheet === "elec1" ? "first" :
      state.sheet === "elec2" ? "second" :
      state.sheet;
    if (curFloor !== room.floor) {
      state.sheet = room.floor;
      state.elecRoomSpotlightId = null;
      syncLayers();
    } else {
      if (state.elecRoomSpotlightId && state.elecRoomSpotlightId !== roomId) {
        state.elecRoomSpotlightId = roomId;
        renderElecHighlights();
      }
      renderRoomHotspots();
    }

    if (zoomTo) {
      const padX = Math.max(140, room.rect.w * 0.6);
      const padY = Math.max(110, room.rect.h * 0.6);
      fitBox({
        x: room.rect.x - padX,
        y: room.rect.y - padY,
        w: room.rect.w + padX * 2,
        h: room.rect.h + padY * 2,
      }, true);
    }

    // Show Room Inspector Card with always-visible Electrical Plan summary
    const card = document.getElementById("room-card");
    document.getElementById("room-card-title").textContent = room.name;
    document.getElementById("room-card-badge").textContent = `${room.ceiling} · ${SHEET_META[room.floor].code}`;
    document.getElementById("room-card-body").textContent = room.desc;
    document.getElementById("room-card-tags").innerHTML = room.tags
      .map((t) => `<span class="room-tag">${t}</span>`)
      .join("");
    renderRoomElecSummary(room);
    card.classList.add("visible");

    document.querySelectorAll(".room-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.roomId === roomId);
    });
  }

  function closeRoomCard() {
    state.activeRoomId = null;
    if (state.elecRoomSpotlightId) {
      state.elecRoomSpotlightId = null;
      renderElecHighlights();
      buildElecLegend();
    }
    document.getElementById("room-card").classList.remove("visible");
    document.querySelectorAll(".room-item").forEach((el) => el.classList.remove("active"));
    renderRoomHotspots();
  }

  function buildRoomDirectory(filter = "") {
    const container = document.getElementById("room-directory");
    const q = filter.trim().toLowerCase();
    const groups = new Map();
    ROOMS.forEach((r) => {
      const hay = `${r.name} ${r.ceiling} ${r.group} ${r.tags.join(" ")} ${r.desc}`.toLowerCase();
      if (q && !hay.includes(q)) return;
      if (!groups.has(r.group)) groups.set(r.group, []);
      groups.get(r.group).push(r);
    });

    if (!groups.size) {
      container.innerHTML = `<div style="padding:16px 6px;color:var(--ui-text-muted);font-size:12px;">No rooms match "${filter}".</div>`;
      return;
    }

    let html = "";
    groups.forEach((list, groupName) => {
      html += `<div class="section-label">${groupName}</div><div class="room-list">`;
      list.forEach((r) => {
        const active = state.activeRoomId === r.id ? " active" : "";
        html += `
          <button class="room-item${active}" data-room-id="${r.id}">
            <span class="room-item-title">${r.name}</span>
            <span class="room-item-meta">${r.ceiling}</span>
          </button>`;
      });
      html += `</div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll(".room-item").forEach((btn) => {
      btn.addEventListener("click", () => selectRoom(btn.dataset.roomId, true));
    });
  }

  // ========================================================================
  // 6. Door & Window Schedules (Sheet A2.3)
  // ========================================================================
  function buildScheduleTable(filter = "") {
    const container = document.getElementById("schedule-container");
    const q = filter.trim().toLowerCase();
    if (state.schedTab === "doors") {
      const rows = DOOR_SCHEDULE.filter((r) => r.join(" ").toLowerCase().includes(q));
      container.innerHTML = `
        <table class="sched-table">
          <thead><tr><th>Mark</th><th>Size (W×H)</th><th>Notes</th></tr></thead>
          <tbody>
            ${rows.map(([m, w, h, n]) => `
              <tr>
                <td class="sched-mark">${m}</td>
                <td class="sched-dim">${w} × ${h}</td>
                <td class="sched-note">${n}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;
    } else {
      const rows = WINDOW_SCHEDULE.filter((r) => r.join(" ").toLowerCase().includes(q));
      container.innerHTML = `
        <table class="sched-table">
          <thead><tr><th>Type</th><th>W × H (Qty)</th><th>Family / Notes</th></tr></thead>
          <tbody>
            ${rows.map(([m, w, h, c, f, n]) => `
              <tr>
                <td class="sched-mark">${m}</td>
                <td class="sched-dim">${w} × ${h} <span style="color:var(--ui-text-muted)">(${c})</span></td>
                <td class="sched-note"><strong>${f}</strong> · ${n}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;
    }
  }

  // ========================================================================
  // 7. Precision Real-World Distance & Area Measurement Tool
  // ========================================================================
  function snapPoint(prev, raw) {
    if (!state.shiftDown || !prev) return raw;
    const dx = Math.abs(raw.x - prev.x);
    const dy = Math.abs(raw.y - prev.y);
    return dx >= dy ? { x: raw.x, y: prev.y } : { x: prev.x, y: raw.y };
  }

  function renderMeasurements() {
    measureSlot.innerHTML = "";
    const rect = viewport.getBoundingClientRect();
    if (!rect.width) return;
    // Scale HUD labels in SVG world units so they remain constant 11px on screen!
    const unitPerPx = state.vb.w / rect.width;
    const fontSize = 11.5 * unitPerPx;
    const dotR = 4.2 * unitPerPx;

    function addTag(cx, cy, label) {
      const padX = 7 * unitPerPx;
      const boxH = 20 * unitPerPx;
      const boxW = label.length * fontSize * 0.62 + padX * 2;

      const bg = document.createElementNS(SVG_NS, "rect");
      bg.setAttribute("x", cx - boxW / 2);
      bg.setAttribute("y", cy - boxH / 2);
      bg.setAttribute("width", boxW);
      bg.setAttribute("height", boxH);
      bg.setAttribute("rx", 4 * unitPerPx);
      bg.setAttribute("class", "measure-tag-bg");
      measureSlot.appendChild(bg);

      const txt = document.createElementNS(SVG_NS, "text");
      txt.setAttribute("x", cx);
      txt.setAttribute("y", cy);
      txt.setAttribute("font-size", fontSize);
      txt.setAttribute("class", "measure-tag-text");
      txt.textContent = label;
      measureSlot.appendChild(txt);
    }

    function addDot(p) {
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", p.x);
      c.setAttribute("cy", p.y);
      c.setAttribute("r", dotR);
      c.setAttribute("class", "measure-dot");
      measureSlot.appendChild(c);
    }

    function drawDist(a, b, isPreview) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", a.x);
      line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x);
      line.setAttribute("y2", b.y);
      line.setAttribute("class", "measure-line" + (isPreview ? " preview" : ""));
      measureSlot.appendChild(line);
      addDot(a);
      addDot(b);
      const distUnits = Math.hypot(b.x - a.x, b.y - a.y);
      const decFt = (distUnits / UNITS_PER_FOOT).toFixed(2);
      addTag((a.x + b.x) / 2, (a.y + b.y) / 2 - 14 * unitPerPx, `${formatFeetInches(distUnits)} (${decFt}')`);
    }

    function drawArea(pts, isPreview) {
      if (pts.length < 2) return;
      const poly = document.createElementNS(SVG_NS, pts.length >= 3 ? "polygon" : "polyline");
      poly.setAttribute("points", pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
      poly.setAttribute("class", pts.length >= 3 ? "measure-poly" : "measure-line preview");
      measureSlot.appendChild(poly);
      pts.forEach(addDot);
      if (pts.length >= 3) {
        const area = polygonAreaSF(pts);
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        addTag(cx, cy, `${area.toFixed(1)} SF`);
      }
    }

    // Completed measurements
    state.measurements.forEach((m) => {
      if (m.type === "dist") drawDist(m.pts[0], m.pts[1], false);
      else drawArea(m.pts, false);
    });

    // Live draft measurement
    if (state.measuring && state.measureDraft.length > 0 && state.mouseWorld) {
      const prev = state.measureDraft[state.measureDraft.length - 1];
      const cur = snapPoint(prev, state.mouseWorld);
      if (state.measureMode === "dist") {
        drawDist(state.measureDraft[0], cur, true);
      } else {
        drawArea([...state.measureDraft, cur], true);
      }
    }
  }

  function setMeasuring(active) {
    state.measuring = active;
    state.measureDraft = [];
    viewport.classList.toggle("measuring", active);
    document.getElementById("btn-measure").classList.toggle("active", active);
    document.getElementById("measure-banner").classList.toggle("visible", active);
    updateMeasureHint();
    renderMeasurements();
  }

  function updateMeasureHint() {
    const hint = document.getElementById("measure-hint");
    if (state.measureMode === "dist") {
      hint.textContent = "Click two points · Hold Shift for 90° ortho snap";
    } else {
      hint.textContent = "Click vertices · Double-click or press Enter to close area";
    }
    document.getElementById("btn-mode-dist").classList.toggle("active", state.measureMode === "dist");
    document.getElementById("btn-mode-area").classList.toggle("active", state.measureMode === "area");
  }

  function finishAreaDraft() {
    if (state.measureMode === "area" && state.measureDraft.length >= 3) {
      state.measurements.push({ type: "area", pts: [...state.measureDraft] });
      state.measureDraft = [];
      renderMeasurements();
    }
  }

  // ========================================================================
  // 8. Export Standalone Composed Vector SVG
  // ========================================================================
  function exportCurrentSVG() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    const visibleSlots = Object.entries(slots)
      .filter(([, el]) => el.classList.contains("visible"))
      .map(([k, el]) => {
        const cls = el.getAttribute("class");
        const op = el.style.opacity ? ` opacity="${el.style.opacity}"` : "";
        return `<g class="${cls}"${op}>${el.innerHTML}</g>`;
      })
      .join("");

    const meta = SHEET_META[state.sheet];
    const vb = `${state.vb.x.toFixed(1)} ${state.vb.y.toFixed(1)} ${state.vb.w.toFixed(1)} ${state.vb.h.toFixed(1)}`;
    const out = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">
<style>
  svg{background:${v("--v-paper")};stroke-linecap:round;stroke-linejoin:round}
  .s-ink{stroke:${v("--v-ink")}}.s-mid{stroke:${v("--v-mid")}}.s-dim{stroke:${v("--v-dim")}}.s-light{stroke:${v("--v-light")}}.s-elec{stroke:${v("--v-elec")}}.s-paper{stroke:${v("--v-paper")}}
  .f-ink{fill:${v("--v-ink")}}.f-paper{fill:${v("--v-paper")}}.f-wall{fill:${v("--v-wall")}}.f-shade{fill:${v("--v-shade")}}.f-tint{fill:${v("--v-tint")}}.f-elec{fill:${v("--v-elec")}}
  .mode-ghost .s-ink,.mode-ghost .s-mid{stroke:${v("--v-ghost-stroke")}}.mode-ghost .s-dim,.mode-ghost .s-light{stroke:${v("--v-ghost-dim")}}.mode-ghost .f-ink{fill:${v("--v-ghost-stroke")}}.mode-ghost .f-wall{fill:${v("--v-ghost-wall")}}.mode-ghost .f-paper{fill:none}
  .mode-underlay{opacity:.34}.mode-underlay .f-paper{fill:none}
  .mode-elec-overlay .f-paper,.mode-elec-overlay .f-wall,.mode-elec-overlay .f-shade,.mode-elec-overlay .f-tint{fill:none}.mode-elec-overlay .s-ink,.mode-elec-overlay .s-mid,.mode-elec-overlay .s-dim{stroke:${v("--v-elec")};stroke-opacity:.45}.mode-elec-overlay .f-ink{fill:${v("--v-elec")};fill-opacity:.85}
</style>
<defs>${defsEl.innerHTML}</defs>
${visibleSlots}
</svg>`;

    const blob = new Blob([out], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `house-floorplan-${meta.code.toLowerCase()}-${state.theme}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ========================================================================
  // 9. Pointer / Wheel / Touch / Keyboard Interactions
  // ========================================================================
  let isPanning = false;
  let wasDragging = false;
  let panStart = null;
  let panStartVb = null;
  let pinchDist = null;

  viewport.addEventListener("wheel", (e) => {
    if (!svg.contains(e.target)) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.13 : 1 / 1.13;
    zoomAt(factor, e.clientX, e.clientY);
  }, { passive: false });

  viewport.addEventListener("pointerdown", (e) => {
    if (!svg.contains(e.target)) return;
    if (e.button !== 0 && e.button !== 1) return;
    if (state.measuring && e.button === 0) {
      const raw = screenToWorld(e.clientX, e.clientY);
      const prev = state.measureDraft[state.measureDraft.length - 1];
      const pt = snapPoint(prev, raw);
      if (state.measureMode === "dist") {
        if (state.measureDraft.length === 0) {
          state.measureDraft = [pt];
        } else {
          state.measurements.push({ type: "dist", pts: [state.measureDraft[0], pt] });
          state.measureDraft = [];
        }
      } else {
        state.measureDraft.push(pt);
      }
      renderMeasurements();
      return;
    }

    isPanning = true;
    wasDragging = false;
    panStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    panStartVb = { ...state.vb };
    viewport.classList.add("panning");
  });

  viewport.addEventListener("pointermove", (e) => {
    const w = screenToWorld(e.clientX, e.clientY);
    state.mouseWorld = w;

    // Update live coordinates relative to ADU SW architectural origin (164.4, 971.5)
    const relX = w.x - 164.4;
    const relY = 971.5 - w.y;
    document.getElementById("coord-badge").textContent =
      `E: ${formatFeetInches(relX)} · N: ${formatFeetInches(relY)}`;

    if (state.measuring && state.measureDraft.length > 0) {
      renderMeasurements();
    }

    if (!isPanning || !panStart) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    if (!wasDragging && Math.hypot(dx, dy) > 4) {
      wasDragging = true;
      try { viewport.setPointerCapture(panStart.pointerId); } catch (_) {}
    }
    if (!wasDragging) return;

    const rect = viewport.getBoundingClientRect();
    state.vb.x = panStartVb.x - (dx / rect.width) * panStartVb.w;
    state.vb.y = panStartVb.y - (dy / rect.height) * panStartVb.h;
    applyViewBox();
  });

  function endPan(e) {
    if (!isPanning) return;
    isPanning = false;
    viewport.classList.remove("panning");
    try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  viewport.addEventListener("pointerup", endPan);
  viewport.addEventListener("pointercancel", endPan);

  viewport.addEventListener("dblclick", (e) => {
    if (!svg.contains(e.target)) return;
    if (state.measuring && state.measureMode === "area") {
      e.preventDefault();
      // Remove duplicate point added by second click of dblclick
      if (state.measureDraft.length > 3) state.measureDraft.pop();
      finishAreaDraft();
    }
  });

  // Two-finger touch pinch zoom
  viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && pinchDist) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAt(pinchDist / d, midX, midY);
      pinchDist = d;
    }
  }, { passive: false });

  viewport.addEventListener("touchend", () => { pinchDist = null; });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === "Shift") {
      state.shiftDown = true;
      if (state.measuring && state.measureDraft.length) renderMeasurements();
    }
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

    const sheetKeys = { "1": "first", "2": "second", "3": "site", "4": "roof", "5": "elec1", "6": "elec2" };
    if (sheetKeys[e.key]) { setSheet(sheetKeys[e.key], true); return; }
    if (e.key === "=" || e.key === "+") { zoomAt(1 / 1.25); return; }
    if (e.key === "-" || e.key === "_") { zoomAt(1.25); return; }
    if (e.key === "0") { fitBox(SHEET_META[state.sheet].box, true); return; }
    if (e.key.toLowerCase() === "m") { setMeasuring(!state.measuring); return; }
    if (e.key.toLowerCase() === "e") {
      state.overlays.elec = !state.overlays.elec;
      if (state.overlays.elec) setElecDrawerOpen(true);
      syncLayers();
      return;
    }
    if (e.key.toLowerCase() === "g") { state.overlays.ghost = !state.overlays.ghost; syncLayers(); return; }
    if (e.key.toLowerCase() === "r") { state.overlays.hotspots = !state.overlays.hotspots; syncLayers(); return; }
    if (e.key.toLowerCase() === "b") { document.getElementById("sidebar").classList.toggle("collapsed"); return; }
    if (e.key === "Enter" && state.measuring && state.measureMode === "area") { finishAreaDraft(); return; }
    if (e.key === "Escape") {
      if (state.measureDraft.length > 0) {
        state.measureDraft = [];
        renderMeasurements();
      } else if (state.measuring) {
        setMeasuring(false);
      } else if (state.elecFocusId) {
        state.elecFocusId = null;
        syncLayers();
        if (state.activeRoomId) {
          const r = ROOMS.find((x) => x.id === state.activeRoomId);
          if (r) renderRoomElecSummary(r);
        }
      } else {
        closeRoomCard();
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
      state.shiftDown = false;
      if (state.measuring && state.measureDraft.length) renderMeasurements();
    }
  });

  window.addEventListener("resize", () => {
    fitBox(state.vb, false);
  });

  // ========================================================================
  // 10. Wire UI Controls
  // ========================================================================
  function bindUI() {
    // Sheet tabs
    document.querySelectorAll(".sheet-tab").forEach((btn) => {
      btn.addEventListener("click", () => setSheet(btn.dataset.sheet, true));
    });

    // Sidebar toggle & panel switcher
    document.getElementById("btn-toggle-sidebar").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("collapsed");
      setTimeout(() => updateZoomAndScaleHUD(), 200);
    });

    document.querySelectorAll(".sidebar-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".sidebar-nav-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".sidebar-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`panel-${btn.dataset.panel}`).classList.add("active");
      });
    });

    // Display Theme swatches
    document.querySelectorAll(".theme-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.theme = btn.dataset.theme;
        document.documentElement.setAttribute("data-theme", state.theme);
        document.querySelectorAll(".theme-swatch").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    // Overlay Toggles & Opacity Sliders
    document.getElementById("toggle-elec").addEventListener("change", (e) => {
      state.overlays.elec = e.target.checked;
      if (state.overlays.elec) setElecDrawerOpen(true);
      syncLayers();
    });
    document.getElementById("opacity-elec").addEventListener("input", (e) => {
      state.overlays.elecOpacity = Number(e.target.value) / 100;
      document.getElementById("opacity-elec-val").textContent = `${e.target.value}%`;
      syncLayers();
    });

    // Expandable Electrical Legend, Device ID Search & General Notes Controls
    document.getElementById("btn-expand-elec").addEventListener("click", () => {
      setElecDrawerOpen(!state.elecDrawerOpen);
    });
    const idSearchInput = document.getElementById("elec-id-search");
    idSearchInput.addEventListener("input", (e) => handleElecIdSearch(e.target.value));
    idSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const firstBtn = document.querySelector("#elec-id-results .elec-id-result-btn");
        if (firstBtn) firstBtn.click();
      } else if (e.key === "Escape") {
        idSearchInput.value = "";
        handleElecIdSearch("");
      }
    });
    document.getElementById("btn-elec-ids").addEventListener("click", () => {
      state.elecShowIds = !state.elecShowIds;
      document.getElementById("btn-elec-ids").classList.toggle("active", state.elecShowIds);
      renderElecHighlights();
    });
    document.getElementById("btn-elec-all").addEventListener("click", () => {
      ensureElecActive();
      state.elecRoomSpotlightId = null;
      state.elecFocusId = null;
      state.elecActiveNoteIdx = null;
      const items = getFloorElecItems(getActiveElecFloor());
      state.elecSelectedTypes = new Set(items.map((it) => it.type));
      syncLayers();
    });
    document.getElementById("btn-elec-clear").addEventListener("click", () => {
      state.elecSelectedTypes.clear();
      state.elecRoomSpotlightId = null;
      state.elecFocusId = null;
      state.elecHoverId = null;
      state.elecActiveNoteIdx = null;
      idSearchInput.value = "";
      handleElecIdSearch("");
      syncLayers();
      if (state.activeRoomId) {
        const r = ROOMS.find((x) => x.id === state.activeRoomId);
        if (r) renderRoomElecSummary(r);
      }
    });
    document.getElementById("btn-elec-notes-toggle").addEventListener("click", () => {
      state.elecNotesOpen = !state.elecNotesOpen;
      document.getElementById("btn-elec-notes-toggle").setAttribute("aria-expanded", state.elecNotesOpen ? "true" : "false");
      document.getElementById("elec-notes-list").classList.toggle("open", state.elecNotesOpen);
    });
    document.getElementById("btn-room-ids-toggle").addEventListener("click", () => {
      state.roomIdsOpen = !state.roomIdsOpen;
      document.getElementById("btn-room-ids-toggle").setAttribute("aria-expanded", state.roomIdsOpen ? "true" : "false");
      document.getElementById("room-ids-list").classList.toggle("open", state.roomIdsOpen);
    });

    document.getElementById("toggle-ghost").addEventListener("change", (e) => {
      state.overlays.ghost = e.target.checked;
      syncLayers();
    });
    document.getElementById("opacity-ghost").addEventListener("input", (e) => {
      state.overlays.ghostOpacity = Number(e.target.value) / 100;
      document.getElementById("opacity-ghost-val").textContent = `${e.target.value}%`;
      syncLayers();
    });

    document.getElementById("toggle-site").addEventListener("change", (e) => {
      state.overlays.site = e.target.checked;
      syncLayers();
    });
    document.getElementById("toggle-roof").addEventListener("change", (e) => {
      state.overlays.roof = e.target.checked;
      syncLayers();
    });
    document.getElementById("toggle-hotspots").addEventListener("change", (e) => {
      state.overlays.hotspots = e.target.checked;
      syncLayers();
    });

    // Quick Zone Jump Buttons
    document.querySelectorAll(".zone-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.zone;
        if (key === "full") {
          fitBox(SHEET_META[state.sheet].box, true);
          return;
        }
        const z = ZONES[key];
        if (!z) return;
        if (z.sheet && state.sheet !== z.sheet) {
          state.sheet = z.sheet;
          syncLayers();
        }
        fitBox(z.box, true);
      });
    });

    // Room Directory Search, Inspector Close & Room Electrical Spotlight
    document.getElementById("room-search").addEventListener("input", (e) => buildRoomDirectory(e.target.value));
    document.getElementById("room-card-close").addEventListener("click", closeRoomCard);
    document.getElementById("btn-room-elec-spotlight").addEventListener("click", toggleElecRoomSpotlight);

    // Schedules Tabs & Search
    document.querySelectorAll(".sched-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.schedTab = btn.dataset.sched;
        document.querySelectorAll(".sched-tab").forEach((b) => b.classList.toggle("active", b === btn));
        buildScheduleTable(document.getElementById("sched-search").value);
      });
    });
    document.getElementById("sched-search").addEventListener("input", (e) => buildScheduleTable(e.target.value));

    // Bottom Dock Controls
    document.getElementById("btn-zoom-in").addEventListener("click", () => zoomAt(1 / 1.28));
    document.getElementById("btn-zoom-out").addEventListener("click", () => zoomAt(1.28));
    document.getElementById("btn-fit").addEventListener("click", () => fitBox(SHEET_META[state.sheet].box, true));
    document.getElementById("btn-measure").addEventListener("click", () => setMeasuring(!state.measuring));
    document.getElementById("btn-quick-elec").addEventListener("click", () => {
      state.overlays.elec = !state.overlays.elec;
      if (state.overlays.elec) setElecDrawerOpen(true);
      syncLayers();
    });
    document.getElementById("btn-quick-ghost").addEventListener("click", () => {
      state.overlays.ghost = !state.overlays.ghost;
      syncLayers();
    });

    // Measurement Banner Controls
    document.getElementById("btn-mode-dist").addEventListener("click", () => {
      state.measureMode = "dist";
      state.measureDraft = [];
      updateMeasureHint();
      renderMeasurements();
    });
    document.getElementById("btn-mode-area").addEventListener("click", () => {
      state.measureMode = "area";
      state.measureDraft = [];
      updateMeasureHint();
      renderMeasurements();
    });
    document.getElementById("btn-clear-measures").addEventListener("click", () => {
      state.measurements = [];
      state.measureDraft = [];
      renderMeasurements();
    });
    document.getElementById("btn-exit-measure").addEventListener("click", () => setMeasuring(false));

    // Export SVG & Print
    document.getElementById("btn-export-svg").addEventListener("click", exportCurrentSVG);
    document.getElementById("btn-print").addEventListener("click", () => window.print());
  }

  // ========================================================================
  // Boot
  // ========================================================================
  mountVectorLayers();
  buildRoomDirectory();
  buildScheduleTable();
  bindUI();
  syncLayers();
  fitBox(SHEET_META.first.box, false);
})();
