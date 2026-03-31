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
const SAVE_VERSION = 4;
const SAVE_KEY = "bq_world_v20_phase4_boss";
const BACKUP_KEY = "bq_world_v20_phase4_boss_backup";
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

  if (!migrated.bossProgress || typeof migrated.bossProgress !== "object") {
    migrated.bossProgress = {};
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

const BOSS_MODE_PIN_IDS = ["abbey_boss"];

const BOSS_DEFS = {
  abbey_boss: {
    id: "abbey_boss",
    title: "Furness Abbey: The Lost Order Boss Trial",
    badgeName: "Abbey Archivist",
    badgeIcon: "👑",
    rewardImage: "./monk.jpg",
    rewardCaption:
      "You solved the Abbey boss trial and restored the final lost sequence.",
    penalty: {
      coins: 10,
      xp: 5,
    },
    kids: {
      autoOrder: true,
      steps: [
        {
          kind: "story",
          title: "The Abbey Begins",
          text:
            "Long ago, Furness Abbey was founded as a place of worship, work, order, and learning. People came here to live by rules, prayer, and daily routine.",
          reward: { coins: 12, xp: 8 },
        },
        {
          kind: "story",
          title: "Life Inside the Walls",
          text:
            "The monks did not only pray. They worked, farmed, stored knowledge, and kept the Abbey running every day. The place was alive with routine and purpose.",
          reward: { coins: 12, xp: 8 },
        },
        {
          kind: "puzzle",
          title: "Boss Puzzle: Right Call in the Right Order",
          text:
            "Put these in the right order: Founded first, destroyed later. Then the game will add them together for you.",
          options: [
            "1537 then 1127",
            "1127 then 1537",
            "1200 then 1400",
          ],
          answer: 1,
          autoSolve: "sum_found_destroyed",
          autoSolveValue: 2664,
          successText:
            "Correct. Founded first, dissolved later. 1127 + 1537 = 2664.",
          reward: { coins: 30, xp: 18 },
          routeComplete: true,
        },
      ],
    },
    teen: {
      autoOrder: false,
      steps: [
        {
          kind: "story",
          title: "A Powerful Religious House",
          text:
            "Furness Abbey grew into one of the great monastic houses in the region. It was not just a church ruin. It once held wealth, land, structure, labour, and influence.",
          reward: { coins: 12, xp: 8 },
        },
        {
          kind: "story",
          title: "Order and Routine",
          text:
            "Monastic life depended on discipline. Prayer, labour, silence, movement, and duty all followed pattern. The Abbey functioned because structure held it together.",
          reward: { coins: 12, xp: 8 },
        },
        {
          kind: "story",
          title: "A Changing World",
          text:
            "What made the Abbey strong also made it vulnerable when royal power turned against the monasteries. The old system could not survive the coming break.",
          reward: { coins: 12, xp: 8 },
        },
        {
          kind: "puzzle",
          title: "Step Puzzle 1",
          text:
            "What came first in Abbey history?",
          options: [
            "Its destruction",
            "Its founding",
            "Its rediscovery",
          ],
          answer: 1,
          successText: "Yes. The Abbey had to begin before it could fall.",
          reward: { coins: 14, xp: 10 },
        },
        {
          kind: "puzzle",
          title: "Step Puzzle 2",
          text:
            "Which number is the foundation year for the Abbey boss trial?",
          options: ["1127", "1537", "1664"],
          answer: 0,
          successText: "Correct. 1127 is the foundation year used here.",
          reward: { coins: 14, xp: 10 },
        },
        {
          kind: "puzzle",
          title: "Boss Puzzle: Right Call in the Right Order",
          text:
            "Now solve it properly. Enter the numbers in the right order, then add them together.",
          inputMode: "ordered_sum",
          expectedOrder: ["1127", "1537"],
          expectedValue: 2664,
          successText:
            "Correct. 1127 first, 1537 second, total 2664.",
          reward: { coins: 36, xp: 22 },
          routeComplete: true,
        },
      ],
    },
    adult: {
      autoOrder: false,
      steps: [
        {
          kind: "story",
          title: "Foundation",
          text:
            "Furness Abbey was founded in 1127, in an age when monasteries were not passive relics but engines of belief, administration, labour, landholding, and control. The Abbey was a working institution, not merely a sacred shell.",
          reward: { coins: 14, xp: 10 },
        },
        {
          kind: "story",
          title: "Power and Routine",
          text:
            "Inside its walls, routine created power. Prayer ordered the day, but so did labour, storage, supply, discipline, and obedience. The Abbey shaped land, people, and movement. Knowledge survived because a system carried it.",
          reward: { coins: 14, xp: 10 },
        },
        {
          kind: "story",
          title: "Wealth, Authority, and Vulnerability",
          text:
            "Like many major religious houses, Furness Abbey accumulated influence as well as devotion. That strength became a weakness when the Crown moved against monasteries. What had once appeared permanent could be dismantled by force of policy and power.",
          reward: { coins: 14, xp: 10 },
        },
        {
          kind: "story",
          title: "Dissolution",
          text:
            "In 1537, during the Dissolution of the Monasteries, the Abbey’s institutional life was broken. Stone remained, but the living order behind it was cut apart. What survived afterward was ruin, memory, and fragments.",
          reward: { coins: 14, xp: 10 },
        },
        {
          kind: "puzzle",
          title: "Boss Step 1: Chronology",
          text:
            "Choose the correct chronological order.",
          options: [
            "1537 then 1127",
            "1127 then 1537",
            "1127 then 1664",
          ],
          answer: 1,
          successText:
            "Correct. Foundation first. Dissolution later.",
          reward: { coins: 16, xp: 12 },
        },
        {
          kind: "puzzle",
          title: "Boss Step 2: Final Sum",
          text:
            "Now enter the ordered years and give the final total. This is the right call in the right order.",
          inputMode: "ordered_sum",
          expectedOrder: ["1127", "1537"],
          expectedValue: 2664,
          successText:
            "Correct. 1127 + 1537 = 2664. You restored the final sequence.",
          reward: { coins: 42, xp: 28 },
          routeComplete: true,
        },
      ],
    },
  },
};

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

  bossProgress: {},
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
        reward: { coins: 22, xp: 12 },
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
        reward: { coins: 24, xp: 14 },
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
        reward: { coins: 28, xp: 16 },
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
        reward: { coins: 36, xp: 22 },
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
        reward: { coins: 18, xp: 10 },
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
        reward: { coins: 20, xp: 12 },
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
        reward: { coins: 24, xp: 14 },
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
        reward: { coins: 24, xp: 14 },
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
        reward: { coins: 28, xp: 16 },
      },
      {
        title: "Pre-Core Pressure",
        desc: "Answer quickly. What was the Abbey built to protect?",
        storyCategory: "loss",
        story:
          "You’re almost there.\nThis is where mistakes mattered.",
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
        reward: { coins: 34, xp: 20 },
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
        reward: { coins: 150, xp: 100 },
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

function normaliseBossProgress(progress = {}) {
  const out = {};
  Object.entries(progress || {}).forEach(([key, value]) => {
    const safe = value && typeof value === "object" ? value : {};
    out[key] = {
      startedAt: safe.startedAt || null,
      completedAt: safe.completedAt || null,
      currentStep: Number.isFinite(safe.currentStep) ? safe.currentStep : 0,
      failedAttempts: Number.isFinite(safe.failedAttempts)
        ? safe.failedAttempts
        : 0,
      wrongAnswers: Number.isFinite(safe.wrongAnswers)
        ? safe.wrongAnswers
        : 0,
      solved: !!safe.solved,
      unlocked: !!safe.unlocked,
      notes: Array.isArray(safe.notes) ? safe.notes : [],
      enteredOrder: Array.isArray(safe.enteredOrder) ? safe.enteredOrder : [],
      finalAnswer:
        safe.finalAnswer === null || safe.finalAnswer === undefined
          ? ""
          : String(safe.finalAnswer),
    };
  });
  return out;
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
    },

    adultLock: normaliseAdultLock(safe.adultLock || {}),
    route: normaliseRoute(safe.route || null),
    rebuild: normaliseRebuild(safe.rebuild || {}),
    bossProgress: normaliseBossProgress(safe.bossProgress || {}),
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

function saveState() {
  queueSaveState();
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
      tokens: 0,
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
   BOSS SYSTEM
============================ */
function getBossDef(pinId) {
  return BOSS_DEFS[pinId] || null;
}

function ensureBossProgressStore() {
  if (!state.bossProgress || typeof state.bossProgress !== "object") {
    state.bossProgress = {};
  }
  return state.bossProgress;
}

function getBossProgress(pinId) {
  const store = ensureBossProgressStore();
  if (!store[pinId]) {
    store[pinId] = {
      startedAt: null,
      completedAt: null,
      currentStep: 0,
      failedAttempts: 0,
      wrongAnswers: 0,
      solved: false,
      unlocked: false,
      notes: [],
      enteredOrder: [],
      finalAnswer: "",
    };
  }
  return store[pinId];
}

function resetBossProgress(pinId) {
  const store = ensureBossProgressStore();
  store[pinId] = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    currentStep: 0,
    failedAttempts: 0,
    wrongAnswers: 0,
    solved: false,
    unlocked: true,
    notes: [],
    enteredOrder: [],
    finalAnswer: "",
  };
  return store[pinId];
}

function getBossTierKey() {
  const tier = getEffectiveTier();
  if (tier === "kid") return "kids";
  if (tier === "teen") return "teen";
  return "adult";
}

function getBossTierSteps(pinId) {
  const def = getBossDef(pinId);
  if (!def) return [];
  const tierKey = getBossTierKey();
  return Array.isArray(def?.[tierKey]?.steps) ? def[tierKey].steps : [];
}

function getBossPenalty(def) {
  return def?.penalty || { coins: 10, xp: 5 };
}

function isBossPin(pin) {
  return !!pin?.id && BOSS_MODE_PIN_IDS.includes(pin.id);
}

function getBossUnlockSummary(pinId) {
  const progress = getBossProgress(pinId);
  return [
    `Boss Step: ${Number(progress.currentStep || 0) + 1}`,
    `Wrong Answers: ${Number(progress.wrongAnswers || 0)}`,
    `Failed Attempts: ${Number(progress.failedAttempts || 0)}`,
    progress.solved ? "Solved: YES" : "Solved: NO",
  ].join("\n");
}

function showBossProgressBox(pinId) {
  const el = $("boss-progress");
  if (!el) return;
  el.style.display = "block";
  el.innerText = getBossUnlockSummary(pinId);
}

function hideBossProgressBox() {
  const el = $("boss-progress");
  if (!el) return;
  el.style.display = "none";
  el.innerText = "";
}

function setBossSummaryBlock(text = "") {
  const block = $("task-block-boss");
  const body = $("task-boss-summary");
  if (!block || !body) return;

  if (text) {
    block.classList.remove("hidden");
    body.innerText = text;
  } else {
    block.classList.add("hidden");
    body.innerText = "";
  }
}

function awardBossBadge(def) {
  if (!def?.badgeName || hasBadge(def.badgeName)) return false;

  state.meta.badges.push({
    name: def.badgeName,
    icon: def.badgeIcon || "👑",
    captures: 0,
    awardedAt: new Date().toISOString(),
  });

  showBadgePopup({
    name: def.badgeName,
    icon: def.badgeIcon || "👑",
    captures: 0,
  });

  return true;
}

function applyBossPenalty(def) {
  const penalty = getBossPenalty(def);
  const active = getActivePlayer();

  if (active && penalty.coins) {
    updateCoins(active.id, -Math.abs(Number(penalty.coins || 0)));
  }

  state.meta.xp = Math.max(
    0,
    Number(state.meta.xp || 0) - Math.abs(Number(penalty.xp || 0))
  );
}

function completeBossStepReward(step) {
  const active = getActivePlayer();
  const reward = step?.reward || { coins: 0, xp: 0 };

  if (active && reward.coins) {
    updateCoins(active.id, Number(reward.coins || 0));
  }

  state.meta.xp = Number(state.meta.xp || 0) + Number(reward.xp || 0);
}

function openBossMission(pin) {
  const def = getBossDef(pin?.id);
  if (!def) {
    alert("No boss file found for this pin yet.");
    return;
  }

  const progress = resetBossProgress(pin.id);
  const tierKey = getBossTierKey();
  const tierDef = def[tierKey];
  const steps = Array.isArray(tierDef?.steps) ? tierDef.steps : [];

  currentTask = {
    mode: "boss",
    pin,
    question: null,
    boss: {
      pinId: pin.id,
      tier: tierKey,
      stepIndex: Number(progress.currentStep || 0),
      steps,
      def,
    },
  };

  if ($("task-title")) $("task-title").innerText = def.title;
  if ($("task-desc")) {
    $("task-desc").innerText =
      tierKey === "kids"
        ? "Final Abbey trial. Listen, learn, then solve the last order puzzle."
        : tierKey === "teen"
        ? "Final Abbey trial. Follow the history, then solve the chronology and sum."
        : "Final Abbey trial. Recover the full sequence, then solve the ordered sum.";
  }

  clearTaskBlocks();
  setBossSummaryBlock(
    `BOSS ACTIVE\n${pin.n}\n${tierKey.toUpperCase()} TIER\n\nPenalty on wrong answer: -${def.penalty.coins} coins, -${def.penalty.xp} XP`
  );
  showBossProgressBox(pin.id);

  const feedback = $("task-feedback");
  if (feedback) {
    feedback.style.display = "none";
    feedback.innerText = "";
  }

  runBossStep();
  showModal("task-modal");
}

function runBossStep() {
  if (!currentTask?.boss) return;

  const { pinId, steps, stepIndex } = currentTask.boss;
  const step = steps[stepIndex];

  if (!step) {
    finishBossMission();
    return;
  }

  const progress = getBossProgress(pinId);
  progress.currentStep = stepIndex;

  if ($("task-title")) $("task-title").innerText = step.title || "Boss Step";
  if ($("task-desc")) $("task-desc").innerText = step.text || "";

  clearTaskBlocks();
  setBossSummaryBlock(
    `BOSS FILE\n${getBossDef(pinId)?.title || "Boss Trial"}\n\nStep ${stepIndex + 1} of ${steps.length}`
  );

  if (step.kind === "story") {
    setTaskBlock("task-block-story", "task-story", step.text || "");
  }

  showBossProgressBox(pinId);
  renderBossStepOptions(step);
  speakText(step.text || step.title || "Boss step.");
  saveState();
}

function renderBossStepOptions(step) {
  const wrap = $("task-options");
  const readBtn = $("btn-read-answers");
  if (!wrap) return;

  wrap.innerHTML = "";
  wrap.style.display = "grid";

  if (readBtn) {
    if (Array.isArray(step?.options) && step.options.length) {
      readBtn.classList.remove("hidden");
    } else {
      readBtn.classList.add("hidden");
    }
  }

  if (step.kind === "story") {
    const btn = document.createElement("button");
    btn.className = "mcq-btn";
    btn.innerText = "CONTINUE";
    btn.addEventListener("click", () => {
      handleBossStoryAdvance(step);
    });
    wrap.appendChild(btn);
    return;
  }

  if (step.autoSolve === "sum_found_destroyed") {
    const btn = document.createElement("button");
    btn.className = "mcq-btn";
    btn.innerText = "AUTO SOLVE FOR KIDS";
    btn.addEventListener("click", () => {
      handleBossAutoSolve(step);
    });
    wrap.appendChild(btn);
  }

  if (Array.isArray(step?.options) && step.options.length) {
    step.options.forEach((option, index) => {
      const btn = document.createElement("button");
      btn.className = "mcq-btn";
      btn.innerText = option;
      btn.addEventListener("click", () => {
        answerBossOption(index);
      });
      wrap.appendChild(btn);
    });
    return;
  }

  if (step.inputMode === "ordered_sum") {
    wrap.innerHTML = `
      <input
        id="boss-order-input"
        type="text"
        placeholder="Enter years in order, e.g. 1127,1537"
        style="
          width:100%;
          background:#111827;
          color:#fff;
          border:1px solid rgba(255,255,255,0.1);
          border-radius:12px;
          padding:12px;
          font-size:16px;
        "
      />
      <input
        id="boss-total-input"
        type="number"
        placeholder="Enter total"
        style="
          width:100%;
          background:#111827;
          color:#fff;
          border:1px solid rgba(255,255,255,0.1);
          border-radius:12px;
          padding:12px;
          font-size:16px;
        "
      />
      <button class="mcq-btn" id="boss-submit-btn">SUBMIT ANSWER</button>
    `;

    $("boss-submit-btn")?.addEventListener("click", () => {
      answerBossOrderedSum();
    });
    return;
  }

  const fallbackBtn = document.createElement("button");
  fallbackBtn.className = "mcq-btn";
  fallbackBtn.innerText = "CONTINUE";
  fallbackBtn.addEventListener("click", () => {
    handleBossStoryAdvance(step);
  });
  wrap.appendChild(fallbackBtn);
}

function handleBossStoryAdvance(step) {
  if (!currentTask?.boss) return;

  completeBossStepReward(step);
  currentTask.boss.stepIndex += 1;
  saveState();
  renderHUD();
  runBossStep();
}

function handleBossAutoSolve(step) {
  if (!currentTask?.boss) return;

  const feedback = $("task-feedback");
  if (feedback) {
    feedback.style.display = "block";
    feedback.style.color = "var(--neon)";
    feedback.innerText = step.successText || "Solved.";
  }

  completeBossStepReward(step);
  currentTask.boss.stepIndex += 1;
  saveState();
  renderHUD();
  setTimeout(() => runBossStep(), 500);
}

function answerBossOption(index) {
  if (!currentTask?.boss) return;

  const { pinId, steps, stepIndex, def } = currentTask.boss;
  const step = steps[stepIndex];
  const feedback = $("task-feedback");
  const progress = getBossProgress(pinId);

  if (!step || !feedback) return;

  const correct = Number(index) === Number(step.answer);

  if (!correct) {
    progress.wrongAnswers = Number(progress.wrongAnswers || 0) + 1;
    progress.failedAttempts = Number(progress.failedAttempts || 0) + 1;
    applyBossPenalty(def);
    saveState();
    renderHUD();
    showBossProgressBox(pinId);

    feedback.style.display = "block";
    feedback.style.color = "#ff6b6b";
    feedback.innerText = `Wrong answer.\nPenalty: -${def.penalty.coins} coins, -${def.penalty.xp} XP`;
    speakText("Wrong answer. Penalty applied.");
    return;
  }

  completeBossStepReward(step);
  feedback.style.display = "block";
  feedback.style.color = "var(--neon)";
  feedback.innerText = step.successText || "Correct.";
  speakText(step.successText || "Correct.");

  currentTask.boss.stepIndex += 1;
  saveState();
  renderHUD();
  showBossProgressBox(pinId);

  setTimeout(() => runBossStep(), 650);
}

function answerBossOrderedSum() {
  if (!currentTask?.boss) return;

  const { pinId, steps, stepIndex, def } = currentTask.boss;
  const step = steps[stepIndex];
  const feedback = $("task-feedback");
  const progress = getBossProgress(pinId);

  if (!step || !feedback) return;

  const rawOrder = String($("boss-order-input")?.value || "").trim();
  const rawTotal = String($("boss-total-input")?.value || "").trim();

  const normalisedOrder = rawOrder
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const expectedOrder = Array.isArray(step.expectedOrder)
    ? step.expectedOrder
    : [];
  const correctOrder =
    normalisedOrder.length === expectedOrder.length &&
    normalisedOrder.every((value, index) => value === expectedOrder[index]);

  const correctTotal = String(step.expectedValue) === rawTotal;

  progress.enteredOrder = normalisedOrder;
  progress.finalAnswer = rawTotal;

  if (!correctOrder || !correctTotal) {
    progress.wrongAnswers = Number(progress.wrongAnswers || 0) + 1;
    progress.failedAttempts = Number(progress.failedAttempts || 0) + 1;
    applyBossPenalty(def);
    saveState();
    renderHUD();
    showBossProgressBox(pinId);

    feedback.style.display = "block";
    feedback.style.color = "#ff6b6b";
    feedback.innerText =
      `Wrong final sequence.\nPenalty: -${def.penalty.coins} coins, -${def.penalty.xp} XP`;
    speakText("Wrong final sequence. Penalty applied.");
    return;
  }

  completeBossStepReward(step);
  feedback.style.display = "block";
  feedback.style.color = "var(--neon)";
  feedback.innerText = step.successText || "Boss puzzle solved.";
  speakText(step.successText || "Boss puzzle solved.");

  currentTask.boss.stepIndex += 1;
  saveState();
  renderHUD();
  showBossProgressBox(pinId);

  setTimeout(() => runBossStep(), 700);
}

function finishBossMission() {
  if (!currentTask?.boss) return;

  const { pinId, def } = currentTask.boss;
  const progress = getBossProgress(pinId);
  progress.solved = true;
  progress.completedAt = new Date().toISOString();

  const pin = currentTask.pin;
  const active = getActivePlayer();
  const bonus = { coins: 60, xp: 40, tokens: 1 };

  if (active) {
    updateCoins(active.id, bonus.coins);
  }

  state.meta.xp = Number(state.meta.xp || 0) + bonus.xp;
  state.meta.tokens = Number(state.meta.tokens || 0) + bonus.tokens;

  recordMissionCompletion(
    pin,
    "boss",
    bonus,
    `${pinId}_boss_complete`
  );

  awardBossBadge(def);
  checkBadgeUnlocksByCaptures();
  saveCaptainNote(
    `${def.title}\nSolved at ${new Date().toLocaleString()}\nFinal answer: ${progress.finalAnswer || "completed"}`,
    "boss",
    def.title
  );

  saveState();
  renderHUD();
  renderHomeLog();
  renderShop();
  refreshPinMarker(pin);
  showBossProgressBox(pinId);

  const feedback = $("task-feedback");
  if (feedback) {
    feedback.style.display = "block";
    feedback.style.color = "var(--neon)";
    feedback.innerText =
      `BOSS COMPLETE\n+${bonus.coins} coins\n+${bonus.xp} XP\n+${bonus.tokens} token\n\n${def.badgeName} unlocked`;
  }

  showScriptedRewardImage(
    def.title,
    def.rewardCaption,
    def.rewardImage || "./monk.jpg"
  );
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
  setBossSummaryBlock("");
  hideBossProgressBox();

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
  speakText(
    "You’ve made it. Most never get this far. Choose your next move."
  );
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
  setBossSummaryBlock("");
  hideBossProgressBox();
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
  setBossSummaryBlock("");
  hideBossProgressBox();
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
  const reward = step.reward || { coins: 20, xp: 10 };

  if (active && reward.coins) {
    updateCoins(active.id, Number(reward.coins || 0));
  }

  state.meta.xp = Number(state.meta.xp || 0) + Number(reward.xp || 0);
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
  narrationParts.push(
    `${Number(reward.coins || 0)} coins earned and ${Number(reward.xp || 0)} XP.`
  );

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
  setBossSummaryBlock("");
  hideBossProgressBox();
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
    abbey: ["history", "quiz", "logic", "activity", "ghost", "family", "speed", "boss"],
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
    if (isBossPin(pin)) pushUnique("boss");
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

  const chosenModes = pickClassicModesForPin(pin, 7);
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
  const ids = [
    "task-block-story",
    "task-block-evidence",
    "task-block-clue",
    "task-block-boss",
  ];

  ids.forEach((id) => {
    const el = $(id);
    if (el) el.classList.add("hidden");
  });

  if ($("task-story")) $("task-story").innerText = "";
  if ($("task-evidence")) $("task-evidence").innerText = "";
  if ($("task-clue")) $("task-clue").innerText = "";
  if ($("task-boss-summary")) $("task-boss-summary").innerText = "";

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
   MAP
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
    try {
      navigator.geolocation.clearWatch(locationWatchId);
    } catch {}
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
          : `${pin.n} • ${status.completedCount}/${status.required} CAPTURED`
      );

      speakText(
        status.fullyCaptured
          ? `${pin.n}. Fully captured. Replay available.`
          : `${pin.n}. ${status.completedCount} out of ${status.required} captured.`
      );
    });

    activeMarkers[pin.id] = marker;
  });
}

