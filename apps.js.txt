// app.js
import { PINS } from "./pins.js";
import { getQA } from "./qa.js";
import { createAIVerifier, listPhotos, clearPhotos } from "./ai_verify.js";

/**
 * Barrow Quest / Barrow Inferno Engine
 * - GPS proximity trigger
 * - AR verify gating only for mission/course modes
 * - Per-pin limited random mode list
 * - Wildcard mode
 * - Manual reward assignment for all rewards
 * - AI Verify support
 */

// ===== CONFIG =====
const ENTER_RADIUS_M_DEFAULT = 30;
const PASS_BONUS_COINS = 10;
const MODE_COMPLETE_COINS = 100;
const CAPTURE_BONUS_COINS = 50;
const QUEST_MODE_COUNT = 4;

// ===== STATE =====
let state = JSON.parse(localStorage.getItem("bq_master_v3")) || {
  k: 0,
  p: 0,
  khyl: 0,
  activeParticipant: "both",
  pendingReward: 0,
  dk: 7,
  dp: 3,
  hpK: false,
  hpP: false,
  nodes: {},
  rules: { cooldownMin: 10, captureNeed: 3 },
};

state.k = state.k ?? 0;
state.p = state.p ?? 0;
state.khyl = state.khyl ?? 0;
state.activeParticipant = state.activeParticipant || "both";
state.pendingReward = state.pendingReward ?? 0;
state.rules = state.rules || { cooldownMin: 10, captureNeed: 3 };
state.nodes = state.nodes || {};
state.session = state.session || {};
state.session.qaSalt = state.session.qaSalt ?? Date.now();

state.settings = state.settings || {};
state.settings = {
  voiceRate: state.settings.voiceRate ?? 1.0,
  sfxVol: state.settings.sfxVol ?? 80,
  enterRadiusM: state.settings.enterRadiusM ?? ENTER_RADIUS_M_DEFAULT,
  arMode: state.settings.arMode ?? "easy",
  character: state.settings.character ?? "hero_duo",
  zoomUI: state.settings.zoomUI ?? false,
  rotMode: state.settings.rotMode ?? "needle",
  rotPower: state.settings.rotPower ?? 85,
  rotSmooth: state.settings.rotSmooth ?? 0.55,
};

const $ = (id) => document.getElementById(id);

// ===== RULE GETTERS =====
const getCaptureNeed = () => state.rules?.captureNeed ?? 3;
const getEnterRadiusM = () => {
  const v = parseInt(
    state.settings?.enterRadiusM ?? ENTER_RADIUS_M_DEFAULT,
    10
  );
  return Number.isFinite(v) ? v : ENTER_RADIUS_M_DEFAULT;
};

// ===== CHARACTER SYSTEM =====
const CHARACTERS = {
  hero_duo: {
    label: "Hero Duo",
    iconHtml: `<div style="font-size:50px">🦸‍♂️👸</div>`,
    pointsMult: 1.0,
    healthMult: 1.0,
    arBonus: 1.0,
  },
  ninja: {
    label: "Ninja Scout",
    iconHtml: `<div style="font-size:50px">🥷</div>`,
    pointsMult: 1.1,
    healthMult: 0.9,
    arBonus: 0.9,
  },
  wizard: {
    label: "Wizard Guide",
    iconHtml: `<div style="font-size:50px">🧙</div>`,
    pointsMult: 1.0,
    healthMult: 1.0,
    arBonus: 1.25,
  },
  robot: {
    label: "Robo Ranger",
    iconHtml: `<div style="font-size:50px">🤖</div>`,
    pointsMult: 1.2,
    healthMult: 1.15,
    arBonus: 0.85,
  },
  pirate: {
    label: "Pirate Captain",
    iconHtml: `<div style="font-size:50px">🏴‍☠️</div>`,
    pointsMult: 1.15,
    healthMult: 1.05,
    arBonus: 0.95,
  },
};

function getCharacter() {
  const key = state.settings?.character || "hero_duo";
  return CHARACTERS[key] || CHARACTERS.hero_duo;
}

// ===== PIN RULES =====
const PIN_RULES = {
  1: {
    label: "HOME BASE PROTOCOL",
    type: "foundation",
    captureNeed: 2,
    requiredModes: ["quiz", "history"],
    allowedModes: null,
    cooldownMin: 5,
    banner: "Home Base: Complete QUIZ + HISTORY to establish the link.",
  },
  4: {
    label: "CENOTAPH PROTOCOL",
    type: "reflection",
    captureNeed: 3,
    requiredModes: ["history", "family", "activity"],
    allowedModes: null,
    cooldownMin: 15,
    banner: "Cenotaph: HISTORY + FAMILY + ACTIVITY required. Respect node.",
  },
  100: {
    label: "FINAL BOSS ACTIVE",
    type: "boss",
    captureNeed: 4,
    requiredModes: ["battle", "logic", "speed", "quiz"],
    allowedModes: ["battle", "logic", "speed", "quiz", "wildcard"],
    cooldownMin: 30,
    banner: "FINAL BOSS: Complete all phases to capture.",
  },
};

function getPinRule(pin) {
  return pin ? PIN_RULES[pin.id] || null : null;
}
function getEffectiveCaptureNeed(pin) {
  return getPinRule(pin)?.captureNeed ?? getCaptureNeed();
}
function getEffectiveCooldownMs(pin) {
  const r = getPinRule(pin);
  const min = r?.cooldownMin ?? state.rules?.cooldownMin ?? 10;
  return min * 60 * 1000;
}
function requiredModesFor(pin) {
  return Array.isArray(getPinRule(pin)?.requiredModes)
    ? getPinRule(pin).requiredModes
    : null;
}
function allowedModesFor(pin) {
  return Array.isArray(getPinRule(pin)?.allowedModes)
    ? getPinRule(pin).allowedModes
    : null;
}

