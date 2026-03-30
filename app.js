import {
  getQA,
  getPinStartIntro,
  getDefaultAdaptiveProfile,
  normaliseAdaptiveProfile,
  updateAdaptiveProfile,
} from "./qa.js";
import { PINS } from "./pins.js";
import { ADULT_PINS } from "./adult_pins.js";
import { ADULT_CONTENT } from "./adult_content.js";
import { applyReward } from "./progression.js";
import { getRandomMystery } from "./mysteries.js";

const $ = (id) => document.getElementById(id);

/* ============================
   STORAGE SYSTEM
============================ */
const SAVE_VERSION = 3;
const SAVE_KEY = "bq_world_v20_phase3s";
const BACKUP_KEY = "bq_world_v20_phase3s_backup";
const EXPORT_FILENAME = "barrow-quest-save.json";

let autosaveTimer = null;
let lastSaveHash = "";

function stableStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function queueSaveState(delay = 160) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveStateNow();
  }, delay);
}

function computeStorageHealth() {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    app: "Barrow Quest",
    saveKey: SAVE_KEY,
  };
}

function createBackupSnapshot(payload) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Backup snapshot failed:", err);
  }
}

function buildSavePayloadFromState(sourceState) {
  return {
    ...sourceState,
    storage: {
      ...computeStorageHealth(),
      ...(sourceState.storage || {}),
      version: SAVE_VERSION,
    },
    saveVersion: SAVE_VERSION,
  };
}

function buildSavePayload() {
  return {
    ...state,
    storage: {
      ...computeStorageHealth(),
      ...(state.storage || {}),
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
    },
    saveVersion: SAVE_VERSION,
  };
}

function saveStateNow(force = false) {
  try {
    const payload = buildSavePayload();
    const raw = stableStringify(payload);
    if (!raw) return false;

    if (!force && raw === lastSaveHash) return true;

    localStorage.setItem(SAVE_KEY, raw);
    createBackupSnapshot(payload);
    lastSaveHash = raw;
    return true;
  } catch (err) {
    console.error("SAVE ERROR:", err);
    return false;
  }
}

function exportSaveFile() {
  try {
    const payload = buildSavePayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = EXPORT_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("EXPORT SAVE FAILED:", err);
    return false;
  }
}

async function importSaveFileFromInput(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const migrated = migrateSave(parsed);
    state = normaliseLoadedState(migrated);
    saveStateNow(true);
    renderEverything();
    return true;
  } catch (err) {
    console.error("IMPORT SAVE FAILED:", err);
    return false;
  }
}

function resetAllProgress() {
  try {
    localStorage.removeItem(SAVE_KEY);
    state = structuredClone(DEFAULT_STATE);
    saveStateNow(true);
    renderEverything();
    resetMap();
    return true;
  } catch (err) {
    console.error("RESET FAILED:", err);
    return false;
  }
}

window.BQStorage = {
  exportSaveFile,
  importSaveFileFromInput,
  resetAllProgress,
  saveNow: () => saveStateNow(true),
  getState: () => structuredClone(state),
};

function migrateSave(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const version = Number(source?.storage?.version || source?.saveVersion || 0);

  if (version >= SAVE_VERSION) return source;

  const migrated = {
    ...source,
  };

  if (!migrated.storage || typeof migrated.storage !== "object") {
    migrated.storage = {};
  }

  if (!migrated.captainNotes) migrated.captainNotes = [];
  if (!migrated.route) migrated.route = null;
  if (!migrated.rebuild) {
    migrated.rebuild = {
      abbey: {
        points: 0,
        stage: 0,
        completedRoutes: [],
        unlockedCore: false,
        completedCore: false,
        finished: false,
      },
    };
  }

  migrated.storage.version = SAVE_VERSION;
  migrated.storage.migratedFrom = version;
  migrated.storage.migratedAt = new Date().toISOString();

  return migrated;
}

/* ============================
   CONSTANTS
============================ */
const BADGE_MILESTONES = [
  { captures: 1, name: "Scout", icon: "🧭" },
  { captures: 5, name: "Explorer", icon: "🥾" },
  { captures: 10, name: "Tracker", icon: "🗺️" },
  { captures: 20, name: "Pathfinder", icon: "🧱" },
  { captures: 50, name: "Adventurer", icon: "⚔️" },
  { captures: 100, name: "Legend", icon: "👑" },
];

const PIN_REWARD_IMAGES = {
  park_cenotaph: {
    src: "./images/rewards/cenotaph.jpg",
    caption: "The Cenotaph complete.",
  },
  park_bandstand: {
    src: "./images/rewards/bandstand.jpg",
    caption: "Bandstand complete.",
  },
  park_leisure_centre: {
    src: "./images/rewards/leisure.jpg",
    caption: "Leisure Centre complete.",
  },
  park_mini_railway: {
    src: "./images/rewards/railway.jpg",
    caption: "Mini Railway complete.",
  },
};

const ABBEY_ROUTE_APPROACH_PIN_IDS = [
  "abbey_valley_view",
  "abbey_gate",
  "abbey_church",
  "abbey_boss",
];

/* ============================
   DEFAULT STATE
============================ */
const DEFAULT_STATE = {
  storage: {
    version: SAVE_VERSION,
    savedAt: null,
    app: "Barrow Quest",
    saveKey: SAVE_KEY,
    migratedFrom: null,
    migratedAt: null,
  },

  players: [
    { id: "p1", name: "Player 1", coins: 0, enabled: true },
    { id: "p2", name: "Player 2", coins: 0, enabled: false },
    { id: "p3", name: "Player 3", coins: 0, enabled: false },
    { id: "p4", name: "Player 4", coins: 0, enabled: false },
  ],

  activePlayerId: "p1",
  mapMode: "core",
  activePack: "classic",
  activeAdultCategory: null,
  tierMode: "kid",

  unlockedMysteries: [],
  completedQuestionIds: [],
  recentQuestionTags: [],

  quizProfiles: {
    kid: getDefaultAdaptiveProfile("kid"),
    teen: getDefaultAdaptiveProfile("teen"),
    adult: getDefaultAdaptiveProfile("adult"),
  },

  purchasedItems: [],
  inventory: {},
  captainNotes: [],

  completedPins: {},
  pinStats: {
    totalCompleted: 0,
    totalFirstCompletions: 0,
    totalRepeatCompletions: 0,
  },

  meta: {
    xp: 0,
    tokens: 0,
    badges: [],
  },

  settings: {
    radius: 35,
    voicePitch: 1,
    voiceRate: 1,
    sfxVol: 80,
    zoomUI: false,
    character: "hero_duo",
  },

  adultLock: {
    unlocked: false,
    pin: "",
    sessionApproved: false,
    hideWhenKidsMode: false,
  },

  route: null,

  rebuild: {
    abbey: {
      points: 0,
      stage: 0,
      completedRoutes: [],
      unlockedCore: false,
      completedCore: false,
      finished: false,
    },
  },

  replay: {
    core: { resets: 0, bonusReady: false },
    park: { resets: 0, bonusReady: false },
    abbey: { resets: 0, bonusReady: false },
    adult: { resets: 0, bonusReady: false },
  },
};

const SHOP_ITEMS = [
  {
    id: "hint_basic",
    name: "Hint Token",
    cost: 50,
    desc: "Use later for clue help.",
    type: "consumable",
  },
  {
    id: "double_reward",
    name: "Double Reward",
    cost: 120,
    desc: "Boost your next mission reward.",
    type: "consumable",
  },
  {
    id: "ghost_badge",
    name: "Ghost Badge",
    cost: 80,
    desc: "Collectible badge for spooky explorers.",
    type: "badge",
  },
  {
    id: "history_badge",
    name: "History Badge",
    cost: 80,
    desc: "Collectible badge for history hunters.",
    type: "badge",
  },
  {
    id: "park_badge",
    name: "Park Badge",
    cost: 65,
    desc: "Collectible badge for park explorers.",
    type: "badge",
  },
  {
    id: "abbey_badge",
    name: "Abbey Badge",
    cost: 65,
    desc: "Collectible badge for abbey runs.",
    type: "badge",
  },
  {
    id: "route_glow_pack",
    name: "Route Glow",
    cost: 95,
    desc: "Adds a brighter glow to completed routes.",
    type: "cosmetic",
  },
];

/* ============================
   SCRIPTED ABBEY ROUTES
============================ */
const ABBEY_ROUTE_DEFS = {
  investigate: {
    id: "investigate",
    title: "Investigate the Monk Paths",
    intro:
      "Not all paths to the Abbey were visible. Some were used quietly by those who protected knowledge.",
    steps: [
      {
        title: "The Hidden Path",
        desc: "Why would a hidden path be important here?",
        storyCategory: "place",
        story:
          "Not all paths to the Abbey were visible.\nSome were used only by those who needed to move quietly… and without notice.",
        options: [
          "For private movement and protected knowledge",
          "For horse racing",
          "For public trading",
        ],
        answer: 0,
        fact:
          "You’ve stepped onto the monks’ route. Hidden movement mattered here.",
        clue: { value: "2", importance: "high", saveLabel: "Hidden Path = 2" },
        rebuild: 2,
        reward: { coins: 22, xp: 12, tokens: 1 },
      },
      {
        title: "Control and Structure",
        desc: "What would monks value most in a place like this?",
        storyCategory: "purpose",
        story:
          "The Abbey was not chaos.\nEvery movement… every path… had purpose.",
        options: ["Order and routine", "Speed", "Noise"],
        answer: 0,
        fact:
          "The Abbey worked because everything followed structure and routine.",
        rebuild: 2,
        reward: { coins: 24, xp: 14, tokens: 1 },
      },
      {
        title: "Work and Life",
        desc: "What would monks likely be doing here each day?",
        storyCategory: "people",
        story:
          "These paths were not just for prayer.\nThey carried workers, supplies… and daily life.",
        options: ["Farming and labour", "Fighting", "Public trading"],
        answer: 0,
        fact:
          "Work and worship were connected here. The Abbey was lived, not just visited.",
        clue: {
          value: "4",
          importance: "low",
          saveLabel: "Work and Worship = 4",
        },
        rebuild: 3,
        reward: { coins: 28, xp: 16, tokens: 1 },
      },
      {
        title: "The Purpose",
        desc: "What were these routes truly protecting?",
        storyCategory: "loss",
        story:
          "The hidden paths were not built to hide.\nThey were built to protect what mattered.",
        options: ["Knowledge and structure", "Food", "Money"],
        answer: 0,
        fact: "You are beginning to see the Abbey as it once was.",
        clue: {
          value: "6",
          importance: "high",
          saveLabel: "Protected Knowledge = 6",
        },
        rebuild: 5,
        reward: { coins: 36, xp: 22, tokens: 2 },
        routeComplete: true,
      },
    ],
  },

  explore: {
    id: "explore",
    title: "Explore the Outer Grounds",
    intro:
      "Some truths are found by looking, walking, and noticing what others pass by.",
    steps: [
      {
        title: "Outer Ground Marker",
        desc: "What kind of place does this feel like?",
        storyCategory: "place",
        story:
          "The outer grounds gave first impressions.\nWhat you notice here shapes what comes next.",
        options: ["Open historic space", "Busy market", "Modern street"],
        answer: 0,
        fact: "You’ve marked the first outer landmark.",
        rebuild: 1,
        reward: { coins: 18, xp: 10, tokens: 0 },
      },
      {
        title: "Walking the Edge",
        desc: "What matters most when exploring a place like this?",
        storyCategory: "people",
        story:
          "The fastest walkers miss things.\nThe best explorers notice what remains.",
        options: ["Looking carefully", "Rushing", "Ignoring details"],
        answer: 0,
        fact: "Exploration reveals what the eye almost misses.",
        clue: {
          value: "3",
          importance: "low",
          saveLabel: "Outer Edge = 3",
        },
        rebuild: 2,
        reward: { coins: 20, xp: 12, tokens: 1 },
      },
      {
        title: "A Place Revealed",
        desc: "What gives this place its meaning?",
        storyCategory: "restoration",
        story:
          "The Abbey is more than stone.\nIt is memory, place, and what people carried into it.",
        options: ["Its history and people", "Its speed", "Its noise"],
        answer: 0,
        fact: "You’ve restored part of the Abbey’s outer story.",
        rebuild: 3,
        reward: { coins: 24, xp: 14, tokens: 1 },
        routeComplete: true,
      },
    ],
  },

  advance: {
    id: "advance",
    title: "Advance Toward the Core",
    intro:
      "You’ve followed the outer paths. Now you step closer to the heart of the Abbey.",
    steps: [
      {
        title: "Path Forward",
        desc: "To move forward… you need to prove you understand the Abbey.",
        storyCategory: "purpose",
        story:
          "You’ve followed the outer paths.\nNow you step closer to the heart of the Abbey.",
        options: [
          "Military defence",
          "Worship, work, and community",
          "Trade hub",
        ],
        answer: 1,
        fact: "Path forward unlocked.",
        rebuild: 2,
        reward: { coins: 24, xp: 14, tokens: 1 },
      },
      {
        title: "Closer to the Core",
        desc: "What kept the Abbey running every day?",
        storyCategory: "people",
        story:
          "You’re close now.\nThis is where the Abbey’s structure became most important.",
        options: ["Random activity", "Strict routine and order", "External trade"],
        answer: 1,
        fact: "You understand how the Abbey functioned.",
        rebuild: 2,
        reward: { coins: 28, xp: 16, tokens: 1 },
      },
      {
        title: "Pre-Core Pressure",
        desc: "Answer quickly. What was the Abbey built to protect?",
        storyCategory: "loss",
        story: "You’re almost there.\nThis is where mistakes mattered.",
        options: ["Wealth", "Knowledge and belief", "Soldiers"],
        answer: 1,
        followUp: {
          desc: "And what kept it stable?",
          options: ["Strict order", "Freedom", "Trade"],
          answer: 0,
        },
        fact: "The Abbey core is now within reach.",
        clue: {
          value: "8",
          importance: "high",
          saveLabel: "Core Pressure = 8",
        },
        rebuild: 4,
        reward: { coins: 34, xp: 20, tokens: 2 },
        routeComplete: true,
      },
    ],
  },

  core: {
    id: "core",
    title: "The Lost Order Core",
    intro:
      "You’ve reached it. The heart of the Abbey. Everything you’ve followed led you here.",
    steps: [
      {
        title: "The Heart of the Abbey",
        desc: "What was the true purpose of the Abbey?",
        storyCategory: "restoration",
        story:
          "You’ve reached it…\nThe heart of the Abbey.\nEverything you’ve followed… every path… every clue… led you here.",
        options: ["Power", "Wealth", "Faith, structure, and way of life"],
        answer: 2,
        fact:
          "You understand. The Abbey was held together by faith, order, labour, and shared purpose.",
        rebuild: 10,
        reward: { coins: 150, xp: 100, tokens: 3 },
        clue: {
          value: "CORE",
          importance: "high",
          saveLabel: "Heart of the Abbey = CORE",
        },
        routeComplete: true,
        coreComplete: true,
      },
    ],
  },
};