function refreshAllPinMarkers() {
  Object.keys(activeMarkers).forEach((pinId) => {
    const pin = getCurrentPins().find((p) => p.id === pinId);
    if (pin) {
      activeMarkers[pin.id].setIcon(createPinIcon(pin));
    }
  });
}

function refreshPinMarker(pin) {
  if (!pin || !activeMarkers[pin.id]) return;
  activeMarkers[pin.id].setIcon(createPinIcon(pin));
}

function showActionButton(show) {
  const btn = $("action-trigger");
  if (!btn) return;
  btn.style.display = show ? "block" : "none";
}

function updateCaptureText(text) {
  const actionBtn = $("action-trigger");
  if (actionBtn && text) {
    actionBtn.title = text;
  }
}

function distanceInMeters(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
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

      let nearby = null;

      for (const pin of pins) {
        const d = distanceInMeters(lat, lng, pin.l[0], pin.l[1]);
        if (d <= radius) {
          nearby = pin;
          break;
        }
      }

      currentPin = nearby;

      if (nearby) {
        const status = getCaptureStatus(nearby);
        updateCaptureText(
          status.fullyCaptured
            ? `${nearby.n} • CAPTURED • REPLAY`
            : `${nearby.n} • ${status.completedCount}/${status.required} CAPTURED`
        );
        showActionButton(true);
      } else {
        showActionButton(false);
      }
    },
    () => {},
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    }
  );
}

