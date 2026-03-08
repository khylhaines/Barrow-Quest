// app.js
import { PINS } from "./pins.js";
import { getQA } from "./qa.js";

const ENTER_RADIUS_M_DEFAULT = 30;
const PASS_BONUS_COINS = 10;
const CAPTURE_BONUS_COINS = 50;

let state = JSON.parse(localStorage.getItem("bq_master_v7")) || {
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
  currentExperience: "full",
  settings: {
    voiceRate: 1,
    sfxVol: 80,
    enterRadiusM: 30,
    character: "hero_duo",
    zoomUI: false,
  },
  session: {
    qaSalt: Date.now(),
    missionsCompleted: 0,
    rank: 1,
  },
};

state.nodes = state.nodes || {};
state.rules = state.rules || { cooldownMin: 10, captureNeed: 3 };
state.settings = state.settings || {};
state.session = state.session || {};
state.settings.voiceRate = state.settings.voiceRate ?? 1;
state.settings.sfxVol = state.settings.sfxVol ?? 80;
state.settings.enterRadiusM =
  state.settings.enterRadiusM ?? ENTER_RADIUS_M_DEFAULT;
state.settings.character = state.settings.character ?? "hero_duo";
state.settings.zoomUI = state.settings.zoomUI ?? false;
state.session.qaSalt = state.session.qaSalt ?? Date.now();
state.session.missionsCompleted = state.session.missionsCompleted ?? 0;
state.session.rank = state.session.rank ?? 1;

const $ = (id) => document.getElementById(id);

const RANK_TABLE = [
  { rank: 1, missions: 0 },
  { rank: 2, missions: 10 },
  { rank: 3, missions: 25 },
  { rank: 4, missions: 50 },
  { rank: 5, missions: 100 },
];

const CHARACTERS = {
  hero_duo: {
    label: "Hero Duo",
    iconHtml: `
      <div style="
        width:48px;height:48px;border-radius:50%;
        background:radial-gradient(circle at 35% 30%, #fff7a8, #f1c40f 45%, #9a6f00 100%);
        border:3px solid #fff3b0;
        box-shadow:0 0 18px rgba(241,196,15,.75);
        display:flex;align-items:center;justify-content:center;
        font-size:24px;line-height:1;
      ">🧭</div>`,
    pointsMult: 1,
    healthMult: 1,
  },
  ninja: {
    label: "Ninja Scout",
    iconHtml: `
      <div style="
        width:48px;height:48px;border-radius:50%;
        background:radial-gradient(circle at 35% 30%, #d8e6ff, #4ea3ff 50%, #173b6e 100%);
        border:3px solid #cfe1ff;
        box-shadow:0 0 18px rgba(78,163,255,.75);
        display:flex;align-items:center;justify-content:center;
        font-size:24px;line-height:1;
      ">🥷</div>`,
    pointsMult: 1.1,
    healthMult: 0.9,
  },
  wizard: {
    label: "Wizard Guide",
    iconHtml: `
      <div style="
        width:48px;height:48px;border-radius:50%;
        background:radial-gradient(circle at 35% 30%, #efe1ff, #9b59b6 50%, #4b245d 100%);
        border:3px solid #f0d9ff;
        box-shadow:0 0 18px rgba(155,89,182,.75);
        display:flex;align-items:center;justify-content:center;
        font-size:24px;line-height:1;
      ">🧙</div>`,
    pointsMult: 1,
    healthMult: 1,
  },
  robot: {
    label: "Robo Ranger",
    iconHtml: `
      <div style="
        width:48px;height:48px;border-radius:50%;
        background:radial-gradient(circle at 35% 30%, #dffcff, #5fffd7 50%, #11665b 100%);
        border:3px solid #dffff4;
        box-shadow:0 0 18px rgba(95,255,215,.75);
        display:flex;align-items:center;justify-content:center;
        font-size:24px;line-height:1;
      ">🤖</div>`,
    pointsMult: 1.2,
    healthMult: 1.15,
  },
  pirate: {
    label: "Pirate Captain",
    iconHtml: `
      <div style="
        width:48px;height:48px;border-radius:50%;
        background:radial-gradient(circle at 35% 30%, #ffe0e6, #ff5d73 50%, #7f2131 100%);
        border:3px solid #ffd4dc;
        box-shadow:0 0 18px rgba(255,93,115,.75);
        display:flex;align-items:center;justify-content:center;
        font-size:24px;line-height:1;
      ">🏴‍☠️</div>`,
    pointsMult: 1.15,
    healthMult: 1.05,
  },
};

