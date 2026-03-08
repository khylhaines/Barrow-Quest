// app.js
import { PINS } from "./pins.js";
import { getQA } from "./qa.js";

const ENTER_RADIUS_M_DEFAULT = 30;
const PASS_BONUS_COINS = 10;
const CAPTURE_BONUS_COINS = 50;

let state = JSON.parse(localStorage.getItem("bq_safe_v1")) || {
  k: 0,
  p: 0,
  khyl: 0,
  activeParticipant: "both",
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

const $ = (id) => document.getElementById(id);

const CHARACTERS = {
  hero_duo: {
    label: "Hero Duo",
    iconHtml: `<div style="width:48px;height:48px;border-radius:50%;background:gold;display:flex;align-items:center;justify-content:center;font-size:24px;">🧭</div>`,
    pointsMult: 1,
    healthMult: 1,
  },
  ninja: {
    label: "Ninja Scout",
    iconHtml: `<div style="width:48px;height:48px;border-radius:50%;background:#4ea3ff;display:flex;align-items:center;justify-content:center;font-size:24px;">🥷</div>`,
    pointsMult: 1.1,
    healthMult: 0.9,
  },
  wizard: {
    label: "Wizard Guide",
    iconHtml: `<div style="width:48px;height:48px;border-radius:50%;background:#9b59b6;display:flex;align-items:center;justify-content:center;font-size:24px;">🧙</div>`,
    pointsMult: 1,
    healthMult: 1,
  },
  robot: {
    label: "Robo Ranger",
    iconHtml: `<div style="width:48px;height:48px;border-radius:50%;background:#5fffd7;display:flex;align-items:center;justify-content:center;font-size:24px;">🤖</div>`,
    pointsMult: 1.2,
    healthMult: 1.15,
  },
  pirate: {
    label: "Pirate Captain",
    iconHtml: `<div style="width:48px;height:48px;border-radius:50%;background:#ff5d73;display:flex;align-items:center;justify-content:center;font-size:24px;">🏴‍☠️</div>`,
    pointsMult: 1.15,
    healthMult: 1.05,
  },
};

let map = null;
let hero = null;
let cur = null;
let activeMarkers = {};
let activeTask = null;
let healthActive = false;
let healthLast = null;
let healthMeters = 0;
let healthTarget = 0;

function getCharacter() {
  const key = state.settings?.character || "hero_duo";
  return CHARACTERS[key] || CHARACTERS.hero_duo;
}

function nodeState(id) {
  if (!state.nodes[id]) {
    state.nodes[id] = { completedModes: [], cooldownUntil: 0 };
  }
  return state.nodes[id];
}

function isOnCooldown(id) {
  const ns = nodeState(id);
  return ns.cooldownUntil && Date.now() < ns.cooldownUntil;
}

function getVisiblePins() {
  return PINS;
}

function speak(t) {
  if (!t) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(t));
    u.lang = "en-GB";
    synth.speak(u);
  } catch {}
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

function save() {
  localStorage.setItem("bq_safe_v1", JSON.stringify(state));
  if ($("h-k")) $("h-k").innerText = state.k || 0;
  if ($("h-p")) $("h-p").innerText = state.p || 0;
  if ($("h-me")) $("h-me").innerText = state.khyl || 0;
}