/* ============================
   GLOBAL STATE / RUNTIME
============================ */
let state = loadState();

let map = null;
let heroMarker = null;
let activeMarkers = {};
let currentPin = null;
let currentTask = null;
let nightVisionOn = false;
let locationWatchId = null;
let arStream = null;

const CHARACTER_ICONS = {
  hero_duo: "🧭",
  ninja: "🥷",
  wizard: "🧙",
  robot: "🤖",
  pirate: "🏴‍☠️",
  monk: "monk.jpg",
  khylan: "khylan.jpg",
  piper: "piper.jpg",
};

const CLASSIC_MODE_META = {
  quiz: { label: "QUIZ", icon: "❓" },
  history: { label: "HISTORY", icon: "📜" },
  logic: { label: "LOGIC", icon: "🧩" },
  activity: { label: "ACTIVITY", icon: "🎯" },
  family: { label: "FAMILY", icon: "👨‍👩‍👧" },
  speed: { label: "SPEED", icon: "⚡" },
  ghost: { label: "GHOST", icon: "👻" },
  boss: { label: "BOSS", icon: "👑" },
  discovery: { label: "DISCOVERY", icon: "🔎" },
};

const CLASSIC_MODE_ORDER = [
  "quiz",
  "history",
  "logic",
  "activity",
  "family",
  "speed",
  "ghost",
  "boss",
  "discovery",
];

/* ============================
   SPEECH / NARRATOR
============================ */
let speechEnabled = true;
let speechVoice = null;

function loadVoices() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  speechVoice =
    voices.find((v) => /en-GB/i.test(v.lang)) ||
    voices.find((v) => /en/i.test(v.lang)) ||
    voices[0] ||
    null;
}

function stopSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

function speakText(text, interrupt = true) {
  if (!speechEnabled || !("speechSynthesis" in window) || !text) return;

  try {
    if (interrupt) stopSpeech();

    const utter = new SpeechSynthesisUtterance(String(text));
    utter.pitch = Number(state?.settings?.voicePitch || 1);
    utter.rate = Number(state?.settings?.voiceRate || 1);
    utter.volume = Math.max(
      0,
      Math.min(1, Number(state?.settings?.sfxVol || 80) / 100)
    );

    if (speechVoice) utter.voice = speechVoice;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.warn("Speech failed:", err);
  }
}

function speakOptions(options = []) {
  if (!Array.isArray(options) || !options.length) return;
  const lines = options.map((opt, i) => `Option ${i + 1}. ${opt}`);
  speakText(lines.join(". "));
}

/* ============================
   STATE NORMALISERS
============================ */
function normaliseAdultLock(lock = {}) {
  return {
    unlocked: !!lock.unlocked,
    pin: typeof lock.pin === "string" ? lock.pin : "",
    sessionApproved: !!lock.sessionApproved,
    hideWhenKidsMode: !!lock.hideWhenKidsMode,
  };
}

function normaliseRoute(route = null) {
  if (!route || typeof route !== "object") return null;
  return {
    type: typeof route.type === "string" ? route.type : "abbey",
    path: typeof route.path === "string" ? route.path : null,
    startedAt: route.startedAt || null,
    step: Number.isFinite(route.step) ? route.step : 0,
    clues: Array.isArray(route.clues) ? route.clues : [],
    completedNodes: Number.isFinite(route.completedNodes)
      ? route.completedNodes
      : 0,
    rebuildPoints: Number.isFinite(route.rebuildPoints)
      ? route.rebuildPoints
      : 0,
    awaitFollowUp: route.awaitFollowUp || null,
    lastCompletedPath:
      typeof route.lastCompletedPath === "string" ? route.lastCompletedPath : null,
    coreUnlocked: !!route.coreUnlocked,
    coreCompleted: !!route.coreCompleted,
  };
}

function normaliseRebuild(rebuild = {}) {
  const abbey = rebuild.abbey || {};
  return {
    abbey: {
      points: Number.isFinite(abbey.points) ? abbey.points : 0,
      stage: Number.isFinite(abbey.stage) ? abbey.stage : 0,
      completedRoutes: Array.isArray(abbey.completedRoutes)
        ? abbey.completedRoutes
        : [],
      unlockedCore: !!abbey.unlockedCore,
      completedCore: !!abbey.completedCore,
      finished: !!abbey.finished,
    },
  };
}

function normaliseReplay(replay = {}) {
  return {
    core: {
      resets: Number.isFinite(replay?.core?.resets) ? replay.core.resets : 0,
      bonusReady: !!replay?.core?.bonusReady,
    },
    park: {
      resets: Number.isFinite(replay?.park?.resets) ? replay.park.resets : 0,
      bonusReady: !!replay?.park?.bonusReady,
    },
    abbey: {
      resets: Number.isFinite(replay?.abbey?.resets) ? replay.abbey.resets : 0,
      bonusReady: !!replay?.abbey?.bonusReady,
    },
    adult: {
      resets: Number.isFinite(replay?.adult?.resets) ? replay.adult.resets : 0,
      bonusReady: !!replay?.adult?.bonusReady,
    },
  };
}

function normaliseStorage(storage = {}) {
  return {
    ...computeStorageHealth(),
    ...storage,
    version: SAVE_VERSION,
  };
}

function normaliseLoadedState(parsed) {
  const safe = parsed && typeof parsed === "object" ? parsed : {};

  return {
    ...structuredClone(DEFAULT_STATE),
    ...safe,

    storage: normaliseStorage(safe.storage || {}),

    settings: {
      ...structuredClone(DEFAULT_STATE.settings),
      ...(safe.settings || {}),
    },

    players:
      Array.isArray(safe.players) && safe.players.length
        ? safe.players
        : structuredClone(DEFAULT_STATE.players),

    unlockedMysteries: Array.isArray(safe.unlockedMysteries)
      ? safe.unlockedMysteries
      : [],

    completedQuestionIds: Array.isArray(safe.completedQuestionIds)
      ? safe.completedQuestionIds
      : [],

    recentQuestionTags: Array.isArray(safe.recentQuestionTags)
      ? safe.recentQuestionTags
      : [],

    quizProfiles:
      safe.quizProfiles && typeof safe.quizProfiles === "object"
        ? {
            kid: normaliseAdaptiveProfile(safe.quizProfiles.kid || {}, "kid"),
            teen: normaliseAdaptiveProfile(safe.quizProfiles.teen || {}, "teen"),
            adult: normaliseAdaptiveProfile(
              safe.quizProfiles.adult || {},
              "adult"
            ),
          }
        : {
            kid: getDefaultAdaptiveProfile("kid"),
            teen: getDefaultAdaptiveProfile("teen"),
            adult: getDefaultAdaptiveProfile("adult"),
          },

    purchasedItems: Array.isArray(safe.purchasedItems)
      ? safe.purchasedItems
      : [],

    inventory:
      safe.inventory && typeof safe.inventory === "object"
        ? safe.inventory
        : {},

    captainNotes: Array.isArray(safe.captainNotes)
      ? safe.captainNotes
      : [],

    completedPins:
      safe.completedPins && typeof safe.completedPins === "object"
        ? safe.completedPins
        : {},

    pinStats: {
      ...structuredClone(DEFAULT_STATE.pinStats),
      ...(safe.pinStats || {}),
    },

    meta: {
      ...structuredClone(DEFAULT_STATE.meta),
      ...(safe.meta || {}),
      badges: Array.isArray(safe?.meta?.badges) ? safe.meta.badges : [],
      tokens: Number.isFinite(safe?.meta?.tokens) ? safe.meta.tokens : 0,
    },

    adultLock: normaliseAdultLock(safe.adultLock || {}),
    route: normaliseRoute(safe.route || null),
    rebuild: normaliseRebuild(safe.rebuild || {}),
    replay: normaliseReplay(safe.replay || {}),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);

    const parsed = JSON.parse(raw);
    const migrated = migrateSave(parsed);
    const loaded = normaliseLoadedState(migrated);
    lastSaveHash = stableStringify(buildSavePayloadFromState(loaded));
    return loaded;
  } catch (err) {
    console.warn("Primary save failed, trying backup:", err);
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (!backup) return structuredClone(DEFAULT_STATE);
      const parsedBackup = JSON.parse(backup);
      const migratedBackup = migrateSave(parsedBackup);
      const loadedBackup = normaliseLoadedState(migratedBackup);
      lastSaveHash = stableStringify(buildSavePayloadFromState(loadedBackup));
      return loadedBackup;
    } catch (backupErr) {
      console.error("Backup load failed:", backupErr);
      return structuredClone(DEFAULT_STATE);
    }
  }
}

function saveState() {
  queueSaveState();
}

/* ============================
   RESET SYSTEM
============================ */
function getCurrentResetBucket() {
  if (state.activePack === "adult") return "adult";
  if (state.mapMode === "park") return "park";
  if (state.mapMode === "abbey") return "abbey";
  return "core";
}

function getResetTokenCost() {
  if (state.activePack === "adult") return 5;
  if (state.mapMode === "park") return 3;
  if (state.mapMode === "abbey") return 5;
  return 4;
}

function getCurrentMapLabel() {
  if (state.activePack === "adult") {
    return state.activeAdultCategory
      ? `Adult Archive: ${String(state.activeAdultCategory)
          .replaceAll("_", " ")
          .toUpperCase()}`
      : "Adult Archive";
  }
  if (state.mapMode === "park") return "Barrow Park";
  if (state.mapMode === "abbey") return "Furness Abbey";
  return "Full Barrow";
}

function buildResetConfirmationText() {
  const label = getCurrentMapLabel();
  const tokenCost = getResetTokenCost();

  return (
    `You are about to reset progress for ${label}.\n\n` +
    `This will reset:\n` +
    `- captured nodes for this map\n` +
    `- route progress for this map\n` +
    `- in-progress route clues for this map\n\n` +
    `This will NOT reset:\n` +
    `- coins\n` +
    `- XP\n` +
    `- badges\n` +
    `- notes\n` +
    `- shop items\n` +
    `- unlocked mysteries\n\n` +
    `Cost: ${tokenCost} tokens\n\n` +
    `Do you want to continue?`
  );
}

function getResetSuccessText() {
  if (state.activePack === "adult") return "Adult archive progress reset.";
  if (state.mapMode === "park") return "Park progress reset. Routes reopened.";
  if (state.mapMode === "abbey") return "The Abbey paths have reopened.";
  return "Full Barrow progress reset. Routes reopened.";
}

