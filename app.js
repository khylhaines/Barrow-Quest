import { PINS } from "./pins.js";
import { getQA, getPinStartIntro } from "./qa.js";
import { ADULT_PINS } from "./adult_pins.js";
import { ADULT_CONTENT } from "./adult_content.js";
import { applyReward } from "./progression.js";
import { getRandomMystery } from "./mysteries.js";

const $ = (id) => document.getElementById(id);

const SAVE_KEY = "bq_world_v11";

const DEFAULT_STATE = {
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
  purchasedItems: [],
  inventory: {},
  completedPins: {},
  pinStats: {
    totalCompleted: 0,
    totalFirstCompletions: 0,
    totalRepeatCompletions: 0,
  },
  meta: {
    xp: 0,
    tokens: 0,
  },
  settings: {
    radius: 35,
    voicePitch: 1,
    voiceRate: 1,
    sfxVol: 80,
    zoomUI: false,
    character: "hero_duo",
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
];

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
  kylan: "kylan.jpg",
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
   SAVE / STATE
============================ */
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);

    const parsed = JSON.parse(raw);

    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      settings: {
        ...structuredClone(DEFAULT_STATE.settings),
        ...(parsed.settings || {}),
      },
      players:
        Array.isArray(parsed.players) && parsed.players.length
          ? parsed.players
          : structuredClone(DEFAULT_STATE.players),
      unlockedMysteries: Array.isArray(parsed.unlockedMysteries)
        ? parsed.unlockedMysteries
        : [],
      completedQuestionIds: Array.isArray(parsed.completedQuestionIds)
        ? parsed.completedQuestionIds
        : [],
      purchasedItems: Array.isArray(parsed.purchasedItems)
        ? parsed.purchasedItems
        : [],
      inventory:
        parsed.inventory && typeof parsed.inventory === "object"
          ? parsed.inventory
          : {},
      completedPins:
        parsed.completedPins && typeof parsed.completedPins === "object"
          ? parsed.completedPins
          : {},
      pinStats: {
        ...structuredClone(DEFAULT_STATE.pinStats),
        ...(parsed.pinStats || {}),
      },
      meta: {
        ...structuredClone(DEFAULT_STATE.meta),
        ...(parsed.meta || {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

/* ============================
   PROGRESSION / COMPLETION
============================ */
function getLevelFromXP(xp) {
  const safeXp = Math.max(0, Number(xp || 0));
  return Math.floor(safeXp / 100) + 1;
}

function getLevelProgress(xp) {
  const safeXp = Math.max(0, Number(xp || 0));
  return safeXp % 100;
}

function getPinProgressKey(pin) {
  if (!pin?.id) return null;
  const pack = state.activePack || "classic";
  const mode = state.mapMode || "core";
  const adult = state.activeAdultCategory || "none";
  return `${pack}__${mode}__${adult}__${pin.id}`;
}

function getPinProgress(pin) {
  const key = getPinProgressKey(pin);
  if (!key) return null;
  return state.completedPins[key] || null;
}

function isPinCompleted(pin) {
  return !!getPinProgress(pin);
}

function recordPinCompletion(pin, mode, rewardResult, questionId) {
  const key = getPinProgressKey(pin);
  if (!key) return { firstTime: false };

  const existing = state.completedPins[key];
  const now = new Date().toISOString();

  if (!existing) {
    state.completedPins[key] = {
      pinId: pin.id,
      pinName: pin.n || pin.id,
      pack: state.activePack,
      mapMode: state.mapMode,
      adultCategory: state.activeAdultCategory,
      firstCompletedAt: now,
      lastCompletedAt: now,
      completionCount: 1,
      completedModes: mode ? [mode] : [],
      lastQuestionId: questionId || null,
      lastReward: {
        coins: Number(rewardResult?.coins || 0),
        xp: Number(rewardResult?.xp || 0),
        tokens: Number(rewardResult?.tokens || 0),
      },
    };

    state.pinStats.totalCompleted += 1;
    state.pinStats.totalFirstCompletions += 1;

    return { firstTime: true, record: state.completedPins[key] };
  }

  existing.lastCompletedAt = now;
  existing.completionCount = Number(existing.completionCount || 0) + 1;
  existing.lastQuestionId = questionId || existing.lastQuestionId || null;
  existing.lastReward = {
    coins: Number(rewardResult?.coins || 0),
    xp: Number(rewardResult?.xp || 0),
    tokens: Number(rewardResult?.tokens || 0),
  };

  if (mode && !Array.isArray(existing.completedModes)) {
    existing.completedModes = [mode];
  } else if (mode && !existing.completedModes.includes(mode)) {
    existing.completedModes.push(mode);
  }

  state.pinStats.totalRepeatCompletions += 1;
  return { firstTime: false, record: existing };
}

function getCurrentModeProgress() {
  const pins = getCurrentPins();
  const total = pins.length;
  const completed = pins.filter((pin) => isPinCompleted(pin)).length;
  const remaining = Math.max(0, total - completed);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, remaining, percent };
}

function getRewardForMission({ mode, correct }) {
  const base = applyReward({
    mode,
    correct,
  }) || { coins: 25, xp: 10, tokens: 0 };

  const firstTime = currentPin ? !isPinCompleted(currentPin) : false;

  if (firstTime) {
    return {
      coins: Number(base.coins || 0),
      xp: Number(base.xp || 0) + 10,
      tokens: Number(base.tokens || 0) + 1,
      firstTime: true,
    };
  }

  return {
    coins: Math.max(5, Math.floor(Number(base.coins || 0) * 0.4)),
    xp: Math.max(2, Math.floor(Number(base.xp || 0) * 0.4)),
    tokens: 0,
    firstTime: false,
  };
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
  const enabled = getEnabledPlayers();
  const p1 = enabled[0] || { name: "Player 1", coins: 0, id: null };
  const p2 = enabled[1] || { name: "Player 2", coins: 0, id: null };
  const p3 = enabled[2] || { name: "Player 3", coins: 0, id: null };

  if ($("h-k")) $("h-k").innerText = `${p1.name}: ${p1.coins} 🪙`;
  if ($("h-p")) $("h-p").innerText = `${p2.name}: ${p2.coins} 🪙`;
  if ($("h-me")) $("h-me").innerText = `${p3.name}: ${p3.coins} 🪙`;

  const active = getActivePlayer();

  if ($("hp-k-tag")) {
    $("hp-k-tag").innerText = active?.id === p1.id ? "ACTIVE" : "OFF";
    $("hp-k-tag").className =
      active?.id === p1.id ? "hp-status hp-on" : "hp-status hp-off";
  }

  if ($("hp-p-tag")) {
    $("hp-p-tag").innerText = active?.id === p2.id ? "ACTIVE" : "OFF";
    $("hp-p-tag").className =
      active?.id === p2.id ? "hp-status hp-on" : "hp-status hp-off";
  }

  const coins = active?.coins || 0;
  const xp = Number(state.meta?.xp || 0);
  const tokens = Number(state.meta?.tokens || 0);

  if ($("top-coins")) $("top-coins").innerText = String(coins);
  if ($("top-xp")) $("top-xp").innerText = `L${getLevelFromXP(xp)} • ${xp}`;
  if ($("top-tokens")) $("top-tokens").innerText = String(tokens);
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
  const completed = isPinCompleted(pin);
  const icon = pin.i || "📍";

  if (completed) {
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
        ">✅</div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  }

  return L.divIcon({
    className: "marker-logo",
    html: `<div style="font-size:28px;line-height:1;">${icon}</div>`,
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

function pickClassicModesForPin(pin, count = 4) {
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

  const chosenModes = pickClassicModesForPin(pin, 4);
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
    if (meta) {
      tile.innerHTML = `<span>${meta.icon}</span>${meta.label}`;
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

      const completed = isPinCompleted(pin);
      updateCaptureText(
        completed ? `${pin.n} • COMPLETED • REPLAY` : `${pin.n} • READY`
      );

      speakText(
        completed
          ? `${pin.n}. Completed already. Replay available.`
          : `${pin.n}. Ready.`
      );
    });

    activeMarkers[pin.id] = marker;
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
  if ($("capture-hud")) {
    $("capture-hud").innerText = text || "WAITING FOR GPS...";
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
  if (!navigator.geolocation || !map) {
    updateCaptureText("GPS NOT AVAILABLE");
    return;
  }

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
        const completed = isPinCompleted(nearby);
        updateCaptureText(
          completed ? `${nearby.n} • COMPLETED • REPLAY` : `${nearby.n} • READY`
        );
        showActionButton(true);
      } else {
        if (state.activePack === "adult") {
          const label = state.activeAdultCategory
            ? `ADULT: ${String(state.activeAdultCategory)
                .replaceAll("_", " ")
                .toUpperCase()}`
            : "ADULT MAP";
          updateCaptureText(label);
        } else {
          updateCaptureText(
            state.mapMode === "core"
              ? "FULL BARROW MAP"
              : state.mapMode === "park"
              ? "PARK ADVENTURE"
              : "ABBEY QUEST"
          );
        }
        showActionButton(false);
      }
    },
    () => {
      updateCaptureText("GPS ERROR");
    },
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

  showQuestLayoutForPack();

  if ($("q-name")) $("q-name").innerText = currentPin.n;

  const completed = isPinCompleted(currentPin);

  if ($("quest-status")) {
    $("quest-status").innerText =
      state.activePack === "adult"
        ? `STATUS: CASE MODE • ${String(
            state.activeAdultCategory || "GENERAL"
          ).toUpperCase()}${completed ? " • COMPLETED" : ""}`
        : `STATUS: ${state.mapMode.toUpperCase()} • ${String(
            currentPin.type || "quiz"
          ).toUpperCase()}${completed ? " • COMPLETED" : ""}`;
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

    $("mode-banner").innerText = completed
      ? `${label}\n${currentPin.n}\nCOMPLETED`
      : `${label}\n${currentPin.n}`;
  }

  if ($("boss-banner")) {
    const isBoss = currentPin.type === "boss";
    $("boss-banner").style.display = isBoss ? "block" : "none";
    $("boss-banner").innerText = isBoss ? "FINAL TRIAL ACTIVE" : "";
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

  const tier = getEffectiveTier();
  let task = null;

  clearTaskBlocks();

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
    });
  }

  currentTask = {
    mode,
    pin: currentPin,
    question: task,
  };

  if ($("task-title")) {
    $("task-title").innerText =
      state.activePack === "adult"
        ? task?.title || currentPin.n
        : `${mode.toUpperCase()} @ ${currentPin.n}`;
  }

  if ($("task-desc")) {
    $("task-desc").innerText =
      task?.desc || task?.q || "No mission found for this location.";
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

function renderTaskOptions(question) {
  const wrap = $("task-options");
  const readBtn = $("btn-read-answers");
  if (!wrap) return;

  wrap.innerHTML = "";

  if (!question?.options?.length) {
    wrap.style.display = "none";
    if (readBtn) readBtn.classList.add("hidden");
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
  const tokens = Number(state.meta?.tokens || 0);
  const level = getLevelFromXP(xp);
  const levelProgress = getLevelProgress(xp);

  summary.innerHTML = `
    <div style="padding:10px;border:1px solid #333;border-radius:12px;background:#111;">
      <strong>${active?.name || "Player"}</strong><br>
      Coins: ${coins} 🪙<br>
      XP: ${xp} (Level ${level})<br>
      Level Progress: ${levelProgress}/100<br>
      Tokens: ${tokens}
    </div>
  `;

  const ownedItems = SHOP_ITEMS.filter(
    (item) => getInventoryCount(item.id) > 0
  );

  inventory.innerHTML = ownedItems.length
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
    : `<div style="opacity:.8;">No purchases yet.</div>`;

  list.innerHTML = SHOP_ITEMS.map((item) => {
    const owned = getInventoryCount(item.id);
    return `
      <div class="shop-item">
        <div class="shop-item-top">
          <div>
            <div style="font-weight:bold;">${item.name}</div>
            <div style="font-size:12px;opacity:.85;margin-top:6px;">${
              item.desc
            }</div>
          </div>
          <div class="shop-cost">${item.cost} 🪙</div>
        </div>
        ${owned > 0 ? `<div class="owned-tag">OWNED: ${owned}</div>` : ""}
        <button class="win-btn shop-buy-btn" data-shop-id="${
          item.id
        }" style="margin-top:12px;">
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
    return;
  }

  const active = getActivePlayer();
  const rewardResult = getRewardForMission({
    mode: currentTask.mode,
    correct: true,
  });

  const rewardCoins = Number(rewardResult.coins || 0);
  const rewardXp = Number(rewardResult.xp || 0);
  const rewardTokens = Number(rewardResult.tokens || 0);

  if (active && rewardCoins) {
    updateCoins(active.id, rewardCoins);
  }

  state.meta.xp = Number(state.meta.xp || 0) + rewardXp;
  state.meta.tokens = Number(state.meta.tokens || 0) + rewardTokens;

  const questionId = q?.meta?.questionId || q?.id || null;
  rememberQuestion(questionId);

  const completion = recordPinCompletion(
    currentTask.pin,
    currentTask.mode,
    rewardResult,
    questionId
  );

  const mystery = maybeUnlockMystery();

  saveState();
  renderHUD();
  renderShop();
  renderHomeLog();
  refreshPinMarker(currentTask.pin);

  feedback.style.color = "var(--neon)";

  const firstLabel = completion.firstTime
    ? "NEW LOCATION COMPLETE"
    : "REPLAY COMPLETE";
  const rewardLine = `+${rewardCoins} coins +${rewardXp} XP +${rewardTokens} tokens`;

  if (mystery) {
    feedback.innerText =
      `${firstLabel}\n${rewardLine}\n\n` +
      `BONUS MYSTERY UNLOCKED\n` +
      `${mystery.icon || "❓"} ${mystery.title}\n\n` +
      `${mystery.story}\n\n` +
      `${mystery.evidence || ""}`;

    speakText(
      `${firstLabel}. ${rewardCoins} coins awarded. ${rewardXp} experience. Bonus mystery unlocked. ${mystery.title}.`
    );
  } else {
    feedback.innerText =
      `${firstLabel}\n${rewardLine}\n\n` + `${q.fact || "Mission complete."}`;

    speakText(
      `${firstLabel}. ${rewardCoins} coins awarded. ${rewardXp} experience. ${
        q.fact || "Mission complete."
      }`
    );
  }
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

  summary.innerHTML = `
    <div style="padding:12px;border:1px solid #444;border-radius:14px;background:#111;line-height:1.6;">
      <div><strong>LEVEL:</strong> ${level}</div>
      <div><strong>XP:</strong> ${xp} (${levelProgress}/100 to next level)</div>
      <div><strong>PACK:</strong> ${state.activePack}</div>
      <div><strong>MODE:</strong> ${state.mapMode}</div>
      <div><strong>TIER:</strong> ${getEffectiveTier()}</div>
      <div><strong>PINS LOADED:</strong> ${pins.length}</div>
      <div><strong>MODE COMPLETED:</strong> ${currentProgress.completed}/${
    currentProgress.total
  } (${currentProgress.percent}%)</div>
      <div><strong>MODE REMAINING:</strong> ${currentProgress.remaining}</div>
      <div><strong>MYSTERIES UNLOCKED:</strong> ${mysteryCount}</div>
      <div><strong>COMPLETED PROMPTS TRACKED:</strong> ${completedCount}</div>
      <div><strong>TOTAL FIRST COMPLETIONS:</strong> ${Number(
        state.pinStats?.totalFirstCompletions || 0
      )}</div>
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

  list.innerHTML =
    mysteryBlock +
    pins
      .slice(0, 50)
      .map((pin) => {
        const progress = getPinProgress(pin);
        const done = !!progress;
        return `
        <div style="padding:10px;border:1px solid #333;border-radius:12px;margin:8px 0;background:${
          done ? "rgba(77,255,158,0.08)" : "#111"
        };">
          <div style="font-weight:bold;">${done ? "✅ " : ""}${pin.n}</div>
          <div style="opacity:.85;font-size:12px;">${
            pin.zone || pin.set || pin.category || "unknown"
          }</div>
          <div style="margin-top:6px;font-size:12px;opacity:.82;">
            ${
              done
                ? `Completed ${Number(progress.completionCount || 1)} time(s)`
                : "Not completed yet"
            }
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

    saveState();
    updateStartButtons();
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
    showModal("commander-hub");
    speakText("Commander hub opened.");
  });

  $("btn-close-commander")?.addEventListener("click", () =>
    closeModal("commander-hub")
  );
  $("btn-close-commander-x")?.addEventListener("click", () =>
    closeModal("commander-hub")
  );

  $("btn-close-quest")?.addEventListener("click", () =>
    closeModal("quest-modal")
  );
  $("btn-task-close")?.addEventListener("click", () =>
    closeModal("task-modal")
  );

  $("btn-read-answers")?.addEventListener("click", () => {
    if (currentTask?.question?.options?.length) {
      speakOptions(currentTask.question.options);
    }
  });

  $("action-trigger")?.addEventListener("click", openMissionMenu);

  $("pill-full")?.addEventListener("click", () => {
    state.activePack = "classic";
    state.mapMode = "core";
    state.activeAdultCategory = null;
    saveState();
    updateStartButtons();
    resetMap();
    speakText("Full Barrow selected.");
  });

  $("pill-park")?.addEventListener("click", () => {
    state.activePack = "classic";
    state.mapMode = "park";
    state.activeAdultCategory = null;
    saveState();
    updateStartButtons();
    resetMap();
    speakText("Park selected.");
  });

  $("pill-docks")?.addEventListener("click", () => {
    state.activePack = "classic";
    state.mapMode = "abbey";
    state.activeAdultCategory = null;
    saveState();
    updateStartButtons();
    resetMap();
    speakText("Abbey selected.");
  });

  $("pill-truecrime")?.addEventListener("click", () => {
    state.activePack = "adult";
    state.activeAdultCategory = "true_crime";
    saveState();
    updateStartButtons();
    resetMap();
    speakText("True crime selected.");
  });

  $("pill-conspiracy")?.addEventListener("click", () => {
    state.activePack = "adult";
    state.activeAdultCategory = "conspiracy";
    saveState();
    updateStartButtons();
    resetMap();
    speakText("Conspiracy selected.");
  });

  $("pill-history")?.addEventListener("click", () => {
    state.activePack = "adult";
    state.activeAdultCategory = "history";
    saveState();
    updateStartButtons();
    resetMap();
    speakText("History selected.");
  });

  $("pill-kids")?.addEventListener("click", () => {
    state.tierMode = "kid";
    saveState();
    updateStartButtons();
    speakText("Kids mode selected.");
  });

  $("pill-teen")?.addEventListener("click", () => {
    state.tierMode = "teen";
    saveState();
    updateStartButtons();
    speakText("Teen mode selected.");
  });

  $("tier-mode")?.addEventListener("change", (e) => {
    state.tierMode = e.target.value;
    saveState();
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
}

/* ============================
   BOOT
============================ */
function boot() {
  try {
    renderHUD();
    applySettingsToUI();
    updateStartButtons();
    showQuestLayoutForPack();
    renderHomeLog();
    renderShop();
    wireButtons();

    loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    initMap();
    console.log("App loaded");
  } catch (err) {
    console.error("BOOT ERROR:", err);
  }
}

window.addEventListener("DOMContentLoaded", boot);