function refreshHeroIcon() {
  if (!hero) return;
  hero.setIcon(
    L.divIcon({
      className: "marker-logo",
      html: getCharacter().iconHtml,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    })
  );
}

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([54.1137, -3.2184], 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

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

function initPins() {
  if (!map) return;

  Object.values(activeMarkers).forEach((m) => map.removeLayer(m));
  activeMarkers = {};

  getVisiblePins().forEach((p) => {
    if (!isOnCooldown(p.id)) {
      const m = L.marker(p.l, {
        icon: L.divIcon({
          className: "marker-logo",
          html: `<div style="width:40px;height:40px;border-radius:50%;background:white;display:flex;align-items:center;justify-content:center;font-size:22px;">${p.i || "📍"}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      }).addTo(map);
      activeMarkers[p.id] = m;
    }
  });
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
        fb.innerText = `Distance: ${Math.round(healthMeters)}m / ${healthTarget}m`;
      }
      if (healthMeters >= healthTarget) {
        healthActive = false;
        activeTask.passed = true;
        activeTask.pendingReward = PASS_BONUS_COINS + 100;
        showRewardOnly("Health complete. Choose who gets the points.");
      }
    }

    const near = getVisiblePins().find(
      (p) =>
        map.distance(e.latlng, p.l) <
          (parseInt(state.settings?.enterRadiusM ?? ENTER_RADIUS_M_DEFAULT, 10) || 30) &&
        !isOnCooldown(p.id)
    );

    if (near) {
      cur = near;
      if ($("action-trigger")) $("action-trigger").style.display = "block";
    } else {
      cur = null;
      if ($("action-trigger")) $("action-trigger").style.display = "none";
      if ($("capture-hud")) $("capture-hud").innerText = "CAPTURE: -";
    }

    updateCaptureHud();
  });

  map.on("locationerror", () => {
    console.warn("GPS blocked/unavailable.");
  });
}

function updateCaptureHud() {
  const hud = $("capture-hud");
  if (!hud) return;
  if (!cur) {
    hud.innerText = "CAPTURE: -";
    return;
  }
  const ns = nodeState(cur.id);
  const need = parseInt(state.rules?.captureNeed ?? 3, 10) || 3;
  const left = Math.max(0, need - ns.completedModes.length);
  hud.innerText = isOnCooldown(cur.id)
    ? "CAPTURE: LOCKED"
    : `CAPTURE: ${ns.completedModes.length}/${need} (need ${left} more)`;
}

function openQuest() {
  if (!cur) return;
  if ($("q-name")) $("q-name").innerText = cur.n;
  if ($("quest-status")) $("quest-status").innerText = "STATUS: READY";
  toggleM("quest-modal", true);
}

function closeQuest() {
  toggleM("quest-modal", false);
}

function showRewardPanel(show = true) {
  const panel = $("reward-panel");
  if (panel) panel.style.display = show ? "block" : "none";
}

function showRewardOnly(message) {
  if ($("task-desc")) $("task-desc").style.display = "none";
  if ($("task-options")) $("task-options").innerHTML = "";
  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").innerText = message || "Reward ready.";
  }
  showRewardPanel(true);
}

function resetTaskView() {
  if ($("task-desc")) $("task-desc").style.display = "block";
  if ($("task-feedback")) {
    $("task-feedback").style.display = "none";
    $("task-feedback").innerText = "";
  }
  showRewardPanel(false);
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
  if (ns.completedModes.includes(mode)) {
    speak("Mode already completed here.");
    return;
  }

  const wildcard = maybeWildcard();
  const q =
    wildcard || getQA(cur.id, mode, difficultyTier(), state.session.qaSalt);

  activeTask = {
    mode,
    passed: false,
    pendingReward: 0,
    prompt: q.q,
    options: q.options,
    answerIndex: q.answer,
    fact: q.fact || "",
    meta: q.meta || {},
  };

  if ($("task-title")) $("task-title").innerText = `${mode.toUpperCase()} @ ${cur.n}`;
  if ($("task-desc")) $("task-desc").innerText = activeTask.prompt;

  resetTaskView();
  renderOptions(activeTask);

  toggleM("quest-modal", false);
  toggleM("task-modal", true);
}

function renderOptions(task) {
  const wrap = $("task-options");
  if (!wrap) return;

  wrap.innerHTML = (task.options || [])
    .map(
      (opt, idx) =>
        `<button class="mcq-btn" data-idx="${idx}">${String.fromCharCode(
          65 + idx
        )}) ${opt}</button>`
    )
    .join("");

  wrap.querySelectorAll(".mcq-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectOption(parseInt(btn.dataset.idx, 10));
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
      healthTarget = Math.max(10, Math.round(base * (char.healthMult ?? 1)));
      healthActive = true;
      healthMeters = 0;
      healthLast = null;
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
      activeTask.pendingReward = PASS_BONUS_COINS + 100;
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
  if (!correct) {
    if ($("task-feedback")) {
      $("task-feedback").style.display = "block";
      $("task-feedback").innerText = "Not quite. Try again.";
    }
    warnTryAgain();
    return;
  }

  activeTask.passed = true;
  activeTask.pendingReward =
    (activeTask.meta?.rewardCoins || PASS_BONUS_COINS) +
    Math.round(100 * (getCharacter().pointsMult ?? 1));

  celebrateCorrect(activeTask.fact || "Nice work!");
  showRewardOnly(activeTask.fact || "Correct. Choose who gets the points.");
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
}

function getPendingRewardAmount() {
  if (activeTask?.pendingReward) return activeTask.pendingReward;
  if (state.pendingCaptureReward) return state.pendingCaptureReward;
  return PASS_BONUS_COINS;
}

function clearPendingRewards() {
  if (activeTask) activeTask.pendingReward = 0;
  state.pendingCaptureReward = 0;
  save();
}

function finalizeReward(target) {
  if (!cur) return;

  const amount = getPendingRewardAmount();
  awardPointsTo(target, amount);
  clearPendingRewards();
  showRewardPanel(false);

  if (activeTask && activeTask.mode) {
    const ns = nodeState(cur.id);
    if (!ns.completedModes.includes(activeTask.mode)) {
      ns.completedModes.push(activeTask.mode);
      completeMissionProgress();
    }

    const need = parseInt(state.rules?.captureNeed ?? 3, 10) || 3;

    toggleM("task-modal", false);

    if (ns.completedModes.length >= need) {
      captureNode(cur);
    } else {
      save();
      openQuest();
    }
    return;
  }

  toggleM("task-modal", false);
  save();
}

function captureNode(pin) {
  const ns = nodeState(pin.id);
  ns.cooldownUntil =
    Date.now() + ((parseInt(state.rules?.cooldownMin ?? 10, 10) || 10) * 60000);
  ns.completedModes = [];

  if (activeMarkers[pin.id]) {
    map.removeLayer(activeMarkers[pin.id]);
    delete activeMarkers[pin.id];
  }

  state.pendingCaptureReward = CAPTURE_BONUS_COINS;
  save();

  celebrateCapture(parseInt(state.rules?.cooldownMin ?? 10, 10) || 10);

  if ($("task-title")) $("task-title").innerText = "NODE CAPTURED";
  if ($("task-desc")) $("task-desc").style.display = "none";
  if ($("task-options")) $("task-options").innerHTML = "";
  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
    $("task-feedback").innerText = "Choose who gets the capture reward.";
  }

  toggleM("task-modal", true);
  showRewardPanel(true);
  toggleM("quest-modal", false);
  updateCaptureHud();
}

function renderHomeLog() {
  const sum = $("home-summary");
  const list = $("home-list");
  if (!sum || !list) return;

  const now = Date.now();
  let locked = 0;
  const rows = [];

  getVisiblePins().forEach((p) => {
    const ns = nodeState(p.id);
    const onCd = ns.cooldownUntil && now < ns.cooldownUntil;
    const doneCount = ns.completedModes?.length || 0;
    if (onCd) locked++;

    let status = "Fresh";
    if (onCd) {
      const mins = Math.ceil((ns.cooldownUntil - now) / 60000);
      status = `Captured (back in ~${mins}m)`;
    } else if (doneCount > 0) {
      status = `Progress (${doneCount}/${state.rules.captureNeed || 3} modes)`;
    }

    rows.push({ name: p.n, status });
  });

  sum.innerHTML = `Pins: <b>${getVisiblePins().length}</b> | Locked: <b>${locked}</b> | Kylan: <b>${state.k}</b> | Piper: <b>${state.p}</b> | KHYL: <b>${state.khyl}</b>`;

  list.innerHTML = rows
    .map(
      (r) =>
        `<div style="padding:10px;border:1px solid #333;border-radius:12px;margin:8px 0;background:#111;"><div style="font-weight:bold;">${r.name}</div><div style="opacity:.85;font-size:12px;">${r.status}</div></div>`
    )
    .join("");
}

function wireHUD() {
  onClick("btn-home", () => {
    renderHomeLog();
    toggleM("home-modal", true);
  });
  onClick("btn-home-close", () => toggleM("home-modal", false));
  onClick("btn-close-commander", () => toggleM("commander-hub", false));
  onClick("btn-close-settings", () => toggleM("settings-modal", false));
  onClick("btn-close-commander-x", () => toggleM("commander-hub", false));
  onClick("btn-close-settings-x", () => toggleM("settings-modal", false));
  onClick("btn-home-close-x", () => toggleM("home-modal", false));
  onClick("btn-settings", () => toggleM("settings-modal", true));
  onClick("btn-commander", () => toggleM("commander-hub", true));
  onClick("action-trigger", openQuest);

  onClick("btn-award-kylan", () => finalizeReward("kylan"));
  onClick("btn-award-piper", () => finalizeReward("piper"));
  onClick("btn-award-khyl", () => finalizeReward("khyl"));
  onClick("btn-award-both", () => finalizeReward("both"));

  onClick("btn-task-close", () => toggleM("task-modal", false));
  onClick("btn-close-quest", closeQuest);

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
  const radiusLabel = $("radius-label");
  if (radius) {
    radius.value = String(state.settings.enterRadiusM ?? 30);
    if (radiusLabel) radiusLabel.innerText = radius.value;
    radius.addEventListener("input", () => {
      state.settings.enterRadiusM = parseInt(radius.value, 10) || 30;
      if (radiusLabel) radiusLabel.innerText = radius.value;
      save();
    });
  }

  const cd = $("cooldown-min");
  const cdLab = $("cooldown-label");
  if (cd) {
    cd.value = String(state.rules.cooldownMin ?? 10);
    if (cdLab) cdLab.innerText = cd.value;
    cd.addEventListener("input", () => {
      state.rules.cooldownMin = parseInt(cd.value, 10) || 10;
      if (cdLab) cdLab.innerText = cd.value;
      save();
    });
  }

  const cap = $("capture-need");
  const capLab = $("capture-label");
  if (cap) {
    cap.value = String(state.rules.captureNeed ?? 3);
    if (capLab) capLab.innerText = cap.value;
    cap.addEventListener("input", () => {
      state.rules.captureNeed = parseInt(cap.value, 10) || 3;
      if (capLab) capLab.innerText = cap.value;
      save();
      updateCaptureHud();
    });
  }

  onClick("btn-start", () => {
    save();
    initPins();
  });

  document.querySelectorAll(".m-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      launchMode(tile.getAttribute("data-mode"));
    });
  });
}

function boot() {
  initMap();
  wireHUD();
  save();
}
window.addEventListener("DOMContentLoaded", boot);
