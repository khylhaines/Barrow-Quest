/* =========================================================
   BARROW QUEST - FULL SINGLE FILE ENGINE
   Matches:
   - index.html
   - styles.css
========================================================= */

const $ = (id) => document.getElementById(id);

const SAVE_KEY = "barrowquest_engine_v2";
const ENTER_RADIUS_M_DEFAULT = 35;
const PASS_BONUS_COINS = 25;
const BOSS_BONUS_COINS = 150;

let map = null;
let hero = null;
let cur = null;
let activeTask = null;
let activeMarkers = {};
let audioCtx = null;
let gpsHasCenteredOnce = false;
let lastGoodGps = null;

/* =========================================================
   STATE
========================================================= */

let state = JSON.parse(localStorage.getItem(SAVE_KEY)) || {
  players: [
    { id: "p1", name: "Player 1", coins: 0, enabled: true },
    { id: "p2", name: "Player 2", coins: 0, enabled: true },
    { id: "p3", name: "Player 3", coins: 0, enabled: false },
    { id: "p4", name: "Player 4", coins: 0, enabled: false },
  ],
  activePlayerId: "p1",

  activeSet: "core", // core | abbey | park
  activeRoute: "core",
  activeRouteStart: null,
  activeTheme: null,

  unlockedHiddenPins: [],
  unlockedBossPins: [],
  ghostStageUnlocked: false,

  nodes: {},

  parkThemeProgress: {
    festival: 0,
    history: 0,
    mystery: 0,
    challenge: 0,
    nature: 0,
  },

  settings: {
    enterRadiusM: ENTER_RADIUS_M_DEFAULT,
    cooldownMin: 10,
    captureNeed: 1,
    character: "hero_duo",
    voiceRate: 1,
    voicePitch: 1,
    sfxVol: 80,
    zoomUI: false,
  },
};

state.players ||= [
  { id: "p1", name: "Player 1", coins: 0, enabled: true },
  { id: "p2", name: "Player 2", coins: 0, enabled: true },
  { id: "p3", name: "Player 3", coins: 0, enabled: false },
  { id: "p4", name: "Player 4", coins: 0, enabled: false },
];
state.activePlayerId ||= "p1";
state.activeSet ||= "core";
state.activeRoute ||= "core";
state.activeRouteStart ||= null;
state.activeTheme ||= null;
state.unlockedHiddenPins ||= [];
state.unlockedBossPins ||= [];
state.ghostStageUnlocked ||= false;
state.nodes ||= {};
state.parkThemeProgress ||= {
  festival: 0,
  history: 0,
  mystery: 0,
  challenge: 0,
  nature: 0,
};
state.settings ||= {};
state.settings.enterRadiusM ??= ENTER_RADIUS_M_DEFAULT;
state.settings.cooldownMin ??= 10;
state.settings.captureNeed ??= 1;
state.settings.character ??= "hero_duo";
state.settings.voiceRate ??= 1;
state.settings.voicePitch ??= 1;
state.settings.sfxVol ??= 80;
state.settings.zoomUI ??= false;

/* =========================================================
   CHARACTERS
========================================================= */

const CHARACTERS = {
  hero_duo: { html: `<div style="font-size:42px;">🧭</div>` },
  ninja: { html: `<div style="font-size:42px;">🥷</div>` },
  wizard: { html: `<div style="font-size:42px;">🧙</div>` },
  robot: { html: `<div style="font-size:42px;">🤖</div>` },
  pirate: { html: `<div style="font-size:42px;">🏴‍☠️</div>` },
};

/* =========================================================
   ROUTES
========================================================= */

const ROUTES = {
  core: {
    id: "core",
    mode: "free",
  },

  abbey: {
    id: "abbey",
    mode: "guided",
    starts: {
      red_river: {
        id: "red_river",
        orderedPins: [
          "abbey_redriver_start",
          "abbey_redriver_bridge",
          "abbey_redriver_bend",
          "abbey_valley_view",
          "abbey_amphitheatre_entry",
          "abbey_gate",
          "abbey_church",
          "abbey_cloister",
          "abbey_chapter_house",
          "abbey_viewpoint",
          "abbey_boss",
        ],
      },
      hospital: { id: "hospital", orderedPins: [] },
      manor: { id: "manor", orderedPins: [] },
      woodland: { id: "woodland", orderedPins: [] },
      visitor: { id: "visitor", orderedPins: [] },
    },
  },

  park: {
    id: "park",
    mode: "free",
    starts: {
      parkroad: { id: "parkroad", suggestedTheme: "festival" },
      abbeyroad: { id: "abbeyroad", suggestedTheme: "festival" },
      daltonroad: { id: "daltonroad", suggestedTheme: "history" },
      greengate: { id: "greengate", suggestedTheme: "nature" },
      leisure: { id: "leisure", suggestedTheme: "challenge" },
      cemetery: { id: "cemetery", suggestedTheme: "history" },
    },
    hiddenRules: {
      park_hidden_old_tree: { theme: "mystery", needed: 2 },
      park_hidden_secret_garden: { theme: "mystery", needed: 2 },
      park_hidden_lake_spot: { theme: "nature", needed: 2 },
      park_hidden_quiet_bench: { totalCompleted: 3 },
    },
    bossRules: {
      park_boss_bandstand: { theme: "festival", needed: 3 },
      park_boss_cenotaph: { theme: "history", needed: 2 },
      park_boss_mudman: {
        theme: "mystery",
        needed: 2,
        needsHidden: "park_hidden_secret_garden",
      },
      park_boss_skate: { theme: "challenge", needed: 3 },
    },
  },
};

/* =========================================================
   PINS
========================================================= */