/* ============================
   QUEST FLOW
============================ */
function openMissionMenu() {
  if (!currentPin) return;

  if (isAbbeyRouteApproachPin(currentPin)) {
    renderAbbeyRouteChoice();
    return;
  }

  showQuestLayoutForPack();

  if ($("q-name")) $("q-name").innerText = currentPin.n;

  const status = getCaptureStatus(currentPin);

  if ($("quest-status")) {
    const requiredText = status.mustInclude.length
      ? ` • REQUIRED: ${status.mustInclude.join(", ").toUpperCase()}`
      : "";
    const routeText =
      state.activePack === "classic" && state.mapMode === "abbey"
        ? ` • ${getAbbeyRouteStatusText()}`
        : "";

    $("quest-status").innerText =
      state.activePack === "adult"
        ? `STATUS: CASE MODE • ${String(
            state.activeAdultCategory || "GENERAL"
          ).toUpperCase()} • ${status.completedCount}/${status.required} CAPTURED${
            status.fullyCaptured ? " • FULLY CAPTURED" : ""
          }`
        : `STATUS: ${state.mapMode.toUpperCase()} • ${status.completedCount}/${
            status.required
          } CAPTURED${requiredText}${
            status.fullyCaptured ? " • FULLY CAPTURED" : ""
          }${routeText}`;
  }

  if ($("mode-banner")) {
    $("mode-banner").style.display = "block";

    const label =
      state.activePack === "adult"
        ? "CASE BRIEFING"
        : state.mapMode === "core"
        ? "FULL BARROW"
        : state.mapMode === "park"
        ? "PARK"
        : "ABBEY";

    $("mode-banner").innerText = status.fullyCaptured
      ? `${label}\n${currentPin.n}\nFULLY CAPTURED`
      : `${label}\n${currentPin.n}\n${status.completedCount}/${status.required} CAPTURED`;
  }

  if ($("boss-banner")) {
    const isBoss = currentPin.type === "boss" || isBossPin(currentPin);
    const abbeyCoreOpen =
      state.activePack === "classic" &&
      state.mapMode === "abbey" &&
      getAbbeyRebuild().unlockedCore;

    $("boss-banner").style.display = isBoss || abbeyCoreOpen ? "block" : "none";
    $("boss-banner").innerText = isBoss
      ? "FINAL TRIAL ACTIVE"
      : abbeyCoreOpen
      ? "ABBEY CORE READY"
      : "";
  }

  let storyText = "";

  if (state.activePack === "adult") {
    const content = getAdultContentForPin(currentPin);
    storyText =
      content?.story || "Case briefing not found for this location yet.";
  } else {
    storyText =
      getPinStartIntro(currentPin.id, getEffectiveTier()) ||
      `${currentPin.n}. Mission briefing ready.`;

    renderClassicModeChoices(currentPin);
  }

  if ($("q-story")) {
    $("q-story").innerText = storyText;
  }

  speakText(storyText);
  showModal("quest-modal");
}

