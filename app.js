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
      desc: "Open living room overlooking the east pool courtyard through the 12'×10' full glass opening (Door 108), with recessed floor outlet and TV conduit to cabinetry.",
      tags: ["Door 108 (12'×10')", "Floor Outlet", "Ceiling Fan", "Window E"]
    },
    {
      id: "dining", floor: "first", group: "First Floor — Main Residence",
      name: "Dining Nook", ceiling: "10' CLG",
      rect: { x: 1396, y: 855, w: 245, h: 218 },
      desc: "Signature curved banquette dining alcove with four curved fixed-glass windows (Type D) wrapping the morning-sun courtyard view.",
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
      desc: "Grand north front entry (Door 100 w/ 2' sidelite & transom), full-height cabinetry, bench/shoe storage, twin 8' deep archways, and curved-landing main staircase.",
      tags: ["Door 100", "Deep Archways", "Bench Storage", "Stairs UP", "Door 107"]
    },
    {
      id: "office", floor: "first", group: "First Floor — Main Residence",
      name: "Office", ceiling: "9' CLG",
      rect: { x: 1968, y: 382, w: 190, h: 215 },
      desc: "Private northwest study accessed via arched Door 101, with direct pocket-door access (102) to Bath 1, ceiling fan, and curved corner window detail.",
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
      desc: "Curved northeast reading lounge featuring a linear electric fireplace, floor-to-ceiling bookshelves, and 10' tall glass-block accent windows (Type V).",
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
      desc: "Private ADU bedroom with built-in closet, 2-in-1 washer/dryer alcove, ceiling fan, and south/west casement & fixed perimeter windows.",
      tags: ["2-1 W/D Closet", "Windows B & G", "Doors 302/303/304"]
    },
    {
      id: "adu-bath", floor: "first", group: "Garage, Carport & ADU (607 SF)",
      name: "ADU Bath", ceiling: "10' CLG",
      rect: { x: 392, y: 382, w: 104, h: 192 },
      desc: "ADU full bathroom with walk-in tiled shower, vanity, linen closet (305), and west clerestory window (H).",
      tags: ["Walk-in Shower", "Door 306", "Window H"]
    },

    // Second Floor — 1,294 SF
    {
      id: "primary-bdrm", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Primary Bedroom", ceiling: "Vaulted CLG",
      rect: { x: 1152, y: 644, w: 334, h: 274 },
      desc: "Vaulted-ceiling primary bedroom with curved southeast corner, south-facing 9'×6' 3-panel slider window (N), dual east-facing 9' tall casements (M), and motorized shade prewire.",
      tags: ["Vaulted Ceiling", "9'×6' Slider N", "2× Casement M", "Pocket Doors 207/208"]
    },
    {
      id: "primary-clst", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Primary Closet", ceiling: "9' CLG",
      rect: { x: 1152, y: 528, w: 334, h: 114 },
      desc: "Walk-in primary dressing closet running the full width behind the bed wall, with west clerestory window (O) and dual-side hanging/shelving.",
      tags: ["Window O (9'×2')", "Pocket Door 208", "Dual-Side Built-ins"]
    },
    {
      id: "bath-3", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Bath 3 (Primary Bath)", ceiling: "9' CLG",
      rect: { x: 1492, y: 528, w: 248, h: 332 },
      desc: "Spa primary bath with dual vanity, soaking tub under overhead skylight (T), oversized shower with bench & arched niche, private WC (Door 205), heated floors, and towel warmers.",
      tags: ["Skylight T", "Heated Floors", "Towel Warmers", "Soaking Tub", "Windows P & Q"]
    },
    {
      id: "bath-2", floor: "second", group: "Second Floor — 1,294 SF",
      name: "Bath 2", ceiling: "9' CLG",
      rect: { x: 1744, y: 528, w: 146, h: 178 },
      desc: "Second-floor full bath serving the Game Room / guest suite, with tiled walk-in shower, vanity, clerestory window (R), and linen closet (Door 202).",
      tags: ["Walk-in Shower", "Door 201 & 202", "Window R"]
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
      desc: "Spacious north-end game room / media lounge featuring built-in dual desk workstation along the stair wall, Hi/Lo TV wall, ceiling fan, and three-sided glazing.",
      tags: ["Dual Desk Built-in", "Hi/Lo TV", "Door 200", "Windows I/J/K/S", "Stairs DN"]
    },

    // Site Features
    {
      id: "pool", floor: "site", group: "Site & Outdoor (7,805 SF Lot)",
      name: "Pool & East Courtyard", ceiling: "Outdoor",
      rect: { x: 1640, y: 970, w: 300, h: 330 },
      desc: "Arched-end east courtyard pool framed directly between the Dining Nook, Living Room, and Powder Room, capturing direct morning and midday sun.",
      tags: ["Courtyard Pool", "Pool Equip Pad (24 SF)", "Garden Wall (50 SF)", "Landscape Lighting"]
    },
    {
      id: "pecans", floor: "site", group: "Site & Outdoor (7,805 SF Lot)",
      name: "Protected Pecan Trees", ceiling: "CRZ Tree Zones",
      rect: { x: 1200, y: 90, w: 1480, h: 520 },
      desc: "Four heritage protected pecan trees (24\", 24\", 22\", and 19\") along the west and northwest sides providing natural late-afternoon shade.",
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
    ["A", "1'-6\"",    "5'-0\"",    "2", "FG",          "North facade fixed glass (Office)"],
    ["B", "1'-6\"",    "10'-0\"",   "2", "FG",          "ADU south facade tall fixed"],
    ["C", "3'-0\"",    "10'-0\"",   "1", "FG",          "Dining courtyard north-facing"],
    ["D", "2'-9\"",    "7'-0\"",    "4", "FG",          "CURVED (Dining east/southeast bay)"],
    ["E", "3'-0\"",    "10'-0\"",   "1", "FG",          "Living west full-height fixed"],
    ["F", "5'-0\"",    "3'-0\"",    "1", "FG",          "Bath 1 clerestory"],
    ["G", "3'-0\"",    "5'-0\"",    "3", "CSMT",        "West casements (ADU & Office)"],
    ["H", "5'-6\"",    "2'-0\"",    "1", "FG",          "ADU Bath west clerestory"],
    ["I", "1'-6\"",    "6'-0\"",    "4", "FG",          "Game Room north & west vertical"],
    ["J", "3'-0\"",    "9'-0\"",    "1", "FG",          "Stair / Game Room east tall"],
    ["K", "4'-0\"",    "3'-0\"",    "2", "FG",          "2nd Fl. east clerestory"],
    ["L", "10'-0\"",   "3'-0\"",    "1", "FG",          "2nd Fl. east wide clerestory"],
    ["M", "3'-0\"",    "9'-0\"",    "2", "CSMT",        "Primary Bedroom east tall casements"],
    ["N", "9'-0\"",    "6'-0\"",    "1", "3-PNL SLIDER","Primary Bedroom south slider"],
    ["O", "9'-0\"",    "2'-0\"",    "1", "AWN",         "Primary Closet west awning"],
    ["P", "7'-2\"",    "3'-0\"",    "1", "FG",          "Bath 3 west picture"],
    ["Q", "3'-0\"",    "3'-0\"",    "1", "CSMT",        "Bath 3 WC west casement"],
    ["R", "5'-0\"",    "3'-0\"",    "1", "FG",          "Bath 2 west clerestory"],
    ["S", "3'-0\"",    "6'-0\"",    "1", "CSMT",        "Game Room west casement"],
    ["T", "1'-9½\"",   "5'-10¾\"",  "1", "Skylight",    "Bath 3 flat roof skylight"],
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

  // Aligned Vector Windows & Glazing Legend Categories
  const WIN_CATEGORIES = [
    {
      category: "fixed",
      label: "Fixed Picture & Curved Glass (FG)",
      short: "Fixed Glass",
      color: "#0284c7",
      icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="3" width="11" height="10" rx="1"/><line x1="5" y1="10.5" x2="10.5" y2="5"/></svg>',
    },
    {
      category: "operable",
      label: "Operable Casement / Slider / Awning",
      short: "Operable Windows",
      color: "#0d9488",
      icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="3" width="11" height="10" rx="1"/><polyline points="11,3 5,8 11,13"/></svg>',
    },
    {
      category: "glazed_door",
      label: "Glazed Doors, Sidelites & Transoms",
      short: "Glazed Doors",
      color: "#6366f1",
      icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="10" height="12"/><line x1="3" y1="5.5" x2="13" y2="5.5"/><line x1="8" y1="5.5" x2="8" y2="14"/></svg>',
    },
    {
      category: "diffused",
      label: "Glass Block & Overhead Skylight",
      short: "Glass Block / Skylight",
      color: "#d97706",
      icon: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2.5" width="11" height="11" rx="1"/><line x1="8" y1="2.5" x2="8" y2="13.5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/></svg>',
    },
  ];

  const WIN_META_BY_CAT = {};
  WIN_CATEGORIES.forEach((c) => { WIN_META_BY_CAT[c.category] = c; });

  // Application State
  const state = {
    sheet: "first",
    theme: "paper",
    overlays: {
      sun: false,
      sunOpacity: 0.85,
      win: false,
      elec: false,
      elecOpacity: 0.9,
      ghost: false,
      ghostOpacity: 0.55,
      site: false,
      roof: false,
      hotspots: false,
    },
    // Sunlight & Daylighting Simulation state
    sunDrawerOpen: false,
    sunDate: "2026-03-20",  // Spring Equinox default
    sunPreset: "equinox",
    sunMinutes: 570,        // 9:30 AM default (vivid morning courtyard sun!)
    sunPlaying: false,
    sunTreeShade: true,
    sunExtShadows: true,
    sunShowArc: true,
    // Windows & Glazing Overlay state
    winDrawerOpen: false,
    winShowIds: true,
    winSelectedCats: new Set(),
    winHoverCat: null,
    winHoverId: null,
    winFocusId: null,
    roomWinIdsOpen: false,
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
  const solarDefsEl = document.getElementById("solar-defs");
  const slots = {
    site: document.getElementById("slot-site"),
    first: document.getElementById("slot-first"),
    second: document.getElementById("slot-second"),
    roof: document.getElementById("slot-roof"),
    elec1: document.getElementById("slot-elec1"),
    elec2: document.getElementById("slot-elec2"),
  };
  const extShadowsSlot = document.getElementById("slot-ext-shadows");
  const sunlightSlot = document.getElementById("slot-sunlight");
  const hotspotsSlot = document.getElementById("slot-hotspots");
  const windowsSlot = document.getElementById("slot-windows");
  const elecHighlightsSlot = document.getElementById("slot-elec-highlights");
  const elecTooltipEl = document.getElementById("elec-tooltip");
  const winTooltipEl = document.getElementById("win-tooltip");
  const sunScrubberBar = document.getElementById("sun-scrubber-bar");
  const measureSlot = document.getElementById("slot-measurements");

  // ========================================================================
  // 1. Mount Pure Vector SVG Layers & Interior Daylight Clip Zones
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
    mountSolarDefs();
  }

  function mountSolarDefs() {
    const ws = window.WINDOWS_AND_SOLAR_DATA;
    if (!ws || !solarDefsEl) return;
    let defsHtml = "";

    // Interior wall clipPaths so every room's sunbeams stop cleanly at interior walls
    Object.entries(ws.clipZones || {}).forEach(([clipId, pts]) => {
      const ptStr = pts.map((p) => `${p[0]},${p[1]}`).join(" ");
      defsHtml += `<clipPath id="${clipId}"><polygon points="${ptStr}" /></clipPath>`;
    });

    // Exterior ground clipPath: outer lot minus two disjoint building footprints (ADU + Main/Garage/Patio/Carport)
    const aduHole = "M 171 373 L 503 373 L 503 928 L 414 928 L 414 964 L 171 964 Z";
    const mainUnifiedHole =
      "M 503.5 580 L 737 580 L 737 525 L 1804 525 L 1804 377 L 2164 377 L 2164 558 " +
      "L 2200 558 L 2200 592 L 2257 592 L 2257 1073 L 1965 1073 L 1965 922 L 1614 922 " +
      "L 1614 1074 L 1465 1074 L 1405 1040 L 1377 980 L 1377 922 L 503.5 922 Z";
    defsHtml += `<clipPath id="clip-exterior-ground" clip-rule="evenodd"><path clip-rule="evenodd" d="M -800 -600 H 3900 V 2400 H -800 Z ${aduHole} ${mainUnifiedHole}" /></clipPath>`;

    // Glowing radial gradient for sun orb
    defsHtml += `
      <radialGradient id="sun-orb-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fde047" stop-opacity="1" />
        <stop offset="55%" stop-color="#f59e0b" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
      </radialGradient>`;

    solarDefsEl.innerHTML = defsHtml;
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
    renderWindowsOverlay();
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

    // 2. Site & Pool Context Underlay (when viewing floors, roof, or electrical — or softly when Exterior Pool Shadows are active on 1st floor)
    if ((ov.site || (ov.sun && state.sunExtShadows && (s === "first" || s === "elec1"))) && s !== "site") {
      slots.site.classList.add("visible", "mode-underlay");
      if (!ov.site) slots.site.style.opacity = "0.24";
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

    document.getElementById("toggle-sun").checked = ov.sun;
    document.getElementById("toggle-win").checked = ov.win;
    document.getElementById("toggle-elec").checked = ov.elec;
    document.getElementById("toggle-ghost").checked = ov.ghost;
    document.getElementById("toggle-site").checked = ov.site;
    document.getElementById("toggle-roof").checked = ov.roof;
    document.getElementById("toggle-hotspots").checked = ov.hotspots;
    document.getElementById("btn-quick-sun").classList.toggle("active", ov.sun);
    document.getElementById("btn-quick-win").classList.toggle("active", ov.win);
    document.getElementById("btn-quick-elec").classList.toggle("active", ov.elec || s === "elec1" || s === "elec2");
    document.getElementById("btn-quick-ghost").classList.toggle("active", ov.ghost);
    if (sunScrubberBar) sunScrubberBar.classList.toggle("visible", ov.sun);

    renderRoomHotspots();
    buildElecLegend();
    renderElecHighlights();
    buildWinLegend();
    renderSunlightAndShadows();
    renderWindowsOverlay();
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
    state.winFocusId = null;
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
  // 4c. Solar Position Engine, 3D Sunlight/Shadows & Windows Vector Overlay
  // ========================================================================
  const COMPASS_16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

  function azimuthToCompass(az) {
    return COMPASS_16[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
  }

  function formatClockTime(mins, compact = false) {
    const m = ((Math.round(mins) % 1440) + 1440) % 1440;
    const h24 = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, "0");
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    if (compact) {
      return `${h12}:${mm}${h24 >= 12 ? "p" : "a"}`;
    }
    return `${h12}:${mm} ${h24 >= 12 ? "PM" : "AM"}`;
  }

  function isCentralDST(year, month, day) {
    // US DST: 2nd Sunday in March through 1st Sunday in November (month is 1-indexed)
    if (month < 3 || month > 11) return false;
    if (month > 3 && month < 11) return true;
    if (month === 3) {
      const mar1Day = new Date(year, 2, 1).getDay();
      const secondSun = 8 + ((7 - mar1Day) % 7);
      return day >= secondSun;
    }
    const nov1Day = new Date(year, 10, 1).getDay();
    const firstSun = 1 + ((7 - nov1Day) % 7);
    return day < firstSun;
  }

  function computeSolarPosition(dateStr, minutesOfDay) {
    const ws = window.WINDOWS_AND_SOLAR_DATA;
    const orient = ws ? ws.orientation : { trueNorthScreenDeg: 10.0, solarLatDeg: 30.0, solarLonDeg: -98.0 };
    const parts = (dateStr || "2026-03-20").split("-").map(Number);
    const year = parts[0] || 2026;
    const month = parts[1] || 3;
    const day = parts[2] || 20;

    const startOfYear = Date.UTC(year, 0, 1);
    const curUTC = Date.UTC(year, month - 1, day);
    const dayOfYear = Math.floor((curUTC - startOfYear) / 86400000) + 1;
    const tzHours = isCentralDST(year, month, day) ? -5 : -6;

    const latRad = (orient.solarLatDeg * Math.PI) / 180;
    const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (minutesOfDay / 60 - 12) / 24);

    // NOAA Equation of Time (minutes) & Solar Declination (radians)
    const eqTime = 229.18 * (
      0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma)
    );
    const decl =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.001480 * Math.sin(3 * gamma);

    const timeOffset = eqTime + 4 * orient.solarLonDeg - 60 * tzHours;
    const trueSolarMin = minutesOfDay + timeOffset;
    const haDeg = trueSolarMin / 4 - 180;
    const haRad = (haDeg * Math.PI) / 180;

    const sinAlt = Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(haRad);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const altDeg = (altRad * 180) / Math.PI;

    const azRad = Math.atan2(
      Math.sin(haRad),
      Math.cos(haRad) * Math.sin(latRad) - Math.tan(decl) * Math.cos(latRad)
    );
    const azDeg = (((azRad * 180) / Math.PI + 180) % 360 + 360) % 360;

    // Sunrise & Sunset in local clock minutes
    const cosH0 =
      Math.cos((90.833 * Math.PI) / 180) / (Math.cos(latRad) * Math.cos(decl)) -
      Math.tan(latRad) * Math.tan(decl);
    const haRiseDeg = (Math.acos(Math.max(-1, Math.min(1, cosH0))) * 180) / Math.PI;
    const solarNoonMin = 720 - 4 * orient.solarLonDeg - eqTime + 60 * tzHours;
    const sunriseMin = Math.round(solarNoonMin - haRiseDeg * 4);
    const sunsetMin = Math.round(solarNoonMin + haRiseDeg * 4);

    // Convert compass azimuth to Master A2.0 SVG screen vector pointing TOWARD the sun
    const screenSunRad = ((orient.trueNorthScreenDeg + azDeg) * Math.PI) / 180;
    const towardSunX = Math.cos(screenSunRad);
    const towardSunY = Math.sin(screenSunRad);

    // Seasonal deciduous Pecan canopy transmission (Apr-Oct leafy dappled shade vs Nov-Mar bare branches)
    const isLeafySeason = month >= 4 && month <= 10;
    const treeTransmission = isLeafySeason ? 0.36 : 0.76;

    return {
      altDeg,
      altRad,
      azDeg,
      compass: azimuthToCompass(azDeg),
      sunriseMin,
      sunsetMin,
      solarNoonMin: Math.round(solarNoonMin),
      towardSunX,
      towardSunY,
      rayX: -towardSunX,
      rayY: -towardSunY,
      isLeafySeason,
      treeTransmission,
    };
  }

  function pointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function raySegmentHit(ox, oy, dx, dy, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const det = dx * vy - dy * vx;
    if (Math.abs(det) < 1e-7) return null;
    const rx = ax - ox, ry = ay - oy;
    const t = (rx * vy - ry * vx) / det;
    const u = (rx * dy - ry * dx) / det;
    if (t > 3.0 && u >= 0 && u <= 1) return t;
    return null;
  }

  function computeOpeningSolarState(op, sun) {
    const ws = window.WINDOWS_AND_SOLAR_DATA;
    if (!sun || sun.altDeg <= 1.2) {
      return { lit: false, reason: "Below horizon (Night / Twilight)" };
    }
    const tanAlt = Math.max(0.085, Math.tan(sun.altRad));

    // 1. Overhead Roof Skylight (B3-T1)
    if (op.isSkylight) {
      const shiftFt = Math.min(18, 9.0 / tanAlt);
      return {
        lit: true,
        isSkylight: true,
        intensity: Math.min(1, 0.45 + 0.55 * Math.sin(sun.altRad)),
        shiftUnits: shiftFt * UNITS_PER_FOOT,
        reachFt: shiftFt,
        reason: `Overhead direct skypatch (${Math.round(sun.altDeg)}° solar alt)`,
      };
    }

    // 2. Facade incidence check
    const cosInc = op.nx * sun.towardSunX + op.ny * sun.towardSunY;
    if (cosInc <= 0.04) {
      return { lit: false, reason: `Shaded — sun is behind ${op.facingLabel.split(" ")[0]} facade` };
    }

    const baseElevFt = typeof op.baseElevFt === "number" ? op.baseElevFt : (op.floor === "second" ? 11.7 : 0.0);
    let effSillFt = op.sillFt;
    let effHeadFt = op.headFt;

    // 3. Opposing courtyard/wing massing self-shadow check
    const ox = op.cx + op.nx * 5;
    const oy = op.cy + op.ny * 5;
    if (ws && ws.masses) {
      for (const m of ws.masses) {
        if (pointInPoly(op.cx - op.nx * 5, op.cy - op.ny * 5, m.poly)) continue;
        let minT = null;
        for (let i = 0; i < m.poly.length; i++) {
          const a = m.poly[i];
          const b = m.poly[(i + 1) % m.poly.length];
          const t = raySegmentHit(ox, oy, sun.towardSunX, sun.towardSunY, a[0], a[1], b[0], b[1]);
          if (t !== null && (minT === null || t < minT)) minT = t;
        }
        if (minT !== null) {
          const distFt = minT / UNITS_PER_FOOT;
          const relWingTop = m.heightFt - baseElevFt;
          const shadowTopOnWall = relWingTop - distFt * tanAlt;
          if (shadowTopOnWall > effSillFt) {
            effSillFt = shadowTopOnWall;
          }
        }
      }
    }
    if (effSillFt >= effHeadFt - 0.1) {
      return { lit: false, reason: "Shaded by adjacent courtyard building wing" };
    }

    // 4. Roof Overhang / Covered Porch vertical cutoff
    const shadowDropFt = (op.overhangFt * tanAlt) / Math.max(0.08, cosInc);
    effHeadFt = Math.min(effHeadFt, op.eaveFt - shadowDropFt);
    if (effHeadFt <= effSillFt + 0.1) {
      const ohDesc = op.overhangFt > 4 ? "covered patio roof" : `${op.overhangFt.toFixed(0)}'-0" roof overhang`;
      return { lit: false, reason: `Shaded by ${ohDesc} (${Math.round(sun.altDeg)}° high sun)` };
    }

    // 5. Heritage Pecan Tree Canopy filtering (when enabled)
    let treeFactor = 1.0;
    let filteredBy = null;
    if (state.sunTreeShade && ws && ws.trees) {
      const midWorldZ = baseElevFt + (effSillFt + effHeadFt) * 0.5;
      for (const tr of ws.trees) {
        const vx = tr.cx - op.cx;
        const vy = tr.cy - op.cy;
        const tProj = vx * sun.towardSunX + vy * sun.towardSunY;
        if (tProj > 0) {
          const perpSq = vx * vx + vy * vy - tProj * tProj;
          if (perpSq < tr.r * tr.r) {
            const zAtTree = midWorldZ + (tProj / UNITS_PER_FOOT) * tanAlt;
            if (zAtTree >= tr.canopyBaseFt && zAtTree <= tr.heightFt + 2) {
              treeFactor *= sun.treeTransmission;
              filteredBy = tr.label;
            }
          }
        }
      }
    }

    const dNearFt = effSillFt / tanAlt;
    const dFarFt = Math.min(40.0, effHeadFt / tanAlt);
    const intensity = Math.max(0.14, Math.min(1.0, (0.35 + 0.65 * cosInc) * treeFactor));

    let reason = `Direct Sun · ${dFarFt.toFixed(1)}' floor reach (${Math.round(sun.altDeg)}° alt)`;
    if (op.category === "diffused") {
      reason = `Sunlit Glass Block · Soft diffused glow (${Math.round(sun.altDeg)}° alt)`;
    }
    if (filteredBy) {
      reason += ` · Filtered by ${filteredBy}`;
    }

    return {
      lit: true,
      cosInc,
      intensity,
      treeFactor,
      filteredBy,
      dNearUnits: dNearFt * UNITS_PER_FOOT,
      dFarUnits: dFarFt * UNITS_PER_FOOT,
      reachFt: dFarFt,
      reason,
    };
  }

  function getActivePlanFloor() {
    if (state.sheet === "second" || state.sheet === "elec2") return "second";
    return "first";
  }

  function getFloorOpenings(floor) {
    const ws = window.WINDOWS_AND_SOLAR_DATA;
    if (!ws || !ws.openings) return [];
    return ws.openings.filter((o) => o.floor === floor);
  }

  function syncSolarControlsUI(sun) {
    const riseStr = formatClockTime(sun.sunriseMin, false);
    const setStr = formatClockTime(sun.sunsetMin, false);
    const riseShort = formatClockTime(sun.sunriseMin, true);
    const setShort = formatClockTime(sun.sunsetMin, true);
    const clockStr = formatClockTime(state.sunMinutes, false);
    const altRound = Math.max(0, Math.round(sun.altDeg));
    const metaStr = sun.altDeg > 0
      ? `Alt ${altRound}° · ${sun.compass} ${ String(Math.round(sun.azDeg)).padStart(3, "0") }°`
      : `Below Horizon · ${sun.compass}`;

    const minBound = Math.max(300, Math.floor((sun.sunriseMin - 10) / 5) * 5);
    const maxBound = Math.min(1320, Math.ceil((sun.sunsetMin + 10) / 5) * 5);

    ["sun-time-sidebar", "sun-time-hud"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.min = String(minBound);
        el.max = String(maxBound);
        el.value = String(state.sunMinutes);
      }
    });
    ["sun-date-sidebar", "sun-date-hud"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.value !== state.sunDate) el.value = state.sunDate;
    });

    const sbClock = document.getElementById("sun-sidebar-clock");
    if (sbClock) sbClock.textContent = clockStr;
    const sbAngles = document.getElementById("sun-sidebar-angles");
    if (sbAngles) sbAngles.textContent = metaStr;
    const sbRise = document.getElementById("sun-sidebar-rise");
    if (sbRise) sbRise.textContent = `Rise ${riseStr}`;
    const sbSet = document.getElementById("sun-sidebar-set");
    if (sbSet) sbSet.textContent = `Set ${setStr}`;

    const hudClock = document.getElementById("sun-hud-clock");
    if (hudClock) hudClock.textContent = clockStr;
    const hudMeta = document.getElementById("sun-hud-meta");
    if (hudMeta) hudMeta.textContent = metaStr;
    const hudRise = document.getElementById("sun-hud-rise");
    if (hudRise) hudRise.textContent = riseShort;
    const hudSet = document.getElementById("sun-hud-set");
    if (hudSet) hudSet.textContent = setShort;

    const treeTag = document.getElementById("sun-tree-season-tag");
    if (treeTag) {
      treeTag.textContent = sun.isLeafySeason ? "(Full Leaf · 64% Shade)" : "(Winter Bare · 24% Shade)";
    }

    document.querySelectorAll("[data-sun-preset]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.sunPreset === state.sunPreset);
    });

    const playHud = document.getElementById("btn-sun-play");
    const playSb = document.getElementById("btn-sun-play-sidebar");
    if (playHud) {
      playHud.textContent = state.sunPlaying ? "❚❚" : "▶";
      playHud.classList.toggle("playing", state.sunPlaying);
    }
    if (playSb) {
      playSb.textContent = state.sunPlaying ? "❚❚ Pause" : "▶ Play Day";
      playSb.classList.toggle("active", state.sunPlaying);
    }
  }

  function renderSunlightAndShadows() {
    extShadowsSlot.innerHTML = "";
    sunlightSlot.innerHTML = "";

    const sun = computeSolarPosition(state.sunDate, state.sunMinutes);
    syncSolarControlsUI(sun);

    if (!state.overlays.sun) return;

    const ws = window.WINDOWS_AND_SOLAR_DATA;
    if (!ws) return;

    const floor = getActivePlanFloor();
    const userOp = state.overlays.sunOpacity;
    const beamHex = sun.altDeg < 16 ? "#f59e0b" : sun.altDeg < 42 ? "#fbbf24" : "#facc15";
    const edgeHex = sun.altDeg < 16 ? "#ea580c" : "#d97706";

    // 1. Exterior 3D Building & Pecan Tree Shadows (on 1st floor, elec1, or site sheet)
    if (state.sunExtShadows && sun.altDeg > 1.5 && (floor === "first" || state.sheet === "site")) {
      const tanAlt = Math.max(0.14, Math.tan(sun.altRad));
      const shadowRoot = document.createElementNS(SVG_NS, "g");
      if (state.sheet !== "site") {
        shadowRoot.setAttribute("clip-path", "url(#clip-exterior-ground)");
      }
      shadowRoot.setAttribute("pointer-events", "none");

      // Extrude building volume shadows as a single seamless positive-winding union path
      let combinedShadowD = "";
      (ws.masses || []).forEach((m) => {
        const shift = Math.min(620, (m.heightFt / tanAlt) * UNITS_PER_FOOT);
        const dx = shift * sun.rayX;
        const dy = shift * sun.rayY;
        const n = m.poly.length;
        // Ensure roof polygon has positive winding
        let area2 = 0;
        for (let i = 0; i < n; i++) {
          const p = m.poly[i], q = m.poly[(i + 1) % n];
          area2 += p[0] * q[1] - q[0] * p[1];
        }
        const roofPts = area2 >= 0 ? m.poly : [...m.poly].reverse();
        combinedShadowD += "M " + roofPts.map((p) => `${(p[0] + dx).toFixed(1)} ${(p[1] + dy).toFixed(1)}`).join(" L ") + " Z ";

        for (let i = 0; i < n; i++) {
          const a = m.poly[i];
          const b = m.poly[(i + 1) % n];
          const cross = (b[0] - a[0]) * dy - (b[1] - a[1]) * dx;
          if (Math.abs(cross) < 0.5) continue;
          if (cross > 0) {
            combinedShadowD += `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${(b[0] + dx).toFixed(1)} ${(b[1] + dy).toFixed(1)} L ${(a[0] + dx).toFixed(1)} ${(a[1] + dy).toFixed(1)} Z `;
          } else {
            combinedShadowD += `M ${b[0]} ${b[1]} L ${a[0]} ${a[1]} L ${(a[0] + dx).toFixed(1)} ${(a[1] + dy).toFixed(1)} L ${(b[0] + dx).toFixed(1)} ${(b[1] + dy).toFixed(1)} Z `;
          }
        }
      });
      if (combinedShadowD) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", combinedShadowD);
        path.setAttribute("fill-rule", "nonzero");
        path.setAttribute("class", "ext-shadow-building");
        shadowRoot.appendChild(path);
      }

      // Extrude 4 Heritage Pecan Tree Canopy Shadows + Canopy Rings
      if (state.sunTreeShade) {
        const treeAlphaScale = sun.isLeafySeason ? 1.0 : 0.45;
        (ws.trees || []).forEach((tr) => {
          const shift = Math.min(650, ((tr.heightFt * 0.78) / tanAlt) * UNITS_PER_FOOT);
          const scx = tr.cx + shift * sun.rayX;
          const scy = tr.cy + shift * sun.rayY;

          const shCircle = document.createElementNS(SVG_NS, "circle");
          shCircle.setAttribute("cx", scx.toFixed(1));
          shCircle.setAttribute("cy", scy.toFixed(1));
          shCircle.setAttribute("r", tr.r.toFixed(1));
          shCircle.setAttribute("class", "ext-shadow-tree");
          shCircle.style.opacity = String(treeAlphaScale);
          shadowRoot.appendChild(shCircle);

          const outline = document.createElementNS(SVG_NS, "circle");
          outline.setAttribute("cx", tr.cx.toFixed(1));
          outline.setAttribute("cy", tr.cy.toFixed(1));
          outline.setAttribute("r", tr.r.toFixed(1));
          outline.setAttribute("class", "ext-tree-canopy-outline");
          shadowRoot.appendChild(outline);
        });
      }

      extShadowsSlot.appendChild(shadowRoot);
    }

    // 2. Indoor Clipped Sunbeams, Diffused Glass-Block Glows & Overhead Skylight Patch
    if (sun.altDeg > 1.2 && state.sheet !== "roof") {
      const openings = getFloorOpenings(floor);
      const byClip = new Map();
      openings.forEach((op) => {
        const st = computeOpeningSolarState(op, sun);
        if (!st.lit) return;
        if (!byClip.has(op.clipId)) byClip.set(op.clipId, []);
        byClip.get(op.clipId).push({ op, st });
      });

      byClip.forEach((entries, clipId) => {
        const clipGroup = document.createElementNS(SVG_NS, "g");
        clipGroup.setAttribute("clip-path", `url(#${clipId})`);
        clipGroup.setAttribute("pointer-events", "none");

        entries.forEach(({ op, st }) => {
          const alpha = Math.min(0.62, (0.20 + 0.34 * st.intensity) * userOp);

          if (st.isSkylight && op.rect) {
            const sx = op.rect.x + st.shiftUnits * sun.rayX;
            const sy = op.rect.y + st.shiftUnits * sun.rayY;
            const patch = document.createElementNS(SVG_NS, "rect");
            patch.setAttribute("x", sx.toFixed(1));
            patch.setAttribute("y", sy.toFixed(1));
            patch.setAttribute("width", op.rect.w.toFixed(1));
            patch.setAttribute("height", op.rect.h.toFixed(1));
            patch.setAttribute("rx", "3");
            patch.setAttribute("fill", beamHex);
            patch.setAttribute("fill-opacity", String(Math.min(0.55, alpha * 1.15)));
            patch.setAttribute("stroke", edgeHex);
            patch.setAttribute("stroke-opacity", String(Math.min(0.6, alpha)));
            patch.setAttribute("stroke-width", "1.2");
            clipGroup.appendChild(patch);
            return;
          }

          if (op.category === "diffused") {
            // Soft translucent radial scatter fan for Glass Block (U / V)
            const inX = -op.nx;
            const inY = -op.ny;
            const baseAng = Math.atan2(inY, inX);
            const fanR = (op.mark === "U" ? 85 : 115) * (0.65 + 0.35 * st.intensity);
            const fanPts = [[op.x1, op.y1], [op.x2, op.y2]];
            for (let deg = 44; deg >= -44; deg -= 11) {
              const a = baseAng + (deg * Math.PI) / 180;
              fanPts.push([op.cx + fanR * Math.cos(a), op.cy + fanR * Math.sin(a)]);
            }
            const poly = document.createElementNS(SVG_NS, "polygon");
            poly.setAttribute("points", fanPts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "));
            poly.setAttribute("fill", beamHex);
            poly.setAttribute("fill-opacity", String(alpha * 0.65));
            clipGroup.appendChild(poly);
            return;
          }

          // Clear Window / Glazed Door geometric beam
          const nx1 = op.x1 + sun.rayX * st.dNearUnits;
          const ny1 = op.y1 + sun.rayY * st.dNearUnits;
          const nx2 = op.x2 + sun.rayX * st.dNearUnits;
          const ny2 = op.y2 + sun.rayY * st.dNearUnits;

          const fx1 = op.x1 + sun.rayX * st.dFarUnits;
          const fy1 = op.y1 + sun.rayY * st.dFarUnits;
          const fx2 = op.x2 + sun.rayX * st.dFarUnits;
          const fy2 = op.y2 + sun.rayY * st.dFarUnits;

          // Subtle aerial beam from raised window sill to floor landing edge
          if (st.dNearUnits > 3) {
            const airPoly = document.createElementNS(SVG_NS, "polygon");
            airPoly.setAttribute(
              "points",
              `${op.x1.toFixed(1)},${op.y1.toFixed(1)} ${op.x2.toFixed(1)},${op.y2.toFixed(1)} ${nx2.toFixed(1)},${ny2.toFixed(1)} ${nx1.toFixed(1)},${ny1.toFixed(1)}`
            );
            airPoly.setAttribute("fill", beamHex);
            airPoly.setAttribute("fill-opacity", String(alpha * 0.28));
            clipGroup.appendChild(airPoly);
          }

          // Bright sunlit floor patch polygon (dNear -> dFar)
          const floorPoly = document.createElementNS(SVG_NS, "polygon");
          floorPoly.setAttribute(
            "points",
            `${nx1.toFixed(1)},${ny1.toFixed(1)} ${nx2.toFixed(1)},${ny2.toFixed(1)} ${fx2.toFixed(1)},${fy2.toFixed(1)} ${fx1.toFixed(1)},${fy1.toFixed(1)}`
          );
          floorPoly.setAttribute("fill", beamHex);
          floorPoly.setAttribute("fill-opacity", String(alpha));
          floorPoly.setAttribute("stroke", edgeHex);
          floorPoly.setAttribute("stroke-opacity", String(alpha * 0.65));
          floorPoly.setAttribute("stroke-width", "1.1");
          clipGroup.appendChild(floorPoly);

          // Crisp sunlit sill glow bar right on the glass
          const sillGlow = document.createElementNS(SVG_NS, "line");
          sillGlow.setAttribute("x1", op.x1.toFixed(1));
          sillGlow.setAttribute("y1", op.y1.toFixed(1));
          sillGlow.setAttribute("x2", op.x2.toFixed(1));
          sillGlow.setAttribute("y2", op.y2.toFixed(1));
          sillGlow.setAttribute("stroke", "#f59e0b");
          sillGlow.setAttribute("stroke-width", "4.5");
          sillGlow.setAttribute("stroke-opacity", String(Math.min(0.95, alpha * 1.8)));
          clipGroup.appendChild(sillGlow);
        });

        sunlightSlot.appendChild(clipGroup);
      });
    }

    // 3. On-Canvas Sun-Path Compass Arc (Sunrise -> Solar Noon -> Sunset)
    if (state.sunShowArc) {
      renderSunPathCompassArc(sun);
    }
  }

  function renderSunPathCompassArc(sun) {
    const ws = window.WINDOWS_AND_SOLAR_DATA;
    const northDeg = ws?.orientation?.trueNorthScreenDeg ?? 10.0;
    const isSecond = state.sheet === "second" || state.sheet === "elec2";
    const cx = isSecond ? 1675 : 1225;
    const cy = isSecond ? 725 : 720;
    const rx = isSecond ? 595 : 1105;
    const ry = isSecond ? 345 : 465;

    const arcGroup = document.createElementNS(SVG_NS, "g");
    arcGroup.setAttribute("pointer-events", "none");

    // Viewport-framing compass reference ellipse so N/E/S/W & sun orb stay visible at 100% Fit
    const ring = document.createElementNS(SVG_NS, "ellipse");
    ring.setAttribute("cx", cx);
    ring.setAttribute("cy", cy);
    ring.setAttribute("rx", rx);
    ring.setAttribute("ry", ry);
    ring.setAttribute("class", "sun-arc-ring");
    arcGroup.appendChild(ring);

    // True Cardinal ticks & labels (N, E, S, W)
    const cardinals = [
      { lbl: "N (Entry)", az: 0 },
      { lbl: "E (Courtyard)", az: 90 },
      { lbl: "S (ADU)", az: 180 },
      { lbl: "W (Pecans)", az: 270 },
    ];
    cardinals.forEach(({ lbl, az }) => {
      const rad = ((northDeg + az) * Math.PI) / 180;
      const ux = Math.cos(rad);
      const uy = Math.sin(rad);
      const px = cx + rx * ux;
      const py = cy + ry * uy;
      const tick = document.createElementNS(SVG_NS, "line");
      tick.setAttribute("x1", (px - ux * 11).toFixed(1));
      tick.setAttribute("y1", (py - uy * 11).toFixed(1));
      tick.setAttribute("x2", (px + ux * 11).toFixed(1));
      tick.setAttribute("y2", (py + uy * 11).toFixed(1));
      tick.setAttribute("stroke", "currentColor");
      tick.setAttribute("stroke-opacity", "0.35");
      tick.setAttribute("stroke-width", "1.5");
      arcGroup.appendChild(tick);

      const lx = px + ux * (isSecond ? 26 : 34);
      const ly = py + uy * (isSecond ? 20 : 24);
      const txt = document.createElementNS(SVG_NS, "text");
      txt.setAttribute("x", lx.toFixed(1));
      txt.setAttribute("y", ly.toFixed(1));
      txt.setAttribute("font-size", isSecond ? "13" : "17");
      txt.setAttribute("class", "sun-arc-cardinal");
      txt.textContent = lbl;
      arcGroup.appendChild(txt);
    });

    // Sample today's solar trajectory from sunrise to sunset along the compass ring
    const pts = [];
    for (let m = sun.sunriseMin; m <= sun.sunsetMin; m += 15) {
      const s = computeSolarPosition(state.sunDate, m);
      pts.push({ x: cx + rx * s.towardSunX, y: cy + ry * s.towardSunY, m });
    }
    const sEnd = computeSolarPosition(state.sunDate, sun.sunsetMin);
    pts.push({ x: cx + rx * sEnd.towardSunX, y: cy + ry * sEnd.towardSunY, m: sun.sunsetMin });

    if (pts.length >= 2) {
      const dPath = "M " + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ");
      const traj = document.createElementNS(SVG_NS, "path");
      traj.setAttribute("d", dPath);
      traj.setAttribute("class", "sun-arc-trajectory");
      arcGroup.appendChild(traj);

      // Sunrise & Sunset endpoint badges
      const pRise = pts[0];
      const pSet = pts[pts.length - 1];
      [
        { p: pRise, text: `☀ Rise ${formatClockTime(sun.sunriseMin, true)}` },
        { p: pSet, text: `☾ Set ${formatClockTime(sun.sunsetMin, true)}` },
      ].forEach(({ p, text }) => {
        const dot = document.createElementNS(SVG_NS, "circle");
        dot.setAttribute("cx", p.x.toFixed(1));
        dot.setAttribute("cy", p.y.toFixed(1));
        dot.setAttribute("r", isSecond ? "5.5" : "7.5");
        dot.setAttribute("fill", "#d97706");
        arcGroup.appendChild(dot);

        const lbl = document.createElementNS(SVG_NS, "text");
        lbl.setAttribute("x", p.x.toFixed(1));
        lbl.setAttribute("y", (p.y + (p.y > cy ? -18 : 20)).toFixed(1));
        lbl.setAttribute("font-size", isSecond ? "12" : "15");
        lbl.setAttribute("class", "sun-arc-time-lbl");
        lbl.textContent = text;
        arcGroup.appendChild(lbl);
      });
    }

    // Current Sun Orb + True Solar Azimuth Sightline Ray
    if (sun.altDeg > 0) {
      const sx = cx + rx * sun.towardSunX;
      const sy = cy + ry * sun.towardSunY;
      const rayLen = isSecond ? 85 : 135;
      const rayInX = sx + rayLen * sun.rayX;
      const rayInY = sy + rayLen * sun.rayY;

      const sight = document.createElementNS(SVG_NS, "line");
      sight.setAttribute("x1", sx.toFixed(1));
      sight.setAttribute("y1", sy.toFixed(1));
      sight.setAttribute("x2", rayInX.toFixed(1));
      sight.setAttribute("y2", rayInY.toFixed(1));
      sight.setAttribute("stroke", "#f59e0b");
      sight.setAttribute("stroke-width", "2.4");
      sight.setAttribute("stroke-dasharray", "5 4");
      sight.setAttribute("vector-effect", "non-scaling-stroke");
      arcGroup.appendChild(sight);

      const glow = document.createElementNS(SVG_NS, "circle");
      glow.setAttribute("cx", sx.toFixed(1));
      glow.setAttribute("cy", sy.toFixed(1));
      glow.setAttribute("r", isSecond ? "24" : "36");
      glow.setAttribute("fill", "url(#sun-orb-glow)");
      arcGroup.appendChild(glow);

      const core = document.createElementNS(SVG_NS, "circle");
      core.setAttribute("cx", sx.toFixed(1));
      core.setAttribute("cy", sy.toFixed(1));
      core.setAttribute("r", isSecond ? "9" : "13");
      core.setAttribute("fill", "#fbbf24");
      core.setAttribute("stroke", "#b45309");
      core.setAttribute("stroke-width", "2");
      core.setAttribute("vector-effect", "non-scaling-stroke");
      arcGroup.appendChild(core);
    }

    sunlightSlot.appendChild(arcGroup);
  }

  // Day Timelapse Animation Loop
  let sunAnimRaf = null;
  let lastSunTick = 0;

  function setSunPlaying(playing) {
    state.sunPlaying = playing;
    if (!playing) {
      if (sunAnimRaf) cancelAnimationFrame(sunAnimRaf);
      sunAnimRaf = null;
      renderSunlightAndShadows();
      return;
    }
    if (!state.overlays.sun) state.overlays.sun = true;
    const curSun = computeSolarPosition(state.sunDate, state.sunMinutes);
    if (state.sunMinutes >= curSun.sunsetMin - 5 || state.sunMinutes < curSun.sunriseMin) {
      state.sunMinutes = curSun.sunriseMin + 15;
    }
    lastSunTick = performance.now();
    function step(now) {
      if (!state.sunPlaying) return;
      const dt = now - lastSunTick;
      if (dt >= 45) {
        lastSunTick = now;
        const s = computeSolarPosition(state.sunDate, state.sunMinutes);
        state.sunMinutes += 4; // ~14 seconds for full sunrise-to-sunset sweep
        if (state.sunMinutes > s.sunsetMin + 5) {
          state.sunMinutes = s.sunriseMin + 10;
        }
        renderSunlightAndShadows();
        renderWindowsOverlay();
      }
      sunAnimRaf = requestAnimationFrame(step);
    }
    syncLayers();
    sunAnimRaf = requestAnimationFrame(step);
  }

  function applySunPreset(preset) {
    state.sunPreset = preset;
    const yr = new Date().getFullYear();
    if (preset === "summer") state.sunDate = `${yr}-06-21`;
    else if (preset === "equinox") state.sunDate = `${yr}-03-20`;
    else if (preset === "winter") state.sunDate = `${yr}-12-21`;
    else if (preset === "today") {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      state.sunDate = `${now.getFullYear()}-${mm}-${dd}`;
    }
    const sun = computeSolarPosition(state.sunDate, state.sunMinutes);
    state.sunMinutes = Math.max(sun.sunriseMin + 15, Math.min(sun.sunsetMin - 15, state.sunMinutes));
    renderSunlightAndShadows();
    renderWindowsOverlay();
    if (state.activeRoomId) {
      const r = ROOMS.find((x) => x.id === state.activeRoomId);
      if (r) renderRoomDaylightSummary(r);
    }
  }

  // ========================================================================
  // Aligned Vector Windows & Glazing Overlay (Legend, IDs, Search, Tooltips)
  // ========================================================================
  function setSunDrawerOpen(open) {
    state.sunDrawerOpen = open;
    const btn = document.getElementById("btn-expand-sun");
    const drawer = document.getElementById("sun-drawer");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (drawer) drawer.classList.toggle("open", open);
  }

  function setWinDrawerOpen(open) {
    state.winDrawerOpen = open;
    const btn = document.getElementById("btn-expand-win");
    const drawer = document.getElementById("win-legend-drawer");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (drawer) drawer.classList.toggle("open", open);
  }

  function copyWinId(id) {
    if (!id) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).catch(() => {});
    }
    const hint = document.getElementById("win-tooltip-hint");
    if (hint) {
      hint.textContent = `Copied ${id} to clipboard`;
      setTimeout(() => {
        if (hint.textContent.startsWith("Copied")) hint.textContent = "Click opening to copy ID";
      }, 1600);
    }
  }

  function toggleWinCategory(catKey) {
    state.overlays.win = true;
    state.winFocusId = null;
    if (state.winSelectedCats.has(catKey)) {
      state.winSelectedCats.delete(catKey);
    } else {
      state.winSelectedCats.add(catKey);
    }
    syncLayers();
  }

  function buildWinLegend() {
    const floor = getActivePlanFloor();
    const items = getFloorOpenings(floor);
    const counts = {};
    items.forEach((it) => { counts[it.category] = (counts[it.category] || 0) + 1; });

    const floorTag = document.getElementById("win-legend-floor-tag");
    if (floorTag) {
      floorTag.textContent = floor === "second"
        ? `2nd Floor · A2.1 (${items.length})`
        : `1st Floor · A2.0 (${items.length})`;
    }

    const expandLbl = document.getElementById("win-expand-label");
    if (expandLbl) {
      if (state.winFocusId) {
        expandLbl.textContent = `Windows · ${state.winFocusId}`;
      } else if (state.winSelectedCats.size > 0) {
        expandLbl.textContent = `Windows · ${state.winSelectedCats.size} filtered`;
      } else {
        expandLbl.textContent = "Window Schedule & IDs";
      }
    }

    const container = document.getElementById("win-legend-groups");
    if (!container) return;

    let html = `<div class="elec-group"><div class="elec-group-items">`;
    WIN_CATEGORIES.forEach((cat) => {
      const cnt = counts[cat.category] || 0;
      if (!cnt) return;
      const act = state.winSelectedCats.has(cat.category) ? " active" : "";
      html += `
        <button type="button" class="elec-item-btn${act}" data-win-cat="${cat.category}" style="--item-color:${cat.color}">
          <span class="elec-item-left">
            <span class="elec-sym-icon">${cat.icon}</span>
            <span class="elec-item-label">${cat.label}</span>
          </span>
          <span class="elec-item-count">${cnt}</span>
        </button>`;
    });
    html += `</div></div>`;
    container.innerHTML = html;

    container.querySelectorAll("[data-win-cat]").forEach((btn) => {
      const catKey = btn.dataset.winCat;
      btn.addEventListener("click", () => toggleWinCategory(catKey));
      btn.addEventListener("mouseenter", () => {
        state.winHoverCat = catKey;
        renderWindowsOverlay();
      });
      btn.addEventListener("mouseleave", () => {
        if (state.winHoverCat === catKey) {
          state.winHoverCat = null;
          renderWindowsOverlay();
        }
      });
    });
  }

  function focusWinById(id, zoomTo = true) {
    const ws = window.WINDOWS_AND_SOLAR_DATA;
    if (!ws || !ws.openings) return;
    const found = ws.openings.find((o) => o.id === id);
    if (!found) return;

    if (getActivePlanFloor() !== found.floor) {
      state.sheet = found.floor;
    }
    state.overlays.win = true;
    state.winFocusId = found.id;
    syncLayers();

    if (zoomTo) {
      fitBox({ x: found.cx - 210, y: found.cy - 145, w: 420, h: 290 }, true);
    }
  }

  function handleWinIdSearch(query) {
    const resEl = document.getElementById("win-id-results");
    if (!resEl) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      resEl.classList.remove("open");
      resEl.innerHTML = "";
      return;
    }
    const ws = window.WINDOWS_AND_SOLAR_DATA;
    const all = ws?.openings || [];
    const matches = all.filter((op) => {
      const hay = `${op.id} mark ${op.mark} ${op.label} ${op.family} ${op.size} ${op.facingLabel} ${getRoomNameById(op.room)}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 24);

    if (!matches.length) {
      resEl.innerHTML = `<div style="padding:7px;font-size:11px;color:var(--ui-text-muted);">No openings match "${query}"</div>`;
      resEl.classList.add("open");
      return;
    }

    resEl.innerHTML = matches.map((op) => {
      const meta = WIN_META_BY_CAT[op.category] || { color: "#0284c7" };
      const fl = op.floor === "second" ? "2F" : "1F";
      return `
        <button type="button" class="elec-id-result-btn" data-jump-win="${op.id}">
          <span class="elec-id-code" style="--item-color:${meta.color}">${op.id}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-text-secondary);">${op.size} · ${getRoomNameById(op.room)}</span>
          <span style="font-family:var(--font-mono);font-size:9.5px;color:var(--ui-text-muted);">${fl}</span>
        </button>`;
    }).join("");
    resEl.classList.add("open");

    resEl.querySelectorAll("[data-jump-win]").forEach((btn) => {
      const id = btn.dataset.jumpWin;
      btn.addEventListener("mouseenter", () => {
        state.winHoverId = id;
        renderWindowsOverlay();
      });
      btn.addEventListener("mouseleave", () => {
        if (state.winHoverId === id) { state.winHoverId = null; renderWindowsOverlay(); }
      });
      btn.addEventListener("click", () => {
        state.winHoverId = null;
        focusWinById(id, true);
        copyWinId(id);
        resEl.classList.remove("open");
      });
    });
  }

  function showWinTooltip(op, clientX, clientY) {
    const meta = WIN_META_BY_CAT[op.category] || { color: "#0284c7", short: "Glazing" };
    const sun = computeSolarPosition(state.sunDate, state.sunMinutes);
    const solarSt = computeOpeningSolarState(op, sun);

    document.getElementById("win-tooltip-dot").style.background = meta.color;
    document.getElementById("win-tooltip-id").textContent = op.id;
    const markPrefix = op.isDoor ? `Door ${op.mark}` : `Window ${op.mark}`;
    document.getElementById("win-tooltip-title").textContent = `${markPrefix} · ${op.label}`;
    const sillHead = op.isSkylight
      ? `Roof Curb @ 9'-0" CLG`
      : `Sill ${op.sillFt}'-0" · Head ${op.headFt}'-0" · ${op.overhangFt}' Overhang`;
    document.getElementById("win-tooltip-specs").textContent = `${op.size} (${op.family}) · ${sillHead}`;
    document.getElementById("win-tooltip-sun").textContent = `${formatClockTime(state.sunMinutes)}: ${solarSt.reason}`;
    const flLbl = op.floor === "second" ? "2nd Floor" : "1st Floor";
    document.getElementById("win-tooltip-room").textContent = `${getRoomNameById(op.room)} · Faces ${op.facingLabel} · ${flLbl}`;
    document.getElementById("win-tooltip-hint").textContent = "Click opening to copy ID";

    const rect = viewport.getBoundingClientRect();
    let left = clientX - rect.left + 14;
    let top = clientY - rect.top - 12;
    winTooltipEl.classList.add("visible");
    const tw = winTooltipEl.offsetWidth || 245;
    const th = winTooltipEl.offsetHeight || 96;
    if (left + tw > rect.width - 12) left = clientX - rect.left - tw - 14;
    if (top + th > rect.height - 12) top = rect.height - th - 12;
    if (top < 12) top = 12;
    winTooltipEl.style.left = `${Math.max(12, left)}px`;
    winTooltipEl.style.top = `${top}px`;
  }

  function hideWinTooltip() {
    if (winTooltipEl) winTooltipEl.classList.remove("visible");
  }

  function renderWindowsOverlay() {
    if (!windowsSlot) return;
    windowsSlot.innerHTML = "";

    if (state.sheet === "roof") {
      hideWinTooltip();
      return;
    }

    const hasHoverId = Boolean(state.winHoverId);
    const hasFocusId = Boolean(state.winFocusId);
    const hasHoverCat = Boolean(state.winHoverCat);
    const hasSelectedCats = state.winSelectedCats.size > 0;
    const anyWinSpotlight = hasHoverId || hasFocusId || hasHoverCat || hasSelectedCats;
    const showVisualBars = state.overlays.win || anyWinSpotlight;
    const allowHitTargets = showVisualBars || state.overlays.sun;

    if (!allowHitTargets) {
      hideWinTooltip();
      return;
    }

    const floor = getActivePlanFloor();
    const openings = getFloorOpenings(floor);
    const rect = viewport.getBoundingClientRect();
    const unitPerPx = rect.width ? state.vb.w / rect.width : 1.8;
    const idFontSize = Math.max(5.5, Math.min(11.5, 9.0 * unitPerPx));
    const tickLen = Math.max(7, Math.min(15, 9.5 * unitPerPx));

    const labelSpecs = [];

    openings.forEach((op) => {
      const meta = WIN_META_BY_CAT[op.category] || { color: "#0284c7" };
      const isSingle = op.id === state.winHoverId || op.id === state.winFocusId;

      let active = true;
      if (hasHoverId) active = op.id === state.winHoverId;
      else if (hasHoverCat) active = op.category === state.winHoverCat;
      else if (hasFocusId) active = op.id === state.winFocusId;
      else if (hasSelectedCats) active = state.winSelectedCats.has(op.category);

      if (anyWinSpotlight && !active) return;

      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "win-marker-group");

      if (showVisualBars) {
        if (op.isSkylight && op.rect) {
          const halo = document.createElementNS(SVG_NS, "rect");
          halo.setAttribute("x", (op.rect.x - 3).toFixed(1));
          halo.setAttribute("y", (op.rect.y - 3).toFixed(1));
          halo.setAttribute("width", (op.rect.w + 6).toFixed(1));
          halo.setAttribute("height", (op.rect.h + 6).toFixed(1));
          halo.setAttribute("rx", "4");
          halo.setAttribute("fill", meta.color);
          halo.setAttribute("fill-opacity", "0.18");
          halo.setAttribute("stroke", meta.color);
          halo.setAttribute("stroke-width", "2.6");
          halo.setAttribute("vector-effect", "non-scaling-stroke");
          g.appendChild(halo);
        } else {
          const halo = document.createElementNS(SVG_NS, "line");
          halo.setAttribute("x1", op.x1);
          halo.setAttribute("y1", op.y1);
          halo.setAttribute("x2", op.x2);
          halo.setAttribute("y2", op.y2);
          halo.setAttribute("stroke", meta.color);
          halo.setAttribute("stroke-width", isSingle ? "12" : "8.5");
          halo.setAttribute("class", "win-bar-halo");
          g.appendChild(halo);

          const core = document.createElementNS(SVG_NS, "line");
          core.setAttribute("x1", op.x1);
          core.setAttribute("y1", op.y1);
          core.setAttribute("x2", op.x2);
          core.setAttribute("y2", op.y2);
          core.setAttribute("stroke", meta.color);
          core.setAttribute("stroke-width", isSingle ? "4.2" : "3.0");
          core.setAttribute("class", "win-bar-core");
          g.appendChild(core);

          // Outward facing normal tick
          const tick = document.createElementNS(SVG_NS, "line");
          tick.setAttribute("x1", op.cx.toFixed(1));
          tick.setAttribute("y1", op.cy.toFixed(1));
          tick.setAttribute("x2", (op.cx + op.nx * tickLen).toFixed(1));
          tick.setAttribute("y2", (op.cy + op.ny * tickLen).toFixed(1));
          tick.setAttribute("stroke", meta.color);
          tick.setAttribute("stroke-width", "1.8");
          tick.setAttribute("class", "win-normal-tick");
          g.appendChild(tick);
        }

        if (isSingle) {
          const ring = document.createElementNS(SVG_NS, "circle");
          ring.setAttribute("cx", op.cx);
          ring.setAttribute("cy", op.cy);
          ring.setAttribute("r", (Math.max(18, tickLen * 2.1)).toFixed(1));
          ring.setAttribute("stroke", meta.color);
          ring.setAttribute("class", "elec-marker-focus-ring");
          g.appendChild(ring);
        }

        if (state.winShowIds || isSingle) {
          labelSpecs.push({ op, meta });
        }
      }

      // Generous invisible pointer hit target (works in both Windows mode and Sunlight mode!)
      if (op.isSkylight && op.rect) {
        const hitRect = document.createElementNS(SVG_NS, "rect");
        hitRect.setAttribute("x", op.rect.x);
        hitRect.setAttribute("y", op.rect.y);
        hitRect.setAttribute("width", op.rect.w);
        hitRect.setAttribute("height", op.rect.h);
        hitRect.setAttribute("fill", "transparent");
        g.appendChild(hitRect);
      } else {
        const hit = document.createElementNS(SVG_NS, "line");
        hit.setAttribute("x1", op.x1);
        hit.setAttribute("y1", op.y1);
        hit.setAttribute("x2", op.x2);
        hit.setAttribute("y2", op.y2);
        hit.setAttribute("stroke-width", Math.max(14, 14 * unitPerPx).toFixed(1));
        hit.setAttribute("class", "win-hit-line");
        g.appendChild(hit);
      }

      g.addEventListener("pointerenter", (e) => showWinTooltip(op, e.clientX, e.clientY));
      g.addEventListener("pointermove", (e) => showWinTooltip(op, e.clientX, e.clientY));
      g.addEventListener("pointerleave", hideWinTooltip);
      g.addEventListener("click", (e) => {
        if (state.measuring || wasDragging) return;
        e.stopPropagation();
        showWinTooltip(op, e.clientX, e.clientY);
        copyWinId(op.id);
      });

      windowsSlot.appendChild(g);
    });

    // Render collision-avoiding Window ID pills
    if (labelSpecs.length > 0) {
      const labelLayer = document.createElementNS(SVG_NS, "g");
      labelLayer.setAttribute("pointer-events", "none");
      const placed = [];
      const padX = idFontSize * 0.45;
      const boxH = idFontSize * 1.45;
      const gap = idFontSize * 0.24;

      const overlaps = (x1, y1, w1, h1) =>
        placed.some((b) => !(x1 + w1 + gap < b.x || b.x + b.w + gap < x1 || y1 + h1 + gap < b.y || b.y + b.h + gap < y1));

      labelSpecs.forEach(({ op, meta }) => {
        const boxW = op.id.length * idFontSize * 0.62 + padX * 2;
        const off = Math.max(14, tickLen + boxH * 0.85);
        const candidates = op.isSkylight
          ? [
              [op.cx, op.cy - boxH],
              [op.cx, op.cy + boxH],
            ]
          : [
              [op.cx + op.nx * off, op.cy + op.ny * off],
              [op.cx - op.nx * off, op.cy - op.ny * off],
              [op.cx + op.nx * (off + boxH * 1.15), op.cy + op.ny * (off + boxH * 1.15)],
              [op.cx + op.ny * (boxW * 0.65), op.cy - op.nx * (boxH * 1.15)],
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
        placed.push({ x: lx - boxW / 2, y: ly - boxH / 2, w: boxW, h: boxH });

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
        txt.textContent = op.id;
        labelLayer.appendChild(txt);
      });
      windowsSlot.appendChild(labelLayer);
    }
  }

  function renderRoomDaylightSummary(room) {
    const sec = document.getElementById("room-sun-section");
    if (!sec) return;

    const ws = window.WINDOWS_AND_SOLAR_DATA;
    if (!ws || (room.floor !== "first" && room.floor !== "second" && room.id !== "pool")) {
      sec.style.display = "none";
      return;
    }
    sec.style.display = "block";

    const sumBox = document.getElementById("room-sun-window-summary");
    const chipsEl = document.getElementById("room-win-chips");
    const idsBtn = document.getElementById("btn-room-win-ids-toggle");
    const idsLbl = document.getElementById("room-win-ids-toggle-label");
    const idsList = document.getElementById("room-win-ids-list");
    const peakBtn = document.getElementById("btn-room-peak-sun");
    const peakLbl = document.getElementById("btn-room-peak-sun-label");
    const totalEl = document.getElementById("room-win-total");

    const dayRef = computeSolarPosition(state.sunDate, 720);

    // Special outdoor daylight analysis for Pool & East Courtyard
    if (room.id === "pool") {
      totalEl.textContent = "Outdoor Courtyard";
      let firstSun = null, lastSun = null, bestMin = 660, bestScore = -1;
      const main2S = (ws.masses || []).filter((m) => m.id.startsWith("main-2story"));
      for (let m = dayRef.sunriseMin + 10; m <= dayRef.sunsetMin - 10; m += 10) {
        const s = computeSolarPosition(state.sunDate, m);
        if (s.altDeg <= 3) continue;
        // Check Pool center (1785, 1085) against the sloped 4:12 2-story volume (modeled as W→E height strips)
        let blocked = false;
        for (const mass of main2S) {
          for (let i = 0; i < mass.poly.length; i++) {
            const a = mass.poly[i], b = mass.poly[(i + 1) % mass.poly.length];
            const t = raySegmentHit(1785, 1085, s.towardSunX, s.towardSunY, a[0], a[1], b[0], b[1]);
            if (t !== null && (t / UNITS_PER_FOOT) * Math.tan(s.altRad) < mass.heightFt) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
        }
        if (!blocked) {
          if (firstSun === null) firstSun = m;
          lastSun = m;
          if (s.altDeg > bestScore) { bestScore = s.altDeg; bestMin = m; }
        }
      }
      sumBox.innerHTML = firstSun !== null
        ? `<strong>Direct Pool Sun (${state.sunDate}):</strong> ${formatClockTime(firstSun)} – ${formatClockTime(lastSun)} · Shaded in late afternoon by 2-story residence.`
        : `<strong>Pool Shade:</strong> Shaded throughout ${state.sunDate}.`;
      chipsEl.innerHTML = "";
      idsBtn.style.display = "none";
      idsList.classList.remove("open");
      peakBtn.style.display = "inline-flex";
      peakLbl.textContent = `Preview Peak Pool Sun (${formatClockTime(bestMin)})`;
      peakBtn.onclick = () => {
        state.overlays.sun = true;
        state.sunMinutes = bestMin;
        syncLayers();
      };
      return;
    }

    const openings = (ws.openings || []).filter((o) => o.room === room.id);
    totalEl.textContent = `${openings.length} opening${openings.length === 1 ? "" : "s"}`;

    if (openings.length === 0) {
      // Check if room shares open-plan borrowed light (Kitchen / Screened Patio)
      if (room.id === "kitchen") {
        sumBox.innerHTML = `<strong>Borrowed Open-Plan Daylight:</strong> Receives deep East morning sun via Living <strong>12'×10' Door 108</strong> &amp; Curved Dining <strong>4× D</strong>.`;
        peakBtn.style.display = "inline-flex";
        peakLbl.textContent = "Preview Morning Kitchen Light (9:00 AM)";
        peakBtn.onclick = () => { state.overlays.sun = true; state.sunMinutes = 540; syncLayers(); };
      } else {
        sumBox.innerHTML = `<strong>Interior / Covered Space:</strong> No direct exterior glazing inside room bounds; relies on borrowed &amp; architectural lighting.`;
        peakBtn.style.display = "none";
      }
      chipsEl.innerHTML = "";
      idsBtn.style.display = "none";
      idsList.classList.remove("open");
      return;
    }

    // Sample active date in 10-min increments to compute exact direct-sun window & peak hour
    let firstDirect = null;
    let lastDirect = null;
    let peakMin = null;
    let peakScore = 0;

    for (let m = dayRef.sunriseMin + 5; m <= dayRef.sunsetMin - 5; m += 10) {
      const s = computeSolarPosition(state.sunDate, m);
      let score = 0;
      openings.forEach((op) => {
        const st = computeOpeningSolarState(op, s);
        if (st.lit) score += st.intensity * op.wFt;
      });
      if (score > 0.05) {
        if (firstDirect === null) firstDirect = m;
        lastDirect = m;
        if (score > peakScore) {
          peakScore = score;
          peakMin = m;
        }
      }
    }

    const dirs = Array.from(new Set(openings.map((o) => o.isSkylight ? "Overhead" : o.facingLabel.split(" ")[0]))).join(", ");
    if (firstDirect !== null) {
      sumBox.innerHTML = `<strong>Direct Sun (${state.sunDate}):</strong> ${formatClockTime(firstDirect)} – ${formatClockTime(lastDirect)} · Peak @ <strong>${formatClockTime(peakMin)}</strong><br><span style="color:var(--ui-text-secondary);font-size:10.5px;">Glazing faces: ${dirs}</span>`;
      peakBtn.style.display = "inline-flex";
      peakLbl.textContent = `Preview Peak Sun (${formatClockTime(peakMin)})`;
      peakBtn.onclick = () => {
        state.overlays.sun = true;
        state.sunMinutes = peakMin;
        syncLayers();
      };
    } else {
      sumBox.innerHTML = `<strong>Soft Indirect Daylight (${state.sunDate}):</strong> Zero harsh direct floor glare (protected by ${dirs} orientation / overhangs).`;
      peakBtn.style.display = "none";
    }

    // Category chips
    const catCounts = {};
    openings.forEach((o) => { catCounts[o.category] = (catCounts[o.category] || 0) + 1; });
    chipsEl.innerHTML = WIN_CATEGORIES.filter((c) => catCounts[c.category] > 0).map((c) => `
      <button type="button" class="room-elec-chip" data-room-win-cat="${c.category}" style="--chip-color:${c.color}">
        <span class="room-elec-chip-dot"></span>
        <span><strong>${catCounts[c.category]}×</strong> ${c.short}</span>
      </button>`).join("");

    chipsEl.querySelectorAll("[data-room-win-cat]").forEach((chip) => {
      const cat = chip.dataset.roomWinCat;
      chip.addEventListener("mouseenter", () => { state.winHoverCat = cat; renderWindowsOverlay(); });
      chip.addEventListener("mouseleave", () => { if (state.winHoverCat === cat) { state.winHoverCat = null; renderWindowsOverlay(); } });
      chip.addEventListener("click", () => {
        state.overlays.win = true;
        setWinDrawerOpen(true);
        state.winFocusId = null;
        state.winSelectedCats = new Set([cat]);
        syncLayers();
      });
    });

    // Expandable Window IDs pill list
    idsBtn.style.display = "flex";
    idsLbl.textContent = `Window IDs (${openings.length}) — hover to locate, click to copy`;
    idsList.classList.toggle("open", state.roomWinIdsOpen);
    idsBtn.setAttribute("aria-expanded", state.roomWinIdsOpen ? "true" : "false");
    idsList.innerHTML = openings.map((op) => {
      const meta = WIN_META_BY_CAT[op.category] || { color: "#0284c7" };
      const act = state.winFocusId === op.id ? " active" : "";
      return `<button type="button" class="room-id-pill${act}" data-win-id="${op.id}" style="--pill-color:${meta.color}" title="${op.id}: ${op.size} ${op.label} (${op.facingLabel})">${op.id}</button>`;
    }).join("");

    idsList.querySelectorAll("[data-win-id]").forEach((pill) => {
      const wid = pill.dataset.winId;
      pill.addEventListener("mouseenter", () => { state.winHoverId = wid; renderWindowsOverlay(); });
      pill.addEventListener("mouseleave", () => { if (state.winHoverId === wid) { state.winHoverId = null; renderWindowsOverlay(); } });
      pill.addEventListener("click", () => {
        state.winHoverId = null;
        if (state.winFocusId === wid) {
          state.winFocusId = null;
          syncLayers();
        } else {
          focusWinById(wid, false);
          copyWinId(wid);
        }
        renderRoomDaylightSummary(room);
      });
    });
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

    // Show Room Inspector Card with Daylight & Windows + Electrical Plan summaries
    const card = document.getElementById("room-card");
    document.getElementById("room-card-title").textContent = room.name;
    document.getElementById("room-card-badge").textContent = `${room.ceiling} · ${SHEET_META[room.floor].code}`;
    document.getElementById("room-card-body").textContent = room.desc;
    document.getElementById("room-card-tags").innerHTML = room.tags
      .map((t) => `<span class="room-tag">${t}</span>`)
      .join("");
    renderRoomDaylightSummary(room);
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
    const extraSolar = state.overlays.sun
      ? `<g>${extShadowsSlot.innerHTML}</g><g>${sunlightSlot.innerHTML}</g>`
      : "";
    const extraWins = state.overlays.win ? `<g>${windowsSlot.innerHTML}</g>` : "";
    const out = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">
<style>
  svg{background:${v("--v-paper")};stroke-linecap:round;stroke-linejoin:round}
  .s-ink{stroke:${v("--v-ink")}}.s-mid{stroke:${v("--v-mid")}}.s-dim{stroke:${v("--v-dim")}}.s-light{stroke:${v("--v-light")}}.s-elec{stroke:${v("--v-elec")}}.s-paper{stroke:${v("--v-paper")}}
  .f-ink{fill:${v("--v-ink")}}.f-paper{fill:${v("--v-paper")}}.f-wall{fill:${v("--v-wall")}}.f-shade{fill:${v("--v-shade")}}.f-tint{fill:${v("--v-tint")}}.f-elec{fill:${v("--v-elec")}}
  .mode-ghost .s-ink,.mode-ghost .s-mid{stroke:${v("--v-ghost-stroke")}}.mode-ghost .s-dim,.mode-ghost .s-light{stroke:${v("--v-ghost-dim")}}.mode-ghost .f-ink{fill:${v("--v-ghost-stroke")}}.mode-ghost .f-wall{fill:${v("--v-ghost-wall")}}.mode-ghost .f-paper{fill:none}
  .mode-underlay{opacity:.34}.mode-underlay .f-paper{fill:none}
  .mode-elec-overlay .f-paper,.mode-elec-overlay .f-wall,.mode-elec-overlay .f-shade,.mode-elec-overlay .f-tint{fill:none}.mode-elec-overlay .s-ink,.mode-elec-overlay .s-mid,.mode-elec-overlay .s-dim{stroke:${v("--v-elec")};stroke-opacity:.45}.mode-elec-overlay .f-ink{fill:${v("--v-elec")};fill-opacity:.85}
  .ext-shadow-building{fill:#0f172a;fill-opacity:.14}.ext-shadow-tree{fill:#14532d;fill-opacity:.13}.ext-tree-canopy-outline{fill:#16a34a;fill-opacity:.06;stroke:#15803d;stroke-opacity:.38;stroke-dasharray:5 3}
  .sun-arc-ring{fill:none;stroke:#64748b;stroke-opacity:.28;stroke-dasharray:3 4}.sun-arc-trajectory{fill:none;stroke:#d97706;stroke-opacity:.72;stroke-width:2.2;stroke-dasharray:6 4}
  .sun-arc-cardinal{font-family:monospace;font-weight:700;fill:#64748b;text-anchor:middle}.sun-arc-time-lbl{font-family:monospace;font-weight:650;fill:#b45309;text-anchor:middle}
  .elec-id-bg{fill:${v("--ui-surface")};stroke-width:1.1;fill-opacity:.94}.elec-id-text{font-family:monospace;font-weight:700;text-anchor:middle;dominant-baseline:central;fill:${v("--ui-text")}}
</style>
<defs>${defsEl.innerHTML}${solarDefsEl ? solarDefsEl.innerHTML : ""}</defs>
${visibleSlots}
${extraSolar}
${extraWins}
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

    // Update live coordinates relative to ADU SE architectural origin (164.4, 971.5) in True North / West feet
    const relX = w.x - 164.4;
    const relY = 971.5 - w.y;
    document.getElementById("coord-badge").textContent =
      `N: ${formatFeetInches(relX)} · W: ${formatFeetInches(relY)}`;

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
    if (e.key.toLowerCase() === "s") {
      state.overlays.sun = !state.overlays.sun;
      if (!state.overlays.sun && state.sunPlaying) setSunPlaying(false);
      if (state.overlays.sun) setSunDrawerOpen(true);
      syncLayers();
      return;
    }
    if (e.key.toLowerCase() === "w") {
      state.overlays.win = !state.overlays.win;
      if (state.overlays.win) setWinDrawerOpen(true);
      syncLayers();
      return;
    }
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
      } else if (state.sunPlaying) {
        setSunPlaying(false);
      } else if (state.winFocusId) {
        state.winFocusId = null;
        syncLayers();
        if (state.activeRoomId) {
          const r = ROOMS.find((x) => x.id === state.activeRoomId);
          if (r) renderRoomDaylightSummary(r);
        }
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

    // Sunlight & Shadows Controls (Sidebar + Floating Timeline Scrubber)
    document.getElementById("toggle-sun").addEventListener("change", (e) => {
      state.overlays.sun = e.target.checked;
      if (!state.overlays.sun && state.sunPlaying) setSunPlaying(false);
      if (state.overlays.sun) setSunDrawerOpen(true);
      syncLayers();
    });
    document.getElementById("opacity-sun").addEventListener("input", (e) => {
      state.overlays.sunOpacity = Number(e.target.value) / 100;
      document.getElementById("opacity-sun-val").textContent = `${e.target.value}%`;
      renderSunlightAndShadows();
    });
    document.getElementById("btn-expand-sun").addEventListener("click", () => {
      setSunDrawerOpen(!state.sunDrawerOpen);
    });

    const onSunTimeInput = (e) => {
      if (state.sunPlaying) setSunPlaying(false);
      state.sunMinutes = Number(e.target.value);
      if (!state.overlays.sun) {
        state.overlays.sun = true;
        syncLayers();
      } else {
        renderSunlightAndShadows();
        renderWindowsOverlay();
      }
    };
    document.getElementById("sun-time-sidebar").addEventListener("input", onSunTimeInput);
    document.getElementById("sun-time-hud").addEventListener("input", onSunTimeInput);

    const onSunDateChange = (e) => {
      if (!e.target.value) return;
      state.sunDate = e.target.value;
      state.sunPreset = "custom";
      renderSunlightAndShadows();
      renderWindowsOverlay();
      if (state.activeRoomId) {
        const r = ROOMS.find((x) => x.id === state.activeRoomId);
        if (r) renderRoomDaylightSummary(r);
      }
    };
    document.getElementById("sun-date-sidebar").addEventListener("change", onSunDateChange);
    document.getElementById("sun-date-hud").addEventListener("change", onSunDateChange);

    document.querySelectorAll("[data-sun-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.overlays.sun) state.overlays.sun = true;
        applySunPreset(btn.dataset.sunPreset);
        syncLayers();
      });
    });

    document.getElementById("btn-sun-play").addEventListener("click", () => setSunPlaying(!state.sunPlaying));
    document.getElementById("btn-sun-play-sidebar").addEventListener("click", () => setSunPlaying(!state.sunPlaying));

    document.getElementById("chk-sun-trees").addEventListener("change", (e) => {
      state.sunTreeShade = e.target.checked;
      renderSunlightAndShadows();
      if (state.activeRoomId) {
        const r = ROOMS.find((x) => x.id === state.activeRoomId);
        if (r) renderRoomDaylightSummary(r);
      }
    });
    document.getElementById("chk-sun-ext-shadows").addEventListener("change", (e) => {
      state.sunExtShadows = e.target.checked;
      syncLayers();
    });
    document.getElementById("chk-sun-arc").addEventListener("change", (e) => {
      state.sunShowArc = e.target.checked;
      renderSunlightAndShadows();
    });

    // Aligned Vector Windows & Glazing Controls
    document.getElementById("toggle-win").addEventListener("change", (e) => {
      state.overlays.win = e.target.checked;
      if (state.overlays.win) setWinDrawerOpen(true);
      syncLayers();
    });
    document.getElementById("btn-expand-win").addEventListener("click", () => {
      setWinDrawerOpen(!state.winDrawerOpen);
    });
    const winSearchInput = document.getElementById("win-id-search");
    winSearchInput.addEventListener("input", (e) => handleWinIdSearch(e.target.value));
    winSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const firstBtn = document.querySelector("#win-id-results .elec-id-result-btn");
        if (firstBtn) firstBtn.click();
      } else if (e.key === "Escape") {
        winSearchInput.value = "";
        handleWinIdSearch("");
      }
    });
    document.getElementById("btn-win-ids").addEventListener("click", () => {
      state.winShowIds = !state.winShowIds;
      document.getElementById("btn-win-ids").classList.toggle("active", state.winShowIds);
      renderWindowsOverlay();
    });
    document.getElementById("btn-win-all").addEventListener("click", () => {
      state.overlays.win = true;
      state.winFocusId = null;
      const items = getFloorOpenings(getActivePlanFloor());
      state.winSelectedCats = new Set(items.map((o) => o.category));
      syncLayers();
    });
    document.getElementById("btn-win-clear").addEventListener("click", () => {
      state.winSelectedCats.clear();
      state.winFocusId = null;
      state.winHoverId = null;
      winSearchInput.value = "";
      handleWinIdSearch("");
      syncLayers();
      if (state.activeRoomId) {
        const r = ROOMS.find((x) => x.id === state.activeRoomId);
        if (r) renderRoomDaylightSummary(r);
      }
    });
    document.getElementById("btn-room-win-ids-toggle").addEventListener("click", () => {
      state.roomWinIdsOpen = !state.roomWinIdsOpen;
      document.getElementById("btn-room-win-ids-toggle").setAttribute("aria-expanded", state.roomWinIdsOpen ? "true" : "false");
      document.getElementById("room-win-ids-list").classList.toggle("open", state.roomWinIdsOpen);
    });

    // Overlay Toggles & Opacity Sliders (Electrical)
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
    document.getElementById("btn-quick-sun").addEventListener("click", () => {
      state.overlays.sun = !state.overlays.sun;
      if (!state.overlays.sun && state.sunPlaying) setSunPlaying(false);
      if (state.overlays.sun) setSunDrawerOpen(true);
      syncLayers();
    });
    document.getElementById("btn-quick-win").addEventListener("click", () => {
      state.overlays.win = !state.overlays.win;
      if (state.overlays.win) setWinDrawerOpen(true);
      syncLayers();
    });
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