const CORE_PINS = [
  { id: "home_base", n: "Home Base (196 Marsh St)", set: "core", zone: "core", route: "core", type: "start", l: [54.113710, -3.218448], i: "🏠" },
  { id: "morrisons_retail", n: "Morrisons Retail", set: "core", zone: "core", route: "core", type: "quiz", l: [54.108899, -3.224459], i: "🛒" },
  { id: "salthouse_mills", n: "Salthouse Mills", set: "core", zone: "core", route: "core", type: "history", l: [54.108788, -3.202556], i: "🏭" },
  { id: "the_cenotaph", n: "The Cenotaph", set: "core", zone: "core", route: "core", type: "history", l: [54.117756, -3.220668], i: "🕊️" },
  { id: "park_bandstand_core", n: "Park Bandstand", set: "core", zone: "core", route: "core", type: "quiz", l: [54.116764, -3.215450], i: "🎵" },
  { id: "park_railway", n: "Park Railway", set: "core", zone: "core", route: "core", type: "history", l: [54.117303, -3.213301], i: "🚂" },
  { id: "boating_lake_core", n: "Boating Lake", set: "core", zone: "core", route: "core", type: "history", l: [54.115711, -3.214812], i: "🦆" },
  { id: "bridgegate_ave", n: "Bridgegate Ave", set: "core", zone: "core", route: "core", type: "quiz", l: [54.1298, -3.2015], i: "🛣️" },
  { id: "fryers_lane", n: "Fryer's Lane", set: "core", zone: "core", route: "core", type: "quiz", l: [54.1332, -3.1995], i: "📍" },
  { id: "flashlight_bend", n: "Flashlight Bend", set: "core", zone: "core", route: "core", type: "logic", l: [54.1350, -3.1985], i: "🔦" },
  { id: "red_river_walk_core", n: "Red River Walk", set: "core", zone: "core", route: "core", type: "activity", l: [54.1365, -3.1978], i: "🌲" },
  { id: "furness_abbey_core", n: "Furness Abbey", set: "core", zone: "core", route: "core", type: "history", l: [54.1375, -3.1965], i: "⛪" },
  { id: "dock_museum_anchor", n: "Dock Museum Anchor", set: "core", zone: "core", route: "core", type: "history", l: [54.111672, -3.239817], i: "⚓" },
  { id: "town_hall_clock", n: "Town Hall Clock", set: "core", zone: "core", route: "core", type: "history", l: [54.111790, -3.227814], i: "🕰️" },
  { id: "the_custom_house", n: "The Custom House", set: "core", zone: "core", route: "core", type: "history", l: [54.112861, -3.233361], i: "🏛️" },
  { id: "the_forum", n: "The Forum", set: "core", zone: "core", route: "core", type: "quiz", l: [54.111780, -3.227541], i: "🎭" },
  { id: "barrow_library", n: "Barrow Library", set: "core", zone: "core", route: "core", type: "quiz", l: [54.114344, -3.231352], i: "📚" },
  { id: "henry_schneider_statue", n: "Statue of Henry Schneider", set: "core", zone: "core", route: "core", type: "history", l: [54.110993, -3.226199], i: "🗿" },
  { id: "james_ramsden_statue", n: "Statue of James Ramsden", set: "core", zone: "core", route: "core", type: "history", l: [54.114014, -3.230905], i: "🗿" },
  { id: "old_fire_station", n: "Old Fire Station", set: "core", zone: "core", route: "core", type: "history", l: [54.113410, -3.232430], i: "🚒" },
  { id: "the_market_hall", n: "The Market Hall", set: "core", zone: "core", route: "core", type: "quiz", l: [54.111512, -3.227291], i: "🏪" },
  { id: "the_duke_of_edinburgh", n: "The Duke of Edinburgh", set: "core", zone: "core", route: "core", type: "quiz", l: [54.117008, -3.225820], i: "🍺" },
  { id: "emlyn_hughes_statue", n: "Emlyn Hughes Statue", set: "core", zone: "core", route: "core", type: "history", l: [54.117198, -3.225964], i: "⚽" },
  { id: "the_slag_bank", n: "The Slag Bank", set: "core", zone: "core", route: "core", type: "history", l: [54.129081, -3.240556], i: "⛰️" },
  { id: "walney_bridge_entrance", n: "Walney Bridge Entrance", set: "core", zone: "core", route: "core", type: "activity", l: [54.107810, -3.242316], i: "🌉" },
  { id: "earnse_bay", n: "Earnse Bay", set: "core", zone: "core", route: "core", type: "activity", l: [54.118717, -3.268810], i: "🌅" },
  { id: "walney_lighthouse", n: "Walney Lighthouse", set: "core", zone: "core", route: "core", type: "history", l: [54.049374, -3.200183], i: "🗼" },
  { id: "the_round_house", n: "The Round House", set: "core", zone: "core", route: "core", type: "history", l: [54.097685, -3.258015], i: "🏠" },
  { id: "biggar_village", n: "Biggar Village", set: "core", zone: "core", route: "core", type: "history", l: [54.084516, -3.238156], i: "🏘️" },
  { id: "piel_castle", n: "Piel Castle", set: "core", zone: "core", route: "core", type: "history", l: [54.062467, -3.172938], i: "🏰" },
  { id: "roa_island_jetty", n: "Roa Island Jetty", set: "core", zone: "core", route: "core", type: "activity", l: [54.073510, -3.174083], i: "🛥️" },
  { id: "the_amphitheatre", n: "The Amphitheatre", set: "core", zone: "core", route: "core", type: "activity", l: [54.134350, -3.197034], i: "🏛️" },
  { id: "abbey_upper_path", n: "Abbey Upper Path", set: "core", zone: "core", route: "core", type: "activity", l: [54.134702, -3.196143], i: "🥾" },
  { id: "park_playground", n: "Park Playground", set: "core", zone: "core", route: "core", type: "activity", l: [54.117774, -3.216320], i: "🛝" },
  { id: "park_greenhouse", n: "Park Greenhouse", set: "core", zone: "core", route: "core", type: "history", l: [54.117961, -3.216366], i: "🌿" },
  { id: "park_bowling_green_core", n: "Park Bowling Green", set: "core", zone: "core", route: "core", type: "history", l: [54.117264, -3.216648], i: "🎳" },
  { id: "park_cafe_core", n: "Park Café", set: "core", zone: "core", route: "core", type: "family", l: [54.117355, -3.217025], i: "☕" },
  { id: "ormsgill_reservoir", n: "Ormsgill Reservoir", set: "core", zone: "core", route: "core", type: "history", l: [54.126658, -3.231571], i: "💧" },
  { id: "barrow_afc_grounds", n: "Barrow AFC Grounds", set: "core", zone: "core", route: "core", type: "activity", l: [54.123732, -3.233835], i: "⚽" },
  { id: "the_rugby_ground", n: "The Rugby Ground", set: "core", zone: "core", route: "core", type: "activity", l: [54.115278, -3.234060], i: "🏉" },
  { id: "hollywood_park", n: "Hollywood Park", set: "core", zone: "core", route: "core", type: "activity", l: [54.114964, -3.237282], i: "🌳" },
  { id: "furness_general_hospital", n: "Furness General Hospital", set: "core", zone: "core", route: "core", type: "history", l: [54.133506, -3.206410], i: "🏥" },
  { id: "rampside_needle", n: "Rampside Needle", set: "core", zone: "core", route: "core", type: "history", l: [54.086756, -3.161553], i: "📍" },
  { id: "st_georges_church", n: "St. George’s Church", set: "core", zone: "core", route: "core", type: "history", l: [54.108532, -3.220131], i: "⛪" },
  { id: "bae_systems_main_gate", n: "BAE Systems Main Gate", set: "core", zone: "core", route: "core", type: "history", l: [54.107824, -3.229059], i: "🛡️" },
  { id: "the_hindpool_tiger", n: "The Hindpool Tiger", set: "core", zone: "core", route: "core", type: "logic", l: [54.117171, -3.236430], i: "🐯" },
  { id: "dalton_road_clock", n: "Dalton Road Clock", set: "core", zone: "core", route: "core", type: "history", l: [54.113436, -3.225185], i: "🕰️" },
  { id: "the_bus_depot", n: "The Bus Depot", set: "core", zone: "core", route: "core", type: "quiz", l: [54.124984, -3.238193], i: "🚌" },
  { id: "north_walney_nature_reserve_gate", n: "North Walney Nature Reserve Gate", set: "core", zone: "core", route: "core", type: "activity", l: [54.121288, -3.270134], i: "🌿" },
  { id: "sandy_gap_beach_access", n: "Sandy Gap Beach Access", set: "core", zone: "core", route: "core", type: "activity", l: [54.103753, -3.261220], i: "🏖️" },
  { id: "walney_airfield_entrance", n: "Walney Airfield Entrance", set: "core", zone: "core", route: "core", type: "history", l: [54.121124, -3.257013], i: "✈️" },
  { id: "the_vickerstown_park", n: "The Vickerstown Park", set: "core", zone: "core", route: "core", type: "activity", l: [54.115351, -3.250952], i: "🌳" },
  { id: "king_alfred_pub", n: "The King Alfred Pub (Vickerstown)", set: "core", zone: "core", route: "core", type: "quiz", l: [54.104361, -3.246295], i: "🍺" },
  { id: "thorny_nook", n: "Thorny Nook", set: "core", zone: "core", route: "core", type: "logic", l: [54.086341, -3.249388], i: "🌲" },
  { id: "south_walney_nature_reserve_entrance", n: "South Walney Nature Reserve Entrance", set: "core", zone: "core", route: "core", type: "activity", l: [54.049029, -3.199424], i: "🦭" },
  { id: "walney_school", n: "Walney School", set: "core", zone: "core", route: "core", type: "quiz", l: [54.105688, -3.258229], i: "🏫" },
  { id: "west_shore_park", n: "West Shore Park", set: "core", zone: "core", route: "core", type: "activity", l: [54.097150, -3.258958], i: "🌊" },
  { id: "jubilee_bridge_mid_point", n: "Jubilee Bridge Mid-Point", set: "core", zone: "core", route: "core", type: "activity", l: [54.107675, -3.243870], i: "🌉" },
  { id: "coast_road_rampside_rd_entrance", n: "The Coast Road (Rampside Rd Entrance)", set: "core", zone: "core", route: "core", type: "activity", l: [54.088312, -3.159760], i: "🛣️" },
  { id: "lifeboat_station_roa_island", n: "Lifeboat Station (Roa Island)", set: "core", zone: "core", route: "core", type: "history", l: [54.072870, -3.173697], i: "🚤" },
  { id: "the_concle_inn", n: "The Concle Inn", set: "core", zone: "core", route: "core", type: "quiz", l: [54.083809, -3.172414], i: "🍻" },
  { id: "furness_abbey_railway_station_ruins", n: "Furness Abbey Railway Station Ruins", set: "core", zone: "core", route: "core", type: "history", l: [54.137605, -3.198454], i: "🚉" },
  { id: "amphitheatre_steps", n: "The Amphitheatre Steps", set: "core", zone: "core", route: "core", type: "activity", l: [54.134723, -3.199773], i: "🥾" },
  { id: "abbey_road_baptist_church", n: "Abbey Road Baptist Church", set: "core", zone: "core", route: "core", type: "history", l: [54.120787, -3.219426], i: "⛪" },
  { id: "barrow_fire_station", n: "Barrow Fire Station", set: "core", zone: "core", route: "core", type: "history", l: [54.124247, -3.238590], i: "🚒" },
  { id: "submarine_memorial", n: "Submarine Memorial (Town Hall)", set: "core", zone: "core", route: "core", type: "history", l: [54.111452, -3.228052], i: "⚓" },
  { id: "the_victoria_hall", n: "The Victoria Hall", set: "core", zone: "core", route: "core", type: "history", l: [54.116226, -3.224835], i: "🏛️" },
  { id: "barrow_golf_club", n: "Barrow Golf Club", set: "core", zone: "core", route: "core", type: "activity", l: [54.140853, -3.219792], i: "⛳" },
  { id: "hawcoat_quarry", n: "Hawcoat Quarry", set: "core", zone: "core", route: "core", type: "history", l: [54.133419, -3.226005], i: "🪨" },
  { id: "st_pauls_church", n: "St. Paul’s Church", set: "core", zone: "core", route: "core", type: "history", l: [54.128161, -3.213691], i: "⛪" },
  { id: "the_strawberry_pub", n: "The Strawberry Pub", set: "core", zone: "core", route: "core", type: "quiz", l: [54.127641, -3.213498], i: "🍓" },
  { id: "red_river_waterfall", n: "The Red River Waterfall", set: "core", zone: "core", route: "core", type: "activity", l: [54.118144, -3.197030], i: "💦" },
  { id: "furness_general_main_entrance", n: "Furness General (Main Entrance)", set: "core", zone: "core", route: "core", type: "history", l: [54.136512, -3.210279], i: "🏥" },
  { id: "roose_station_platform", n: "Roose Station Platform", set: "core", zone: "core", route: "core", type: "history", l: [54.114828, -3.194084], i: "🚉" },
  { id: "the_ship_inn", n: "The Ship Inn (Piel Island)", set: "core", zone: "core", route: "core", type: "quiz", l: [54.064098, -3.172772], i: "🍺" },
  { id: "the_lifeboat_monument", n: "The Lifeboat Monument", set: "core", zone: "core", route: "core", type: "history", l: [54.111624, -3.239883], i: "🚤" },
  { id: "bae_systems_the_bridge", n: "BAE Systems (The Bridge)", set: "core", zone: "core", route: "core", type: "history", l: [54.109233, -3.239460], i: "🛡️" },
  { id: "the_gas_terminals", n: "The Gas Terminals (Main Gates)", set: "core", zone: "core", route: "core", type: "history", l: [54.098589, -3.173926], i: "🔥" },
  { id: "kimberly_clark_factory", n: "Kimberly-Clark Factory", set: "core", zone: "core", route: "core", type: "history", l: [54.143936, -3.230962], i: "🏭" },
  { id: "spiral_ramp", n: "The Spiral Ramp (Town Center)", set: "core", zone: "core", route: "core", type: "activity", l: [54.125454, -3.238880], i: "🌀" },
  { id: "barrow_park_greenhouse_2", n: "Barrow Park Greenhouse", set: "core", zone: "core", route: "core", type: "history", l: [54.118030, -3.216973], i: "🌿" },
  { id: "park_fitness_trail_start", n: "The Park Fitness Trail Start", set: "core", zone: "core", route: "core", type: "activity", l: [54.118062, -3.213948], i: "💪" },
  { id: "the_park_rockery", n: "The Park Rockery", set: "core", zone: "core", route: "core", type: "logic", l: [54.118401, -3.218738], i: "🪨" },
  { id: "the_park_rose_garden", n: "The Park Rose Garden", set: "core", zone: "core", route: "core", type: "quiz", l: [54.117790, -3.216026], i: "🌹" },
  { id: "the_greenway_path", n: "The Greenway Path (Barrow Island)", set: "core", zone: "core", route: "core", type: "activity", l: [54.110553, -3.241691], i: "🚶" },
  { id: "barrow_island_primary", n: "Barrow Island Primary", set: "core", zone: "core", route: "core", type: "quiz", l: [54.103947, -3.229953], i: "🏫" },
  { id: "the_old_brickworks", n: "The Old Brickworks", set: "core", zone: "core", route: "core", type: "history", l: [54.121427, -3.238341], i: "🧱" },
  { id: "cavendish_dock_water_gate", n: "Cavendish Dock Water Gate", set: "core", zone: "core", route: "core", type: "history", l: [54.100186, -3.207629], i: "🌊" },
  { id: "the_graving_dock_new", n: "The Graving Dock (New Location)", set: "core", zone: "core", route: "core", type: "history", l: [54.112288, -3.240744], i: "🚢" },
  { id: "the_bowling_alley_hollywood_park", n: "The Bowling Alley (Hollywood Park)", set: "core", zone: "core", route: "core", type: "activity", l: [54.114863, -3.237901], i: "🎳" },
  { id: "the_skate_park_core", n: "The Skate Park", set: "core", zone: "core", route: "core", type: "activity", l: [54.121424, -3.243982], i: "🛹" },
  { id: "dock_museum_submarine", n: "The Dock Museum Submarine", set: "core", zone: "core", route: "core", type: "history", l: [54.111995, -3.240591], i: "🚢" },
  { id: "barrow_cricket_club", n: "Barrow Cricket Club", set: "core", zone: "core", route: "core", type: "activity", l: [54.133856, -3.206900], i: "🏏" },
  { id: "twelve_laws_stone", n: "The 12 Laws of the Universe Stone", set: "core", zone: "core", route: "core", type: "logic", l: [54.132256, -3.243878], i: "🪨" },
  { id: "spirit_of_barrow_mural", n: "The Spirit of Barrow Mural", set: "core", zone: "core", route: "core", type: "history", l: [54.113448, -3.225193], i: "🎨" },
  { id: "final_boss_gate", n: "The Final Boss Gate (Marsh St Entrance)", set: "core", zone: "core", route: "core", type: "boss", l: [54.113258, -3.218118], i: "👑" },
];