function openTask(mode) {
  if (!currentPin) return;

  if (isAbbeyRouteApproachPin(currentPin)) {
    renderAbbeyRouteChoice();
    return;
  }

  if (mode === "boss" && isBossPin(currentPin)) {
    closeModal("quest-modal");
    openBossMission(currentPin);
    return;
  }

  const tier = getEffectiveTier();
  let task = null;

  clearTaskBlocks();
  setBossSummaryBlock("");
  hideBossProgressBox();

  if (state.activePack === "adult") {
    const content = getAdultContentForPin(currentPin);

    const storyText =
      content?.story ||
      "Case briefing not found for this location yet. Add story content for this adult pin.";
    const evidenceText = content?.evidence || "No evidence logged yet.";
    const clueText = content?.clue || "No clue logged yet.";

    if (mode === "read_case") {
      task = {
        title: content?.title || currentPin.event || currentPin.n,
        desc: `Case briefing for ${currentPin.n}`,
        story: storyText,
        evidence: "",
        clue: "",
        options: [],
        meta: { informational: true, rewardCoins: 0 },
        speech: storyText,
      };
    } else if (mode === "evidence") {
      task = {
        title: content?.title || currentPin.event || currentPin.n,
        desc: `Evidence log for ${currentPin.n}`,
        story: "",
        evidence: evidenceText,
        clue: "",
        options: [],
        meta: { informational: true, rewardCoins: 0 },
        speech: evidenceText,
      };
    } else if (mode === "clue") {
      task = {
        title: content?.title || currentPin.event || currentPin.n,
        desc: `Clue file for ${currentPin.n}`,
        story: "",
        evidence: "",
        clue: clueText,
        options: [],
        meta: { informational: true, rewardCoins: 0 },
        speech: clueText,
      };
    } else if (mode === "ar_verify") {
      task = {
        title: content?.title || currentPin.event || currentPin.n,
        desc: "Use AR verify to confirm the hotspot and compare the real place to the case notes.",
        story: "",
        evidence: "Hotspot verification required on site.",
        clue: "Look for details that match the case briefing before you confirm.",
        options: [],
        meta: { informational: true, rewardCoins: 0 },
        speech:
          "Use AR verify to confirm the hotspot and compare the real place to the case notes.",
      };
    } else {
      task = {
        title: content?.title || currentPin.event || currentPin.n,
        desc: `Case file for ${currentPin.n}`,
        story: storyText,
        evidence: evidenceText,
        clue: clueText,
        options: [],
        meta: { informational: true, rewardCoins: 0 },
        speech: storyText,
      };
    }
  } else {
    task = getQA({
      pinId: currentPin.id,
      mode,
      tier,
      zone: currentPin.zone || currentPin.set || state.mapMode,
      salt: Date.now(),
      recentQuestionIds: state.completedQuestionIds || [],
      recentQuestionTags: state.recentQuestionTags || [],
      adaptiveProfile: getCurrentQuizProfile(),
    });
  }

  currentTask = {
    mode,
    pin: currentPin,
    question: task,
    speedStartedAt: null,
  };

  const status = getCaptureStatus(currentPin);

  if ($("task-title")) {
    $("task-title").innerText =
      state.activePack === "adult"
        ? task?.title || currentPin.n
        : `${mode.toUpperCase()} @ ${currentPin.n}`;
  }

  if ($("task-desc")) {
    const requiredText = status.mustInclude.includes(mode)
      ? `\n\nREQUIRED FOR FULL CAPTURE`
      : "";
    const doneText = isModeCompletedForPin(currentPin, mode)
      ? `\n\nTHIS MODE ALREADY COMPLETED`
      : "";
    $("task-desc").innerText =
      (task?.desc || task?.q || "No mission found for this location.") +
      requiredText +
      doneText;
  }

  setTaskBlock("task-block-story", "task-story", task?.story || "");
  setTaskBlock("task-block-evidence", "task-evidence", task?.evidence || "");
  setTaskBlock("task-block-clue", "task-clue", task?.clue || "");

  renderTaskOptions(task);

  if (task?.speech) {
    speakText(task.speech);
  } else if (task?.q) {
    speakText(task.q);
  } else {
    speakText("No mission found.");
  }

  showModal("task-modal");
}

function buildManualTaskButtons(question) {
  const wrap = $("task-options");
  const readBtn = $("btn-read-answers");
  if (!wrap || !currentTask) return;

  wrap.innerHTML = "";
  wrap.style.display = "grid";
  if (readBtn) readBtn.classList.add("hidden");

  const mode = currentTask.mode;

  if (mode === "speed") {
    const startBtn = document.createElement("button");
    startBtn.className = "mcq-btn";
    startBtn.innerText = "START SPEED TIMER";
    startBtn.addEventListener("click", () => {
      currentTask.speedStartedAt = Date.now();
      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").style.color = "var(--gold)";
        $("task-feedback").innerText =
          "Speed timer started. Finish within 20 seconds.";
      }
      speakText("Speed timer started.");
    });

    const completeBtn = document.createElement("button");
    completeBtn.className = "mcq-btn";
    completeBtn.innerText = "COMPLETE SPEED TASK";
    completeBtn.addEventListener("click", () => completeCurrentTaskManually());

    wrap.appendChild(startBtn);
    wrap.appendChild(completeBtn);
    return;
  }

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "mcq-btn";

  if (mode === "activity") confirmBtn.innerText = "CONFIRM ACTIVITY COMPLETE";
  else if (mode === "family") confirmBtn.innerText = "CONFIRM FAMILY COMPLETE";
  else if (mode === "history") confirmBtn.innerText = "MARK HISTORY COMPLETE";
  else confirmBtn.innerText = "CONFIRM COMPLETE";

  confirmBtn.addEventListener("click", () => completeCurrentTaskManually());
  wrap.appendChild(confirmBtn);
}

