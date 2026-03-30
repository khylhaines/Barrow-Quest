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

const SAVE_KEY = "bq_world_v18_adultlock";

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
   SAVE / STATE
============================ */
function normaliseAdultLock(lock = {}) {
  return {
    unlocked: !!lock.unlocked,
    pin: typeof lock.pin === "string" ? lock.pin : "",
    sessionApproved: !!lock.sessionApproved,
    hideWhenKidsMode: !!lock.hideWhenKidsMode,
  };
}

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
      recentQuestionTags: Array.isArray(parsed.recentQuestionTags)
        ? parsed.recentQuestionTags
        : [],
      quizProfiles:
        parsed.quizProfiles && typeof parsed.quizProfiles === "object"
          ? {
              kid: normaliseAdaptiveProfile(parsed.quizProfiles.kid || {}, "kid"),
              teen: normaliseAdaptiveProfile(parsed.quizProfiles.teen || {}, "teen"),
              adult: normaliseAdaptiveProfile(
                parsed.quizProfiles.adult || {},
                "adult"
              ),
            }
          : {
              kid: getDefaultAdaptiveProfile("kid"),
              teen: getDefaultAdaptiveProfile("teen"),
              adult: getDefaultAdaptiveProfile("adult"),
            },
      purchasedItems: Array.isArray(parsed.purchasedItems)
        ? parsed.purchasedItems
        : [],
      inventory:
        parsed.inventory && typeof parsed.inventory === "object"
          ? parsed.inventory
          : {},
      captainNotes: Array.isArray(parsed.captainNotes)
        ? parsed.captainNotes
        : [],
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
        badges: Array.isArray(parsed?.meta?.badges) ? parsed.meta.badges : [],
      },
      adultLock: normaliseAdultLock(parsed.adultLock || {}),
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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

function isAdultAccessApproved() {
  const lock = getAdultLock();
  return !!(lock.unlocked && lock.sessionApproved);
}

function setAdultPillState(el, label, isLocked) {
  if (!el) return;
  el.innerText = isLocked ? `🔒 ${label}` : label;
  el.dataset.locked = isLocked ? "true" : "false";
  el.style.opacity = isLocked ? "0.9" : "1";
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

  setAdultPillState(trueCrime, "TRUE CRIME", !lock.unlocked);
  setAdultPillState(conspiracy, "CONSPIRACY", !lock.unlocked);
  setAdultPillState(history, "HISTORY", !lock.unlocked);

  if (trueCrime) {
    trueCrime.title = lock.unlocked
      ? "Adult archive available"
      : "Locked adult archive";
  }
  if (conspiracy) {
    conspiracy.title = lock.unlocked
      ? "Adult archive available"
      : "Locked adult archive";
  }
  if (history) {
    history.title = lock.unlocked
      ? "Adult archive available"
      : "Locked adult archive";
  }
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

  if (!lock.unlocked) {
    return promptToCreateAdultPin();
  }

  if (lock.sessionApproved) {
    return true;
  }

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

function closeRewardImageModal() {
  closeModal("reward-image-modal");
}

/* ============================
   CAPTAIN NOTES / BROADCAST
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

function saveCaptainNote(text) {
  const clean = String(text || "").trim();
  if (!clean) return false;

  if (!Array.isArray(state.captainNotes)) {
    state.captainNotes = [];
  }

  state.captainNotes.unshift({
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: clean,
    createdAt: new Date().toISOString(),
  });

  state.captainNotes = state.captainNotes.slice(0, 50);
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

  const ok = saveCaptainNote(text);
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
   PRESENTATION MODES
============================ */
function getRewardPresentationMode() {
  if (state.activePack === "adult") return "adult";

  const tier = getEffectiveTier();
  if (tier === "kid") return "kid";
  if (tier === "teen") return "teen";
  return "adult";
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
        ">✅</div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });
  }

  if (status.completedCount > 0) {
    return L.divIcon({
      className: "marker-logo",
      html: `
        <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;">
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

  showQuestLayoutForPack();

  if ($("q-name")) $("q-name").innerText = currentPin.n;

  const status = getCaptureStatus(currentPin);

  if ($("quest-status")) {
    const requiredText = status.mustInclude.length
      ? ` • REQUIRED: ${status.mustInclude.join(", ").toUpperCase()}`
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
          }`;
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
    const isBoss = currentPin.type === "boss";
    const missingRequiredText = status.missingRequired.length
      ? `REQUIRED STILL NEEDED: ${status.missingRequired.join(", ").toUpperCase()}`
      : "";
    $("boss-banner").style.display =
      isBoss || status.missingRequired.length ? "block" : "none";
    $("boss-banner").innerText = isBoss
      ? "FINAL TRIAL ACTIVE"
      : missingRequiredText;
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
        $("task-feedback").innerText = "Speed timer started. Finish within 20 seconds.";
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

  summary.innerHTML = `
    <div style="padding:10px;border:1px solid #333;border-radius:12px;background:#111;">
      <strong>${active?.name || "Player"}</strong><br>
      Coins: ${coins} 🪙<br>
      XP: ${xp} (Level ${level})<br>
      Level Progress: ${levelProgress}/100<br>
      Badges: ${badges.length}
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
            <div style="font-size:12px;opacity:.82;margin-top:6px;">${badge.captures} node${
              badge.captures === 1 ? "" : "s"
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
      <div><strong>TOTAL FIRST CAPTURES:</strong> ${Number(
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

  const badgeBlock = badges.length
    ? `
      <div style="padding:10px;border:1px solid #444;border-radius:12px;margin:8px 0 14px;background:#161616;">
        <div style="font-weight:bold;color:var(--gold);">NODE BADGES</div>
        <div style="margin-top:8px;font-size:13px;line-height:1.6;">
          ${badges
            .map(
              (b) =>
                `${b.icon} ${b.name} (${b.captures} node${
                  b.captures === 1 ? "" : "s"
                })`
            )
            .join("<br>")}
        </div>
      </div>
    `
    : "";

  list.innerHTML =
    mysteryBlock +
    badgeBlock +
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
    clearAdultSessionApproval();

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
}

/* ============================
   BOOT
============================ */
function boot() {
  try {
    renderHUD();
    applySettingsToUI();
    updateStartButtons();
    refreshAdultLockUI();
    showQuestLayoutForPack();
    renderHomeLog();
    renderShop();
    renderCaptainNotes();
    wireButtons();

    loadVoices();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    initMap();
    checkBadgeUnlocksByCaptures();
    console.log("App loaded");
  } catch (err) {
    console.error("BOOT ERROR:", err);
  }
}

window.addEventListener("DOMContentLoaded", boot);