const ABBEY_PINS = [
  { id: "abbey_redriver_start", n: "Red River Walk Entrance", set: "abbey", zone: "abbey", route: "abbey", routeStart: "red_river", type: "start", l: [54.118164, -3.196948], i: "🌲" },
  { id: "abbey_redriver_bridge", n: "Red River Bridge", set: "abbey", zone: "abbey", route: "abbey", type: "story", l: [54.123073, -3.193007], i: "🌉" },
  { id: "abbey_redriver_bend", n: "Woodland Bend", set: "abbey", zone: "abbey", route: "abbey", type: "quiz", l: [54.133017, -3.190272], i: "🌳" },
  { id: "abbey_valley_view", n: "Abbey Valley View", set: "abbey", zone: "abbey", route: "abbey", type: "history", l: [54.134365, -3.196948], i: "👁️" },
  { id: "abbey_amphitheatre_entry", n: "Amphitheatre Entrance", set: "abbey", zone: "abbey", route: "abbey", type: "activity", l: [54.134455, -3.196085], i: "🏛️" },
  { id: "abbey_gate", n: "Abbey Entrance Gate", set: "abbey", zone: "abbey", route: "abbey", type: "history", l: [54.134990, -3.212040], i: "🚪" },
  { id: "abbey_church", n: "Abbey Church Ruins", set: "abbey", zone: "abbey", route: "abbey", type: "quiz", l: [54.135050, -3.212240], i: "⛪" },
  { id: "abbey_cloister", n: "Cloister Walk", set: "abbey", zone: "abbey", route: "abbey", type: "logic", l: [54.134940, -3.212390], i: "🧩" },
  { id: "abbey_chapter_house", n: "Chapter House", set: "abbey", zone: "abbey", route: "abbey", type: "history", l: [54.134920, -3.212570], i: "📜" },
  { id: "abbey_viewpoint", n: "Abbey Viewpoint", set: "abbey", zone: "abbey", route: "abbey", type: "activity", l: [54.135120, -3.212720], i: "🔭" },
  { id: "abbey_boss", n: "Abbey Final Boss", set: "abbey", zone: "abbey", route: "abbey", type: "boss", l: [54.134960, -3.212320], i: "👑" },
  { id: "abbey_headless_monk", n: "Headless Monk Gate", set: "abbey", zone: "abbey", route: "abbey", type: "ghost", hidden: true, l: [54.134970, -3.212180], i: "👻" },
];