function removeCompletedPinsForCurrentMap() {
  const next = {};

  Object.entries(state.completedPins || {}).forEach(([key, value]) => {
    const samePack = value?.pack === state.activePack;
    const sameMode = value?.mapMode === state.mapMode;
    const sameAdult =
      state.activePack !== "adult"
        ? true
        : value?.adultCategory === state.activeAdultCategory;

    if (samePack && sameMode && sameAdult) {
      return;
    }

    next[key] = value;
  });

  state.completedPins = next;
}

function resetCurrentMapProgress() {
  const cost = getResetTokenCost();
  const currentTokens = Number(state.meta?.tokens || 0);

  if (currentTokens < cost) {
    alert(`You need ${cost} tokens to reset this map.`);
    speakText(`You need ${cost} tokens to reset this map.`);
    return false;
  }

  const ok = confirm(buildResetConfirmationText());
  if (!ok) return false;

  state.meta.tokens = currentTokens - cost;

  removeCompletedPinsForCurrentMap();

  state.pinStats = {
    totalCompleted: 0,
    totalFirstCompletions: 0,
    totalRepeatCompletions: 0,
  };

  if (state.route && state.route.type === "abbey" && state.mapMode === "abbey") {
    state.route = null;
  }

  const bucket = getCurrentResetBucket();
  if (!state.replay || typeof state.replay !== "object") {
    state.replay = structuredClone(DEFAULT_STATE.replay);
  }

  if (!state.replay[bucket]) {
    state.replay[bucket] = { resets: 0, bonusReady: false };
  }

  state.replay[bucket].resets = Number(state.replay[bucket].resets || 0) + 1;
  state.replay[bucket].bonusReady = true;

  saveStateNow(true);
  renderEverything();
  refreshAllPinMarkers();
  renderPins();

  const message = getResetSuccessText();
  alert(message);
  speakText(message);
  return true;
}

function consumeReplayBonusIfAvailable() {
  const bucket = getCurrentResetBucket();
  const replay = state.replay?.[bucket];
  if (!replay?.bonusReady) return false;
  replay.bonusReady = false;
  return true;
}

/* ============================
   ADULT LOCK
============================ */
function getAdultLock() {
  state.adultLock = normaliseAdultLock(state.adultLock || {});
  return state.adultLock;
}

function clearAdultSessionApproval() {
  const lock = getAdultLock();
  lock.sessionApproved = false;
  saveState();
}

function refreshAdultLockUI() {
  const lock = getAdultLock();

  const showAdult =
    !lock.hideWhenKidsMode || state.tierMode !== "kid" || lock.sessionApproved;

  const trueCrime = $("pill-truecrime");
  const conspiracy = $("pill-conspiracy");
  const history = $("pill-history");

  [trueCrime, conspiracy, history].forEach((btn) => {
    if (!btn) return;
    btn.style.display = showAdult ? "" : "none";
  });

  const setAdultPillState = (el, label, isLocked) => {
    if (!el) return;
    el.innerText = isLocked ? `🔒 ${label}` : label;
    el.dataset.locked = isLocked ? "true" : "false";
    el.style.opacity = isLocked ? "0.9" : "1";
  };

  setAdultPillState(trueCrime, "TRUE CRIME", !lock.unlocked);
  setAdultPillState(conspiracy, "CONSPIRACY", !lock.unlocked);
  setAdultPillState(history, "HISTORY", !lock.unlocked);
}

function isValidParentPin(value) {
  return /^\d{4}$/.test(String(value || "").trim());
}

function promptToCreateAdultPin() {
  alert(
    "Adult mode is locked.\n\nCreate a 4-digit parent PIN to unlock adult content on this device."
  );

  const pin1 = prompt("Create a 4-digit parent PIN");
  if (pin1 === null) return false;
  if (!isValidParentPin(pin1)) {
    alert("PIN must be exactly 4 digits.");
    return false;
  }

  const pin2 = prompt("Re-enter the 4-digit PIN");
  if (pin2 === null) return false;
  if (String(pin1).trim() !== String(pin2).trim()) {
    alert("PINs did not match.");
    return false;
  }

  const lock = getAdultLock();
  lock.pin = String(pin1).trim();
  lock.unlocked = true;
  lock.sessionApproved = true;
  saveState();
  refreshAdultLockUI();
  speakText("Adult archive unlocked.");
  return true;
}

function promptForAdultPinApproval() {
  const lock = getAdultLock();

  if (!lock.unlocked || !lock.pin) {
    return promptToCreateAdultPin();
  }

  const entered = prompt("Enter parent PIN for adult content");
  if (entered === null) return false;

  if (String(entered).trim() !== lock.pin) {
    alert("Incorrect parent PIN.");
    speakText("Incorrect parent PIN.");
    return false;
  }

  lock.sessionApproved = true;
  saveState();
  speakText("Adult archive approved.");
  return true;
}

function ensureAdultAccess() {
  const lock = getAdultLock();
  if (!lock.unlocked) return promptToCreateAdultPin();
  if (lock.sessionApproved) return true;
  return promptForAdultPinApproval();
}

function openAdultCategory(category, spokenLabel) {
  if (!ensureAdultAccess()) return;

  state.activePack = "adult";
  state.activeAdultCategory = category;
  saveState();
  updateStartButtons();
  refreshAdultLockUI();
  resetMap();
  speakText(`${spokenLabel} selected.`);
}

/* ============================
   BADGES / LEVELS
============================ */
function getLevelFromXP(xp) {
  const safeXp = Math.max(0, Number(xp || 0));
  return Math.floor(safeXp / 100) + 1;
}

function getLevelProgress(xp) {
  const safeXp = Math.max(0, Number(xp || 0));
  return safeXp % 100;
}

function hasBadge(name) {
  return Array.isArray(state.meta?.badges)
    ? state.meta.badges.some((b) => b.name === name)
    : false;
}

function showBadgePopup(badge) {
  const popup = $("badge-popup");
  const icon = $("badge-icon");
  const title = $("badge-title");
  const text = $("badge-text");

  if (!popup || !icon || !title || !text) return;

  icon.innerText = badge.icon;
  title.innerText = "BADGE UNLOCKED";
  text.innerText = `${badge.name} • ${badge.captures} node${
    badge.captures === 1 ? "" : "s"
  }`;

  popup.classList.remove("hidden");
  speakText(`Badge unlocked. ${badge.name}.`);

  setTimeout(() => {
    popup.classList.add("hidden");
  }, 3200);
}

function awardBadge(badge) {
  if (!badge || hasBadge(badge.name)) return false;
  state.meta.badges.push({
    ...badge,
    awardedAt: new Date().toISOString(),
  });
  showBadgePopup(badge);
  return true;
}

function checkBadgeUnlocksByCaptures() {
  const captures = Number(state.pinStats?.totalFirstCompletions || 0);
  let unlockedAny = false;

  BADGE_MILESTONES.forEach((badge) => {
    if (captures >= badge.captures && !hasBadge(badge.name)) {
      if (awardBadge(badge)) unlockedAny = true;
    }
  });

  if (unlockedAny) saveState();
}

/* ============================
   REWARD IMAGES
============================ */
function getRewardImageForPin(pin) {
  if (!pin?.id) return null;
  return PIN_REWARD_IMAGES[pin.id] || null;
}

function showRewardImage(pin, fallbackText = "") {
  const reward = getRewardImageForPin(pin);
  if (!reward || !reward.src) return;

  const img = $("reward-image");
  const caption = $("reward-image-caption");

  if (!img || !caption) return;

  img.src = reward.src;
  img.alt = pin?.n || "Reward";
  caption.innerText = reward.caption || fallbackText || "";

  showModal("reward-image-modal");
}

function showScriptedRewardImage(title, captionText, src = "") {
  const img = $("reward-image");
  const caption = $("reward-image-caption");

  if (!img || !caption) return;

  img.src = src || "./monk.jpg";
  img.alt = title || "Reward";
  caption.innerText = captionText || "";

  showModal("reward-image-modal");
}

function closeRewardImageModal() {
  closeModal("reward-image-modal");
}

/* ============================
   NOTES / STORAGE HELPERS
============================ */
function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCaptainNotes() {
  const list = $("captain-notes-list");
  if (!list) return;

  const notes = Array.isArray(state.captainNotes) ? state.captainNotes : [];

  if (!notes.length) {
    list.innerHTML = `
      <div style="
        border:1px solid rgba(255,255,255,0.08);
        border-radius:14px;
        padding:12px;
        background:#111;
        color:var(--muted);
      ">
        No captain notes saved yet.
      </div>
    `;
    return;
  }

  list.innerHTML = notes
    .map(
      (note, index) => `
        <div style="
          border:1px solid rgba(255,255,255,0.08);
          border-radius:14px;
          padding:12px;
          background:#111;
        ">
          <div style="font-size:12px;color:var(--gold);margin-bottom:6px;">
            NOTE ${notes.length - index}
          </div>
          <div style="white-space:pre-wrap;line-height:1.45;">${escapeHtml(
            note.text
          )}</div>
          <div style="margin-top:6px;font-size:11px;color:var(--muted);">
            ${note.kind ? String(note.kind).toUpperCase() : "NOTE"} • ${
        note.createdAt
          ? new Date(note.createdAt).toLocaleString()
          : "saved"
      }
          </div>
          <div style="margin-top:10px;">
            <button
              class="win-btn captain-note-delete-btn"
              data-note-id="${note.id}"
              style="background:#2a2a2a;color:#fff;"
            >
              DELETE
            </button>
          </div>
        </div>
      `
    )
    .join("");

  document.querySelectorAll(".captain-note-delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteCaptainNote(btn.dataset.noteId);
    });
  });
}

function saveCaptainNote(text, kind = "note", source = "") {
  const clean = String(text || "").trim();
  if (!clean) return false;

  if (!Array.isArray(state.captainNotes)) {
    state.captainNotes = [];
  }

  state.captainNotes.unshift({
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: clean,
    kind,
    source,
    createdAt: new Date().toISOString(),
  });

  state.captainNotes = state.captainNotes.slice(0, 120);
  saveState();
  renderCaptainNotes();
  return true;
}

function deleteCaptainNote(noteId) {
  if (!noteId || !Array.isArray(state.captainNotes)) return;
  state.captainNotes = state.captainNotes.filter((n) => n.id !== noteId);
  saveState();
  renderCaptainNotes();
}

function saveClueToCaptainNotes(clue, sourceTitle = "Clue") {
  if (!clue) return;
  const line =
    typeof clue === "string"
      ? clue
      : `${sourceTitle}: ${clue.saveLabel || clue.value || "clue"}`;
  saveCaptainNote(line, "clue", sourceTitle);
}

function saveRouteStoryToNotes(title, storyText, category = "story") {
  if (!storyText) return false;
  return saveCaptainNote(`${title}\n\n${storyText}`, category, title);
}

function sendBroadcastMessage() {
  const input = $("broadcast-input");
  if (!input) return;

  const text = String(input.value || "").trim();
  if (!text) {
    alert("Type a message first.");
    return;
  }

  speakText(text);
  input.value = "";
}

function handleSaveCaptainNote() {
  const input = $("captain-note-input");
  if (!input) return;

  const text = String(input.value || "").trim();
  if (!text) {
    alert("Write a note first.");
    return;
  }

  const ok = saveCaptainNote(text, "note", "Commander");
  if (!ok) return;

  speakText("Captain note saved.");
  input.value = "";
}

/* ============================
   NODE CAPTURE SYSTEM
============================ */
function getCaptureRequired(pin) {
  const value = Number(pin?.captureRequired || 4);
  return Math.max(1, Math.min(6, value));
}

function getMustIncludeModes(pin) {
  return Array.isArray(pin?.mustInclude)
    ? pin.mustInclude.map((x) => String(x).toLowerCase())
    : [];
}

function getPinProgressKey(pin) {
  if (!pin?.id) return null;
  const pack = state.activePack || "classic";
  const mode = state.mapMode || "core";
  const adult = state.activeAdultCategory || "none";
  return `${pack}__${mode}__${adult}__${pin.id}`;
}

function createEmptyPinProgress(pin) {
  return {
    pinId: pin.id,
    pinName: pin.n || pin.id,
    pack: state.activePack,
    mapMode: state.mapMode,
    adultCategory: state.activeAdultCategory,
    firstCompletedAt: null,
    lastCompletedAt: null,
    missionPlayCount: 0,
    captureCount: 0,
    captureRequired: getCaptureRequired(pin),
    mustInclude: getMustIncludeModes(pin),
    completedModes: [],
    fullyCaptured: false,
    lastQuestionId: null,
    lastReward: {
      coins: 0,
      xp: 0,
      tokens: 0,
    },
  };
}