const PIN_RULES = {
  1: {
    label: "HOME BASE PROTOCOL",
    type: "foundation",
    captureNeed: 2,
    requiredModes: ["quiz", "history"],
    cooldownMin: 5,
    banner: "Home Base: Complete QUIZ + HISTORY to establish the link.",
  },
  4: {
    label: "CENOTAPH PROTOCOL",
    type: "reflection",
    captureNeed: 3,
    requiredModes: ["history", "family", "activity"],
    cooldownMin: 15,
    banner: "Cenotaph: HISTORY + FAMILY + ACTIVITY required.",
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

const VOICE_PACK = {
  kid: {
    welcome: "Hey explorers! Welcome back!",
    nearPin: "Nice! You found a mission spot. Tap the lightning button!",
    correct: "Brilliant! You got it right!",
    capture: "Node captured! Great work!",
  },
  teen: {
    welcome: "Alright. Mission time.",
    nearPin: "You're in range. Hit the lightning button.",
    correct: "Correct.",
    capture: "Node captured.",
  },
};

let map = null;
let hero = null;
let cur = null;
let activeTask = null;
let activeMarkers = {};
let audioCtx = null;

let healthActive = false;
let healthLast = null;
let healthMeters = 0;
let healthTarget = 0;

function getCharacter() {
  const key = state.settings?.character || "hero_duo";
  return CHARACTERS[key] || CHARACTERS.hero_duo;
}

function getRank() {
  return state.session.rank ?? 1;
}

function updateRank() {
  let nextRank = 1;
  for (const row of RANK_TABLE) {
    if ((state.session.missionsCompleted ?? 0) >= row.missions) {
      nextRank = row.rank;
    }
  }
  state.session.rank = nextRank;
}

function completeMissionProgress() {
  state.session.missionsCompleted = (state.session.missionsCompleted ?? 0) + 1;
  updateRank();
}

function getCaptureNeed() {
  return state.rules?.captureNeed ?? 3;
}

function getEnterRadiusM() {
  const v = parseInt(
    state.settings?.enterRadiusM ?? ENTER_RADIUS_M_DEFAULT,
    10
  );
  return Number.isFinite(v) ? v : ENTER_RADIUS_M_DEFAULT;
}

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

function nodeState(id) {
  if (!state.nodes[id]) {
    state.nodes[id] = {
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

// All pins always visible now.
function pinMatchesExperience(_pin) {
  return true;
}

function pinUnlockedForRank(_pin) {
  return true;
}

function getVisiblePins() {
  return PINS.filter(
    (pin) => pinMatchesExperience(pin) && pinUnlockedForRank(pin)
  );
}

function cleanSpeechText(text) {
  return String(text || "").replace(/[^\w\s.,!?'"():;\-]/g, "");
}

function difficultyTier() {
  return state.dp <= 4 ? "kid" : "adult";
}

function voiceLine(key) {
  const pack = difficultyTier() === "kid" ? VOICE_PACK.kid : VOICE_PACK.teen;
  return pack[key] || "";
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
  const m = $(id);
  if (!m) return;
  if (typeof force === "boolean") {
    m.style.display = force ? "block" : "none";
    return;
  }
  m.style.display = m.style.display === "block" ? "none" : "block";
}

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

function showRewardOnly(message) {
  const desc = $("task-desc");
  const options = $("task-options");
  const feedback = $("task-feedback");
  const completeBtn = $("btn-task-complete");

  if (desc) desc.style.display = "none";
  if (options) options.innerHTML = "";
  if (feedback) {
    feedback.style.display = "block";
    feedback.innerText = message || "Reward ready.";
  }
  if (completeBtn) completeBtn.style.display = "none";

  showRewardPanel(true);
}

function resetTaskView() {
  const desc = $("task-desc");
  const feedback = $("task-feedback");
  const completeBtn = $("btn-task-complete");

  if (desc) desc.style.display = "block";
  if (feedback) {
    feedback.style.display = "none";
    feedback.innerText = "";
  }
  if (completeBtn) completeBtn.style.display = "none";
  showRewardPanel(false);
}

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
      className: "marker-logo",
      html: getCharacter().iconHtml,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    }),
  }).addTo(map);

  initPins();
  startGPSWatcher();
}

function refreshHeroIcon() {
  if (!hero) return;
  const c = getCharacter();
  hero.setIcon(
    L.divIcon({
      className: "marker-logo",
      html: c.iconHtml,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    })
  );
}

function initPins() {
  if (!map) return;

  Object.values(activeMarkers).forEach((m) => map.removeLayer(m));
  activeMarkers = {};

  getVisiblePins().forEach((p) => {
    if (!isOnCooldown(p.id)) {
      const m = L.marker(p.l, {
        icon: L.divIcon({
          className: "marker-logo",
          html: `
            <div style="
              width:40px;
              height:40px;
              border-radius:50%;
              background:radial-gradient(circle at 35% 30%, #ffffff, #e9ecff 45%, #8c95b8 100%);
              border:2px solid #ffffff;
              box-shadow:0 0 14px rgba(255,255,255,.45);
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:22px;
              line-height:1;
            ">${p.i || "📍"}</div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      }).addTo(map);
      activeMarkers[p.id] = m;
    }
  });

  save();
}

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
        if (activeTask) {
          activeTask.passed = true;
          activeTask.pendingReward =
            PASS_BONUS_COINS +
            Math.round(100 * (getCharacter().pointsMult ?? 1));
        }
        celebrateCorrect("Health objective complete!");
        showRewardOnly("Health objective complete. Choose who gets the points.");
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
    disableModeTiles(true);
  } else {
    if ($("quest-status")) {
      $("quest-status").innerText = `STATUS: READY (Complete ${effectiveNeed} modes to capture)`;
    }
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
  speak("Node discovered. Select mode.");
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

  resetTaskView();
  renderOptions(activeTask);

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
      toggleM("task-modal", false);
      openQuest();
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
      activeTask.pendingReward =
        PASS_BONUS_COINS +
        Math.round(100 * (getCharacter().pointsMult ?? 1));
      celebrateCorrect(activeTask.fact || "Completed.");
      showRewardOnly(activeTask.fact || "Completed. Choose who gets the points.");
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
      toggleM("task-modal", false);
      openQuest();
      return;
    }
  }

  const correct = idx === activeTask.answerIndex;

  if (correct) {
    activeTask.passed = true;
    activeTask.pendingReward =
      (activeTask.meta?.rewardCoins || PASS_BONUS_COINS) +
      Math.round(100 * (getCharacter().pointsMult ?? 1));

    celebrateCorrect(activeTask.fact || "Nice work!");
    speak(voiceLine("correct"));
    showRewardOnly(activeTask.fact || "Correct. Choose who gets the points.");
  } else {
    if ($("task-feedback")) {
      $("task-feedback").style.display = "block";
      $("task-feedback").innerText = "Not quite. Try again.";
    }
    warnTryAgain();
    speak("Not quite. Try again.");
  }
}

function finalizeReward(target) {
  if (!cur || !activeTask) return;

  const amount = getPendingRewardAmount();
  awardPointsTo(target, amount);
  clearPendingRewards();
  showRewardPanel(false);

  const ns = nodeState(cur.id);
  if (!ns.completedModes.includes(activeTask.mode)) {
    ns.completedModes.push(activeTask.mode);
    completeMissionProgress();
    save();
  }

  const need = getEffectiveCaptureNeed(cur);
  const reqModes = requiredModesFor(cur);
  const reqOk = reqModes
    ? reqModes.every((m) => ns.completedModes.includes(m))
    : true;

  toggleM("task-modal", false);

  if (ns.completedModes.length >= need && reqOk) {
    captureNode(cur);
  } else {
    openQuest();
  }
}

function captureNode(pin) {
  const ns = nodeState(pin.id);
  ns.cooldownUntil = Date.now() + getEffectiveCooldownMs(pin);
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

  if ($("task-title")) $("task-title").innerText = "NODE CAPTURED";
  if ($("task-desc")) {
    $("task-desc").style.display = "none";
  }
  if ($("task-options")) {
    $("task-options").innerHTML = "";
  }
  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").innerText = "Choose who gets the capture reward.";
  }

  showRewardPanel(true);
  toggleM("quest-modal", false);
  $("map")?.classList.remove("shatter-mode");
  updateCaptureHud();
}

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
    if (doneCount > 0 || onCd) completed++;

    let status = "Fresh";
    if (onCd) {
      const mins = Math.ceil((ns.cooldownUntil - now) / 60000);
      status = `Captured (back in ~${mins}m)`;
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
    });
    initPins();
    save();
    speak("All nodes reset.");
  });

  onClick("btn-award-kylan", () => finalizeReward("kylan"));
  onClick("btn-award-piper", () => finalizeReward("piper"));
  onClick("btn-award-khyl", () => finalizeReward("khyl"));
  onClick("btn-award-both", () => finalizeReward("both"));

  onClick("btn-test", () => {
    speak("Systems online. GPS ready.");
    showRewardPopup("SYSTEMS OK", "All pins unlocked and reward flow simplified.");
  });

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

function wireModes() {
  onClick("btn-close-quest", closeQuest);
  onClick("btn-task-close", () => toggleM("task-modal", false));

  document.querySelectorAll(".m-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      const mode = tile.getAttribute("data-mode");
      launchMode(mode);
    });
  });
}

function boot() {
  try {
    wireHUD();
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