const PARK_PINS = [
  { id: "park_start_parkave", n: "Park Road Gate", set: "park", zone: "park", route: "park", routeStart: "parkroad", type: "start", l: [54.116412, -3.219966], i: "🚪" },
  { id: "park_start_abbeyroad", n: "Abbey Road Entrance", set: "park", zone: "park", route: "park", routeStart: "abbeyroad", type: "start", l: [54.120464, -3.220300], i: "🚪" },
  { id: "park_start_daltonroad", n: "Dalton Road Entrance", set: "park", zone: "park", route: "park", routeStart: "daltonroad", type: "start", l: [54.118661, -3.222992], i: "🚪" },
  { id: "park_start_greengate", n: "Greengate Street Entrance", set: "park", zone: "park", route: "park", routeStart: "greengate", type: "start", l: [54.114817, -3.214354], i: "🚪" },
  { id: "park_start_leisure", n: "Leisure Centre Entrance", set: "park", zone: "park", route: "park", routeStart: "leisure", type: "start", l: [54.116810, -3.213118], i: "🚪" },
  { id: "park_start_cemetery", n: "Cemetery Side Entrance", set: "park", zone: "park", route: "park", routeStart: "cemetery", type: "start", l: [54.118259, -3.214589], i: "🚪" },

  { id: "park_bandstand", n: "Bandstand", set: "park", zone: "park", route: "park", type: "quiz", theme: "festival", l: [54.117519, -3.218420], i: "🎵" },
  { id: "park_pirate_ship", n: "Pirate Ship Playground", set: "park", zone: "park", route: "park", type: "activity", theme: "challenge", l: [54.117904, -3.216734], i: "🏴‍☠️" },
  { id: "park_parrot_corner", n: "Parrot Corner", set: "park", zone: "park", route: "park", type: "quiz", theme: "mystery", l: [54.119361, -3.218797], i: "🦜" },
  { id: "park_mudman", n: "Mudman Statue", set: "park", zone: "park", route: "park", type: "logic", theme: "mystery", l: [54.118436, -3.218646], i: "🗿" },
  { id: "park_lake", n: "Boating Lake", set: "park", zone: "park", route: "park", type: "history", theme: "nature", l: [54.117399, -3.215484], i: "🦆" },
  { id: "park_bridge", n: "Lake Bridge", set: "park", zone: "park", route: "park", type: "logic", theme: "nature", l: [54.116938, -3.214752], i: "🌉" },
  { id: "park_boat_hut", n: "Boat Hut", set: "park", zone: "park", route: "park", type: "history", theme: "nature", l: [54.117955, -3.214877], i: "🛶" },
  { id: "park_flower_gardens", n: "Flower Gardens", set: "park", zone: "park", route: "park", type: "quiz", theme: "nature", l: [54.117887, -3.215989], i: "🌺" },
  { id: "park_open_field", n: "Central Open Field", set: "park", zone: "park", route: "park", type: "family", theme: "festival", l: [54.116753, -3.217746], i: "🌳" },
  { id: "park_cafe", n: "Park Café", set: "park", zone: "park", route: "park", type: "family", theme: "festival", l: [54.117360, -3.217020], i: "☕" },
  { id: "park_mini_railway", n: "Mini Railway Station", set: "park", zone: "park", route: "park", type: "history", theme: "history", l: [54.117318, -3.213263], i: "🚂" },
  { id: "park_leisure_centre", n: "Park Leisure Centre", set: "park", zone: "park", route: "park", type: "quiz", theme: "challenge", l: [54.116157, -3.212451], i: "🏊" },
  { id: "park_skate_park", n: "Skate Park", set: "park", zone: "park", route: "park", type: "activity", theme: "challenge", l: [54.117822, -3.213870], i: "🛹" },
  { id: "park_gym_park", n: "Outdoor Gym", set: "park", zone: "park", route: "park", type: "activity", theme: "challenge", l: [54.118055, -3.214172], i: "💪" },
  { id: "park_bowls", n: "Bowling Green", set: "park", zone: "park", route: "park", type: "history", theme: "festival", l: [54.117278, -3.216732], i: "🎳" },
  { id: "park_golf", n: "Golf Area", set: "park", zone: "park", route: "park", type: "activity", theme: "festival", l: [54.117494, -3.217177], i: "⛳" },
  { id: "park_cenotaph", n: "Cenotaph", set: "park", zone: "park", route: "park", type: "history", theme: "history", l: [54.117798, -3.220584], i: "🕊️" },

  { id: "park_hidden_old_tree", n: "Old Tree", set: "park", zone: "park", route: "park", type: "discovery", theme: "mystery", hidden: true, l: [54.118995, -3.218479], i: "🌲" },
  { id: "park_hidden_quiet_bench", n: "Quiet Bench", set: "park", zone: "park", route: "park", type: "discovery", theme: "mystery", hidden: true, l: [54.119403, -3.221360], i: "🪑" },
  { id: "park_hidden_secret_garden", n: "Secret Garden Spot", set: "park", zone: "park", route: "park", type: "discovery", theme: "mystery", hidden: true, l: [54.118215, -3.217110], i: "🌼" },
  { id: "park_hidden_lake_spot", n: "Hidden Lake Spot", set: "park", zone: "park", route: "park", type: "discovery", theme: "nature", hidden: true, l: [54.115944, -3.214410], i: "💧" },

  { id: "park_boss_bandstand", n: "Festival Boss", set: "park", zone: "park", route: "park", type: "boss", theme: "festival", hidden: true, l: [54.117520, -3.218402], i: "🎺" },
  { id: "park_boss_cenotaph", n: "History Boss", set: "park", zone: "park", route: "park", type: "boss", theme: "history", hidden: true, l: [54.117798, -3.220584], i: "🏅" },
  { id: "park_boss_skate", n: "Challenge Boss", set: "park", zone: "park", route: "park", type: "boss", theme: "challenge", hidden: true, l: [54.117822, -3.213870], i: "⚡" },
  { id: "park_boss_mudman", n: "Mudman Mystery Boss", set: "park", zone: "park", route: "park", type: "boss", theme: "mystery", hidden: true, l: [54.118436, -3.218646], i: "👑" },
];

const PINS = [...CORE_PINS, ...ABBEY_PINS, ...PARK_PINS];

/* =========================================================
   QA POOLS
========================================================= */

const QUIZ_POOL = {
  kid: [
    { q: "What colour stone is Furness Abbey famous for?", options: ["Blue", "Red sandstone", "Green", "Silver"], answer: 1, fact: "Furness Abbey is famous for its red sandstone." },
    { q: "What is Barrow known for building?", options: ["Submarines", "Castles", "Air balloons", "Canals"], answer: 0, fact: "Barrow is famous for shipbuilding and submarines." },
    { q: "What might you hear near a bandstand?", options: ["Music", "Lions", "Thunder only", "Nothing ever"], answer: 0, fact: "Bandstands were built for music and events." },
  ],
  teen: [
    { q: "Which industry helped Barrow grow rapidly?", options: ["Iron and shipbuilding", "Banana farming", "Space rockets", "Silk weaving"], answer: 0, fact: "Iron and shipbuilding were central to Barrow’s growth." },
    { q: "Why were parks like Barrow Park important?", options: ["Leisure and civic life", "Secret tank storage", "Airport training", "Dragon racing"], answer: 0, fact: "Victorian parks were designed for recreation and public life." },
  ],
  adult: [
    { q: "What transformed Barrow into an industrial town?", options: ["Iron, docks and shipbuilding", "Gold mining", "A palace", "A duck uprising"], answer: 0, fact: "Barrow grew through industry and shipbuilding." },
    { q: "What ended the power of Furness Abbey?", options: ["The Dissolution of the Monasteries", "A flood", "A castle war", "A famine alone"], answer: 0, fact: "The Dissolution under Henry VIII ended the abbey’s power." },
  ],
};

const HISTORY_POOL = {
  kid: [
    { q: "Who lived at Furness Abbey long ago?", options: ["Monks", "Pirates", "Astronauts", "Wizards only"], answer: 0, fact: "Cistercian monks lived at Furness Abbey." },
    { q: "What does the Cenotaph help us do?", options: ["Remember people", "Feed ducks", "Play music", "Buy snacks"], answer: 0, fact: "The Cenotaph is for remembrance." },
  ],
  teen: [
    { q: "Why was Furness Abbey built in a quiet valley?", options: ["For prayer and seclusion", "For football", "For train testing", "For treasure races"], answer: 0, fact: "Cistercians preferred quiet, remote places." },
  ],
  adult: [
    { q: "What does the scale of Furness Abbey suggest?", options: ["It was wealthy and influential", "It was tiny and poor", "It was unfinished", "It was modern"], answer: 0, fact: "The size of the ruins reflects major wealth and influence." },
  ],
};