function getPinProgress(pin) {
  const key = getPinProgressKey(pin);
  if (!key) return null;

  const existing = state.completedPins[key];
  if (!existing) return null;

  return {
    ...createEmptyPinProgress(pin),
    ...existing,
    completedModes: Array.isArray(existing.completedModes)
      ? existing.completedModes
      : [],
    mustInclude: Array.isArray(existing.mustInclude)
      ? existing.mustInclude
      : getMustIncludeModes(pin),
  };
}

function getCompletedModesForPin(pin) {
  return getPinProgress(pin)?.completedModes || [];
}

function isModeCompletedForPin(pin, mode) {
  const completed = getCompletedModesForPin(pin);
  return completed.includes(String(mode || "").toLowerCase());
}

function getCaptureStatus(pin) {
  const progress = getPinProgress(pin) || createEmptyPinProgress(pin);
  const completedModes = Array.isArray(progress.completedModes)
    ? progress.completedModes
    : [];
  const required = Number(progress.captureRequired || getCaptureRequired(pin));
  const mustInclude = Array.isArray(progress.mustInclude)
    ? progress.mustInclude
    : getMustIncludeModes(pin);

  const missingRequired = mustInclude.filter(
    (mode) => !completedModes.includes(mode)
  );
  const completedCount = completedModes.length;
  const fullyCaptured = completedCount >= required && missingRequired.length === 0;

  return {
    completedCount,
    required,
    mustInclude,
    missingRequired,
    fullyCaptured,
    completedModes,
    progress,
  };
}

function isPinCompleted(pin) {
  return getCaptureStatus(pin).fullyCaptured;
}

function getMissionReward({ mode, isNewMode }) {
  const base = applyReward({
    mode,
    correct: true,
  }) || { coins: 20, xp: 8, tokens: 0 };

  if (isNewMode) {
    return {
      coins: Math.max(6, Math.floor(Number(base.coins || 0) * 0.55)),
      xp: Math.max(4, Math.floor(Number(base.xp || 0) * 0.55)),
      tokens: Math.max(0, Number(base.tokens || 0)),
    };
  }

  return {
    coins: Math.max(2, Math.floor(Number(base.coins || 0) * 0.2)),
    xp: Math.max(1, Math.floor(Number(base.xp || 0) * 0.2)),
    tokens: 0,
  };
}

function getFullCaptureBonus(pin) {
  const required = getCaptureRequired(pin);
  return {
    coins: 15 + required * 3,
    xp: 10 + required * 2,
    tokens: 1,
  };
}

function recordMissionCompletion(pin, mode, rewardResult, questionId) {
  const key = getPinProgressKey(pin);
  if (!key) {
    return {
      firstModeTime: false,
      fullCaptureJustUnlocked: false,
      record: null,
      status: null,
    };
  }

  const now = new Date().toISOString();
  const existing = getPinProgress(pin) || createEmptyPinProgress(pin);
  const safeMode = String(mode || "").toLowerCase();
  const beforeStatus = getCaptureStatus(pin);
  const alreadyHadMode = existing.completedModes.includes(safeMode);

  existing.missionPlayCount = Number(existing.missionPlayCount || 0) + 1;
  existing.lastCompletedAt = now;
  existing.lastQuestionId = questionId || existing.lastQuestionId || null;
  existing.captureRequired = getCaptureRequired(pin);
  existing.mustInclude = getMustIncludeModes(pin);

  if (!alreadyHadMode && safeMode) {
    existing.completedModes.push(safeMode);
    existing.captureCount = existing.completedModes.length;
  }

  const afterMissingRequired = existing.mustInclude.filter(
    (x) => !existing.completedModes.includes(x)
  );
  const afterFullyCaptured =
    existing.completedModes.length >= existing.captureRequired &&
    afterMissingRequired.length === 0;

  const fullCaptureJustUnlocked = !beforeStatus.fullyCaptured && afterFullyCaptured;

  if (fullCaptureJustUnlocked) {
    existing.fullyCaptured = true;
    existing.firstCompletedAt = existing.firstCompletedAt || now;
    state.pinStats.totalCompleted += 1;
    state.pinStats.totalFirstCompletions += 1;
  } else if (alreadyHadMode) {
    state.pinStats.totalRepeatCompletions += 1;
  }

  existing.lastReward = {
    coins: Number(rewardResult?.coins || 0),
    xp: Number(rewardResult?.xp || 0),
    tokens: Number(rewardResult?.tokens || 0),
  };

  state.completedPins[key] = existing;

  return {
    firstModeTime: !alreadyHadMode,
    fullCaptureJustUnlocked,
    record: existing,
    status: {
      completedCount: existing.completedModes.length,
      required: existing.captureRequired,
      mustInclude: existing.mustInclude,
      missingRequired: afterMissingRequired,
      fullyCaptured: afterFullyCaptured,
      completedModes: existing.completedModes,
    },
  };
}

function getCurrentModeProgress() {
  const pins = getCurrentPins();
  const total = pins.length;
  const completed = pins.filter((pin) => isPinCompleted(pin)).length;
  const remaining = Math.max(0, total - completed);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, remaining, percent };
}

/* ============================
   ABBEY ROUTE / REBUILD SYSTEM
============================ */
function getAbbeyRebuild() {
  if (!state.rebuild || typeof state.rebuild !== "object") {
    state.rebuild = structuredClone(DEFAULT_STATE.rebuild);
  }
  if (!state.rebuild.abbey) {
    state.rebuild.abbey = structuredClone(DEFAULT_STATE.rebuild.abbey);
  }
  return state.rebuild.abbey;
}

function getAbbeyStageFromPoints(points) {
  const p = Number(points || 0);
  if (p >= 20) return 4;
  if (p >= 12) return 3;
  if (p >= 6) return 2;
  if (p >= 1) return 1;
  return 0;
}

function addAbbeyRebuildPoints(amount) {
  const abbey = getAbbeyRebuild();
  abbey.points = Number(abbey.points || 0) + Number(amount || 0);
  abbey.stage = getAbbeyStageFromPoints(abbey.points);
}

function markAbbeyRouteComplete(pathId) {
  const abbey = getAbbeyRebuild();
  if (!abbey.completedRoutes.includes(pathId)) {
    abbey.completedRoutes.push(pathId);
  }
  if (
    abbey.completedRoutes.includes("investigate") &&
    abbey.completedRoutes.includes("advance")
  ) {
    abbey.unlockedCore = true;
  }
}

function clearActiveRoute() {
  state.route = null;
  saveState();
}

function startAbbeyRouteChoice() {
  state.route = {
    type: "abbey",
    path: null,
    startedAt: new Date().toISOString(),
    step: 0,
    clues: [],
    completedNodes: 0,
    rebuildPoints: 0,
    awaitFollowUp: null,
    lastCompletedPath: null,
    coreUnlocked: getAbbeyRebuild().unlockedCore,
    coreCompleted: getAbbeyRebuild().completedCore,
  };
  saveState();
  renderAbbeyRouteChoice();
}

function isAbbeyRouteApproachPin(pin) {
  return (
    state.activePack === "classic" &&
    state.mapMode === "abbey" &&
    !!pin &&
    ABBEY_ROUTE_APPROACH_PIN_IDS.includes(pin.id)
  );
}

function getAbbeyRouteStatusText() {
  const route = state.route;
  const abbey = getAbbeyRebuild();

  if (!route || route.type !== "abbey") {
    return `REBUILD ${abbey.points} • STAGE ${abbey.stage}`;
  }

  const clueText = route.clues.length
    ? route.clues.map((c) => c.value).join(" • ")
    : "NO CLUES";

  return `${String(route.path || "route").toUpperCase()} • STEP ${
    Number(route.step || 0) + 1
  } • CLUES ${clueText}`;
}

function maybeAddScriptedClue(clue, title) {
  if (!clue || !state.route) return;

  const alreadyExists = state.route.clues.some(
    (x) => x.value === clue.value && x.saveLabel === clue.saveLabel
  );
  if (!alreadyExists) {
    state.route.clues.push({
      value: clue.value,
      importance: clue.importance || "low",
      saveLabel: clue.saveLabel || String(clue.value),
      title: title || "Clue",
      savedAt: new Date().toISOString(),
    });
  }
}

function getRewardPresentationMode() {
  if (state.activePack === "adult") return "adult";

  const tier = getEffectiveTier();
  if (tier === "kid") return "kid";
  if (tier === "teen") return "teen";
  return "adult";
}

function getClueAnnouncementText(clue) {
  const mode = getRewardPresentationMode();

  if (!clue) return "";
  if (mode === "kid") return `CLUE FOUND: ${clue.value}`;
  if (mode === "teen") {
    return clue.importance === "high"
      ? `KEY CLUE FOUND: ${clue.value}`
      : "A clue has been added.";
  }
  return clue.importance === "high" ? "A key clue has been marked." : "Clue added.";
}

function renderAbbeyRouteChoice() {
  if (!state.route || state.route.type !== "abbey") {
    startAbbeyRouteChoice();
    return;
  }

  const abbey = getAbbeyRebuild();

  currentTask = {
    mode: "abbey_route_choice",
    pin: currentPin,
    question: null,
  };

  if ($("task-title")) $("task-title").innerText = "Furness Abbey: The Lost Order";
  if ($("task-desc")) {
    $("task-desc").innerText =
      "You’ve made it. Most never get this far.\nAhead lies the Abbey… but it won’t reveal itself easily.\n\nChoose your next move.";
  }

  clearTaskBlocks();
  setTaskBlock(
    "task-block-story",
    "task-story",
    "You are standing before Furness Abbey.\nThe ruins remain… but the Order was lost.\nComplete routes, recover clues, and rebuild what was forgotten."
  );

  const wrap = $("task-options");
  if (!wrap) return;

  const coreLocked = !abbey.unlockedCore;
  wrap.style.display = "grid";
  wrap.innerHTML = `
    <button class="mcq-btn" id="route-investigate-btn">🧩 Investigate the Monk Paths</button>
    <button class="mcq-btn" id="route-explore-btn">🔍 Explore the Outer Grounds</button>
    <button class="mcq-btn" id="route-advance-btn">⚔️ Advance Toward the Core</button>
    ${
      coreLocked
        ? `<button class="mcq-btn" disabled style="opacity:.55;">👑 Core Route Locked (complete Investigate + Advance)</button>`
        : `<button class="mcq-btn" id="route-core-btn">👑 Enter the Abbey Core</button>`
    }
  `;

  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").style.color = "var(--gold)";
    $("task-feedback").innerText =
      `REBUILD ${abbey.points} • STAGE ${abbey.stage}\n` +
      `ROUTES COMPLETE: ${
        abbey.completedRoutes.length ? abbey.completedRoutes.join(", ") : "none yet"
      }`;
  }

  $("route-investigate-btn")?.addEventListener("click", () => {
    chooseAbbeyRoute("investigate");
  });
  $("route-explore-btn")?.addEventListener("click", () => {
    chooseAbbeyRoute("explore");
  });
  $("route-advance-btn")?.addEventListener("click", () => {
    chooseAbbeyRoute("advance");
  });
  $("route-core-btn")?.addEventListener("click", () => {
    chooseAbbeyRoute("core");
  });

  showModal("task-modal");
  speakText("You’ve made it. Most never get this far. Choose your next move.");
}

function chooseAbbeyRoute(pathId) {
  const def = ABBEY_ROUTE_DEFS[pathId];
  if (!def) return;

  if (!state.route || state.route.type !== "abbey") {
    state.route = normaliseRoute({
      type: "abbey",
      path: pathId,
      step: 0,
      clues: [],
      completedNodes: 0,
      rebuildPoints: 0,
    });
  }

  state.route.path = pathId;
  state.route.step = 0;
  state.route.awaitFollowUp = null;
  state.route.startedAt = new Date().toISOString();

  saveState();
  openAbbeyRouteIntro(pathId);
}

function openAbbeyRouteIntro(pathId) {
  const def = ABBEY_ROUTE_DEFS[pathId];
  if (!def) return;

  currentTask = {
    mode: "abbey_route_intro",
    pin: currentPin,
    question: null,
  };

  if ($("task-title")) $("task-title").innerText = def.title;
  if ($("task-desc")) {
    $("task-desc").innerText =
      pathId === "core"
        ? "Everything you’ve followed led you here."
        : "Start this route and recover what was lost.";
  }

  clearTaskBlocks();
  setTaskBlock("task-block-story", "task-story", def.intro || "");

  const wrap = $("task-options");
  if (!wrap) return;

  wrap.style.display = "grid";
  wrap.innerHTML = `
    <button class="mcq-btn" id="route-begin-btn">START ROUTE</button>
    <button class="mcq-btn" id="route-save-intro-btn">SAVE STORY TO NOTES</button>
    <button class="mcq-btn" id="route-back-btn">BACK TO ROUTE CHOICE</button>
  `;

  $("route-begin-btn")?.addEventListener("click", () => {
    state.route.step = 0;
    saveState();
    runAbbeyRouteStep();
  });

  $("route-save-intro-btn")?.addEventListener("click", () => {
    saveRouteStoryToNotes(def.title, def.intro, "route_intro");
    speakText("Route intro saved to notes.");
    alert("Route intro saved to notes.");
  });

  $("route-back-btn")?.addEventListener("click", () => {
    renderAbbeyRouteChoice();
  });

  if ($("task-feedback")) {
    $("task-feedback").style.display = "none";
    $("task-feedback").innerText = "";
  }

  showModal("task-modal");
  speakText(def.intro || def.title);
}