// ===== MODE SYSTEM =====
const ALL_MODES = [
  "quiz",
  "battle",
  "history",
  "logic",
  "speed",
  "health",
  "activity",
  "family",
];

const MODE_META = {
  quiz: { label: "QUIZ", icon: "❓" },
  battle: { label: "BATTLE", icon: "⚔️" },
  history: { label: "HISTORY", icon: "📜" },
  logic: { label: "LOGIC", icon: "🧩" },
  speed: { label: "SPEED", icon: "⚡" },
  health: { label: "HEALTH", icon: "🏃" },
  activity: { label: "ACTIVITY", icon: "🎯" },
  family: { label: "FAMILY", icon: "👨‍👩‍👧" },
  wildcard: { label: "WILDCARD", icon: "🃏" },
};

function modeNeedsAR(mode) {
  return ["activity", "health"].includes(mode);
}

function seededValue(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let x = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getModesForPin(pin) {
  const allowed = allowedModesFor(pin);
  const pool = allowed
    ? allowed.filter((m) => m !== "wildcard")
    : [...ALL_MODES];

  const seed = seededValue(`${pin.id}|${state.session.qaSalt}|modes`);
  let picked = seededShuffle(pool, seed).slice(0, QUEST_MODE_COUNT);

  if (!picked.length) picked = ["quiz", "history", "logic", "battle"];

  if (!picked.includes("wildcard")) picked.push("wildcard");
  return picked;
}

function resolveWildcardMode(pin) {
  const ns = nodeState(pin.id);
  const allowed = allowedModesFor(pin);
  const pool = (
    allowed ? allowed.filter((m) => m !== "wildcard") : ALL_MODES
  ).filter((m) => !ns.completedModes.includes(m));

  if (!pool.length) return "quiz";
  const seed = seededValue(`${pin.id}|${state.session.qaSalt}|wildcard`);
  return pool[seed % pool.length];
}

function renderQuestModes(pin) {
  const wrap = $("quest-modes");
  if (!wrap || !pin) return;

  const ns = nodeState(pin.id);
  const modes = getModesForPin(pin);

  wrap.innerHTML = "";

  modes.forEach((mode) => {
    const actualMode = mode === "wildcard" ? resolveWildcardMode(pin) : mode;
    const meta = MODE_META[mode] || MODE_META.quiz;
    const completed = ns.completedModes.includes(actualMode);
    const needsAR = modeNeedsAR(actualMode);

    const tile = document.createElement("div");
    tile.className = "m-tile";
    tile.setAttribute("data-mode", mode);

    let sub = "";
    if (mode === "wildcard") sub = `<small>Random mode</small>`;
    else if (needsAR && !ns.arVerified) sub = `<small>Needs AR</small>`;
    else if (completed) sub = `<small>Done</small>`;

    tile.innerHTML = `<span>${meta.icon}</span>${meta.label}${sub}`;

    if (completed) {
      tile.style.opacity = "0.45";
    }

    tile.addEventListener("click", () => launchMode(mode));
    wrap.appendChild(tile);
  });
}

// ===== RUNTIME =====
let cur = null;
let activeMarkers = {};
let hero = null;
let map = null;

// ===== HEALTH TRACKER =====
let healthActive = false;
let healthLast = null;
let healthMeters = 0;
let healthTarget = 0;

// ===== AR =====
let arStream = null;

// ===== AI VERIFY + GALLERY =====
let ai = {
  verifier: null,
  running: false,
  template: "still",
  pinId: null,
  pinName: "",
  child: "Both",
  taskLabel: "Pose Challenge",
};

const VOICE_PACK = {
  kid: {
    welcome: "Hey explorers! Welcome back!",
    nearPin: "Nice! You found a mission spot. Tap the lightning button!",
    verified: "Boom! Verified! Nice one!",
    tryAgain: "Nearly! Try again. You have got this!",
    correct: "Brilliant! You got it right!",
    reward: "Reward ready.",
    capture: "Node captured! Great work!",
  },
  teen: {
    welcome: "Alright. Mission time.",
    nearPin: "You are in range. Hit the lightning button.",
    verified: "Clean. Verified.",
    tryAgain: "Close. Run it again.",
    correct: "Correct.",
    reward: "Reward ready.",
    capture: "Node captured.",
  },
};

function difficultyTier() {
  return state.dp <= 4 ? "kid" : "adult";
}

function voiceLine(key) {
  const pack = difficultyTier() === "kid" ? VOICE_PACK.kid : VOICE_PACK.teen;
  return pack[key] || "";
}

// ===== CLICK WIRING =====
function onClick(id, fn) {
  const el = $(id);
  if (!el) return;
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  });
}

// ===== HELPERS =====
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