function renderTaskOptions(question) {
  const wrap = $("task-options");
  const readBtn = $("btn-read-answers");
  if (!wrap) return;

  wrap.innerHTML = "";

  const hasOptions = Array.isArray(question?.options) && question.options.length;

  if (!hasOptions) {
    buildManualTaskButtons(question);
    if ($("task-feedback")) {
      $("task-feedback").style.display = "none";
      $("task-feedback").innerText = "";
    }
    return;
  }

  wrap.style.display = "grid";

  question.options.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.className = "mcq-btn";
    btn.innerText = option;
    btn.addEventListener("click", () => answerMission(index));
    wrap.appendChild(btn);
  });

  if (readBtn) {
    readBtn.classList.remove("hidden");
  }

  if ($("task-feedback")) {
    $("task-feedback").style.display = "none";
    $("task-feedback").innerText = "";
  }
}

/* ============================
   MYSTERIES
============================ */
function hasUnlockedMystery(id) {
  return state.unlockedMysteries.includes(Number(id));
}

function unlockMystery(id) {
  const num = Number(id);
  if (!Number.isFinite(num)) return;
  if (!hasUnlockedMystery(num)) {
    state.unlockedMysteries.push(num);
    saveState();
  }
}

function maybeUnlockMystery() {
  const chance = 0.35;
  if (Math.random() > chance) return null;

  const mystery = getRandomMystery(state.unlockedMysteries);
  if (!mystery) return null;

  unlockMystery(mystery.id);
  return mystery;
}

/* ============================
   SHOP
============================ */
function getInventoryCount(itemId) {
  return Number(state.inventory?.[itemId] || 0);
}

function markPurchased(itemId) {
  if (!state.purchasedItems.includes(itemId)) {
    state.purchasedItems.push(itemId);
  }
}

function addInventory(itemId, qty = 1) {
  state.inventory[itemId] = getInventoryCount(itemId) + qty;
  markPurchased(itemId);
}

