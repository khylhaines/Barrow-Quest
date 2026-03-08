// app.js
import { PINS } from "./pins.js";
import { getQA } from "./qa.js";
import { listPhotos, clearPhotos } from "./ai_verify.js";

/**
 * Barrow Quest Engine
 * - GPS proximity trigger
 * - AR verify gating (manual verify supported)
 * - Mode selection
 * - Manual reward assignment for ALL modes
 * - AI Verify disabled for stability
 * - Stable option button wiring
 * - Experience filter support (Park / Docks / Full Barrow)
 */

const AI_VERIFY_ENABLED = false;

// ===== CONFIG =====
const ENTER_RADIUS_M_DEFAULT = 30;
const PASS_BONUS_COINS = 10;
const CAPTURE_BONUS_COINS = 50;

// ===== STATE =====
let state = JSON.parse(localStorage.getItem("bq_master_v3")) || {
  k: 0,
  p: 0,
  khyl: 0,
  activeParticipant: "both",
  pendingCaptureReward: 0,
  dk: 7,
  dp: 3,
  hpK: false,
  hpP: false,
  nodes: {},
  rules: { cooldownMin: 10, captureNeed: 3 },
  currentExperience: "park",
};

state.k = state.k ?? 0;
state.p = state.p ?? 0;
state.khyl = state.khyl ?? 0;
state.activeParticipant = state.activeParticipant || "both";
state.pendingCaptureReward = state.pendingCaptureReward ?? 0;
state.rules = state.rules || { cooldownMin: 10, captureNeed: 3 };
state.nodes = state.nodes || {};
state.currentExperience = state.currentExperience || "park";

state.session = state.session || {};
state.session.qaSalt = state.session.qaSalt ?? Date.now();
state.session.missionsCompleted = state.session.missionsCompleted ?? 0;
state.session.rank = state.session.rank ?? 1;

// settings defaults
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

// ===== DOM =====
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

// ===== RANK SYSTEM =====
const RANK_TABLE = [
  { rank: 1, missions: 0 },
  { rank: 2, missions: 10 },
  { rank: 3, missions: 25 },
  { rank: 4, missions: 50 },
  { rank: 5, missions: 100 },
];

function updateRank() {
  let nextRank = 1;
  for (const row of RANK_TABLE) {
    if ((state.session.missionsCompleted ?? 0) >= row.missions) {
      nextRank = row.rank;
    }
  }
  state.session.rank = nextRank;
  save();
}

function completeMissionProgress() {
  state.session.missionsCompleted = (state.session.missionsCompleted ?? 0) + 1;
  updateRank();
  save();
}

function getRank() {
  return state.session.rank ?? 1;
}