const RIDDLE_POOL = [
  { q: "What has keys but can’t open locks?", a: "A piano" },
  { q: "What gets wetter the more it dries?", a: "A towel" },
  { q: "What disappears when you say its name?", a: "Silence" },
  { q: "What has hands but can’t clap?", a: "A clock" },
  { q: "What belongs to you but others use it more?", a: "Your name" },
];

const SPEED_POOL = {
  kid: ["Point to something red as fast as you can."],
  teen: ["Take 10 silent stealth steps."],
  adult: ["Name 3 details here in 20 seconds."],
};

const BATTLE_POOL = {
  kid: ["Rock-paper-scissors duel. Winner claims the node."],
  teen: ["Fast slogan battle: best 3-word slogan wins."],
  adult: ["Observation duel: first to spot 3 details wins."],
};

const FAMILY_POOL = {
  kid: ["Do a team explorer pose together."],
  teen: ["Invent a 3-word team motto."],
  adult: ["Each player says one word that matches this place."],
};

const ACTIVITY_POOL = {
  kid: ["Pretend to be a medieval guard for 5 seconds."],
  teen: ["Do a dramatic adventure walk."],
  adult: ["Pause and notice 3 things people usually miss."],
};

function getTier() {
  const enabledCount = getEnabledPlayers().length;
  if (enabledCount <= 1) return "adult";
  if (enabledCount === 2) return "teen";
  return "kid";
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildLogicQuestion() {
  const r = pickOne(RIDDLE_POOL);
  const wrongs = ["A haunted toaster", "Your neighbour Dave", "A confused pigeon", "A potato in sunglasses"];
  const options = [r.a, ...wrongs.slice(0, 3)];
  return {
    q: r.q,
    options,
    answer: 0,
    fact: r.a,
  };
}

function getQA({ pinId, zone, mode, tier }) {
  if (mode === "quiz") {
    const q = pickOne(QUIZ_POOL[tier] || QUIZ_POOL.kid);
    return q;
  }

  if (mode === "history") {
    const q = pickOne(HISTORY_POOL[tier] || HISTORY_POOL.kid);
    return q;
  }

  if (mode === "logic") {
    return buildLogicQuestion();
  }

  if (mode === "speed") {
    const q = pickOne(SPEED_POOL[tier] || SPEED_POOL.kid);
    return { q, options: ["Done", "Skip", "Retry", "Too weird"], answer: 0, fact: "Speed challenge complete." };
  }

  if (mode === "battle") {
    const q = pickOne(BATTLE_POOL[tier] || BATTLE_POOL.kid);
    return { q, options: ["Victory!", "Retry", "Draw", "Blame teammate"], answer: 0, fact: "Battle complete." };
  }

  if (mode === "family") {
    const q = pickOne(FAMILY_POOL[tier] || FAMILY_POOL.kid);
    return { q, options: ["Done", "Skip", "Too silly", "Blame dad"], answer: 0, fact: "Family challenge complete." };
  }

  if (mode === "activity") {
    const q = pickOne(ACTIVITY_POOL[tier] || ACTIVITY_POOL.kid);
    return { q, options: ["Done", "Skip", "Unsafe", "Too weird"], answer: 0, fact: "Activity complete." };
  }

  if (mode === "ghost") {
    return {
      q: "A ghostly presence has appeared. Pause, look around, and tell the team what feels strange here.",
      options: ["Done", "Nothing there", "Too spooky", "Run away"],
      answer: 0,
      fact: "Ghost encounter logged.",
    };
  }

  if (mode === "boss") {
    return {
      q: "FINAL TRIAL! Complete this challenge to defeat the boss.",
      options: ["Victory!", "Retreat", "Cry dramatically", "Throw bread"],
      answer: 0,
      fact: "Boss defeated!",
    };
  }

  return {
    q: "Explorer challenge",
    options: ["Done", "Skip", "Retry", "Dance"],
    answer: 0,
    fact: "Mission complete.",
  };
}

/* =========================================================
   HELPERS
========================================================= */

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  renderPlayersHUD();
  updateCaptureHud();

  if ($("radius-label")) $("radius-label").innerText = String(state.settings.enterRadiusM ?? 35);
  if ($("cooldown-label")) $("cooldown-label").innerText = String(state.settings.cooldownMin ?? 10);
  if ($("capture-label")) $("capture-label").innerText = String(state.settings.captureNeed ?? 1);
  if ($("zoomui-label")) $("zoomui-label").innerText = state.settings.zoomUI ? "ON" : "OFF";
  if ($("rate-label")) $("rate-label").innerText = String(state.settings.voiceRate ?? 1);
  if ($("pitch-label")) $("pitch-label").innerText = String(state.settings.voicePitch ?? 1);
  if ($("sfx-label")) $("sfx-label").innerText = String(state.settings.sfxVol ?? 80);
}

function getEnabledPlayers() {
  return state.players.filter((p) => p.enabled);
}

function getPlayerById(id) {
  return state.players.find((p) => p.id === id) || null;
}

function ensureActivePlayer() {
  const active = getPlayerById(state.activePlayerId);
  if (active && active.enabled) return active;
  const first = getEnabledPlayers()[0] || state.players[0];
  state.activePlayerId = first.id;
  return first;
}

function awardCoins(playerId, amount) {
  const p = getPlayerById(playerId);
  if (!p) return;
  p.coins += Math.max(0, Math.round(amount || 0));
  save();
}

function onClick(id, fn) {
  const el = $(id);
  if (!el) return;
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  });
}

function toggleM(id, force) {
  const el = $(id);
  if (!el) return;
  if (typeof force === "boolean") {
    el.style.display = force ? "block" : "none";
  } else {
    el.style.display = el.style.display === "block" ? "none" : "block";
  }
}

function getCharacterHtml() {
  return CHARACTERS[state.settings.character || "hero_duo"]?.html || CHARACTERS.hero_duo.html;
}

function getPinById(id) {
  return PINS.find((p) => p.id === id) || null;
}

function nodeState(id) {
  if (!state.nodes[id]) {
    state.nodes[id] = {
      completed: false,
      lastCompletedAt: null,
    };
  }
  return state.nodes[id];
}

function totalCompletedVisible() {
  return getVisiblePins().filter((p) => nodeState(p.id).completed).length;
}

function totalCompletedInRoute(routeId) {
  return Object.keys(state.nodes)
    .map((id) => getPinById(id))
    .filter((pin) => pin && pin.route === routeId && state.nodes[id]?.completed)
    .length;
}

function speak(text) {
  try {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = "en-GB";
    u.rate = parseFloat(state.settings.voiceRate || 1);
    u.pitch = parseFloat(state.settings.voicePitch || 1);
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(u);
      } catch (_) {}
    }, 60);
  } catch (_) {}
}

function getSfxVolume() {
  const pct = parseInt(state.settings.sfxVol ?? 80, 10);
  return Math.max(0, Math.min(1, pct / 100));
}

function beep(freq = 660, duration = 0.12, type = "sine", gain = 0.05) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain * getSfxVolume();
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {}
}

function playSuccessSfx() {
  beep(660, 0.08, "triangle", 0.05);
  setTimeout(() => beep(880, 0.1, "triangle", 0.055), 70);
}

function playFailSfx() {
  beep(220, 0.1, "sawtooth", 0.04);
}

function playBossSfx() {
  beep(520, 0.09, "square", 0.05);
  setTimeout(() => beep(780, 0.12, "square", 0.055), 80);
  setTimeout(() => beep(1040, 0.14, "square", 0.06), 170);
}

function ensureRewardLayer() {
  let fx = $("reward-fx-layer");
  if (fx) return fx;

  fx = document.createElement("div");
  fx.id = "reward-fx-layer";
  fx.style.position = "fixed";
  fx.style.inset = "0";
  fx.style.pointerEvents = "none";
  fx.style.zIndex = "20000";
  document.body.appendChild(fx);
  return fx;
}