function runAbbeyRouteStep() {
  if (!state.route || state.route.type !== "abbey" || !state.route.path) {
    renderAbbeyRouteChoice();
    return;
  }

  const def = ABBEY_ROUTE_DEFS[state.route.path];
  if (!def) {
    renderAbbeyRouteChoice();
    return;
  }

  const stepIndex = Number(state.route.step || 0);
  const step = def.steps[stepIndex];

  if (!step) {
    finishAbbeyRoute();
    return;
  }

  currentTask = {
    mode: "abbey_scripted_step",
    pin: currentPin,
    question: step,
  };

  if ($("task-title")) $("task-title").innerText = step.title || def.title;
  if ($("task-desc")) $("task-desc").innerText = step.desc || "";

  clearTaskBlocks();
  setTaskBlock("task-block-story", "task-story", step.story || "");
  setTaskBlock("task-block-evidence", "task-evidence", "");
  setTaskBlock("task-block-clue", "task-clue", "");

  const wrap = $("task-options");
  if (!wrap) return;

  wrap.style.display = "grid";
  wrap.innerHTML = (step.options || [])
    .map(
      (opt, index) => `
      <button class="mcq-btn abbey-step-option" data-step-index="${index}">
        ${opt}
      </button>
    `
    )
    .join("");

  document.querySelectorAll(".abbey-step-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      answerAbbeyRouteStep(Number(btn.dataset.stepIndex || -1));
    });
  });

  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").style.color = "var(--gold)";
    $("task-feedback").innerText = getAbbeyRouteStatusText();
  }

  showModal("task-modal");
  speakText(step.story || step.desc || step.title);
}


function resolveAbbeyRouteStep(step) {
  if (!state.route || !step) return;

const feedback = $("task-feedback");
  const active = getActivePlayer();
  const reward = step.reward || { coins: 20, xp: 10, tokens: 0 };

  if (active && reward.coins) {
    updateCoins(active.id, Number(reward.coins || 0));
  }

  state.meta.xp = Number(state.meta.xp || 0) + Number(reward.xp || 0);
  state.meta.tokens =
    Number(state.meta.tokens || 0) + Number(reward.tokens || 0);

  state.route.completedNodes = Number(state.route.completedNodes || 0) + 1;
  state.route.rebuildPoints =
    Number(state.route.rebuildPoints || 0) + Number(step.rebuild || 0);

  addAbbeyRebuildPoints(step.rebuild || 0);

  if (step.clue) {
    maybeAddScriptedClue(step.clue, step.title);
  }

  const clueAnnouncement = getClueAnnouncementText(step.clue);
  const lines = [];

  lines.push(step.fact || "Progress made.");
  lines.push(`+${Number(reward.coins || 0)} coins`);
  lines.push(`+${Number(reward.xp || 0)} XP`);
  if (Number(reward.tokens || 0) > 0) {
    lines.push(`+${Number(reward.tokens || 0)} tokens`);
  }

  if (step.clue) {
    lines.push("");
    lines.push(clueAnnouncement);
  }

  lines.push("");
  lines.push(`REBUILD +${Number(step.rebuild || 0)}`);

  if (feedback) {
    feedback.style.display = "block";
    feedback.style.color = "var(--neon)";
    feedback.innerText = lines.join("\n");
  }

  const narrationParts = [step.fact || "Progress made."];
  if (step.clue) narrationParts.push(clueAnnouncement);

  const rewardSpeechBits = [];
  if (Number(reward.coins || 0) > 0) {
    rewardSpeechBits.push(`${Number(reward.coins || 0)} coins`);
  }
  if (Number(reward.xp || 0) > 0) {
    rewardSpeechBits.push(`${Number(reward.xp || 0)} XP`);
  }
  if (Number(reward.tokens || 0) > 0) {
    rewardSpeechBits.push(`${Number(reward.tokens || 0)} tokens`);
  }
  if (rewardSpeechBits.length) {
    narrationParts.push(`Rewards earned: ${rewardSpeechBits.join(", ")}.`);
  }

  speakText(narrationParts.join(" "));

  const wrap = $("task-options");
  if (wrap) {
    const clueButtons = step.clue
      ? `<button class="mcq-btn" id="save-route-clue-btn">SAVE CLUE TO NOTES</button>`
      : "";

    wrap.innerHTML = `
      <button class="mcq-btn" id="save-route-story-btn">SAVE STORY TO NOTES</button>
      ${clueButtons}
      <button class="mcq-btn" id="continue-route-btn">CONTINUE</button>
      <button class="mcq-btn" id="back-route-choice-btn">BACK TO ROUTE CHOICE</button>
    `;
  }

  $("save-route-story-btn")?.addEventListener("click", () => {
    saveRouteStoryToNotes(
      step.title || "Story",
      step.story || step.desc || "",
      step.storyCategory || "story"
    );
    speakText("Story saved to notes.");
    alert("Story saved to notes.");
  });

  $("save-route-clue-btn")?.addEventListener("click", () => {
    saveClueToCaptainNotes(step.clue, step.title || "Clue");
    speakText("Clue saved to notes.");
    alert("Clue saved to notes.");
  });

  $("continue-route-btn")?.addEventListener("click", () => {
    state.route.step = Number(state.route.step || 0) + 1;
    state.route.awaitFollowUp = null;

    if (step.routeComplete) {
      finishAbbeyRoute();
      return;
    }

    saveState();
    runAbbeyRouteStep();
  });

  $("back-route-choice-btn")?.addEventListener("click", () => {
    renderAbbeyRouteChoice();
  });

  if (step.coreComplete) {
    completeAbbeyCoreReward();
  }

  saveState();
  renderHUD();
  renderHomeLog();
}

function finishAbbeyRoute() {
  if (!state.route || state.route.type !== "abbey") {
    renderAbbeyRouteChoice();
    return;
  }

  const pathId = state.route.path;
  const def = ABBEY_ROUTE_DEFS[pathId];
  const abbey = getAbbeyRebuild();

  if (pathId && pathId !== "core") {
    markAbbeyRouteComplete(pathId);
  }

  state.route.lastCompletedPath = pathId || null;
  state.route.coreUnlocked = !!abbey.unlockedCore;
  state.route.coreCompleted = !!abbey.completedCore;

  currentTask = {
    mode: "abbey_route_complete",
    pin: currentPin,
    question: null,
  };

  if ($("task-title")) {
    $("task-title").innerText =
      pathId === "core" ? "Abbey Core Complete" : `${def?.title || "Route"} Complete`;
  }

  const clueText = state.route.clues.length
    ? state.route.clues.map((c) => c.value).join(" • ")
    : "No clues stored";

  if ($("task-desc")) {
    $("task-desc").innerText =
      pathId === "core"
        ? "The core of the Lost Order has been restored."
        : `You completed the ${def?.title || "route"}.\nClues collected: ${clueText}`;
  }

  clearTaskBlocks();
  setTaskBlock(
    "task-block-story",
    "task-story",
    pathId === "core"
      ? "You’ve reached the heart of the Abbey.\nEverything you followed led here."
      : "You completed part of the Lost Order.\nMore of the Abbey still waits."
  );

  const wrap = $("task-options");
  if (wrap) {
    wrap.style.display = "grid";
    wrap.innerHTML = `
      <button class="mcq-btn" id="abbey-route-save-summary-btn">SAVE ROUTE SUMMARY TO NOTES</button>
      <button class="mcq-btn" id="abbey-route-choice-btn">RETURN TO ROUTE CHOICE</button>
      <button class="mcq-btn" id="abbey-route-close-btn">CLOSE</button>
    `;
  }

  $("abbey-route-save-summary-btn")?.addEventListener("click", () => {
    const summaryText =
      pathId === "core"
        ? "Abbey Core Complete: The Lost Order Restored"
        : `${def?.title || "Route"} Complete\nClues: ${clueText}`;
    saveCaptainNote(summaryText, "route_summary", def?.title || "Abbey Route");
    speakText("Route summary saved.");
    alert("Route summary saved.");
  });

  $("abbey-route-choice-btn")?.addEventListener("click", () => {
    renderAbbeyRouteChoice();
  });

  $("abbey-route-close-btn")?.addEventListener("click", () => {
    closeModal("task-modal");
  });

  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").style.color = "var(--gold)";
    $("task-feedback").innerText =
      `REBUILD ${abbey.points} • STAGE ${abbey.stage}\n` +
      `ROUTES COMPLETE: ${
        abbey.completedRoutes.length ? abbey.completedRoutes.join(", ") : "none yet"
      }` +
      `${abbey.unlockedCore ? "\nCORE ROUTE UNLOCKED" : ""}`;
  }

  saveState();
  renderHomeLog();

  if (pathId !== "core") {
    speakText(
      abbey.unlockedCore
        ? "Route complete. The Abbey core is now unlocked."
        : "Route complete. More of the Abbey awaits."
    );
  }

  showModal("task-modal");
}

function completeAbbeyCoreReward() {
  const abbey = getAbbeyRebuild();

  if (!abbey.completedCore) {
    abbey.completedCore = true;
    abbey.finished = true;
    abbey.unlockedCore = true;
  }

  if (!hasBadge("Abbey Conqueror")) {
    state.meta.badges.push({
      name: "Abbey Conqueror",
      icon: "🏛️",
      captures: 0,
      awardedAt: new Date().toISOString(),
    });

    const popup = $("badge-popup");
    const icon = $("badge-icon");
    const title = $("badge-title");
    const text = $("badge-text");

    if (popup && icon && title && text) {
      icon.innerText = "🏛️";
      title.innerText = "ABBEY COMPLETE";
      text.innerText = "Abbey Conqueror";
      popup.classList.remove("hidden");
      setTimeout(() => {
        popup.classList.add("hidden");
      }, 3400);
    }
  }

  showScriptedRewardImage(
    "The Lost Order Restored",
    "The Abbey restored… through your path.\nNew routes and visual rewards await.",
    "./monk.jpg"
  );

  saveCaptainNote(
    "Abbey Core Complete: The Lost Order Restored",
    "route_summary",
    "Abbey Core"
  );
  saveState();
}

/* ============================
   PLAYERS / HUD
============================ */
function getEnabledPlayers() {
  return state.players.filter((p) => p.enabled);
}

function getActivePlayer() {
  return (
    state.players.find((p) => p.id === state.activePlayerId && p.enabled) ||
    getEnabledPlayers()[0] ||
    state.players[0]
  );
}

function setActivePlayer(id) {
  const player = state.players.find((p) => p.id === id && p.enabled);
  if (!player) return;
  state.activePlayerId = id;
  saveState();
  renderHUD();
  renderShop();
}

function setPlayerCount(count) {
  state.players.forEach((p, i) => {
    p.enabled = i < count;
  });

  const active = getActivePlayer();
  state.activePlayerId = active.id;
  saveState();
  renderHUD();
  renderShop();
}

function updateCoins(playerId, amount) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  player.coins = Math.max(0, Number(player.coins || 0) + Number(amount || 0));
  saveState();
  renderHUD();
  renderShop();
}

function updateTokens(amount) {
  state.meta.tokens = Math.max(
    0,
    Number(state.meta?.tokens || 0) + Number(amount || 0)
  );
  saveState();
  renderHUD();
}

function renderHUD() {
  const active = getActivePlayer();
  const coins = active?.coins || 0;
  const xp = Number(state.meta?.xp || 0);
  const level = getLevelFromXP(xp);

  if ($("top-coins")) $("top-coins").innerText = String(coins);
  if ($("top-xp")) $("top-xp").innerText = `L${level} • ${xp}`;

  const legacyTokens = $("top-tokens");
  if (legacyTokens) {
    legacyTokens.parentElement?.classList.add("hidden");
  }

  const title = document.querySelector(".top-pill");
  if (title && state.activePack === "classic" && state.mapMode === "abbey") {
    const abbey = getAbbeyRebuild();
    title.innerText =
      abbey.stage > 0
        ? `LOST ORDER • R${abbey.points}`
        : "BARROW QUEST";
  } else if (title) {
    title.innerText = "BARROW QUEST";
  }
}