// ===== Character system =====
const CHARACTERS = {
  hero_duo: {
    label: "Hero Duo",
    iconHtml: `<div style="font-size:50px">HD</div>`,
    pointsMult: 1.0,
    healthMult: 1.0,
    arBonus: 1.0,
  },
  ninja: {
    label: "Ninja Scout",
    iconHtml: `<div style="font-size:50px">N</div>`,
    pointsMult: 1.1,
    healthMult: 0.9,
    arBonus: 0.9,
  },
  wizard: {
    label: "Wizard Guide",
    iconHtml: `<div style="font-size:50px">W</div>`,
    pointsMult: 1.0,
    healthMult: 1.0,
    arBonus: 1.25,
  },
  robot: {
    label: "Robo Ranger",
    iconHtml: `<div style="font-size:50px">R</div>`,
    pointsMult: 1.2,
    healthMult: 1.15,
    arBonus: 0.85,
  },
  pirate: {
    label: "Pirate Captain",
    iconHtml: `<div style="font-size:50px">P</div>`,
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
    allowedModes: ["battle", "logic", "speed", "quiz"],
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

// ===== AI VERIFY STATE (disabled) =====
let ai = {
  running: false,
};

// ===== VOICE PACK =====
const VOICE_PACK = {
  kid: {
    welcome: "Hey explorers! Welcome back!",
    nearPin: "Nice! You found a mission spot. Tap the lightning button!",
    verified: "Verified! Nice one!",
    tryAgain: "Nearly! Try again.",
    correct: "Brilliant! You got it right!",
    reward: "Reward ready.",
    capture: "Node captured! Great work!",
  },
  teen: {
    welcome: "Alright. Mission time.",
    nearPin: "You're in range. Hit the lightning button.",
    verified: "Verified.",
    tryAgain: "Close. Run it again.",
    correct: "Correct.",
    reward: "Reward ready.",
    capture: "Node captured.",
  },
};

function cleanSpeechText(text) {
  return String(text || "").replace(/[^\w\s.,!?'"():;\-]/g, "");
}

function voiceLine(key) {
  const pack = difficultyTier() === "kid" ? VOICE_PACK.kid : VOICE_PACK.teen;
  return pack[key] || "";
}

// ===== SAFE CLICK WIRING =====
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

function speak(t) {
  if (!t) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const cleaned = cleanSpeechText(t);
    const u = new SpeechSynthesisUtterance(cleaned);
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

function activeParticipantLabel() {
  if (state.activeParticipant === "kylan") return "Kylan";
  if (state.activeParticipant === "piper") return "Piper";
  if (state.activeParticipant === "khyl") return "KHYL";
  return "Both";
}

function awardPointsTo(target, amount) {
  const gain = Math.max(0, Math.round(amount || 0));
  if (!gain) return;

  if (target === "kylan") state.k += gain;
  else if (target === "piper") state.p += gain;
  else if (target === "khyl") state.khyl += gain;
  else if (target === "both") {
    state.k += gain;
    state.p += gain;
  }

  save();
  playSuccessSfx();
  pulseCoinsHud();
  burstEmoji(10, "COIN");
  showRewardPopup(`+${gain} COINS`, `${target.toUpperCase()} awarded!`);
}

function showRewardPanel(show = true) {
  const panel = $("reward-panel");
  if (panel) panel.style.display = show ? "block" : "none";
}

function getPendingRewardAmount() {
  if (activeTask?.pendingReward) return activeTask.pendingReward;
  if (state.pendingCaptureReward) return state.pendingCaptureReward;
  return PASS_BONUS_COINS;
}

function clearPendingRewards() {
  if (activeTask) {
    activeTask.rewardedOnPass = true;
    activeTask.pendingReward = 0;
  }
  state.pendingCaptureReward = 0;
  save();
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

function burstEmoji(count = 12, emoji = "STAR") {
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
  }, 3200);
  setTimeout(() => card.remove(), 3700);
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
  burstEmoji(14, "STAR");
  showRewardPopup("CORRECT!", fact || "Great job, explorer!");
}

function celebrateCapture(mins) {
  playCaptureSfx();
  burstEmoji(18, "TROPHY");
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
    $("hp-k-tag").innerText = state.hpK ? "ACTIVE" : "OFF";
  }

  if ($("hp-p-tag")) {
    $("hp-p-tag").className = state.hpP
      ? "hp-status hp-on"
      : "hp-status hp-off";
    $("hp-p-tag").innerText = state.hpP ? "ACTIVE" : "OFF";
  }

  updateCaptureHud();
  updateRankHud();
}

function updateRankHud() {
  const existing = $("rank-hud");
  if (!existing) return;
  const next = RANK_TABLE.find((x) => x.rank > getRank());
  existing.innerText = next
    ? `RANK ${getRank()} | MISSIONS ${state.session.missionsCompleted} | NEXT ${next.missions}`
    : `RANK ${getRank()} | MISSIONS ${state.session.missionsCompleted} | MAX`;
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

// ===== EXPERIENCE + UNLOCKING =====
function pinMatchesExperience(pin) {
  const exp = state.currentExperience || "park";
  if (exp === "full") return true;
  if (exp === "park") return pin.zone === "Nature";
  if (exp === "docks") {
    return pin.zone === "Docks" || pin.zone === "Industrial";
  }
  return true;
}

function pinUnlockedForRank(pin) {
  const rank = getRank();

  if (state.currentExperience === "park") {
    if (rank === 1) return pin.id <= 7 || pin.id === 35 || pin.id === 37;
    if (rank === 2) return pin.zone === "Nature";
    return pin.zone === "Nature";
  }

  if (state.currentExperience === "docks") {
    if (rank === 1) return [3, 13, 24, 46, 69, 81].includes(pin.id);
    if (rank === 2) return pin.zone === "Docks" || pin.zone === "Industrial";
    return pin.zone === "Docks" || pin.zone === "Industrial";
  }

  if (rank === 1) return pin.id <= 20;
  if (rank === 2) return pin.id <= 40;
  if (rank === 3) return pin.id <= 70;
  if (rank === 4) return pin.id <= 100;
  return true;
}

function getVisiblePins() {
  return PINS.filter(
    (pin) => pinMatchesExperience(pin) && pinUnlockedForRank(pin)
  );
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

  getVisiblePins().forEach((p) => {
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
        if (fb) {
          fb.innerText = `Completed Distance: ${healthMeters.toFixed(0)}m`;
        }
        if (activeTask) {
          activeTask.passed = true;
          activeTask.pendingReward = PASS_BONUS_COINS;
        }
        celebrateCorrect("Health objective complete!");
        showRewardPanel(true);
        speak("Health objective complete.");
      }
    }

    const visiblePins = getVisiblePins();
    const near = visiblePins.find(
      (p) => map.distance(e.latlng, p.l) < getEnterRadiusM() && !isOnCooldown(p.id)
    );

    if (near) {
      if (!cur || cur.id !== near.id) speak(voiceLine("nearPin"));
      cur = near;
      if ($("action-trigger")) $("action-trigger").style.display = "block";
      updateCaptureHud();
    } else {
      if ($("action-trigger")) $("action-trigger").style.display = "none";
      cur = null;
      if ($("capture-hud")) $("capture-hud").innerText = "CAPTURE: -";
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
      if (radiusLabel) {
        radiusLabel.innerText = String(state.settings.enterRadiusM);
      }
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
      if (arLabel) {
        arLabel.innerText = (state.settings.arMode || "easy").toUpperCase();
      }
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

  // reward buttons
  onClick("btn-award-kylan", () => {
    const amount = getPendingRewardAmount();
    awardPointsTo("kylan", amount);
    clearPendingRewards();
    showRewardPanel(false);
  });

  onClick("btn-award-piper", () => {
    const amount = getPendingRewardAmount();
    awardPointsTo("piper", amount);
    clearPendingRewards();
    showRewardPanel(false);
  });

  onClick("btn-award-khyl", () => {
    const amount = getPendingRewardAmount();
    awardPointsTo("khyl", amount);
    clearPendingRewards();
    showRewardPanel(false);
  });

  onClick("btn-award-both", () => {
    const amount = getPendingRewardAmount();
    awardPointsTo("both", amount);
    clearPendingRewards();
    showRewardPanel(false);
  });

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

  // start screen choices
  onClick("btn-start", () => {
    initExperienceFromStart();
    initPins();
    save();
  });

  const kids = $("pill-kids");
  const teen = $("pill-teen");
  if (kids && teen) {
    kids.addEventListener("click", () => {
      if ($("dp")) $("dp").value = "3";
      state.dp = 3;
      save();
    });
    teen.addEventListener("click", () => {
      if ($("dp")) $("dp").value = "8";
      state.dp = 8;
      save();
    });
  }
}

function initExperienceFromStart() {
  if ($("pill-park")?.classList.contains("active")) {
    state.currentExperience = "park";
  } else if ($("pill-docks")?.classList.contains("active")) {
    state.currentExperience = "docks";
  } else {
    state.currentExperience = "full";
  }
}

// ===== AI disabled helpers =====
function openAI() {
  showRewardPopup("AI VERIFY OFF", "Activity will use normal completion only.");
}

async function renderGallery() {
  const wrap = $("gallery-list");
  if (!wrap) return;
  wrap.innerHTML = "<div style='opacity:.8'>Loading...</div>";

  const rows = await listPhotos(200);
  if (!rows.length) {
    wrap.innerHTML =
      "<div style='opacity:.8'>No saved photos yet.</div>";
    return;
  }

  wrap.innerHTML = rows
    .map((r) => {
      const d = new Date(r.ts);
      const when = d.toLocaleString();
      const url = URL.createObjectURL(r.blob);
      return `
        <div style="padding:10px;border:1px solid #333;border-radius:14px;margin:10px 0;background:#111;">
          <div style="font-weight:bold;">${r.pinName || "Unknown Pin"} - ${
        r.taskLabel || "Pose"
      }</div>
          <div style="opacity:.85;font-size:12px;margin-top:4px;">${when}</div>
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

  const effectiveNeed = getEffectiveCaptureNeed(cur);

  if (isOnCooldown(cur.id)) {
    const mins = Math.ceil((ns.cooldownUntil - Date.now()) / 60000);
    if ($("quest-status")) {
      $("quest-status").innerText = `STATUS: CAPTURED (reawakens in ~${mins} min)`;
    }
    if ($("btn-ar-open")) $("btn-ar-open").style.display = "none";
    disableModeTiles(true);
  } else if (!ns.arVerified) {
    if ($("quest-status")) $("quest-status").innerText = "STATUS: NEEDS AR VERIFY";
    if ($("btn-ar-open")) $("btn-ar-open").style.display = "block";
    disableModeTiles(true);
  } else {
    if ($("quest-status")) {
      $("quest-status").innerText = `STATUS: VERIFIED (Complete ${effectiveNeed} modes to capture)`;
    }
    if ($("btn-ar-open")) $("btn-ar-open").style.display = "none";
    disableModeTiles(false);

    const allowed = allowedModesFor(cur);
    if (allowed) {
      document.querySelectorAll(".m-tile").forEach((tile) => {
        const mode = tile.getAttribute("data-mode");
        const ok = allowed.includes(mode);
        tile.style.opacity = ok ? "1" : "0.2";
        tile.style.pointerEvents = ok ? "auto" : "none";
      });
    } else {
      document.querySelectorAll(".m-tile").forEach((tile) => {
        tile.style.opacity = "1";
        tile.style.pointerEvents = "auto";
      });
    }
  }

  updateCaptureHud();
  speak("Node discovered. Select mode or verify.");
}

function closeQuest() {
  toggleM("quest-modal", false);
  $("map")?.classList.remove("shatter-mode");
}

function disableModeTiles(disabled) {
  document.querySelectorAll(".m-tile").forEach((tile) => {
    tile.style.opacity = disabled ? "0.35" : "1";
    tile.style.pointerEvents = disabled ? "none" : "auto";
  });
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
  if ($("ar-hint")) {
    $("ar-hint").innerText = cur?.ar?.hint || "Face the landmark and scan.";
  }
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
  burstEmoji(10, "CAM");
  showRewardPopup("VERIFIED!", "Node unlocked");
  speak("AR verified. Node unlocked.");

  if ($("quest-status")) {
    $("quest-status").innerText = `STATUS: VERIFIED (Complete ${getEffectiveCaptureNeed(
      cur
    )} modes to capture)`;
  }

  if ($("btn-ar-open")) $("btn-ar-open").style.display = "none";
  disableModeTiles(false);
}

// ===== MODE LAUNCH =====
function wireModes() {
  onClick("btn-close-quest", closeQuest);
  onClick("btn-task-close", () => toggleM("task-modal", false));
  onClick("btn-task-complete", finishMode);

  document.querySelectorAll(".m-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const mode = tile.getAttribute("data-mode");
      launchMode(mode);
    });
  });
}

let activeTask = null;

function difficultyTier() {
  return state.dp <= 4 ? "kid" : "adult";
}

function maybeWildcard() {
  const roll = Math.random();
  if (roll > 0.05) return null;

  return {
    q: "WILDCARD: Treasure chest discovered!",
    options: ["OPEN CHEST", "LEAVE IT", "SKIP", "UNSAFE"],
    answer: 0,
    fact: "Lucky find! Rare reward ready.",
    meta: { wildcard: true, rewardCoins: 250 },
  };
}

function launchMode(mode) {
  if (!cur) return;

  const ns = nodeState(cur.id);

  if (!ns.arVerified) {
    speak("Verification required first.");
    return;
  }

  const allowed = allowedModesFor(cur);
  if (allowed && !allowed.includes(mode)) {
    speak("This mode is locked at this node.");
    return;
  }

  if (ns.completedModes.includes(mode)) {
    speak("Mode already completed here. Choose a different mode.");
    return;
  }

  const tier = difficultyTier();
  const wildcard = maybeWildcard();
  const q = wildcard || getQA(cur.id, mode, tier, state.session.qaSalt);

  activeTask = {
    mode,
    requiresPass: true,
    passed: false,
    rewardedOnPass: false,
    pendingReward: 0,
    prompt: q.q,
    options: q.options,
    answerIndex: q.answer,
    fact: q.fact || "",
    meta: q.meta || {},
  };

  if ($("task-title")) {
    $("task-title").innerText = `${mode.toUpperCase()} @ ${cur.n}`;
  }
  if ($("task-desc")) $("task-desc").innerText = activeTask.prompt;

  renderOptions(activeTask);
  showRewardPanel(false);

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

  wrap.innerHTML = (task.options || [])
    .map(
      (opt, idx) => `
        <button class="mcq-btn" data-idx="${idx}">
          ${String.fromCharCode(65 + idx)}) ${opt}
        </button>
      `
    )
    .join("");

  wrap.querySelectorAll(".mcq-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      selectOption(idx);
    });
  });
}

function selectOption(idx) {
  if (!activeTask) return;

  if (
    AI_VERIFY_ENABLED &&
    activeTask.mode === "activity" &&
    activeTask.meta?.ai === true
  ) {
    if (idx === 0) {
      toggleM("task-modal", false);
      openAI();
      return;
    }
  }

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

  if (
    activeTask.mode === "battle" ||
    activeTask.mode === "speed" ||
    activeTask.mode === "family" ||
    activeTask.mode === "activity"
  ) {
    if (idx === 0) {
      activeTask.passed = true;
      activeTask.pendingReward = PASS_BONUS_COINS;

      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = activeTask.fact || "Completed. Reward ready.";
      }

      celebrateCorrect(activeTask.fact || "Completed.");
      showRewardPanel(true);
      return;
    }

    if (idx === 1) {
      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = "Not yet.";
      }
      return;
    }

    if (idx === 2 || idx === 3) {
      activeTask.passed = true;
      activeTask.pendingReward = 0;
      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = idx === 2 ? "Skipped." : "Marked unsafe.";
      }
      showRewardPanel(false);
      return;
    }
  }

  const correct = idx === activeTask.answerIndex;

  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").innerText = correct
      ? `Correct! Reward ready. ${activeTask.fact || ""}`
      : "Not quite. Try again.";
  }

  if (correct) {
    activeTask.pendingReward = activeTask.meta?.rewardCoins || PASS_BONUS_COINS;
    celebrateCorrect(activeTask.fact || "Nice work!");
    speak(voiceLine("correct"));
    showRewardPanel(true);
  } else {
    warnTryAgain();
    speak("Not quite. Try again.");
  }

  activeTask.passed = correct;
}

function finishMode() {
  if (!cur || !activeTask) return;

  if (activeTask.requiresPass && !activeTask.passed) {
    speak("You must complete this mode first.");
    return;
  }

  const ns = nodeState(cur.id);
  ns.completedModes.push(activeTask.mode);
  completeMissionProgress();
  save();

  const mult = getCharacter().pointsMult ?? 1.0;
  const gain = Math.round(100 * mult);
  activeTask.pendingReward = (activeTask.pendingReward || 0) + gain;

  if (activeTask.meta?.familyChain) {
    const bonus = activeTask.meta.rewardCoins || 150;
    activeTask.pendingReward = (activeTask.pendingReward || 0) + bonus;

    if ($("task-feedback")) {
      $("task-feedback").style.display = "block";
      $("task-feedback").innerText = `FAMILY CHAIN COMPLETE!\nBonus ready to award\n${
        activeTask.meta.badge || "Family Badge"
      } unlocked`;
    }

    speak("Family chain complete. Choose who gets the reward.");
    showRewardPanel(true);
  }

  if (activeTask.meta?.wildcard) {
    showRewardPanel(true);
    speak("Wildcard complete. Choose who gets the reward.");
  }

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

  toggleM("task-modal", false);

  const need = getEffectiveCaptureNeed(cur);
  const reqModes = requiredModesFor(cur);
  const reqOk = reqModes
    ? reqModes.every((m) => ns.completedModes.includes(m))
    : true;

  if (ns.completedModes.length >= need && reqOk) {
    captureNode(cur);
  } else {
    openQuest();
  }
}

// ===== CAPTURE + COOLDOWN =====
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

  save();

  const rule = getPinRule(pin);
  const mins = rule?.cooldownMin ?? state.rules?.cooldownMin ?? 10;
  celebrateCapture(mins);

  showRewardPopup(
    "CAPTURE REWARD READY",
    `Choose who gets +${CAPTURE_BONUS_COINS} coins`
  );

  state.pendingCaptureReward = CAPTURE_BONUS_COINS;
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
    hud.innerText = "CAPTURE: -";
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

  getVisiblePins().forEach((p) => {
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

  sum.innerHTML = `Pins: <b>${getVisiblePins().length}</b> | Active/seen: <b>${completed}</b> | Locked: <b>${locked}</b> | Kylan: <b>${state.k}</b> | Piper: <b>${state.p}</b> | KHYL: <b>${state.khyl}</b> | Rank: <b>${getRank()}</b>`;

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

// ===== SMALL UI ADDITIONS =====
function injectRankHud() {
  if ($("rank-hud")) return;
  const coinHud = $("coin-hud");
  if (!coinHud) return;

  const div = document.createElement("div");
  div.id = "rank-hud";
  div.style.marginTop = "6px";
  div.style.fontSize = "12px";
  div.style.color = "var(--gold)";
  coinHud.appendChild(div);
  updateRankHud();
}

// ===== BOOT =====
function boot() {
  try {
    wireHUD();
    wireAR();
    injectRankHud();
    initMap();
    wireModes();
    updateRank();
    save();
    ensureRewardLayer();
    speak(voiceLine("welcome"));
    console.log("Barrow Quest booted");
  } catch (err) {
    console.error("Boot error:", err);
    if ($("capture-hud")) {
      $("capture-hud").innerText = "BOOT ERROR - check console";
    }
  }
}

window.addEventListener("DOMContentLoaded", boot);