function burstEmoji(count = 10, emoji = "✨") {
  const layer = ensureRewardLayer();
  const rect = document.body.getBoundingClientRect();

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.textContent = emoji;
    el.style.position = "fixed";
    el.style.left = `${rect.width * (0.2 + Math.random() * 0.6)}px`;
    el.style.top = `${rect.height * (0.35 + Math.random() * 0.15)}px`;
    el.style.fontSize = `${18 + Math.random() * 18}px`;
    el.style.opacity = "1";
    el.style.transition = "transform 900ms ease-out, opacity 900ms ease-out";
    layer.appendChild(el);

    requestAnimationFrame(() => {
      const dx = -80 + Math.random() * 160;
      const dy = -100 - Math.random() * 120;
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${-80 + Math.random() * 160}deg)`;
      el.style.opacity = "0";
    });

    setTimeout(() => el.remove(), 950);
  }
}

function showRewardPopup(title, subtitle = "", tone = "success") {
  const layer = ensureRewardLayer();
  const card = document.createElement("div");
  card.style.position = "fixed";
  card.style.left = "50%";
  card.style.top = "18%";
  card.style.transform = "translate(-50%, -10px) scale(0.96)";
  card.style.minWidth = "220px";
  card.style.maxWidth = "86vw";
  card.style.background = tone === "fail" ? "rgba(80,0,0,0.92)" : "rgba(0,0,0,0.9)";
  card.style.border = tone === "fail" ? "2px solid #ff6666" : "2px solid #ffd700";
  card.style.color = "#fff";
  card.style.borderRadius = "18px";
  card.style.padding = "16px 18px";
  card.style.textAlign = "center";
  card.style.opacity = "0";
  card.style.transition = "all 320ms ease";
  card.innerHTML = `
    <div style="font-size:22px;font-weight:bold;margin-bottom:6px;">${title}</div>
    <div style="font-size:14px;opacity:.92;">${subtitle}</div>
  `;
  layer.appendChild(card);

  requestAnimationFrame(() => {
    card.style.opacity = "1";
    card.style.transform = "translate(-50%, 0) scale(1)";
  });

  setTimeout(() => {
    card.style.opacity = "0";
    card.style.transform = "translate(-50%, -12px) scale(0.97)";
  }, 2600);

  setTimeout(() => card.remove(), 3100);
}

/* =========================================================
   MAP / GPS
========================================================= */

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function initMap() {
  gpsHasCenteredOnce = false;
  lastGoodGps = null;

  map = L.map("map", { zoomControl: false }).setView([54.114, -3.218], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  if (state.settings.zoomUI) {
    L.control.zoom({ position: "topright" }).addTo(map);
  }

  hero = L.marker([54.114, -3.218], {
    icon: L.divIcon({
      className: "marker-logo",
      html: getCharacterHtml(),
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    }),
  }).addTo(map);

  initPins();
  startGPSWatcher();
}

function refreshHeroIcon() {
  if (!hero) return;
  hero.setIcon(
    L.divIcon({
      className: "marker-logo",
      html: getCharacterHtml(),
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    })
  );
}

function startGPSWatcher() {
  if (!navigator.geolocation) {
    console.warn("Geolocation not supported");
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy || 9999;

      lastGoodGps = { lat, lng, acc };

      if (hero) {
        hero.setLatLng([lat, lng]);
      }

      if (!gpsHasCenteredOnce && acc < 100) {
        gpsHasCenteredOnce = true;
        map.setView([lat, lng], 17, { animate: true });
      }

      const radius =
        parseInt(state.settings.enterRadiusM ?? ENTER_RADIUS_M_DEFAULT, 10) ||
        ENTER_RADIUS_M_DEFAULT;

      const near = getVisiblePins().find((p) => {
        return (
          haversineMeters(
            { lat, lng },
            { lat: p.l[0], lng: p.l[1] }
          ) < radius
        );
      });

      if (near) {
        cur = near;
        if ($("action-trigger")) $("action-trigger").style.display = "block";
      } else {
        cur = null;
        if ($("action-trigger")) $("action-trigger").style.display = "none";
      }

      updateCaptureHud();
    },
    (err) => {
      console.warn("GPS unavailable", err);
      updateCaptureHud();
    },
    {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 15000,
    }
  );
}

/* =========================================================
   PIN FILTERING / VISIBILITY
========================================================= */

function pinMatchesActiveSet(pin) {
  if (state.activeSet === "all") return true;
  if (state.activeSet === "core") return pin.set === "core";
  return pin.set === state.activeSet;
}

function getActiveRouteOrder() {
  const cfg = ROUTES[state.activeRoute];
  if (!cfg || !state.activeRouteStart || cfg.mode !== "guided") return [];
  return cfg.starts?.[state.activeRouteStart]?.orderedPins || [];
}

function isPinVisible(pin) {
  if (!pin) return false;
  if (!pinMatchesActiveSet(pin)) return false;

  if (pin.hidden === true) {
    if (pin.type === "ghost") return state.ghostStageUnlocked;
    if (pin.type === "boss") return state.unlockedBossPins.includes(pin.id);
    return state.unlockedHiddenPins.includes(pin.id);
  }

  if (state.activeSet === "abbey" && state.activeRouteStart) {
    const ordered = getActiveRouteOrder();
    if (ordered.length) return ordered.includes(pin.id);
  }

  return true;
}

function getVisiblePins() {
  return PINS.filter(isPinVisible).filter((p) => Array.isArray(p.l) && p.l.length === 2);
}

function initPins() {
  if (!map) return;

  Object.values(activeMarkers).forEach((m) => map.removeLayer(m));
  activeMarkers = {};

  getVisiblePins().forEach((p) => {
    const html =
      typeof p.i === "string" && p.i.trim().startsWith("<")
        ? p.i
        : `<div style="font-size:28px;line-height:1;">${p.i || "📍"}</div>`;

    const m = L.marker(p.l, {
      icon: L.divIcon({
        className: "marker-logo",
        html,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      }),
    }).addTo(map);

    m.on("click", () => {
      cur = p;
      if ($("action-trigger")) $("action-trigger").style.display = "block";
      updateCaptureHud();
      openQuest();
    });

    activeMarkers[p.id] = m;
  });

  updateCaptureHud();
}

/* =========================================================
   HUD / PLAYER UI
========================================================= */

function renderPlayersHUD() {
  const enabled = getEnabledPlayers();

  const slot1 = enabled[0] || { name: "Player 1", coins: 0 };
  const slot2 = enabled[1] || { name: "Player 2", coins: 0 };
  const slot3 = enabled[2] || { name: "Player 3", coins: 0 };

  if ($("h-k")) $("h-k").innerText = `${slot1.name}: ${slot1.coins} 🪙`;
  if ($("h-p")) $("h-p").innerText = `${slot2.name}: ${slot2.coins} 🪙`;
  if ($("h-me")) $("h-me").innerText = `${slot3.name}: ${slot3.coins} 🪙`;
}

function updateCaptureHud() {
  const hud = $("capture-hud");
  if (!hud) return;

  if (!cur) {
    if (lastGoodGps) {
      hud.innerText = `GPS LIVE • ${Math.round(lastGoodGps.acc || 0)}m`;
      return;
    }
    hud.innerText = "WAITING FOR GPS...";
    return;
  }

  const themeLabel = cur.theme ? ` • ${cur.theme.toUpperCase()}` : "";
  hud.innerText = `${cur.n} • ${cur.type.toUpperCase()}${themeLabel}`;
}

function renderSettingsPlayerManager() {
  const list = $("settings-player-manager");
  if (!list) return;

  list.innerHTML = state.players
    .map(
      (p) => `
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin:8px 0;align-items:center;">
          <input data-player-name="${p.id}" value="${p.name}" style="padding:10px;border-radius:10px;border:1px solid #333;background:#111;color:#fff;" />
          <button data-player-active="${p.id}" class="win-btn" style="padding:10px 12px;background:${p.enabled ? '#1f8f4d' : '#444'};color:#fff;width:auto;">
            ${p.enabled ? "ON" : "OFF"}
          </button>
        </div>
      `
    )
    .join("");

  list.querySelectorAll("[data-player-name]").forEach((el) => {
    el.addEventListener("input", () => {
      const id = el.getAttribute("data-player-name");
      const p = getPlayerById(id);
      if (!p) return;
      p.name = el.value || p.name;
      save();
      renderRewardButtons();
    });
  });

  list.querySelectorAll("[data-player-active]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-player-active");
      const p = getPlayerById(id);
      if (!p) return;
      p.enabled = !p.enabled;
      if (getEnabledPlayers().length === 0) p.enabled = true;
      ensureActivePlayer();
      save();
      renderSettingsPlayerManager();
      renderRewardButtons();
    });
  });
}

function setPlayerCount(count) {
  state.players.forEach((p, idx) => {
    p.enabled = idx < count;
  });
  ensureActivePlayer();
  save();
  renderSettingsPlayerManager();
  renderRewardButtons();
}

function renderRewardButtons() {
  const panel = $("reward-panel");
  if (!panel) return;

  const enabled = getEnabledPlayers();

  panel.innerHTML = `
    <div style="font-weight:bold;margin-bottom:8px;">AWARD POINTS TO:</div>
    <div id="reward-buttons-list" style="display:grid;gap:10px;"></div>
  `;

  const list = $("reward-buttons-list");
  if (!list) return;

  enabled.forEach((p, idx) => {
    const btn = document.createElement("button");
    btn.className = "win-btn";
    btn.style.color = idx === 1 ? "#000" : "#fff";
    btn.style.background =
      idx === 0 ? "var(--kylan)" :
      idx === 1 ? "var(--piper)" :
      idx === 2 ? "var(--parent)" : "var(--gold)";
    btn.textContent = p.name.toUpperCase();
    btn.addEventListener("click", () => finalizeReward(p.id));
    list.appendChild(btn);
  });
}

/* =========================================================
   QUEST / TASK FLOW
========================================================= */

function showRewardPanel(show = true) {
  const panel = $("reward-panel");
  if (panel) panel.style.display = show ? "block" : "none";
}

function renderOptions(task) {
  const wrap = $("task-options");
  if (!wrap) return;

  wrap.innerHTML = (task.options || [])
    .map(
      (opt, idx) =>
        `<button class="mcq-btn" data-idx="${idx}">${String.fromCharCode(65 + idx)}) ${opt}</button>`
    )
    .join("");

  wrap.querySelectorAll(".mcq-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectOption(parseInt(btn.dataset.idx, 10));
    });
  });
}

function startRouteFromPin(pin) {
  if (!pin?.route || !pin?.routeStart) return;

  state.activeRoute = pin.route;
  state.activeRouteStart = pin.routeStart;

  if (pin.route === "park") {
    const cfg = ROUTES.park?.starts?.[pin.routeStart];
    state.activeSet = "park";
    state.activeTheme = cfg?.suggestedTheme || null;
    showRewardPopup(
      "PARK ADVENTURE",
      state.activeTheme ? `Suggested theme: ${state.activeTheme}` : pin.n
    );
  } else if (pin.route === "abbey") {
    state.activeSet = "abbey";
    state.activeTheme = null;
    showRewardPopup("ABBEY QUEST", pin.n);
  }

  save();
  initPins();
}

function openQuest() {
  if (!cur) return;

  if (cur.type === "start" && cur.routeStart) {
    startRouteFromPin(cur);
  }

  if ($("q-name")) $("q-name").innerText = cur.n;

  if ($("quest-status")) {
    const themeText = cur.theme ? ` • ${cur.theme.toUpperCase()}` : "";
    $("quest-status").innerText = `STATUS: ${cur.type.toUpperCase()}${themeText}`;
  }

  if ($("mode-banner")) {
    $("mode-banner").style.display = "block";
    let banner = `${cur.zone.toUpperCase()} ROUTE\n${cur.n}`;
    if (cur.zone === "park" && cur.theme) {
      banner = `PARK • ${cur.theme.toUpperCase()}\n${cur.n}`;
    }
    if (state.activeSet === "core") {
      banner = `FULL BARROW MAP\n${cur.n}`;
    }
    $("mode-banner").innerText = banner;
  }

  if ($("boss-banner")) {
    $("boss-banner").style.display = cur.type === "boss" ? "block" : "none";
    $("boss-banner").innerText = cur.type === "boss" ? "FINAL TRIAL ACTIVE" : "";
  }

  toggleM("quest-modal", true);
  updateCaptureHud();
}

function closeQuest() {
  toggleM("quest-modal", false);
}

function launchMode(mode) {
  if (!cur) return;

  const task = getQA({
    pinId: cur.id,
    zone: cur.zone || "core",
    mode,
    tier: getTier(),
  });

  activeTask = {
    pinId: cur.id,
    mode,
    task,
    passed: false,
    pendingReward: 0,
  };

  if ($("task-title")) $("task-title").innerText = `${mode.toUpperCase()} @ ${cur.n}`;
  if ($("task-desc")) $("task-desc").innerText = task.q || "Task";

  if ($("task-feedback")) {
    $("task-feedback").style.display = "none";
    $("task-feedback").innerText = "";
  }

  showRewardPanel(false);
  renderOptions(task);

  toggleM("quest-modal", false);
  toggleM("task-modal", true);
  speak(task.q);
}

function selectOption(idx) {
  if (!activeTask?.task) return;

  const task = activeTask.task;
  const correct = idx === task.answer;

  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").innerText = correct
      ? `Correct! ${task.fact || ""}`
      : "Not quite. Try again.";
  }

  if (correct) {
    activeTask.passed = true;
    activeTask.pendingReward = PASS_BONUS_COINS;
    showRewardPanel(true);
    playSuccessSfx();
    burstEmoji(10, "✨");
    showRewardPopup("CORRECT!", task.fact || "Nice work.");
  } else {
    playFailSfx();
    showRewardPopup("NOT QUITE", "Try again.", "fail");
  }
}

/* =========================================================
   PROGRESSION / UNLOCKS
========================================================= */

function unlockHiddenPin(pinId) {
  if (!state.unlockedHiddenPins.includes(pinId)) {
    state.unlockedHiddenPins.push(pinId);
  }
}

function unlockBossPin(pinId) {
  if (!state.unlockedBossPins.includes(pinId)) {
    state.unlockedBossPins.push(pinId);
  }
}

function completeAbbeyBossUnlocks() {
  state.ghostStageUnlocked = true;
  unlockHiddenPin("abbey_headless_monk");
  save();
  initPins();
  showRewardPopup("GHOST STAGE UNLOCKED", "The Headless Monk can now appear.");
}

function completeParkProgress(pin) {
  if (!pin || pin.route !== "park") return;

  const theme = pin.theme || null;
  if (theme && state.parkThemeProgress[theme] !== undefined) {
    state.parkThemeProgress[theme] += 1;
  }

  const hiddenRules = ROUTES.park?.hiddenRules || {};
  Object.entries(hiddenRules).forEach(([pinId, rule]) => {
    if (state.unlockedHiddenPins.includes(pinId)) return;

    if (rule.totalCompleted) {
      if (totalCompletedInRoute("park") >= rule.totalCompleted) {
        unlockHiddenPin(pinId);
      }
      return;
    }

    if (rule.theme && (state.parkThemeProgress[rule.theme] || 0) >= (rule.needed || 0)) {
      unlockHiddenPin(pinId);
    }
  });

  const bossRules = ROUTES.park?.bossRules || {};
  Object.entries(bossRules).forEach(([pinId, rule]) => {
    if (state.unlockedBossPins.includes(pinId)) return;
    const score = state.parkThemeProgress[rule.theme] || 0;
    const enough = score >= (rule.needed || 0);
    const hiddenOk = !rule.needsHidden || state.unlockedHiddenPins.includes(rule.needsHidden);

    if (enough && hiddenOk) {
      unlockBossPin(pinId);
      showRewardPopup("BOSS UNLOCKED", getPinById(pinId)?.n || pinId);
    }
  });

  save();
  initPins();
}

function finalizeReward(playerId) {
  if (!cur || !activeTask?.passed) return;

  const amount = activeTask.pendingReward || PASS_BONUS_COINS;
  awardCoins(playerId, amount);

  const ns = nodeState(cur.id);
  ns.completed = true;
  ns.lastCompletedAt = Date.now();

  if (cur.route === "park") {
    completeParkProgress(cur);
  }

  if (cur.id === "abbey_boss") {
    getEnabledPlayers().forEach((p) => awardCoins(p.id, BOSS_BONUS_COINS));
    playBossSfx();
    completeAbbeyBossUnlocks();
    showRewardPopup("ABBEY CONQUERED", "Ghost stage and rare encounters unlocked.");
  }

  if (cur.route === "park" && cur.type === "boss") {
    getEnabledPlayers().forEach((p) => awardCoins(p.id, Math.round(BOSS_BONUS_COINS / 2)));
    playBossSfx();
    showRewardPopup("PARK BOSS DEFEATED", cur.n);
  }

  save();
  burstEmoji(12, "🪙");
  showRewardPanel(false);
  toggleM("task-modal", false);
  activeTask = null;
  initPins();
}

function showNodeStats() {
  const visible = getVisiblePins().length;
  const done = totalCompletedVisible();
  const left = visible - done;
  showRewardPopup("NODE STATS", `Visible: ${visible} • Done: ${done} • Left: ${left}`);
}

/* =========================================================
   HOME / SETTINGS / MODES
========================================================= */

function renderHomeLog() {
  const sum = $("home-summary");
  const list = $("home-list");
  if (!sum || !list) return;

  const rows = getVisiblePins().map((p) => ({
    name: p.n,
    status: nodeState(p.id).completed ? "Completed" : "Available",
    theme: p.theme || "",
    zone: p.zone || p.set || "core",
  }));

  sum.innerHTML = `Visible pins: <b>${rows.length}</b> | Done: <b>${rows.filter(r => r.status === "Completed").length}</b> | Set: <b>${state.activeSet}</b> | Route: <b>${state.activeRouteStart || "-"}</b> | Theme: <b>${state.activeTheme || "-"}</b>`;

  list.innerHTML = rows
    .map(
      (r) => `
        <div style="padding:10px;border:1px solid #333;border-radius:12px;margin:8px 0;background:#111;">
          <div style="font-weight:bold;">${r.name}</div>
          <div style="opacity:.85;font-size:12px;">${r.status} • ${r.zone}${r.theme ? ` • ${r.theme}` : ""}</div>
        </div>
      `
    )
    .join("");
}

function setMapMode(mode) {
  if (!["core", "abbey", "park"].includes(mode)) return;

  state.activeSet = mode;
  state.activeRoute = mode;
  state.activeRouteStart = null;
  state.activeTheme = null;

  save();

  if (map) {
    map.remove();
    map = null;
    activeMarkers = {};
    cur = null;
  }

  initMap();
}

/* =========================================================
   WIRING
========================================================= */

function wireHUD() {
  onClick("btn-home", () => {
    renderHomeLog();
    toggleM("home-modal", true);
  });

  onClick("btn-home-close", () => toggleM("home-modal", false));
  onClick("btn-home-close-x", () => toggleM("home-modal", false));

  onClick("btn-settings", () => {
    renderSettingsPlayerManager();
    toggleM("settings-modal", true);
  });
  onClick("btn-close-settings", () => toggleM("settings-modal", false));
  onClick("btn-close-settings-x", () => toggleM("settings-modal", false));
  onClick("btn-open-settings", () => {
    renderSettingsPlayerManager();
    toggleM("settings-modal", true);
  });

  onClick("btn-commander", () => toggleM("commander-hub", true));
  onClick("btn-close-commander", () => toggleM("commander-hub", false));
  onClick("btn-close-commander-x", () => toggleM("commander-hub", false));
  onClick("btn-open-commander-from-home", () => toggleM("commander-hub", true));
  onClick("btn-open-settings-from-commander", () => {
    renderSettingsPlayerManager();
    toggleM("settings-modal", true);
  });

  onClick("btn-start", () => toggleM("start-modal", false));
  onClick("btn-start-close", () => toggleM("start-modal", false));
  onClick("btn-start-close-x", () => toggleM("start-modal", false));

  onClick("btn-close-quest", closeQuest);
  onClick("btn-task-close", () => {
    toggleM("task-modal", false);
    activeTask = null;
  });

  onClick("action-trigger", openQuest);

  onClick("btn-hp-k", () => {
    const p = getEnabledPlayers()[0];
    if (p) state.activePlayerId = p.id;
    save();
  });

  onClick("btn-hp-p", () => {
    const p = getEnabledPlayers()[1] || getEnabledPlayers()[0];
    if (p) state.activePlayerId = p.id;
    save();
  });

  onClick("btn-swap", () => {
    const enabled = getEnabledPlayers();
    if (enabled.length >= 2) {
      const a = enabled[0].name;
      enabled[0].name = enabled[1].name;
      enabled[1].name = a;
      save();
      renderSettingsPlayerManager();
      renderRewardButtons();
    }
  });

  onClick("btn-night", () => {
    $("map")?.classList.toggle("night-vision");
  });

  onClick("btn-respawn-nodes", () => {
    state.nodes = {};
    state.unlockedHiddenPins = [];
    state.unlockedBossPins = [];
    state.ghostStageUnlocked = false;
    state.activeRouteStart = null;
    state.activeTheme = null;
    state.parkThemeProgress = {
      festival: 0,
      history: 0,
      mystery: 0,
      challenge: 0,
      nature: 0,
    };
    save();
    initPins();
    showRewardPopup("RESET", "Progress cleared");
  });

  onClick("btn-show-node-stats", () => {
    showNodeStats();
  });

  onClick("btn-test", () => {
    refreshHeroIcon();
    initPins();
    showRewardPopup("SYSTEMS OK", "Buttons and markers refreshed.");
  });

  onClick("btn-zoom-ui", () => {
    state.settings.zoomUI = !state.settings.zoomUI;
    save();
    location.reload();
  });

  onClick("btn-player-1", () => setPlayerCount(1));
  onClick("btn-player-2", () => setPlayerCount(2));
  onClick("btn-player-3", () => setPlayerCount(3));
  onClick("btn-player-4", () => setPlayerCount(4));

  const charSel = $("char-select");
  if (charSel) {
    charSel.value = state.settings.character || "hero_duo";
    charSel.addEventListener("change", () => {
      state.settings.character = charSel.value || "hero_duo";
      refreshHeroIcon();
      save();
    });
  }

  const radius = $("enter-radius");
  if (radius) {
    radius.value = String(state.settings.enterRadiusM ?? ENTER_RADIUS_M_DEFAULT);
    radius.addEventListener("input", () => {
      state.settings.enterRadiusM = parseInt(radius.value, 10) || ENTER_RADIUS_M_DEFAULT;
      save();
    });
  }

  const cooldown = $("cooldown-min");
  if (cooldown) {
    cooldown.value = String(state.settings.cooldownMin ?? 10);
    cooldown.addEventListener("input", () => {
      state.settings.cooldownMin = parseInt(cooldown.value, 10) || 10;
      save();
    });
  }

  const captureNeed = $("capture-need");
  if (captureNeed) {
    captureNeed.value = String(state.settings.captureNeed ?? 1);
    captureNeed.addEventListener("input", () => {
      state.settings.captureNeed = parseInt(captureNeed.value, 10) || 1;
      save();
    });
  }

  const rate = $("v-rate");
  if (rate) {
    rate.value = String(state.settings.voiceRate ?? 1);
    rate.addEventListener("input", () => {
      state.settings.voiceRate = parseFloat(rate.value) || 1;
      save();
    });
  }

  const pitch = $("v-pitch");
  if (pitch) {
    pitch.value = String(state.settings.voicePitch ?? 1);
    pitch.addEventListener("input", () => {
      state.settings.voicePitch = parseFloat(pitch.value) || 1;
      save();
    });
  }

  const sfx = $("sfx-vol");
  if (sfx) {
    sfx.value = String(state.settings.sfxVol ?? 80);
    sfx.addEventListener("input", () => {
      state.settings.sfxVol = parseInt(sfx.value, 10) || 80;
      save();
    });
  }

  const pillAbbey = $("pill-abbey");
  const pillPark = $("pill-park");
  const pillFull = $("pill-full");

  if (pillAbbey) pillAbbey.addEventListener("click", () => setMapMode("abbey"));
  if (pillPark) pillPark.addEventListener("click", () => setMapMode("park"));
  if (pillFull) pillFull.addEventListener("click", () => setMapMode("core"));
}

function wireModes() {
  document.querySelectorAll(".m-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const mode = tile.getAttribute("data-mode");
      launchMode(mode);
    });
  });
}

/* =========================================================
   BOOT
========================================================= */

function boot() {
  try {
    ensureActivePlayer();
    renderSettingsPlayerManager();
    renderRewardButtons();
    initMap();
    wireHUD();
    wireModes();
    renderPlayersHUD();
    save();
    ensureRewardLayer();
    console.log("Barrow Quest single-file engine booted");
  } catch (err) {
    console.error("Boot error:", err);
    if ($("capture-hud")) $("capture-hud").innerText = "BOOT ERROR";
  }
}

window.addEventListener("DOMContentLoaded", boot);