function stripForSpeech(text) {
  return String(text || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function speak(t) {
  const clean = stripForSpeech(t);
  if (!clean) return;

  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();

    const u = new SpeechSynthesisUtterance(clean);
    const pitchSlider = parseFloat($("v-pitch")?.value || "1.0");
    u.pitch = Number.isFinite(pitchSlider) ? pitchSlider : 1.0;

    const rateSlider = parseFloat(
      $("v-rate")?.value || String(state.settings.voiceRate || 1.0)
    );
    u.rate = Number.isFinite(rateSlider) ? rateSlider : 1.0;
    u.volume = 1.0;
    u.lang = "en-GB";

    setTimeout(() => {
      try {
        synth.speak(u);
      } catch {}
    }, 120);
  } catch {}
}

function toggleM(id, force) {
  const m = $(id);
  if (!m) return;
  if (typeof force === "boolean") {
    m.style.display = force ? "block" : "none";
    return;
  }
  m.style.display = m.style.display === "block" ? "none" : "block";
}

function activeParticipantLabel(target = state.activeParticipant) {
  if (target === "kylan") return "Kylan";
  if (target === "piper") return "Piper";
  if (target === "khyl") return "KHYL";
  return "Both";
}

// ===== REWARD SYSTEM =====
function showRewardPanel(show = true) {
  const panel = $("reward-panel");
  if (panel) panel.style.display = show ? "block" : "none";
}

function addPendingReward(amount) {
  const gain = Math.max(0, Math.round(amount || 0));
  if (!gain) return;
  state.pendingReward = (state.pendingReward || 0) + gain;
  save();
  showRewardPanel(true);
}

function clearPendingReward() {
  state.pendingReward = 0;
  save();
  showRewardPanel(false);
}

function awardPointsTo(target, amount) {
  const gain = Math.max(0, Math.round(amount || 0));
  if (!gain) return;

  if (target === "kylan") state.k += gain;
  else if (target === "piper") state.p += gain;
  else if (target === "khyl") state.khyl += gain;
  else {
    state.k += gain;
    state.p += gain;
  }

  save();
  playSuccessSfx();
  pulseCoinsHud();
  burstEmoji(10, "🪙");
  showRewardPopup(
    `+${gain} COINS`,
    `${activeParticipantLabel(target)} awarded!`
  );
}

function awardPendingTo(target) {
  const gain = state.pendingReward || 0;
  if (!gain) return;
  awardPointsTo(target, gain);
  clearPendingReward();
}

function grantPassBonusOnce() {
  if (!activeTask || activeTask.rewardedOnPass) return;
  activeTask.rewardedOnPass = true;
  addPendingReward(PASS_BONUS_COINS);
  showRewardPopup(`+${PASS_BONUS_COINS} BONUS`, "Reward ready to assign");
  speak(voiceLine("reward"));
}

// ===== REWARD FX =====
let audioCtx = null;

function getSfxVolume() {
  const pct = parseInt(state.settings?.sfxVol ?? 80, 10);
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
  } catch {}
}