/* ============================
   MODALS
============================ */
function hideAllModals() {
  document.querySelectorAll(".full-modal").forEach((el) => {
    el.style.display = "none";
  });
}

function showModal(id) {
  hideAllModals();
  const el = $(id);
  if (el) el.style.display = "block";
}

function closeModal(id) {
  const el = $(id);
  if (el) el.style.display = "none";
}

/* ============================
   HELPERS
============================ */
function hasValidCoords(pin) {
  return (
    Array.isArray(pin?.l) &&
    pin.l.length === 2 &&
    Number.isFinite(pin.l[0]) &&
    Number.isFinite(pin.l[1]) &&
    !(pin.l[0] === 0 && pin.l[1] === 0)
  );
}

function getEffectiveTier() {
  if (state.activePack === "adult") return "adult";
  if (state.tierMode === "auto") {
    return getEnabledPlayers().length <= 1 ? "adult" : "teen";
  }
  return state.tierMode || "kid";
}

function getCurrentQuizProfile() {
  const tier = getEffectiveTier();
  const base = state.quizProfiles?.[tier] || getDefaultAdaptiveProfile(tier);
  return normaliseAdaptiveProfile(base, tier);
}

function rememberQuestionTags(tags = []) {
  if (!Array.isArray(tags) || !tags.length) return;
  const merged = [...(state.recentQuestionTags || []), ...tags.map(String)];
  state.recentQuestionTags = merged.slice(-20);
}

function getCurrentPins() {
  if (state.activePack === "adult") {
    if (!state.activeAdultCategory) return ADULT_PINS.filter(hasValidCoords);
    return ADULT_PINS.filter(
      (p) => p.category === state.activeAdultCategory && hasValidCoords(p)
    );
  }

  if (state.mapMode === "park") {
    return PINS.filter((p) => p.set === "park" && hasValidCoords(p));
  }

  if (state.mapMode === "abbey") {
    return PINS.filter((p) => p.set === "abbey" && hasValidCoords(p));
  }

  return PINS.filter((p) => p.set === "core" && hasValidCoords(p));
}

function getModeStart() {
  if (state.activePack === "adult") {
    const pins = getCurrentPins();
    if (pins.length) return [pins[0].l[0], pins[0].l[1], 14];
    return [54.11371, -3.218448, 14];
  }

  if (state.mapMode === "park") return [54.1174, -3.2168, 16];
  if (state.mapMode === "abbey") return [54.1344, -3.1964, 15];
  return [54.11371, -3.218448, 14];
}

function getClassicWorld(pin) {
  return String(pin?.set || state.mapMode || "core").toLowerCase();
}

function getClassicZone(pin) {
  return String(pin?.zone || pin?.set || state.mapMode || "core").toLowerCase();
}

function createHeroIcon() {
  const char = state.settings.character || "hero_duo";
  const value = CHARACTER_ICONS[char] || "🧭";

  if (value.endsWith(".jpg") || value.endsWith(".png")) {
    return L.divIcon({
      className: "marker-logo",
      html: `
        <div style="
          width:52px;
          height:52px;
          border-radius:50%;
          overflow:hidden;
          border:2px solid #ffd54a;
          box-shadow:0 4px 12px rgba(0,0,0,0.6);
          background:#111;
        ">
          <img src="${value}" style="width:100%;height:100%;object-fit:cover;">
        </div>
      `,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
    });
  }

  return L.divIcon({
    className: "marker-logo",
    html: `<div style="font-size:40px;">${value}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function createPinIcon(pin) {
  const status = getCaptureStatus(pin);
  const icon = pin.i || "📍";
  const abbey = getAbbeyRebuild();
  const hasGlowPack = getInventoryCount("route_glow_pack") > 0;

  if (status.fullyCaptured) {
    return L.divIcon({
      className: "marker-logo",
      html: `
        <div style="
          width:38px;
          height:38px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          background:rgba(77,255,158,0.18);
          border:2px solid #4dff9e;
          box-shadow:0 0 0 2px rgba(0,0,0,0.35) inset;
          font-size:20px;
          line-height:1;
          ${hasGlowPack ? "filter: drop-shadow(0 0 8px rgba(99,255,211,.7));" : ""}
        ">✅</div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  }

  const abbeyGlow =
    state.activePack === "classic" &&
    state.mapMode === "abbey" &&
    abbey.stage > 0
      ? `filter: drop-shadow(0 0 ${4 + abbey.stage * 2}px rgba(255,213,74,.35));`
      : "";

  if (status.completedCount > 0) {
    return L.divIcon({
      className: "marker-logo",
      html: `
        <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;${abbeyGlow}">
          <div style="font-size:28px;line-height:1;">${icon}</div>
          <div style="
            position:absolute;
            right:-4px;
            bottom:-4px;
            min-width:20px;
            height:20px;
            padding:0 4px;
            border-radius:999px;
            background:#ffd54a;
            color:#111;
            font-size:11px;
            font-weight:900;
            display:flex;
            align-items:center;
            justify-content:center;
            border:2px solid #111;
          ">${status.completedCount}/${status.required}</div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
  }

  return L.divIcon({
    className: "marker-logo",
    html: `<div style="font-size:28px;line-height:1;${abbeyGlow}">${icon}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function getAdultContentForPin(pin) {
  if (!pin) return null;
  return ADULT_CONTENT?.[pin.id] || null;
}

function showQuestLayoutForPack() {
  const classicWrap = $("classic-mission-wrap");
  const adultWrap = $("adult-investigation-wrap");

  if (classicWrap) {
    classicWrap.style.display = state.activePack === "adult" ? "none" : "block";
  }

  if (adultWrap) {
    adultWrap.style.display = state.activePack === "adult" ? "block" : "none";
  }
}

function normaliseClassicModeFromPin(pin) {
  if (!pin) return "quiz";

  const type = String(pin.type || "").toLowerCase();

  if (!type || type === "start") return "quiz";
  if (type === "story") return "history";
  if (type === "battle") return "activity";

  if (
    [
      "quiz",
      "history",
      "logic",
      "activity",
      "family",
      "speed",
      "ghost",
      "boss",
      "discovery",
    ].includes(type)
  ) {
    return type;
  }

  return "quiz";
}

function getClassicModePoolForPin(pin) {
  const primary = normaliseClassicModeFromPin(pin);
  const world = getClassicWorld(pin);
  const zone = getClassicZone(pin);
  const unique = [];

  const pushUnique = (value) => {
    if (!value) return;
    if (!CLASSIC_MODE_META[value]) return;
    if (!unique.includes(value)) unique.push(value);
  };

  const worldPools = {
    core: ["quiz", "history", "logic", "activity", "family", "speed"],
    park: ["quiz", "history", "activity", "family", "speed", "logic"],
    abbey: ["history", "quiz", "logic", "activity", "ghost", "family", "speed"],
  };

  pushUnique(primary);

  if (primary === "boss") {
    pushUnique("quiz");
    pushUnique("history");
    pushUnique("logic");
  }

  if (primary === "ghost") {
    pushUnique("logic");
    pushUnique("history");
  }

  if (primary === "discovery") {
    pushUnique("activity");
    pushUnique("family");
  }

  if (zone === "memorial") {
    pushUnique("history");
    pushUnique("quiz");
  }

  if (zone === "abbey") {
    pushUnique("ghost");
    pushUnique("logic");
    pushUnique("history");
  }

  if (zone === "docks") {
    pushUnique("history");
    pushUnique("quiz");
    pushUnique("logic");
  }

  if (zone === "nature" || zone === "park") {
    pushUnique("activity");
    pushUnique("family");
    pushUnique("speed");
  }

  (worldPools[world] || worldPools.core).forEach((mode) => pushUnique(mode));

  if (pin?.hidden) pushUnique("discovery");
  if (primary === "boss") pushUnique("boss");
  if (primary === "ghost") pushUnique("ghost");

  return unique.filter(Boolean);
}

function pickClassicModesForPin(pin, count = 6) {
  const pool = getClassicModePoolForPin(pin);
  const primary = normaliseClassicModeFromPin(pin);
  const selected = [];

  const pushUnique = (value) => {
    if (!value) return;
    if (!selected.includes(value)) selected.push(value);
  };

  pushUnique(primary);

  const remaining = pool.filter((mode) => mode !== primary);
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);

  shuffled.forEach((mode) => {
    if (selected.length < count) pushUnique(mode);
  });

  CLASSIC_MODE_ORDER.forEach((mode) => {
    if (selected.length < count && pool.includes(mode)) pushUnique(mode);
  });

  return selected.slice(0, count);
}

function renderClassicModeChoices(pin) {
  const tiles = Array.from(document.querySelectorAll(".m-tile"));
  if (!tiles.length) return;

  const chosenModes = pickClassicModesForPin(pin, 6);
  const chosenSet = new Set(chosenModes);

  tiles.forEach((tile) => {
    const mode = tile.dataset.mode;
    if (!mode) return;

    if (mode === "health" || mode === "battle") {
      tile.classList.add("hidden");
      return;
    }

    if (!chosenSet.has(mode)) {
      tile.classList.add("hidden");
      return;
    }

    tile.classList.remove("hidden");

    const meta = CLASSIC_MODE_META[mode];
    const done = isModeCompletedForPin(pin, mode);
    if (meta) {
      tile.innerHTML = `<span>${done ? "✅" : meta.icon}</span>${meta.label}`;
      tile.style.opacity = done ? "0.75" : "1";
    }
  });
}

function clearTaskBlocks() {
  const ids = ["task-block-story", "task-block-evidence", "task-block-clue"];

  ids.forEach((id) => {
    const el = $(id);
    if (el) el.classList.add("hidden");
  });

  if ($("task-story")) $("task-story").innerText = "";
  if ($("task-evidence")) $("task-evidence").innerText = "";
  if ($("task-clue")) $("task-clue").innerText = "";

  if ($("btn-read-answers")) {
    $("btn-read-answers").classList.add("hidden");
  }
}

function setTaskBlock(id, bodyId, text) {
  const block = $(id);
  const body = $(bodyId);
  if (!block || !body) return;

  if (text) {
    body.innerText = text;
    block.classList.remove("hidden");
  } else {
    body.innerText = "";
    block.classList.add("hidden");
  }
}

function answerAbbeyRouteStep(index) {
  if (!state.route || state.route.type !== "abbey") return;

  const def = ABBEY_ROUTE_DEFS[state.route.path];
  const step = def?.steps?.[state.route.step];
  const feedback = $("task-feedback");

  if (!def || !step || !feedback) return;

  if (state.route.awaitFollowUp) {
    const follow = state.route.awaitFollowUp;
    const isCorrect = index === Number(follow.answer);

    if (!isCorrect) {
      feedback.style.display = "block";
      feedback.style.color = "#ff6b6b";
      feedback.innerText = "Not quite. Try again.";
      speakText("Not quite. Try again.");
      return;
    }

    state.route.awaitFollowUp = null;
    resolveAbbeyRouteStep(step);
    return;
  }

  const isCorrect = index === Number(step.answer);

  if (!isCorrect) {
    feedback.style.display = "block";
    feedback.style.color = "#ff6b6b";
    feedback.innerText = "Not quite. Try again.";
    speakText("Not quite. Try again.");
    return;
  }

  if (step.followUp) {
    state.route.awaitFollowUp = step.followUp;

    if ($("task-desc")) $("task-desc").innerText = step.followUp.desc || "";

    const wrap = $("task-options");
    if (wrap) {
      wrap.innerHTML = (step.followUp.options || [])
        .map(
          (opt, followIndex) => `
          <button class="mcq-btn abbey-follow-option" data-follow-index="${followIndex}">
            ${opt}
          </button>
        `
        )
        .join("");

      document.querySelectorAll(".abbey-follow-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          answerAbbeyRouteStep(Number(btn.dataset.followIndex || -1));
        });
      });
    }

    feedback.style.display = "block";
    feedback.style.color = "var(--gold)";
    feedback.innerText = "Good. One more.";
    speakText(step.followUp.desc || "One more.");
    saveState();
    return;
  }

  resolveAbbeyRouteStep(step);
}

function resolveAbbeyRouteStep(step) {
  if (!state.route || !step) return;

  const feedback = $("task-feedback");
  const active = getActivePlayer();
  const reward = step.reward || { coins: 20, xp: 10, tokens: 0 };

  if (active && reward.coins) {
    updateCoins(active.id, Number(reward.coins || 0));
  }

  state.meta.xp = Number(state.meta.xp || 0) + Number(reward.xp || 0);
  state.meta.tokens =
    Number(state.meta.tokens || 0) + Number(reward.tokens || 0);

  state.route.completedNodes = Number(state.route.completedNodes || 0) + 1;
  state.route.rebuildPoints =
    Number(state.route.rebuildPoints || 0) + Number(step.rebuild || 0);

  addAbbeyRebuildPoints(step.rebuild || 0);

  if (step.clue) {
    maybeAddScriptedClue(step.clue, step.title);
  }

  const clueAnnouncement = getClueAnnouncementText(step.clue);
  const lines = [];

  lines.push(step.fact || "Progress made.");
  lines.push(`+${Number(reward.coins || 0)} coins`);
  lines.push(`+${Number(reward.xp || 0)} XP`);
  if (Number(reward.tokens || 0) > 0) {
    lines.push(`+${Number(reward.tokens || 0)} tokens`);
  }

  if (step.clue) {
    lines.push("");
    lines.push(clueAnnouncement);
  }

  lines.push("");
  lines.push(`REBUILD +${Number(step.rebuild || 0)}`);

  if (feedback) {
    feedback.style.display = "block";
    feedback.style.color = "var(--neon)";
    feedback.innerText = lines.join("\n");
  }

  const narrationParts = [step.fact || "Progress made."];
  if (step.clue) narrationParts.push(clueAnnouncement);

  const rewardSpeechBits = [];
  if (Number(reward.coins || 0) > 0) {
    rewardSpeechBits.push(`${Number(reward.coins || 0)} coins`);
  }
  if (Number(reward.xp || 0) > 0) {
    rewardSpeechBits.push(`${Number(reward.xp || 0)} XP`);
  }
  if (Number(reward.tokens || 0) > 0) {
    rewardSpeechBits.push(`${Number(reward.tokens || 0)} tokens`);
  }
  if (rewardSpeechBits.length) {
    narrationParts.push(`Rewards earned: ${rewardSpeechBits.join(", ")}.`);
  }

  speakText(narrationParts.join(" "));

  const wrap = $("task-options");
  if (wrap) {
    const clueButtons = step.clue
      ? `<button class="mcq-btn" id="save-route-clue-btn">SAVE CLUE TO NOTES</button>`
      : "";

    wrap.innerHTML = `
      <button class="mcq-btn" id="save-route-story-btn">SAVE STORY TO NOTES</button>
      ${clueButtons}
      <button class="mcq-btn" id="continue-route-btn">CONTINUE</button>
      <button class="mcq-btn" id="back-route-choice-btn">BACK TO ROUTE CHOICE</button>
    `;
  }

  $("save-route-story-btn")?.addEventListener("click", () => {
    saveRouteStoryToNotes(
      step.title || "Story",
      step.story || step.desc || "",
      step.storyCategory || "story"
    );
    speakText("Story saved to notes.");
    alert("Story saved to notes.");
  });

  $("save-route-clue-btn")?.addEventListener("click", () => {
    saveClueToCaptainNotes(step.clue, step.title || "Clue");
    speakText("Clue saved to notes.");
    alert("Clue saved to notes.");
  });

  $("continue-route-btn")?.addEventListener("click", () => {
    state.route.step = Number(state.route.step || 0) + 1;
    state.route.awaitFollowUp = null;

    if (step.routeComplete) {
      finishAbbeyRoute();
      return;
    }

    saveState();
    runAbbeyRouteStep();
  });

  $("back-route-choice-btn")?.addEventListener("click", () => {
    renderAbbeyRouteChoice();
  });

  if (step.coreComplete) {
    completeAbbeyCoreReward();
  }

  saveState();
  renderHUD();
  renderHomeLog();
}

function finishAbbeyRoute() {
  if (!state.route || state.route.type !== "abbey") {
    renderAbbeyRouteChoice();
    return;
  }

  const pathId = state.route.path;
  const def = ABBEY_ROUTE_DEFS[pathId];
  const abbey = getAbbeyRebuild();

  if (pathId && pathId !== "core") {
    markAbbeyRouteComplete(pathId);
  }

  state.route.lastCompletedPath = pathId || null;
  state.route.coreUnlocked = !!abbey.unlockedCore;
  state.route.coreCompleted = !!abbey.completedCore;

  currentTask = {
    mode: "abbey_route_complete",
    pin: currentPin,
    question: null,
  };

  if ($("task-title")) {
    $("task-title").innerText =
      pathId === "core" ? "Abbey Core Complete" : `${def?.title || "Route"} Complete`;
  }

  const clueText = state.route.clues.length
    ? state.route.clues.map((c) => c.value).join(" • ")
    : "No clues stored";

  if ($("task-desc")) {
    $("task-desc").innerText =
      pathId === "core"
        ? "The core of the Lost Order has been restored."
        : `You completed the ${def?.title || "route"}.\nClues collected: ${clueText}`;
  }

  clearTaskBlocks();
  setTaskBlock(
    "task-block-story",
    "task-story",
    pathId === "core"
      ? "You’ve reached the heart of the Abbey.\nEverything you followed led here."
      : "You completed part of the Lost Order.\nMore of the Abbey still waits."
  );

  const wrap = $("task-options");
  if (wrap) {
    wrap.style.display = "grid";
    wrap.innerHTML = `
      <button class="mcq-btn" id="abbey-route-save-summary-btn">SAVE ROUTE SUMMARY TO NOTES</button>
      <button class="mcq-btn" id="abbey-route-choice-btn">RETURN TO ROUTE CHOICE</button>
      <button class="mcq-btn" id="abbey-route-close-btn">CLOSE</button>
    `;
  }

  $("abbey-route-save-summary-btn")?.addEventListener("click", () => {
    const summaryText =
      pathId === "core"
        ? "Abbey Core Complete: The Lost Order Restored"
        : `${def?.title || "Route"} Complete\nClues: ${clueText}`;
    saveCaptainNote(summaryText, "route_summary", def?.title || "Abbey Route");
    speakText("Route summary saved.");
    alert("Route summary saved.");
  });

  $("abbey-route-choice-btn")?.addEventListener("click", () => {
    renderAbbeyRouteChoice();
  });

  $("abbey-route-close-btn")?.addEventListener("click", () => {
    closeModal("task-modal");
  });

  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").style.color = "var(--gold)";
    $("task-feedback").innerText =
      `REBUILD ${abbey.points} • STAGE ${abbey.stage}\n` +
      `ROUTES COMPLETE: ${
        abbey.completedRoutes.length ? abbey.completedRoutes.join(", ") : "none yet"
      }` +
      `${abbey.unlockedCore ? "\nCORE ROUTE UNLOCKED" : ""}`;
  }

  saveState();
  renderHomeLog();

  if (pathId !== "core") {
    speakText(
      abbey.unlockedCore
        ? "Route complete. The Abbey core is now unlocked."
        : "Route complete. More of the Abbey awaits."
    );
  }

  showModal("task-modal");
}

function completeAbbeyCoreReward() {
  const abbey = getAbbeyRebuild();

  if (!abbey.completedCore) {
    abbey.completedCore = true;
    abbey.finished = true;
    abbey.unlockedCore = true;
  }

  if (!hasBadge("Abbey Conqueror")) {
    state.meta.badges.push({
      name: "Abbey Conqueror",
      icon: "🏛️",
      captures: 0,
      awardedAt: new Date().toISOString(),
    });

    const popup = $("badge-popup");
    const icon = $("badge-icon");
    const title = $("badge-title");
    const text = $("badge-text");

    if (popup && icon && title && text) {
      icon.innerText = "🏛️";
      title.innerText = "ABBEY COMPLETE";
      text.innerText = "Abbey Conqueror";
      popup.classList.remove("hidden");
      setTimeout(() => {
        popup.classList.add("hidden");
      }, 3400);
    }
  }

  showScriptedRewardImage(
    "The Lost Order Restored",
    "The Abbey restored… through your path.\nNew routes and visual rewards await.",
    "./monk.jpg"
  );

  saveCaptainNote(
    "Abbey Core Complete: The Lost Order Restored",
    "route_summary",
    "Abbey Core"
  );
  saveState();
}

/* ============================
   PLAYERS / HUD
============================ */
function getEnabledPlayers() {
  return state.players.filter((p) => p.enabled);
}

function getActivePlayer() {
  return (
    state.players.find((p) => p.id === state.activePlayerId && p.enabled) ||
    getEnabledPlayers()[0] ||
    state.players[0]
  );
}

function setActivePlayer(id) {
  const player = state.players.find((p) => p.id === id && p.enabled);
  if (!player) return;
  state.activePlayerId = id;
  saveState();
  renderHUD();
  renderShop();
}

function setPlayerCount(count) {
  state.players.forEach((p, i) => {
    p.enabled = i < count;
  });

  const active = getActivePlayer();
  state.activePlayerId = active.id;
  saveState();
  renderHUD();
  renderShop();
}

function updateCoins(playerId, amount) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  player.coins = Math.max(0, Number(player.coins || 0) + Number(amount || 0));
  saveState();
  renderHUD();
  renderShop();
}