function renderShop() {
  const summary = $("shop-summary");
  const list = $("shop-list");
  const inventory = $("shop-inventory");
  const active = getActivePlayer();

  if (!summary || !list || !inventory) return;

  const coins = active?.coins || 0;
  const xp = Number(state.meta?.xp || 0);
  const level = getLevelFromXP(xp);
  const levelProgress = getLevelProgress(xp);
  const badges = Array.isArray(state.meta?.badges) ? state.meta.badges : [];
  const abbey = getAbbeyRebuild();

  summary.innerHTML = `
    <div style="padding:10px;border:1px solid #333;border-radius:12px;background:#111;">
      <strong>${active?.name || "Player"}</strong><br>
      Coins: ${coins} 🪙<br>
      XP: ${xp} (Level ${level})<br>
      Level Progress: ${levelProgress}/100<br>
      Badges: ${badges.length}<br>
      Abbey Rebuild: ${abbey.points}
    </div>
  `;

  const ownedItems = SHOP_ITEMS.filter((item) => getInventoryCount(item.id) > 0);

  const badgeBlock = badges.length
    ? `
      <div style="margin-top:10px;">
        ${badges
          .map(
            (badge) => `
          <div style="border:1px solid #333;border-radius:14px;padding:12px;background:#111;margin-bottom:10px;">
            <div style="font-weight:bold;">${badge.icon} ${badge.name}</div>
            <div style="font-size:12px;opacity:.82;margin-top:6px;">${
              badge.captures
                ? `${badge.captures} node${badge.captures === 1 ? "" : "s"}`
                : "special unlock"
            }</div>
          </div>
        `
          )
          .join("")}
      </div>
    `
    : "";

  inventory.innerHTML =
    (ownedItems.length
      ? ownedItems
          .map(
            (item) => `
        <div style="border:1px solid #333;border-radius:14px;padding:12px;background:#111;margin-bottom:10px;">
          <div style="font-weight:bold;">${item.name}</div>
          <div style="font-size:12px;opacity:.82;margin-top:6px;">Owned: ${getInventoryCount(
            item.id
          )}</div>
        </div>
      `
          )
          .join("")
      : `<div style="opacity:.8;">No purchases yet.</div>`) + badgeBlock;

  list.innerHTML = SHOP_ITEMS.map((item) => {
    const owned = getInventoryCount(item.id);
    return `
      <div class="shop-item">
        <div class="shop-item-top">
          <div>
            <div style="font-weight:bold;">${item.name}</div>
            <div style="font-size:12px;opacity:.85;margin-top:6px;">${item.desc}</div>
          </div>
          <div class="shop-cost">${item.cost} 🪙</div>
        </div>
        ${owned > 0 ? `<div class="owned-tag">OWNED: ${owned}</div>` : ""}
        <button class="win-btn shop-buy-btn" data-shop-id="${item.id}" style="margin-top:12px;">
          BUY
        </button>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".shop-buy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.shopId;
      buyShopItem(itemId);
    });
  });
}

function buyShopItem(itemId) {
  const item = SHOP_ITEMS.find((x) => x.id === itemId);
  const active = getActivePlayer();
  if (!item || !active) return;

  if ((active.coins || 0) < item.cost) {
    speakText("Not enough coins.");
    alert("Not enough coins.");
    return;
  }

  updateCoins(active.id, -item.cost);
  addInventory(item.id, 1);
  saveState();
  renderHUD();
  renderShop();
  refreshAllPinMarkers();

  speakText(`${item.name} purchased.`);
  alert(`${item.name} purchased and added to inventory.`);
}

/* ============================
   ANSWERS / REWARDS
============================ */
function rememberQuestion(questionId) {
  if (!questionId) return;
  if (!state.completedQuestionIds.includes(questionId)) {
    state.completedQuestionIds.push(questionId);
    if (state.completedQuestionIds.length > 300) {
      state.completedQuestionIds = state.completedQuestionIds.slice(-300);
    }
  }
}

function speakRewardSequence({
  factText,
  rewardCoins,
  rewardXp,
  newLevel,
  oldLevel,
  fullCaptureJustUnlocked,
}) {
  const mode = getRewardPresentationMode();
  const levelUpText =
    newLevel > oldLevel ? ` You reached level ${newLevel}.` : "";
  const captureText = fullCaptureJustUnlocked
    ? " Node fully captured."
    : " Progress saved.";

  if (mode === "kid") {
    const line = `${factText}. You earned ${rewardCoins} coins and ${rewardXp} XP.${captureText}${levelUpText}`;
    speakText(line);
    return 1200;
  }

  if (mode === "teen") {
    const intro = `Correct. You earned ${rewardCoins} coins and ${rewardXp} XP.`;
    const fact = factText ? ` ${factText}.` : "";
    const level = levelUpText ? ` ${levelUpText.trim()}` : "";
    speakText(`${intro}${fact}${captureText}${level}`);
    return 1100;
  }

  const adultLine = `${factText}.${captureText}${levelUpText} You earned ${rewardCoins} coins and ${rewardXp} XP.`;
  speakText(adultLine);
  return 1500;
}

function applyMissionOutcome({
  isCorrect = true,
  manual = false,
}) {
  if (!currentTask) return;

  const q = currentTask.question || {};
  const feedback = $("task-feedback");
  const pin = currentTask.pin;
  const mode = currentTask.mode;

  if (!pin || !feedback) return;

  const wasAlreadyDone = isModeCompletedForPin(pin, mode);
  const missionReward = getMissionReward({
    mode,
    isNewMode: !wasAlreadyDone,
  });

  const questionId = q?.meta?.questionId || q?.id || null;
  const active = getActivePlayer();

  if (active && missionReward.coins) {
    updateCoins(active.id, missionReward.coins);
  }

  const oldLevel = getLevelFromXP(Number(state.meta.xp || 0));
  state.meta.xp = Number(state.meta.xp || 0) + Number(missionReward.xp || 0);
  state.meta.tokens =
    Number(state.meta.tokens || 0) + Number(missionReward.tokens || 0);

  const missionRecord = recordMissionCompletion(
    pin,
    mode,
    missionReward,
    questionId
  );

  let rewardCoins = Number(missionReward.coins || 0);
  let rewardXp = Number(missionReward.xp || 0);
  let rewardTokens = Number(missionReward.tokens || 0);

  if (missionRecord.fullCaptureJustUnlocked) {
    const bonus = getFullCaptureBonus(pin);
    rewardCoins += Number(bonus.coins || 0);
    rewardXp += Number(bonus.xp || 0);
    rewardTokens += Number(bonus.tokens || 0);

    if (active && bonus.coins) {
      updateCoins(active.id, bonus.coins);
    }

    state.meta.xp = Number(state.meta.xp || 0) + Number(bonus.xp || 0);
    state.meta.tokens =
      Number(state.meta.tokens || 0) + Number(bonus.tokens || 0);
  }

  const newLevel = getLevelFromXP(Number(state.meta.xp || 0));

  rememberQuestion(questionId);
  rememberQuestionTags(q?.meta?.tags || []);

  if (mode === "quiz") {
    const tier = getEffectiveTier();
    const currentProfile =
      state.quizProfiles?.[tier] || getDefaultAdaptiveProfile(tier);

    state.quizProfiles[tier] = updateAdaptiveProfile(currentProfile, {
      tier,
      isCorrect,
      difficulty: q?.meta?.difficulty,
      tags: q?.meta?.tags || [],
      questionId,
    });
  }

  const mystery = missionRecord.fullCaptureJustUnlocked ? maybeUnlockMystery() : null;

  checkBadgeUnlocksByCaptures();

  saveState();
  renderHUD();
  renderShop();
  renderHomeLog();
  refreshPinMarker(pin);
  renderClassicModeChoices(pin);

  const status = getCaptureStatus(pin);
  const factText = q.fact || q.desc || "Mission complete.";

  feedback.style.display = "block";
  feedback.style.color = "var(--neon)";

  const lines = [];
  lines.push(wasAlreadyDone ? "MODE REPLAY COMPLETE" : "MODE COMPLETE");
  lines.push(`${status.completedCount}/${status.required} CAPTURED`);

  if (status.missingRequired.length) {
    lines.push(`Still required: ${status.missingRequired.join(", ")}`);
  }

  lines.push("");
  lines.push(factText);
  lines.push("");
  lines.push(`+${rewardCoins} coins`);
  lines.push(`+${rewardXp} XP`);
  if (rewardTokens) lines.push(`+${rewardTokens} tokens`);

  if (missionRecord.fullCaptureJustUnlocked) {
    lines.push("");
    lines.push("FULL NODE CAPTURE COMPLETE");
  }

  if (mystery) {
    lines.push("");
    lines.push(`BONUS MYSTERY UNLOCKED`);
    lines.push(`${mystery.icon || "❓"} ${mystery.title}`);
  }

  feedback.innerText = lines.join("\n");

  const imageDelay = speakRewardSequence({
    factText,
    rewardCoins,
    rewardXp,
    newLevel,
    oldLevel,
    fullCaptureJustUnlocked: missionRecord.fullCaptureJustUnlocked,
  });

  if (missionRecord.fullCaptureJustUnlocked) {
    setTimeout(() => {
      showRewardImage(pin, factText);
    }, imageDelay);
  }
}

function answerMission(index) {
  if (!currentTask) return;

  const q = currentTask.question;
  const feedback = $("task-feedback");
  if (!feedback) return;

  if (!Array.isArray(q?.options) || typeof q.answer !== "number") {
    feedback.style.display = "none";
    return;
  }

  const correct = index === q.answer;
  feedback.style.display = "block";

  if (!correct) {
    const correctAnswer =
      Array.isArray(q.options) && q.options[q.answer] != null
        ? q.options[q.answer]
        : "Unknown";

    feedback.style.color = "#ff6b6b";
    feedback.innerText = `Wrong answer.\nCorrect answer: ${correctAnswer}`;
    speakText(`Wrong answer. The correct answer is ${correctAnswer}.`);

    if (currentTask.mode === "quiz") {
      const tier = getEffectiveTier();
      const currentProfile =
        state.quizProfiles?.[tier] || getDefaultAdaptiveProfile(tier);

      state.quizProfiles[tier] = updateAdaptiveProfile(currentProfile, {
        tier,
        isCorrect: false,
        difficulty: q?.meta?.difficulty,
        tags: q?.meta?.tags || [],
        questionId: q?.meta?.questionId || q?.id || null,
      });

      rememberQuestionTags(q?.meta?.tags || []);
      saveState();
    }

    return;
  }

  applyMissionOutcome({ isCorrect: true });
}

function completeCurrentTaskManually() {
  if (!currentTask) return;

  const feedback = $("task-feedback");
  if (!feedback) return;

  if (currentTask.mode === "speed") {
    if (!currentTask.speedStartedAt) {
      feedback.style.display = "block";
      feedback.style.color = "#ff6b6b";
      feedback.innerText = "Start the speed timer first.";
      speakText("Start the speed timer first.");
      return;
    }

    const elapsed = Date.now() - currentTask.speedStartedAt;
    if (elapsed > 20000) {
      feedback.style.display = "block";
      feedback.style.color = "#ff6b6b";
      feedback.innerText = "Speed task failed. Time ran out.";
      speakText("Speed task failed. Time ran out.");
      return;
    }
  }

  applyMissionOutcome({ isCorrect: true, manual: true });
}

/* ============================
   SETTINGS / HOME
============================ */
function applySettingsToUI() {
  if ($("radius-label")) $("radius-label").innerText = state.settings.radius;
  if ($("pitch-label")) $("pitch-label").innerText = state.settings.voicePitch;
  if ($("rate-label")) $("rate-label").innerText = state.settings.voiceRate;
  if ($("sfx-label")) $("sfx-label").innerText = state.settings.sfxVol;
  if ($("zoomui-label"))
    $("zoomui-label").innerText = state.settings.zoomUI ? "ON" : "OFF";

  if ($("enter-radius")) $("enter-radius").value = state.settings.radius;
  if ($("v-pitch")) $("v-pitch").value = state.settings.voicePitch;
  if ($("v-rate")) $("v-rate").value = state.settings.voiceRate;
  if ($("sfx-vol")) $("sfx-vol").value = state.settings.sfxVol;
  if ($("char-select")) $("char-select").value = state.settings.character;
  if ($("tier-mode")) $("tier-mode").value = state.tierMode || "kid";
}

function renderHomeLog() {
  const summary = $("home-summary");
  const list = $("home-list");
  if (!summary || !list) return;

  const pins = getCurrentPins();
  const mysteryCount = state.unlockedMysteries?.length || 0;
  const completedCount = state.completedQuestionIds?.length || 0;
  const currentProgress = getCurrentModeProgress();
  const xp = Number(state.meta?.xp || 0);
  const level = getLevelFromXP(xp);
  const levelProgress = getLevelProgress(xp);
  const tier = getEffectiveTier();
  const quizProfile = getCurrentQuizProfile();
  const badges = Array.isArray(state.meta?.badges) ? state.meta.badges : [];
  const lock = getAdultLock();
  const abbey = getAbbeyRebuild();
  const route = state.route;
  const noteCount = Array.isArray(state.captainNotes) ? state.captainNotes.length : 0;
  const bossSolvedCount = Object.values(state.bossProgress || {}).filter(
    (x) => x?.solved
  ).length;

  summary.innerHTML = `
    <div style="padding:12px;border:1px solid #444;border-radius:14px;background:#111;line-height:1.6;">
      <div><strong>LEVEL:</strong> ${level}</div>
      <div><strong>XP:</strong> ${xp} (${levelProgress}/100 to next level)</div>
      <div><strong>BADGES:</strong> ${badges.length}</div>
      <div><strong>FULL NODES CAPTURED:</strong> ${Number(
        state.pinStats?.totalFirstCompletions || 0
      )}</div>
      <div><strong>PACK:</strong> ${state.activePack}</div>
      <div><strong>MODE:</strong> ${state.mapMode}</div>
      <div><strong>TIER:</strong> ${tier}</div>
      <div><strong>ADULT LOCK:</strong> ${
        lock.unlocked ? "UNLOCKED" : "LOCKED"
      }</div>
      <div><strong>QUIZ RATING:</strong> ${Number(quizProfile.rating || 0)}</div>
      <div><strong>QUIZ STREAK:</strong> ${Number(quizProfile.streak || 0)}</div>
      <div><strong>QUIZ CONFIDENCE:</strong> ${Math.round(
        Number(quizProfile.confidence || 0) * 100
      )}%</div>
      <div><strong>PINS LOADED:</strong> ${pins.length}</div>
      <div><strong>MODE FULLY CAPTURED:</strong> ${currentProgress.completed}/${currentProgress.total} (${currentProgress.percent}%)</div>
      <div><strong>MODE REMAINING:</strong> ${currentProgress.remaining}</div>
      <div><strong>MYSTERIES UNLOCKED:</strong> ${mysteryCount}</div>
      <div><strong>COMPLETED PROMPTS TRACKED:</strong> ${completedCount}</div>
      <div><strong>CAPTAIN NOTES:</strong> ${noteCount}</div>
      <div><strong>ABBEY REBUILD:</strong> ${abbey.points} (Stage ${abbey.stage})</div>
      <div><strong>ABBEY ROUTES COMPLETE:</strong> ${
        abbey.completedRoutes.length ? abbey.completedRoutes.join(", ") : "none"
      }</div>
      <div><strong>ACTIVE ROUTE:</strong> ${
        route?.path ? `${route.path} step ${Number(route.step || 0) + 1}` : "none"
      }</div>
      <div><strong>BOSS TRIALS SOLVED:</strong> ${bossSolvedCount}</div>
    </div>
  `;

  const mysteryBlock = mysteryCount
    ? `
      <div style="padding:10px;border:1px solid #444;border-radius:12px;margin:8px 0 14px;background:#161616;">
        <div style="font-weight:bold;color:var(--gold);">UNLOCKED MYSTERIES</div>
        <div style="margin-top:6px;font-size:13px;opacity:.9;">
          ${state.unlockedMysteries.map((id) => `#${id}`).join(", ")}
        </div>
      </div>
    `
    : `
      <div style="padding:10px;border:1px solid #333;border-radius:12px;margin:8px 0 14px;background:#111;">
        <div style="font-weight:bold;color:var(--gold);">UNLOCKED MYSTERIES</div>
        <div style="margin-top:6px;font-size:13px;opacity:.85;">None yet.</div>
      </div>
    `;

  const badgeBlock = badges.length
    ? `
      <div style="padding:10px;border:1px solid #444;border-radius:12px;margin:8px 0 14px;background:#161616;">
        <div style="font-weight:bold;color:var(--gold);">NODE BADGES</div>
        <div style="margin-top:8px;font-size:13px;line-height:1.6;">
          ${badges
            .map(
              (b) =>
                `${b.icon} ${b.name} ${
                  b.captures ? `(${b.captures} node${b.captures === 1 ? "" : "s"})` : ""
                }`
            )
            .join("<br>")}
        </div>
      </div>
    `
    : "";

  const clueBlock =
    route?.clues?.length
      ? `
    <div style="padding:10px;border:1px solid #444;border-radius:12px;margin:8px 0 14px;background:#161616;">
      <div style="font-weight:bold;color:var(--gold);">ACTIVE ROUTE CLUES</div>
      <div style="margin-top:8px;font-size:13px;line-height:1.6;">
        ${route.clues
          .map((c) => `${c.value} — ${c.saveLabel || c.title || "clue"}`)
          .join("<br>")}
      </div>
    </div>
  `
      : "";

  const bossBlock = Object.keys(state.bossProgress || {}).length
    ? `
      <div style="padding:10px;border:1px solid #444;border-radius:12px;margin:8px 0 14px;background:#161616;">
        <div style="font-weight:bold;color:var(--gold);">BOSS FILES</div>
        <div style="margin-top:8px;font-size:13px;line-height:1.6;">
          ${Object.entries(state.bossProgress)
            .map(
              ([key, value]) =>
                `${key} — ${value?.solved ? "SOLVED" : "IN PROGRESS"} • wrong ${Number(
                  value?.wrongAnswers || 0
                )}`
            )
            .join("<br>")}
        </div>
      </div>
    `
    : "";

  list.innerHTML =
    mysteryBlock +
    badgeBlock +
    clueBlock +
    bossBlock +
    pins
      .slice(0, 50)
      .map((pin) => {
        const status = getCaptureStatus(pin);
        return `
        <div style="padding:10px;border:1px solid #333;border-radius:12px;margin:8px 0;background:${
          status.fullyCaptured ? "rgba(77,255,158,0.08)" : "#111"
        };">
          <div style="font-weight:bold;">${
            status.fullyCaptured ? "✅ " : ""
          }${pin.n}</div>
          <div style="opacity:.85;font-size:12px;">${
            pin.zone || pin.set || pin.category || "unknown"
          }</div>
          <div style="margin-top:6px;font-size:12px;opacity:.82;">
            ${status.completedCount}/${status.required} captured${
              status.mustInclude.length
                ? ` • required: ${status.mustInclude.join(", ")}`
                : ""
            }${isBossPin(pin) ? " • boss trial" : ""}
          </div>
        </div>
      `;
      })
      .join("");
}

function updateStartButtons() {
  $("pill-full")?.classList.toggle(
    "active",
    state.activePack === "classic" && state.mapMode === "core"
  );
  $("pill-park")?.classList.toggle(
    "active",
    state.activePack === "classic" && state.mapMode === "park"
  );
  $("pill-docks")?.classList.toggle(
    "active",
    state.activePack === "classic" && state.mapMode === "abbey"
  );

  $("pill-kids")?.classList.toggle("active", state.tierMode === "kid");
  $("pill-teen")?.classList.toggle("active", state.tierMode === "teen");

  $("pill-truecrime")?.classList.toggle(
    "active",
    state.activePack === "adult" && state.activeAdultCategory === "true_crime"
  );
  $("pill-conspiracy")?.classList.toggle(
    "active",
    state.activePack === "adult" && state.activeAdultCategory === "conspiracy"
  );
  $("pill-history")?.classList.toggle(
    "active",
    state.activePack === "adult" && state.activeAdultCategory === "history"
  );
}

/* ============================
   AR
============================ */
async function openAR() {
  showModal("ar-modal");

  if ($("ar-readout")) {
    $("ar-readout").innerText = currentPin
      ? `Scanning around ${currentPin.n}`
      : "Scanning...";
  }

  const video = $("ar-video");
  if (!video || !navigator.mediaDevices?.getUserMedia) return;

  try {
    arStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    video.srcObject = arStream;
  } catch (err) {
    console.warn("AR camera failed:", err);
    if ($("ar-readout")) $("ar-readout").innerText = "Camera access failed.";
  }
}

function stopAR() {
  const video = $("ar-video");
  if (video && video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
    video.srcObject = null;
  }
  arStream = null;
}

/* ============================
   RENDER ALL / FULL REFRESH
============================ */
function renderEverything() {
  renderHUD();
  applySettingsToUI();
  updateStartButtons();
  refreshAdultLockUI();
  showQuestLayoutForPack();
  renderHomeLog();
  renderShop();
  renderCaptainNotes();

  if (map) {
    refreshAllPinMarkers();
  }
}

/* ============================
   BUTTONS
============================ */
function wireButtons() {
  $("btn-start")?.addEventListener("click", () => closeModal("start-modal"));
  $("btn-start-close")?.addEventListener("click", () =>
    closeModal("start-modal")
  );
  $("btn-start-close-x")?.addEventListener("click", () =>
    closeModal("start-modal")
  );

  $("btn-home")?.addEventListener("click", () => {
    currentPin = null;
    currentTask = null;

    const actionBtn = $("action-trigger");
    if (actionBtn) actionBtn.style.display = "none";

    state.activePack = "classic";
    state.activeAdultCategory = null;
    state.mapMode = "core";
    clearAdultSessionApproval();
    clearActiveRoute();

    saveState();
    updateStartButtons();
    refreshAdultLockUI();
    resetMap();
    showModal("start-modal");
  });

  $("btn-shop")?.addEventListener("click", () => {
    renderShop();
    showModal("shop-modal");
    speakText("Shop opened.");
  });

  $("btn-shop-close")?.addEventListener("click", () =>
    closeModal("shop-modal")
  );
  $("btn-shop-close-x")?.addEventListener("click", () =>
    closeModal("shop-modal")
  );

  $("btn-home-close")?.addEventListener("click", () =>
    closeModal("home-modal")
  );
  $("btn-home-close-x")?.addEventListener("click", () =>
    closeModal("home-modal")
  );

  $("btn-settings")?.addEventListener("click", () => {
    showModal("settings-modal");
    speakText("System config opened.");
  });

  $("btn-open-settings")?.addEventListener("click", () => {
    showModal("settings-modal");
    speakText("System config opened.");
  });

  $("btn-close-settings")?.addEventListener("click", () =>
    closeModal("settings-modal")
  );
  $("btn-close-settings-x")?.addEventListener("click", () =>
    closeModal("settings-modal")
  );

  $("btn-commander")?.addEventListener("click", () => {
    renderHomeLog();
    renderCaptainNotes();
    showModal("commander-hub");
    speakText("Commander hub opened.");
  });

  $("btn-close-commander")?.addEventListener("click", () =>
    closeModal("commander-hub")
  );
  $("btn-close-commander-x")?.addEventListener("click", () =>
    closeModal("commander-hub")
  );

  $("btn-send-broadcast")?.addEventListener("click", sendBroadcastMessage);
  $("btn-save-captain-note")?.addEventListener("click", handleSaveCaptainNote);

  $("btn-close-quest")?.addEventListener("click", () =>
    closeModal("quest-modal")
  );
  $("btn-task-close")?.addEventListener("click", () =>
    closeModal("task-modal")
  );

  $("btn-read-answers")?.addEventListener("click", () => {
    if (currentTask?.mode === "boss") {
      const step =
        currentTask?.boss?.steps?.[Number(currentTask?.boss?.stepIndex || 0)];
      if (step?.options?.length) {
        speakOptions(step.options);
      }
      return;
    }

    if (currentTask?.question?.options?.length) {
      speakOptions(currentTask.question.options);
    }
  });

  $("btn-reward-image-close")?.addEventListener("click", closeRewardImageModal);
  $("btn-reward-image-close-x")?.addEventListener(
    "click",
    closeRewardImageModal
  );

  $("action-trigger")?.addEventListener("click", openMissionMenu);

  $("pill-full")?.addEventListener("click", () => {
    state.activePack = "classic";
    state.mapMode = "core";
    state.activeAdultCategory = null;
    clearActiveRoute();
    saveState();
    updateStartButtons();
    refreshAdultLockUI();
    resetMap();
    speakText("Full Barrow selected.");
  });

  $("pill-park")?.addEventListener("click", () => {
    state.activePack = "classic";
    state.mapMode = "park";
    state.activeAdultCategory = null;
    clearActiveRoute();
    saveState();
    updateStartButtons();
    refreshAdultLockUI();
    resetMap();
    speakText("Park selected.");
  });

  $("pill-docks")?.addEventListener("click", () => {
    state.activePack = "classic";
    state.mapMode = "abbey";
    state.activeAdultCategory = null;
    clearActiveRoute();
    saveState();
    updateStartButtons();
    refreshAdultLockUI();
    resetMap();
    speakText("Abbey selected.");
  });

  $("pill-truecrime")?.addEventListener("click", () => {
    openAdultCategory("true_crime", "True crime");
  });

  $("pill-conspiracy")?.addEventListener("click", () => {
    openAdultCategory("conspiracy", "Conspiracy");
  });

  $("pill-history")?.addEventListener("click", () => {
    openAdultCategory("history", "History");
  });

  $("pill-kids")?.addEventListener("click", () => {
    state.tierMode = "kid";
    state.activePack = "classic";
    state.activeAdultCategory = null;
    clearAdultSessionApproval();
    saveState();
    updateStartButtons();
    refreshAdultLockUI();
    speakText("Kids mode selected.");
  });

  $("pill-teen")?.addEventListener("click", () => {
    state.tierMode = "teen";
    saveState();
    updateStartButtons();
    refreshAdultLockUI();
    speakText("Teen mode selected.");
  });

  $("tier-mode")?.addEventListener("change", (e) => {
    state.tierMode = e.target.value;
    if (state.tierMode === "kid") {
      clearAdultSessionApproval();
      if (state.activePack === "adult") {
        state.activePack = "classic";
        state.activeAdultCategory = null;
        resetMap();
      }
    }
    saveState();
    refreshAdultLockUI();
  });

  document.querySelectorAll(".m-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const mode = tile.dataset.mode;
      if (!mode || mode === "battle") return;
      closeModal("quest-modal");
      openTask(mode);
    });
  });

  $("adult-read-case")?.addEventListener("click", () => {
    closeModal("quest-modal");
    openTask("read_case");
  });

  $("adult-view-evidence")?.addEventListener("click", () => {
    closeModal("quest-modal");
    openTask("evidence");
  });

  $("adult-view-clue")?.addEventListener("click", () => {
    closeModal("quest-modal");
    openTask("clue");
  });

  $("adult-ar-verify")?.addEventListener("click", () => {
    closeModal("quest-modal");
    openTask("ar_verify");
  });

  $("btn-player-1")?.addEventListener("click", () => setPlayerCount(1));
  $("btn-player-2")?.addEventListener("click", () => setPlayerCount(2));
  $("btn-player-3")?.addEventListener("click", () => setPlayerCount(3));
  $("btn-player-4")?.addEventListener("click", () => setPlayerCount(4));

  $("btn-hp-k")?.addEventListener("click", () => {
    const p = getEnabledPlayers()[0];
    if (p) setActivePlayer(p.id);
  });

  $("btn-hp-p")?.addEventListener("click", () => {
    const p = getEnabledPlayers()[1] || getEnabledPlayers()[0];
    if (p) setActivePlayer(p.id);
  });

  $("btn-swap")?.addEventListener("click", () => {
    const enabled = getEnabledPlayers();
    if (enabled.length >= 2) {
      const tmp = enabled[0].name;
      enabled[0].name = enabled[1].name;
      enabled[1].name = tmp;
      saveState();
      renderHUD();
      renderShop();
      speakText("Players swapped.");
    }
  });

  $("btn-night")?.addEventListener("click", () => {
    nightVisionOn = !nightVisionOn;
    $("map")?.classList.toggle("night-vision", nightVisionOn);
    speakText(nightVisionOn ? "Night vision on." : "Night vision off.");
  });

  $("btn-zoom-ui")?.addEventListener("click", () => {
    state.settings.zoomUI = !state.settings.zoomUI;
    saveState();
    applySettingsToUI();
    resetMap();
    speakText(state.settings.zoomUI ? "Zoom buttons on." : "Zoom buttons off.");
  });

  $("btn-test")?.addEventListener("click", () => {
    alert("Systems are responding.");
    speakText("Systems are responding.");
  });

  $("enter-radius")?.addEventListener("input", (e) => {
    state.settings.radius = Number(e.target.value);
    saveState();
    applySettingsToUI();
  });

  $("v-pitch")?.addEventListener("input", (e) => {
    state.settings.voicePitch = Number(e.target.value);
    saveState();
    applySettingsToUI();
    speakText(`Voice pitch ${state.settings.voicePitch}`);
  });

  $("v-rate")?.addEventListener("input", (e) => {
    state.settings.voiceRate = Number(e.target.value);
    saveState();
    applySettingsToUI();
    speakText(`Voice rate ${state.settings.voiceRate}`);
  });

  $("sfx-vol")?.addEventListener("input", (e) => {
    state.settings.sfxVol = Number(e.target.value);
    saveState();
    applySettingsToUI();
  });

  $("char-select")?.addEventListener("change", (e) => {
    state.settings.character = e.target.value;
    saveState();
    resetMap();
    applySettingsToUI();
    speakText(`Character changed to ${e.target.value}`);
  });

  $("btn-ar-open")?.addEventListener("click", openAR);
  $("btn-ar-stop")?.addEventListener("click", stopAR);
  $("btn-ar-close")?.addEventListener("click", () => {
    stopAR();
    closeModal("ar-modal");
  });
  $("btn-ar-manual")?.addEventListener("click", () => {
    stopAR();
    closeModal("ar-modal");
    speakText("Hotspot verified.");
    alert("Hotspot verified.");
  });

  window.addEventListener("beforeunload", () => {
    saveStateNow(true);
  });
}

/* ============================
   BOOT
============================ */
function boot() {
  try {
    renderEverything();
    wireButtons();

    loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    initMap();
    checkBadgeUnlocksByCaptures();
    saveStateNow(true);

    console.log("App loaded");
  } catch (err) {
    console.error("BOOT ERROR:", err);
  }
}

window.addEventListener("DOMContentLoaded", boot);