function playSuccessSfx() {
  beep(660, 0.08, "triangle", 0.05);
  setTimeout(() => beep(880, 0.1, "triangle", 0.055), 70);
  setTimeout(() => beep(1040, 0.12, "triangle", 0.06), 140);
}
function playFailSfx() {
  beep(220, 0.1, "sawtooth", 0.04);
  setTimeout(() => beep(180, 0.12, "sawtooth", 0.035), 90);
}
function playCaptureSfx() {
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

function burstEmoji(count = 12, emoji = "✨") {
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
    el.style.transition =
      "transform 900ms ease-out, opacity 900ms ease-out, top 900ms ease-out";
    layer.appendChild(el);

    requestAnimationFrame(() => {
      const dx = -80 + Math.random() * 160;
      const dy = -100 - Math.random() * 120;
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${
        -80 + Math.random() * 160
      }deg)`;
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
  card.style.top = "20%";
  card.style.transform = "translate(-50%, -10px) scale(0.96)";
  card.style.minWidth = "220px";
  card.style.maxWidth = "86vw";
  card.style.background =
    tone === "fail" ? "rgba(80,0,0,0.92)" : "rgba(0,0,0,0.9)";
  card.style.border =
    tone === "fail" ? "2px solid #ff6666" : "2px solid var(--gold)";
  card.style.color = "#fff";
  card.style.borderRadius = "18px";
  card.style.padding = "16px 18px";
  card.style.textAlign = "center";
  card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";
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
  }, 4200);

  setTimeout(() => card.remove(), 4700);
}

function pulseCoinsHud() {
  const hud = $("coin-hud");
  if (!hud) return;

  hud.animate(
    [
      { transform: "scale(1)", boxShadow: "0 0 0 rgba(241,196,15,0)" },
      {
        transform: "scale(1.04)",
        boxShadow: "0 0 22px rgba(241,196,15,0.55)",
      },
      { transform: "scale(1)", boxShadow: "0 0 0 rgba(241,196,15,0)" },
    ],
    { duration: 450, easing: "ease-out" }
  );
}

function celebrateCorrect(fact = "") {
  playSuccessSfx();
  burstEmoji(14, "✨");
  showRewardPopup("CORRECT!", fact || "Great job, explorer!");
}
function celebrateCapture(mins) {
  playCaptureSfx();
  burstEmoji(18, "🏆");
  showRewardPopup("NODE CAPTURED!", `Reawakens in ${mins} minutes`);
  speak(voiceLine("capture"));
}
function warnTryAgain() {
  playFailSfx();
  showRewardPopup("NOT QUITE", "Try again, explorer.", "fail");
}

// ===== SAVE + HUD =====
function save() {
  state.dk = parseInt($("dk")?.value || state.dk, 10);
  state.dp = parseInt($("dp")?.value || state.dp, 10);

  const r = $("enter-radius");
  if (r) {
    state.settings.enterRadiusM =
      parseInt(r.value, 10) || state.settings.enterRadiusM;
  }

  const ar = $("ar-mode");
  if (ar) state.settings.arMode = ar.value || state.settings.arMode;

  const cs = $("char-select");
  if (cs) state.settings.character = cs.value || state.settings.character;

  const vr = $("v-rate");
  if (vr) {
    state.settings.voiceRate = parseFloat(vr.value) || state.settings.voiceRate;
  }

  const sv = $("sfx-vol");
  if (sv) {
    state.settings.sfxVol = parseInt(sv.value, 10) || state.settings.sfxVol;
  }

  const ps = $("participant-select");
  if (ps) {
    state.activeParticipant = ps.value || state.activeParticipant || "both";
  }

  localStorage.setItem("bq_master_v3", JSON.stringify(state));

  if ($("h-k")) $("h-k").innerText = state.k;
  if ($("h-p")) $("h-p").innerText = state.p;
  if ($("h-me")) $("h-me").innerText = state.khyl;

  if ($("hp-k-tag")) {
    $("hp-k-tag").className = state.hpK
      ? "hp-status hp-on"
      : "hp-status hp-off";
    $("hp-k-tag").innerText = state.hpK ? "🎧 ACTIVE" : "🎧 OFF";
  }

  if ($("hp-p-tag")) {
    $("hp-p-tag").className = state.hpP
      ? "hp-status hp-on"
      : "hp-status hp-off";
    $("hp-p-tag").innerText = state.hpP ? "🎧 ACTIVE" : "🎧 OFF";
  }

  updateCaptureHud();
}

function toggleHP(unit) {
  if (unit === "k") state.hpK = !state.hpK;
  if (unit === "p") state.hpP = !state.hpP;
  speak(unit === "k" ? "Kylan gear synced" : "Piper gear synced");
  save();
}

// ===== NODE STATE =====
function nodeState(id) {
  if (!state.nodes[id]) {
    state.nodes[id] = {
      arVerified: false,
      completedModes: [],
      cooldownUntil: 0,
    };
  }
  return state.nodes[id];
}

function isOnCooldown(id) {
  const ns = nodeState(id);
  return ns.cooldownUntil && Date.now() < ns.cooldownUntil;
}

// ===== MAP INIT =====
function initMap() {
  map = L.map("map", { zoomControl: false }).setView([54.1137, -3.2184], 17);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  if (state.settings.zoomUI) {
    L.control.zoom({ position: "topright" }).addTo(map);
    if ($("zoomui-label")) $("zoomui-label").innerText = "ON";
  } else {
    if ($("zoomui-label")) $("zoomui-label").innerText = "OFF";
  }

  hero = L.marker([54.1137, -3.2184], {
    icon: L.divIcon({
      html: getCharacter().iconHtml,
      className: "marker-logo",
    }),
  }).addTo(map);

  initPins();
  startGPSWatcher();
}

function refreshHeroIcon() {
  if (!hero) return;
  const c = getCharacter();
  hero.setIcon(L.divIcon({ html: c.iconHtml, className: "marker-logo" }));
}

function initPins() {
  if (!map) return;

  Object.values(activeMarkers).forEach((m) => map.removeLayer(m));
  activeMarkers = {};

  PINS.forEach((p) => {
    if (!isOnCooldown(p.id)) {
      const m = L.marker(p.l, {
        icon: L.divIcon({ className: "marker-logo", html: p.i }),
      }).addTo(map);
      activeMarkers[p.id] = m;
    }
  });

  save();
}

// ===== GPS WATCH =====
function startGPSWatcher() {
  map.locate({ watch: true, enableHighAccuracy: true });

  map.on("locationfound", (e) => {
    if (hero) hero.setLatLng(e.latlng);

    if (healthActive) {
      const pt = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!healthLast) healthLast = pt;

      const step = haversineMeters(healthLast, pt);
      if (step > 0.5 && step < 20) {
        healthMeters += step;
        healthLast = pt;
      }

      const fb = $("task-feedback");
      if (fb) {
        fb.style.display = "block";
        fb.innerText = `Distance: ${healthMeters.toFixed(
          0
        )}m / ${healthTarget}m`;
      }

      if (healthMeters >= healthTarget) {
        healthActive = false;
        if (fb)
          fb.innerText = `Completed Distance: ${healthMeters.toFixed(0)}m`;

        if (activeTask) {
          activeTask.passed = true;
          grantPassBonusOnce();
        }

        celebrateCorrect("Health objective complete!");
        speak("Health objective complete.");
      }
    }

    const near = PINS.find(
      (p) =>
        map.distance(e.latlng, p.l) < getEnterRadiusM() && !isOnCooldown(p.id)
    );

    if (near) {
      if (!cur || cur.id !== near.id) speak(voiceLine("nearPin"));
      cur = near;
      if ($("action-trigger")) $("action-trigger").style.display = "block";
      updateCaptureHud();
    } else {
      if ($("action-trigger")) $("action-trigger").style.display = "none";
      cur = null;
      if ($("capture-hud")) $("capture-hud").innerText = "CAPTURE: —";
    }
  });

  map.on("locationerror", () => {
    console.warn("GPS blocked/unavailable.");
  });
}

// ===== HUD WIRING =====
function wireHUD() {
  onClick("btn-home", () => {
    renderHomeLog();
    toggleM("home-modal", true);
  });
  onClick("btn-home-close", () => toggleM("home-modal", false));
  onClick("btn-commander", () => toggleM("commander-hub", true));
  onClick("btn-settings", () => toggleM("settings-modal", true));
  onClick("btn-close-commander", () => toggleM("commander-hub", false));
  onClick("btn-close-settings", () => toggleM("settings-modal", false));
  onClick("btn-close-commander-x", () => toggleM("commander-hub", false));
  onClick("btn-close-settings-x", () => toggleM("settings-modal", false));
  onClick("btn-home-close-x", () => toggleM("home-modal", false));

  onClick("btn-hp-k", () => toggleHP("k"));
  onClick("btn-hp-p", () => toggleHP("p"));

  const dk = $("dk");
  const dp = $("dp");
  if (dk) dk.addEventListener("input", save);
  if (dp) dp.addEventListener("input", save);

  onClick("btn-swap", () => {
    [state.dk, state.dp] = [state.dp, state.dk];
    if (dk) dk.value = String(state.dk);
    if (dp) dp.value = String(state.dp);
    save();
    speak("Polarity swapped.");
  });

  onClick("btn-night", () => $("map")?.classList.toggle("night-vision"));
  onClick("action-trigger", openQuest);

  const vRate = $("v-rate");
  const rateLabel = $("rate-label");
  if (vRate) {
    vRate.value = String(state.settings.voiceRate ?? 1.0);
    if (rateLabel) rateLabel.innerText = vRate.value;
    vRate.addEventListener("input", () => {
      state.settings.voiceRate = parseFloat(vRate.value) || 1.0;
      if (rateLabel) rateLabel.innerText = String(state.settings.voiceRate);
      save();
    });
  }

  const sfx = $("sfx-vol");
  const sfxLabel = $("sfx-label");
  if (sfx) {
    sfx.value = String(state.settings.sfxVol ?? 80);
    if (sfxLabel) sfxLabel.innerText = sfx.value;
    sfx.addEventListener("input", () => {
      state.settings.sfxVol = parseInt(sfx.value, 10) || 80;
      if (sfxLabel) sfxLabel.innerText = String(state.settings.sfxVol);
      save();
    });
  }

  const radius = $("enter-radius");
  const radiusLabel = $("radius-label");
  if (radius) {
    radius.value = String(
      state.settings.enterRadiusM ?? ENTER_RADIUS_M_DEFAULT
    );
    if (radiusLabel) radiusLabel.innerText = radius.value;
    radius.addEventListener("input", () => {
      state.settings.enterRadiusM =
        parseInt(radius.value, 10) || ENTER_RADIUS_M_DEFAULT;
      if (radiusLabel)
        radiusLabel.innerText = String(state.settings.enterRadiusM);
      save();
    });
  }

  const arMode = $("ar-mode");
  const arLabel = $("ar-label");
  if (arMode) {
    arMode.value = state.settings.arMode || "easy";
    if (arLabel) arLabel.innerText = (arMode.value || "easy").toUpperCase();
    arMode.addEventListener("change", () => {
      state.settings.arMode = arMode.value || "easy";
      if (arLabel)
        arLabel.innerText = (state.settings.arMode || "easy").toUpperCase();
      save();
    });
  }

  const charSel = $("char-select");
  if (charSel) {
    charSel.value = state.settings.character || "hero_duo";
    charSel.addEventListener("change", () => {
      state.settings.character = charSel.value || "hero_duo";
      save();
      refreshHeroIcon();
      speak(`Character set: ${getCharacter().label}`);
    });
  }

  const participantSelect = $("participant-select");
  if (participantSelect) {
    participantSelect.value = state.activeParticipant || "both";
    participantSelect.addEventListener("change", () => {
      state.activeParticipant = participantSelect.value || "both";
      save();
      speak(`Active player set to ${activeParticipantLabel()}.`);
    });
  }

  onClick("btn-zoom-ui", () => {
    state.settings.zoomUI = !state.settings.zoomUI;
    if ($("zoomui-label")) {
      $("zoomui-label").innerText = state.settings.zoomUI ? "ON" : "OFF";
    }
    save();
    speak(state.settings.zoomUI ? "Zoom UI on." : "Zoom UI off.");
    setTimeout(() => location.reload(), 300);
  });

  const cd = $("cooldown-min");
  const cap = $("capture-need");
  const cdLab = $("cooldown-label");
  const capLab = $("capture-label");

  if (cd) {
    cd.value = String(state.rules.cooldownMin ?? 10);
    if (cdLab) cdLab.innerText = cd.value;
    cd.addEventListener("input", () => {
      state.rules.cooldownMin = parseInt(cd.value, 10) || 10;
      if (cdLab) cdLab.innerText = String(state.rules.cooldownMin);
      save();
      updateCaptureHud();
      initPins();
    });
  }

  if (cap) {
    cap.value = String(state.rules.captureNeed ?? 3);
    if (capLab) capLab.innerText = cap.value;
    cap.addEventListener("input", () => {
      state.rules.captureNeed = parseInt(cap.value, 10) || 3;
      if (capLab) capLab.innerText = String(state.rules.captureNeed);
      save();
      updateCaptureHud();
    });
  }

  onClick("btn-respawn-nodes", () => {
    Object.keys(state.nodes || {}).forEach((id) => {
      state.nodes[id].cooldownUntil = 0;
      state.nodes[id].completedModes = [];
      state.nodes[id].arVerified = false;
    });
    initPins();
    save();
    speak("All nodes reset.");
  });

  // AI
  onClick("btn-ai-start", aiStart);
  onClick("btn-ai-stop", () => aiStop(false));
  onClick("btn-ai-close", () => aiStop(true));
  onClick("btn-ai-capture", async () => {
    const ok = await aiCaptureAndVerify();
    if (ok && activeTask) {
      activeTask.passed = true;
      grantPassBonusOnce();
      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = `Verified! Photo saved. ${
          activeTask.fact || ""
        }`;
      }
      celebrateCorrect(activeTask.fact || "Verified activity complete!");
      toggleM("ai-modal", false);
      toggleM("task-modal", true);
      showRewardPanel(true);
    }
  });

  // Manual reward buttons
  onClick("btn-award-kylan", () => awardPendingTo("kylan"));
  onClick("btn-award-piper", () => awardPendingTo("piper"));
  onClick("btn-award-khyl", () => awardPendingTo("khyl"));
  onClick("btn-award-both", () => awardPendingTo("both"));

  // Gallery
  onClick("btn-gallery-close", () => toggleM("gallery-modal", false));
  onClick("btn-gallery-refresh", renderGallery);
  onClick("btn-gallery-clear", async () => {
    await clearPhotos();
    renderGallery();
    speak("Gallery cleared.");
  });

  onClick("btn-test", () => {
    speak("Systems online. GPS ready.");
    openGallery();
  });
}

// ===== AI =====
function openAI(template, { pinId, pinName, child, taskLabel, hint, voice }) {
  ai.template = template || "still";
  ai.pinId = pinId ?? null;
  ai.pinName = pinName || "";
  ai.child = child || "Both";
  ai.taskLabel = taskLabel || "Pose Challenge";

  if ($("ai-hint")) {
    $("ai-hint").innerText = hint || "Copy the pose, then press CAPTURE.";
  }
  if ($("ai-status")) $("ai-status").innerText = "Ready…";

  toggleM("ai-modal", true);
  if (voice) speak(voice);
}

async function ensureAIVerifier() {
  if (ai.verifier) return ai.verifier;
  ai.verifier = await createAIVerifier({
    videoEl: $("ai-video"),
    canvasEl: $("ai-canvas"),
    statusEl: $("ai-status"),
  });
  return ai.verifier;
}

async function aiStart() {
  const v = await ensureAIVerifier();
  ai.running = true;
  await v.start();
}

async function aiStop(close = false) {
  try {
    if (ai.verifier) await ai.verifier.stop();
  } catch {}
  ai.running = false;
  if (close) toggleM("ai-modal", false);
}

async function aiCaptureAndVerify() {
  const v = await ensureAIVerifier();
  const res = await v.captureAndVerify({
    template: ai.template,
    pinId: ai.pinId,
    pinName: ai.pinName,
    child: ai.child,
    taskLabel: ai.taskLabel,
    autosave: true,
  });

  if ($("ai-status")) {
    $("ai-status").innerText = res.ok
      ? `VERIFIED — ${res.reason}`
      : `NOT YET — ${res.reason}`;
  }

  speak(res.ok ? voiceLine("verified") : voiceLine("tryAgain"));
  return res.ok;
}

// ===== GALLERY =====
function blobToImgUrl(blob) {
  return URL.createObjectURL(blob);
}

async function renderGallery() {
  const wrap = $("gallery-list");
  if (!wrap) return;

  wrap.innerHTML = "<div style='opacity:.8'>Loading…</div>";
  const rows = await listPhotos(200);

  if (!rows.length) {
    wrap.innerHTML =
      "<div style='opacity:.8'>No saved photos yet. Do an AI Verify activity and it will save on success.</div>";
    return;
  }

  wrap.innerHTML = rows
    .map((r) => {
      const d = new Date(r.ts);
      const when = d.toLocaleString();
      const url = blobToImgUrl(r.blob);
      return `
        <div style="padding:10px;border:1px solid #333;border-radius:14px;margin:10px 0;background:#111;">
          <div style="font-weight:bold;">${r.pinName || "Unknown Pin"} — ${
        r.taskLabel || "Pose"
      }</div>
          <div style="opacity:.85;font-size:12px;margin-top:4px;">${when} • ${
        r.child || "Both"
      } • template: ${r.template}</div>
          <img src="${url}" style="width:100%;margin-top:10px;border-radius:12px;border:1px solid #222;" />
        </div>`;
    })
    .join("");
}

function openGallery() {
  toggleM("gallery-modal", true);
  renderGallery();
}

// ===== QUEST OPEN/CLOSE =====
function showPinBanners(pin) {
  const rule = getPinRule(pin);
  const modeBanner = $("mode-banner");
  const bossBanner = $("boss-banner");

  if (modeBanner) modeBanner.style.display = "none";
  if (bossBanner) bossBanner.style.display = "none";
  if (!rule) return;

  if (modeBanner) {
    modeBanner.style.display = "block";
    modeBanner.innerText = `${rule.label}\n${rule.banner || ""}`;
  }

  if (rule.type === "boss" && bossBanner) {
    bossBanner.style.display = "block";
    bossBanner.innerText = "BOSS MODE ACTIVE\nBoss phases enforced.";
  }
}

function openQuest() {
  if (!cur) return;

  const ns = nodeState(cur.id);
  if ($("q-name")) $("q-name").innerText = cur.n;

  $("map")?.classList.add("shatter-mode");
  toggleM("quest-modal", true);
  showPinBanners(cur);
  renderQuestModes(cur);

  const effectiveNeed = getEffectiveCaptureNeed(cur);

  if (isOnCooldown(cur.id)) {
    const mins = Math.ceil((ns.cooldownUntil - Date.now()) / 60000);
    if ($("quest-status")) {
      $(
        "quest-status"
      ).innerText = `STATUS: CAPTURED (reawakens in ~${mins} min)`;
    }
    if ($("btn-ar-open")) $("btn-ar-open").style.display = "none";
  } else {
    if ($("quest-status")) {
      $("quest-status").innerText = ns.arVerified
        ? `STATUS: VERIFIED (Complete ${effectiveNeed} modes to capture)`
        : `STATUS: READY — AR only needed for mission modes`;
    }
    if ($("btn-ar-open")) $("btn-ar-open").style.display = "block";
  }

  updateCaptureHud();
  speak("Node discovered. Select mode or verify.");
}

function closeQuest() {
  toggleM("quest-modal", false);
  $("map")?.classList.remove("shatter-mode");
}

// ===== AR VERIFY =====
function wireAR() {
  onClick("btn-ar-open", startARVerify);
  onClick("btn-ar-close", () => stopARVerify(true));
  onClick("btn-ar-stop", () => stopARVerify(false));
  onClick("btn-ar-manual", completeARVerify);
}

async function startARVerify() {
  if (!cur) return;

  toggleM("ar-modal", true);
  if ($("ar-hint"))
    $("ar-hint").innerText = cur?.ar?.hint || "Face the landmark and scan.";
  if ($("ar-readout")) $("ar-readout").innerText = "Heading: --";

  try {
    arStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    if ($("ar-video")) $("ar-video").srcObject = arStream;
  } catch {
    if ($("ar-hint")) {
      $("ar-hint").innerText +=
        " (Camera blocked; manual verify still possible.)";
    }
  }

  speak("AR verification started. Slowly turn and face the landmark.");
}

function stopARVerify(closeModal) {
  if (arStream) {
    arStream.getTracks().forEach((t) => t.stop());
    arStream = null;
  }
  if (closeModal) toggleM("ar-modal", false);
}

function completeARVerify() {
  if (!cur) return;

  const ns = nodeState(cur.id);
  if (ns.arVerified) return;

  ns.arVerified = true;
  save();
  stopARVerify(true);

  playSuccessSfx();
  burstEmoji(10, "📷");
  showRewardPopup("VERIFIED!", "Mission modes unlocked");
  speak("AR verified. Mission modes unlocked.");

  if ($("quest-status")) {
    $(
      "quest-status"
    ).innerText = `STATUS: VERIFIED (Complete ${getEffectiveCaptureNeed(
      cur
    )} modes to capture)`;
  }
}

// ===== MODES =====
function wireModes() {
  onClick("btn-close-quest", closeQuest);
  onClick("btn-task-close", () => toggleM("task-modal", false));
  onClick("btn-task-complete", finishMode);
}

let activeTask = null;

function launchMode(mode) {
  if (!cur) return;

  const actualMode = mode === "wildcard" ? resolveWildcardMode(cur) : mode;
  const ns = nodeState(cur.id);

  if (modeNeedsAR(actualMode) && !ns.arVerified) {
    speak("Verification required first for this mission.");
    showRewardPopup(
      "AR REQUIRED",
      `${MODE_META[actualMode]?.label || actualMode} needs AR first`
    );
    return;
  }

  if (ns.completedModes.includes(actualMode)) {
    speak("Mode already completed here. Choose a different mode.");
    return;
  }

  const allowed = allowedModesFor(cur);
  if (allowed && !allowed.includes(actualMode) && mode !== "wildcard") {
    speak("This mode is locked at this node.");
    return;
  }

  const tier = difficultyTier();
  const q = getQA(cur.id, actualMode, tier, state.session.qaSalt);

  activeTask = {
    displayMode: mode,
    mode: actualMode,
    requiresPass: true,
    passed: false,
    rewardedOnPass: false,
    prompt: q.q,
    options: q.options,
    answerIndex: q.answer,
    fact: q.fact || "",
    meta: q.meta || {},
  };

  if ($("task-title")) {
    $("task-title").innerText = `${
      MODE_META[mode]?.label || actualMode.toUpperCase()
    } @ ${cur.n}`;
  }
  if ($("task-desc")) $("task-desc").innerText = activeTask.prompt;

  renderOptions(activeTask);
  showRewardPanel(state.pendingReward > 0);

  if ($("task-feedback")) {
    $("task-feedback").style.display = "none";
    $("task-feedback").innerText = "";
  }

  toggleM("quest-modal", false);
  toggleM("task-modal", true);

  speak(activeTask.prompt);
}

function renderOptions(task) {
  const wrap = $("task-options");
  if (!wrap) return;

  wrap.innerHTML = "";
  (task.options || []).forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.className = "mcq-btn";
    btn.innerText = `${String.fromCharCode(65 + idx)}) ${opt}`;
    btn.addEventListener("click", () => selectOption(idx));
    wrap.appendChild(btn);
  });
}

function selectOption(idx) {
  if (!activeTask) return;

  // AI activity branch
  if (activeTask.mode === "activity" && activeTask.meta?.ai === true) {
    if (idx === 0) {
      toggleM("task-modal", false);
      openAI(activeTask.meta.template || "still", {
        pinId: cur?.id,
        pinName: cur?.n,
        child: activeTask.meta.child || "Both",
        taskLabel: activeTask.meta.label || "Pose Challenge",
        hint: activeTask.meta.hint || "Copy the pose, then press CAPTURE.",
        voice: activeTask.meta.voice || "Copy the pose, then press capture.",
      });
      return;
    }
    if (idx === 2 || idx === 3) {
      activeTask.passed = true;
      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText =
          idx === 2 ? "Skipped." : "Marked unsafe. Good call.";
      }
      speak("Okay.");
      return;
    }
    if (idx === 1) {
      speak("No worries. Start when ready.");
      return;
    }
  }

  // Simple task modes
  if (["battle", "speed", "family", "activity"].includes(activeTask.mode)) {
    const doneIndex = 0;
    const skipIndex = 2;
    const unsafeIndex = 3;

    if (idx === doneIndex) {
      activeTask.passed = true;
      grantPassBonusOnce();
      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = `Completed. Reward ready. ${
          activeTask.fact || ""
        }`;
      }
      celebrateCorrect(activeTask.fact || "Challenge complete!");
      return;
    }

    if (idx === skipIndex || idx === unsafeIndex) {
      activeTask.passed = true;
      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText =
          idx === skipIndex ? "Skipped." : "Marked unsafe. Good call.";
      }
      return;
    }

    if ($("task-feedback")) {
      $("task-feedback").style.display = "block";
      $("task-feedback").innerText = "Not yet. Complete it first.";
    }
    return;
  }

  // Health mode
  if (activeTask.mode === "health") {
    if (idx === 0) {
      const char = getCharacter();
      const base =
        activeTask.meta?.meters ?? (difficultyTier() === "kid" ? 30 : 80);
      const meters = Math.max(10, Math.round(base * (char.healthMult ?? 1.0)));
      healthActive = true;
      healthMeters = 0;
      healthTarget = meters;
      healthLast = null;
      activeTask.passed = false;
      speak("Tracking started. Keep walking.");
      return;
    }
    if (idx === 1) {
      healthActive = false;
      speak("Health tracking cancelled.");
      return;
    }
  }

  // Normal MCQ modes
  const correct = idx === activeTask.answerIndex;

  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").innerText = correct
      ? `Correct! Reward ready. ${activeTask.fact || ""}`
      : "Not quite. Try again.";
  }

  if (correct) {
    activeTask.passed = true;
    grantPassBonusOnce();
    celebrateCorrect(activeTask.fact || "Nice work!");
    speak(voiceLine("correct"));
  } else {
    warnTryAgain();
    speak("Not quite. Try again.");
  }
}

function finishMode() {
  if (!cur || !activeTask) return;
  if (activeTask.requiresPass && !activeTask.passed) {
    speak("You must complete this mode first.");
    return;
  }

  const ns = nodeState(cur.id);
  if (!ns.completedModes.includes(activeTask.mode)) {
    ns.completedModes.push(activeTask.mode);
  }

  const mult = getCharacter().pointsMult ?? 1.0;
  addPendingReward(Math.round(MODE_COMPLETE_COINS * mult));

  if (activeTask.meta?.familyChain) {
    addPendingReward(activeTask.meta.rewardCoins || 150);
  }

  save();
  showRewardPanel(true);

  const req = requiredModesFor(cur);
  if (req) {
    const leftReq = req.filter((m) => !ns.completedModes.includes(m));
    speak(
      leftReq.length > 0
        ? `Phase complete. Remaining: ${leftReq.join(", ")}.`
        : "All required phases complete."
    );
  } else {
    speak("Mission secure.");
  }

  const need = getEffectiveCaptureNeed(cur);
  const reqModes = requiredModesFor(cur);
  const reqOk = reqModes
    ? reqModes.every((m) => ns.completedModes.includes(m))
    : true;

  if (ns.completedModes.length >= need && reqOk) {
    captureNode(cur);
    return;
  }

  toggleM("task-modal", false);
  openQuest();
}

// ===== CAPTURE =====
function captureNode(pin) {
  const ns = nodeState(pin.id);
  ns.cooldownUntil = Date.now() + getEffectiveCooldownMs(pin);
  ns.arVerified = false;
  ns.completedModes = [];
  state.session.qaSalt = Date.now();

  if (activeMarkers[pin.id]) {
    map.removeLayer(activeMarkers[pin.id]);
    delete activeMarkers[pin.id];
  }

  addPendingReward(CAPTURE_BONUS_COINS);
  save();

  const rule = getPinRule(pin);
  const mins = rule?.cooldownMin ?? state.rules?.cooldownMin ?? 10;

  celebrateCapture(mins);
  showRewardPopup(
    "CAPTURE REWARD READY",
    `Choose who gets +${CAPTURE_BONUS_COINS} coins`
  );

  toggleM("task-modal", true);
  showRewardPanel(true);
  toggleM("quest-modal", false);
  $("map")?.classList.remove("shatter-mode");
  updateCaptureHud();
}

// ===== CAPTURE HUD =====
function updateCaptureHud() {
  const hud = $("capture-hud");
  if (!hud) return;

  if (!cur) {
    hud.innerText = "CAPTURE: —";
    return;
  }

  const ns = nodeState(cur.id);
  const need = getEffectiveCaptureNeed(cur);
  const left = Math.max(0, need - ns.completedModes.length);
  const rule = getPinRule(cur);
  const label = rule?.type === "boss" ? "BOSS" : "CAPTURE";

  hud.innerText = isOnCooldown(cur.id)
    ? `${label}: LOCKED`
    : `${label}: ${ns.completedModes.length}/${need} (need ${left} more)`;
}

// ===== HOME LOG =====
function renderHomeLog() {
  const sum = $("home-summary");
  const list = $("home-list");
  if (!sum || !list) return;

  const now = Date.now();
  let completed = 0;
  let locked = 0;
  const rows = [];

  PINS.forEach((p) => {
    const ns = nodeState(p.id);
    const onCd = ns.cooldownUntil && now < ns.cooldownUntil;
    const doneCount = ns.completedModes?.length || 0;

    if (onCd) locked++;
    if (doneCount > 0 || ns.arVerified || onCd) completed++;

    let status = "Fresh";
    if (onCd) {
      const mins = Math.ceil((ns.cooldownUntil - now) / 60000);
      status = `Captured (back in ~${mins}m)`;
    } else if (ns.arVerified) {
      status = `Verified (${doneCount}/${getEffectiveCaptureNeed(p)} modes)`;
    } else if (doneCount > 0) {
      status = `Progress (${doneCount}/${getEffectiveCaptureNeed(p)} modes)`;
    }

    rows.push({ name: p.n, status });
  });

  sum.innerHTML = `Pins: <b>${PINS.length}</b> | Active/seen: <b>${completed}</b> | Locked: <b>${locked}</b> | Kylan: <b>${state.k}</b> | Piper: <b>${state.p}</b> | KHYL: <b>${state.khyl}</b>`;

  list.innerHTML = rows
    .map(
      (r) => `
        <div style="padding:10px;border:1px solid #333;border-radius:12px;margin:8px 0;background:#111;">
          <div style="font-weight:bold;">${r.name}</div>
          <div style="opacity:.85;font-size:12px;">${r.status}</div>
        </div>`
    )
    .join("");
}

// ===== BOOT =====
function boot() {
  try {
    wireHUD();
    wireAR();
    initMap();
    wireModes();
    save();
    ensureRewardLayer();
    speak(voiceLine("welcome"));
    console.log("Barrow Quest booted");
  } catch (err) {
    console.error("Boot error:", err);
    if ($("capture-hud")) {
      $("capture-hud").innerText = "BOOT ERROR — check console";
    }
  }
}

window.addEventListener("DOMContentLoaded", boot);