function updateTokens(amount) {
  state.meta.tokens = Math.max(
    0,
    Number(state.meta?.tokens || 0) + Number(amount || 0)
  );
  saveState();
  renderHUD();
}

function renderHUD() {
  const active = getActivePlayer();
  const coins = active?.coins || 0;
  const xp = Number(state.meta?.xp || 0);
  const level = getLevelFromXP(xp);

  if ($("top-coins")) $("top-coins").innerText = String(coins);
  if ($("top-xp")) $("top-xp").innerText = `L${level} • ${xp}`;

  const legacyTokens = $("top-tokens");
  if (legacyTokens) {
    legacyTokens.parentElement?.classList.add("hidden");
  }

  const title = document.querySelector(".top-pill");
  if (title && state.activePack === "classic" && state.mapMode === "abbey") {
    const abbey = getAbbeyRebuild();
    title.innerText =
      abbey.stage > 0
        ? `LOST ORDER • R${abbey.points}`
        : "BARROW QUEST";
  } else if (title) {
    title.innerText = "BARROW QUEST";
  }
}

/* ============================
   MODALS
============================ */
function hideAllModals() {
  document.querySelectorAll(".full-modal").forEach((el) => {
    el.style.display = "none";
  });
}

function showModal(id) {
  hideAllModals();
  const el = $(id);
  if (el) el.style.display = "block";
}

function closeModal(id) {
  const el = $(id);
  if (el) el.style.display = "none";
}

/* ============================
   HELPERS
============================ */
function hasValidCoords(pin) {
  return (
    Array.isArray(pin?.l) &&
    pin.l.length === 2 &&
    Number.isFinite(pin.l[0]) &&
    Number.isFinite(pin.l[1]) &&
    !(pin.l[0] === 0 && pin.l[1] === 0)
  );
}

function getEffectiveTier() {
  if (state.activePack === "adult") return "adult";
  if (state.tierMode === "auto") {
    return getEnabledPlayers().length <= 1 ? "adult" : "teen";
  }
  return state.tierMode || "kid";
}

function getCurrentQuizProfile() {
  const tier = getEffectiveTier();
  const base = state.quizProfiles?.[tier] || getDefaultAdaptiveProfile(tier);
  return normaliseAdaptiveProfile(base, tier);
}

function rememberQuestionTags(tags = []) {
  if (!Array.isArray(tags) || !tags.length) return;
  const merged = [...(state.recentQuestionTags || []), ...tags.map(String)];
  state.recentQuestionTags = merged.slice(-20);
}

function getCurrentPins() {
  if (state.activePack === "adult") {
    if (!state.activeAdultCategory) return ADULT_PINS.filter(hasValidCoords);
    return ADULT_PINS.filter(
      (p) => p.category === state.activeAdultCategory && hasValidCoords(p)
    );
  }

  if (state.mapMode === "park") {
    return PINS.filter((p) => p.set === "park" && hasValidCoords(p));
  }

  if (state.mapMode === "abbey") {
    return PINS.filter((p) => p.set === "abbey" && hasValidCoords(p));
  }

  return PINS.filter((p) => p.set === "core" && hasValidCoords(p));
}

function getModeStart() {
  if (state.activePack === "adult") {
    const pins = getCurrentPins();
    if (pins.length) return [pins[0].l[0], pins[0].l[1], 14];
    return [54.11371, -3.218448, 14];
  }

  if (state.mapMode === "park") return [54.1174, -3.2168, 16];
  if (state.mapMode === "abbey") return [54.1344, -3.1964, 15];
  return [54.11371, -3.218448, 14];
}

function getClassicWorld(pin) {
  return String(pin?.set || state.mapMode || "core").toLowerCase();
}

function getClassicZone(pin) {
  return String(pin?.zone || pin?.set || state.mapMode || "core").toLowerCase();
}

function createHeroIcon() {
  const char = state.settings.character || "hero_duo";
  const value = CHARACTER_ICONS[char] || "🧭";

  if (value.endsWith(".jpg") || value.endsWith(".png")) {
    return L.divIcon({
      className: "marker-logo",
      html: `
        <div style="
          width:52px;
          height:52px;
          border-radius:50%;
          overflow:hidden;
          border:2px solid #ffd54a;
          box-shadow:0 4px 12px rgba(0,0,0,0.6);
          background:#111;
        ">
          <img src="${value}" style="width:100%;height:100%;object-fit:cover;">
        </div>
      `,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
    });
  }

  return L.divIcon({
    className: "marker-logo",
    html: `<div style="font-size:40px;">${value}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function createPinIcon(pin) {
  const status = getCaptureStatus(pin);
  const icon = pin.i || "📍";
  const abbey = getAbbeyRebuild();
  const hasGlowPack = getInventoryCount("route_glow_pack") > 0;

  if (status.fullyCaptured) {
    return L.divIcon({
      className: "marker-logo",
      html: `
        <div style="
          width:38px;
          height:38px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          background:rgba(77,255,158,0.18);
          border:2px solid #4dff9e;
          box-shadow:0 0 0 2px rgba(0,0,0,0.35) inset;
          font-size:20px;
          line-height:1;
          ${hasGlowPack ? "filter: drop-shadow(0 0 8px rgba(99,255,211,.7));" : ""}
        ">✅</div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  }

  const abbeyGlow =
    state.activePack === "classic" &&
    state.mapMode === "abbey" &&
    abbey.stage > 0
      ? `filter: drop-shadow(0 0 ${4 + abbey.stage * 2}px rgba(255,213,74,.35));`
      : "";

  if (status.completedCount > 0) {
    return L.divIcon({
      className: "marker-logo",
      html: `
        <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;${abbeyGlow}">
          <div style="font-size:28px;line-height:1;">${icon}</div>
          <div style="
            position:absolute;
            right:-4px;
            bottom:-4px;
            min-width:20px;
            height:20px;
            padding:0 4px;
            border-radius:999px;
            background:#ffd54a;
            color:#111;
            font-size:11px;
            font-weight:900;
            display:flex;
            align-items:center;
            justify-content:center;
            border:2px solid #111;
          ">${status.completedCount}/${status.required}</div>
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
  }

  return L.divIcon({
    className: "marker-logo",
    html: `<div style="font-size:28px;line-height:1;${abbeyGlow}">${icon}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function getAdultContentForPin(pin) {
  if (!pin) return null;
  return ADULT_CONTENT?.[pin.id] || null;
}

function showQuestLayoutForPack() {
  const classicWrap = $("classic-mission-wrap");
  const adultWrap = $("adult-investigation-wrap");

  if (classicWrap) {
    classicWrap.style.display = state.activePack === "adult" ? "none" : "block";
  }

  if (adultWrap) {
    adultWrap.style.display = state.activePack === "adult" ? "block" : "none";
  }
}

function normaliseClassicModeFromPin(pin) {
  if (!pin) return "quiz";

  const type = String(pin.type || "").toLowerCase();

  if (!type || type === "start") return "quiz";
  if (type === "story") return "history";
  if (type === "battle") return "activity";

  if (
    [
      "quiz",
      "history",
      "logic",
      "activity",
      "family",
      "speed",
      "ghost",
      "boss",
      "discovery",
    ].includes(type)
  ) {
    return type;
  }

  return "quiz";
}

function getClassicModePoolForPin(pin) {
  const primary = normaliseClassicModeFromPin(pin);
  const world = getClassicWorld(pin);
  const zone = getClassicZone(pin);
  const unique = [];

  const pushUnique = (value) => {
    if (!value) return;
    if (!CLASSIC_MODE_META[value]) return;
    if (!unique.includes(value)) unique.push(value);
  };

  const worldPools = {
    core: ["quiz", "history", "logic", "activity", "family", "speed"],
    park: ["quiz", "history", "activity", "family", "speed", "logic"],
    abbey: ["history", "quiz", "logic", "activity", "ghost", "family", "speed"],
  };

  pushUnique(primary);

  if (primary === "boss") {
    pushUnique("quiz");
    pushUnique("history");
    pushUnique("logic");
  }

  if (primary === "ghost") {
    pushUnique("logic");
    pushUnique("history");
  }

  if (primary === "discovery") {
    pushUnique("activity");
    pushUnique("family");
  }

  if (zone === "memorial") {
    pushUnique("history");
    pushUnique("quiz");
  }

  if (zone === "abbey") {
    pushUnique("ghost");
    pushUnique("logic");
    pushUnique("history");
  }

  if (zone === "docks") {
    pushUnique("history");
    pushUnique("quiz");
    pushUnique("logic");
  }

  if (zone === "nature" || zone === "park") {
    pushUnique("activity");
    pushUnique("family");
    pushUnique("speed");
  }

  (worldPools[world] || worldPools.core).forEach((mode) => pushUnique(mode));

  if (pin?.hidden) pushUnique("discovery");
  if (primary === "boss") pushUnique("boss");
  if (primary === "ghost") pushUnique("ghost");

  return unique.filter(Boolean);
}

function pickClassicModesForPin(pin, count = 6) {
  const pool = getClassicModePoolForPin(pin);
  const primary = normaliseClassicModeFromPin(pin);
  const selected = [];

  const pushUnique = (value) => {
    if (!value) return;
    if (!selected.includes(value)) selected.push(value);
  };

  pushUnique(primary);

  const remaining = pool.filter((mode) => mode !== primary);
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);

  shuffled.forEach((mode) => {
    if (selected.length < count) pushUnique(mode);
  });

  CLASSIC_MODE_ORDER.forEach((mode) => {
    if (selected.length < count && pool.includes(mode)) pushUnique(mode);
  });

  return selected.slice(0, count);
}

function renderClassicModeChoices(pin) {
  const tiles = Array.from(document.querySelectorAll(".m-tile"));
  if (!tiles.length) return;

  const chosenModes = pickClassicModesForPin(pin, 6);
  const chosenSet = new Set(chosenModes);

  tiles.forEach((tile) => {
    const mode = tile.dataset.mode;
    if (!mode) return;

    if (mode === "health" || mode === "battle") {
      tile.classList.add("hidden");
      return;
    }

    if (!chosenSet.has(mode)) {
      tile.classList.add("hidden");
      return;
    }

    tile.classList.remove("hidden");

    const meta = CLASSIC_MODE_META[mode];
    const done = isModeCompletedForPin(pin, mode);
    if (meta) {
      tile.innerHTML = `<span>${done ? "✅" : meta.icon}</span>${meta.label}`;
      tile.style.opacity = done ? "0.75" : "1";
    }
  });
}

function clearTaskBlocks() {
  const ids = ["task-block-story", "task-block-evidence", "task-block-clue"];

  ids.forEach((id) => {
    const el = $(id);
    if (el) el.classList.add("hidden");
  });

  if ($("task-story")) $("task-story").innerText = "";
  if ($("task-evidence")) $("task-evidence").innerText = "";
  if ($("task-clue")) $("task-clue").innerText = "";

  if ($("btn-read-answers")) {
    $("btn-read-answers").classList.add("hidden");
  }
}

function setTaskBlock(id, bodyId, text) {
  const block = $(id);
  const body = $(bodyId);
  if (!block || !body) return;

  if (text) {
    body.innerText = text;
    block.classList.remove("hidden");
  } else {
    body.innerText = "";
    block.classList.add("hidden");
  }
}

/* ============================
   MAP SYSTEM
============================ */
function initMap() {
  const [lat, lng, zoom] = getModeStart();

  map = L.map("map", {
    zoomControl: !!state.settings.zoomUI,
  }).setView([lat, lng], zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  heroMarker = L.marker([lat, lng], { icon: createHeroIcon() }).addTo(map);

  renderPins();
  startLocationWatch();
}

function resetMap() {
  if (locationWatchId != null && navigator.geolocation?.clearWatch) {
    try { navigator.geolocation.clearWatch(locationWatchId); } catch {}
    locationWatchId = null;
  }

  if (map) {
    map.remove();
    map = null;
  }

  activeMarkers = {};
  heroMarker = null;
  currentPin = null;

  initMap();
  renderHomeLog();
}

function renderPins() {
  if (!map) return;

  Object.values(activeMarkers).forEach((m) => map.removeLayer(m));
  activeMarkers = {};

  const pins = getCurrentPins();

  pins.forEach((pin) => {
    const marker = L.marker(pin.l, {
      icon: createPinIcon(pin),
    }).addTo(map);

    marker.on("click", () => {
      currentPin = pin;
      showActionButton(true);

      const status = getCaptureStatus(pin);
      updateCaptureText(
        status.fullyCaptured
          ? `${pin.n} • CAPTURED • REPLAY`
          : `${pin.n} • ${status.completedCount}/${status.required}`
      );
    });

    activeMarkers[pin.id] = marker;
  });
}

function refreshAllPinMarkers() {
  Object.keys(activeMarkers).forEach((id) => {
    const pin = getCurrentPins().find((p) => p.id === id);
    if (pin) activeMarkers[id].setIcon(createPinIcon(pin));
  });
}

function showActionButton(show) {
  const btn = $("action-trigger");
  if (!btn) return;
  btn.style.display = show ? "block" : "none";
}

function updateCaptureText(text) {
  const btn = $("action-trigger");
  if (btn) btn.title = text;
}

function distanceInMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)));
}

function startLocationWatch() {
  if (!navigator.geolocation || !map) return;

  locationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      heroMarker?.setLatLng([lat, lng]);

      const pins = getCurrentPins();
      const radius = Number(state.settings.radius || 35);

      let found = null;

      for (const pin of pins) {
        const d = distanceInMeters(lat, lng, pin.l[0], pin.l[1]);
        if (d <= radius) {
          found = pin;
          break;
        }
      }

      currentPin = found;

      if (found) {
        const status = getCaptureStatus(found);
        updateCaptureText(
          status.fullyCaptured
            ? `${found.n} • REPLAY`
            : `${found.n} • ${status.completedCount}/${status.required}`
        );
        showActionButton(true);
      } else {
        showActionButton(false);
      }
    },
    () => {},
    { enableHighAccuracy: true }
  );
}

/* ============================
   MISSION ENTRY
============================ */
function openCurrentPinMission() {
  if (!currentPin) return;

  if (isAbbeyRouteApproachPin(currentPin)) {
    renderAbbeyRouteChoice();
    return;
  }

  if (state.activePack === "adult") {
    openAdultMission(currentPin);
    return;
  }

  openClassicMission(currentPin);
}

function openClassicMission(pin) {
  currentTask = {
    mode: "classic",
    pin,
  };

  renderClassicModeChoices(pin);
  showModal("task-modal");
}

function openAdultMission(pin) {
  const content = getAdultContentForPin(pin);

  if (!content) {
    alert("No content available.");
    return;
  }

  currentTask = {
    mode: "adult",
    pin,
  };

  if ($("adult-title")) $("adult-title").innerText = content.title || pin.n;
  if ($("adult-body")) $("adult-body").innerText = content.text || "";

  showModal("adult-modal");
}

/* ============================
   SHOP
============================ */
function getInventoryCount(id) {
  return Number(state.inventory?.[id] || 0);
}

function addToInventory(id, amount = 1) {
  if (!state.inventory[id]) state.inventory[id] = 0;
  state.inventory[id] += amount;
}

function renderShop() {
  const wrap = $("shop-list");
  if (!wrap) return;

  wrap.innerHTML = SHOP_ITEMS.map(
    (item) => `
    <div class="shop-item">
      <div>${item.name}</div>
      <div>${item.cost} tokens</div>
      <button data-id="${item.id}">BUY</button>
    </div>
  `
  ).join("");

  wrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      buyItem(btn.dataset.id);
    });
  });
}

function buyItem(id) {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return;

  if ((state.meta.tokens || 0) < item.cost) {
    alert("Not enough tokens.");
    return;
  }

  state.meta.tokens -= item.cost;
  addToInventory(id, 1);

  saveState();
  renderShop();
  renderHUD();
}

/* ============================
   UI / RENDER
============================ */
function renderHomeLog() {
  const el = $("home-log");
  if (!el) return;

  const progress = getCurrentModeProgress();

  el.innerText = `Progress: ${progress.completed}/${progress.total}`;
}

function renderEverything() {
  renderHUD();
  renderPins();
  renderShop();
  renderCaptainNotes();
  renderHomeLog();
  refreshAdultLockUI();
}

/* ============================
   BUTTONS
============================ */
function wireButtons() {
  $("action-trigger")?.addEventListener("click", openCurrentPinMission);

  $("btn-reset-map")?.addEventListener("click", resetCurrentMapProgress);

  $("btn-export-save")?.addEventListener("click", exportSaveFile);

  $("btn-import-save")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importSaveFileFromInput(file);
  });
}

/* ============================
   BOOT
============================ */
window.addEventListener("load", () => {
  loadVoices();
  initMap();
  renderEverything();
  wireButtons();
});
