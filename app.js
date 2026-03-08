import { PINS } from "./pins.js";
import { getQA } from "./qa.js";

const ENTER_RADIUS_M_DEFAULT = 30;
const PASS_BONUS_COINS = 10;
const CAPTURE_BONUS_COINS = 50;

let state = JSON.parse(localStorage.getItem("bq_clean_v2")) || {
  k: 0,
  p: 0,
  khyl: 0,
  activeParticipant: "both",
  currentExperience: "park",
  enterRadiusM: 30,
  captureNeed: 3,
  missionsCompleted: 0,
  rank: 1,
  nodes: {},
};

const $ = (id) => document.getElementById(id);

let map = null;
let hero = null;
let cur = null;
let markers = {};
let activeTask = null;
let pendingReward = 0;

let healthActive = false;
let healthTarget = 0;
let healthMeters = 0;
let healthLast = null;

const RANK_TABLE = [
  { rank: 1, missions: 0 },
  { rank: 2, missions: 10 },
  { rank: 3, missions: 25 },
  { rank: 4, missions: 50 },
  { rank: 5, missions: 100 },
];

function save() {
  localStorage.setItem("bq_clean_v2", JSON.stringify(state));

  if ($("h-k")) $("h-k").innerText = state.k;
  if ($("h-p")) $("h-p").innerText = state.p;
  if ($("h-me")) $("h-me").innerText = state.khyl;

  if ($("rank-hud")) {
    $("rank-hud").innerText = `RANK ${state.rank} | MISSIONS ${state.missionsCompleted}`;
  }

  if ($("radius-label")) $("radius-label").innerText = state.enterRadiusM;
  if ($("capture-label")) $("capture-label").innerText = state.captureNeed;

  updateCaptureHud();
}

function updateRank() {
  let rank = 1;
  for (const row of RANK_TABLE) {
    if (state.missionsCompleted >= row.missions) rank = row.rank;
  }
  state.rank = rank;
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
  const n = nodeState(id);
  return n.cooldownUntil && Date.now() < n.cooldownUntil;
}

function awardPointsTo(target, amount) {
  const gain = Math.max(0, Math.round(amount || 0));
  if (!gain) return;

  if (target === "kylan") {
    state.k += gain;
  } else if (target === "piper") {
    state.p += gain;
  } else if (target === "khyl") {
    state.khyl += gain;
  } else {
    state.k += gain;
    state.p += gain;
  }

  pendingReward = 0;
  showRewardPanel(false);
  save();
}

function showRewardPanel(show) {
  const panel = $("reward-panel");
  if (panel) panel.style.display = show ? "block" : "none";
}

function getVisiblePins() {
  const exp = state.currentExperience;

  return PINS.filter((pin) => {
    if (exp === "park" && pin.zone !== "Nature") return false;
    if (exp === "docks" && !["Docks", "Industrial"].includes(pin.zone)) {
      return false;
    }

    if (exp === "full") {
      if (state.rank === 1) return pin.id <= 20;
      if (state.rank === 2) return pin.id <= 40;
      if (state.rank === 3) return pin.id <= 70;
      if (state.rank === 4) return pin.id <= 100;
      return true;
    }

    if (exp === "park") {
      if (state.rank === 1) return [5, 6, 7, 35, 37, 38, 85, 86].includes(pin.id);
      return pin.zone === "Nature";
    }

    if (exp === "docks") {
      if (state.rank === 1) return [3, 13, 24, 46, 69, 81].includes(pin.id);
      return ["Docks", "Industrial"].includes(pin.zone);
    }

    return true;
  });
}

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([54.1137, -3.2184], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  hero = L.marker([54.1137, -3.2184]).addTo(map);

  initPins();
  startGPSWatcher();
}

function initPins() {
  Object.values(markers).forEach((m) => map.removeLayer(m));
  markers = {};

  getVisiblePins().forEach((pin) => {
    if (isOnCooldown(pin.id)) return;
    const m = L.marker(pin.l).addTo(map);
    markers[pin.id] = m;
  });

  save();
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
    hero.setLatLng(e.latlng);

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
        if (activeTask) activeTask.passed = true;
        pendingReward = PASS_BONUS_COINS;

        if ($("task-feedback")) {
          $("task-feedback").style.display = "block";
          $("task-feedback").innerText = "Health mission complete. Reward ready.";
        }

        showRewardPanel(true);
      }
    }

    const near = getVisiblePins().find(
      (pin) => map.distance(e.latlng, pin.l) < state.enterRadiusM && !isOnCooldown(pin.id)
    );

    if (near) {
      cur = near;
      if ($("action-trigger")) $("action-trigger").style.display = "block";
      updateCaptureHud();
    } else {
      cur = null;
      if ($("action-trigger")) $("action-trigger").style.display = "none";
      if ($("capture-hud")) $("capture-hud").innerText = "CAPTURE: -";
    }
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
  const left = Math.max(0, state.captureNeed - ns.completedModes.length);

  hud.innerText = isOnCooldown(cur.id)
    ? "CAPTURE: LOCKED"
    : `CAPTURE: ${ns.completedModes.length}/${state.captureNeed} (need ${left} more)`;
}

function openQuest() {
  if (!cur) return;

  const ns = nodeState(cur.id);
  if ($("q-name")) $("q-name").innerText = cur.n;
  if ($("quest-modal")) $("quest-modal").style.display = "block";

  if (isOnCooldown(cur.id)) {
    if ($("quest-status")) $("quest-status").innerText = "STATUS: CAPTURED";
    disableModeTiles(true);
  } else {
    if ($("quest-status")) {
      $("quest-status").innerText = `STATUS: READY (${ns.completedModes.length}/${state.captureNeed})`;
    }
    disableModeTiles(false);
  }
}

function disableModeTiles(disabled) {
  document.querySelectorAll(".m-tile").forEach((tile) => {
    tile.style.opacity = disabled ? "0.35" : "1";
    tile.style.pointerEvents = disabled ? "none" : "auto";
  });
}

function difficultyTier() {
  return $("pill-kids")?.classList.contains("active") ? "kid" : "adult";
}

function launchMode(mode) {
  if (!cur) return;

  const ns = nodeState(cur.id);
  if (ns.completedModes.includes(mode)) return;

  const task = getQA(cur.id, mode, difficultyTier(), Date.now());

  activeTask = {
    mode,
    passed: false,
    answerIndex: task.answer,
    options: task.options,
    prompt: task.q,
    fact: task.fact || "",
    meta: task.meta || {},
  };

  if ($("task-title")) $("task-title").innerText = `${mode.toUpperCase()} @ ${cur.n}`;
  if ($("task-desc")) $("task-desc").innerText = activeTask.prompt;

  if ($("task-feedback")) {
    $("task-feedback").style.display = "none";
    $("task-feedback").innerText = "";
  }

  showRewardPanel(false);
  renderOptions(activeTask);

  if ($("quest-modal")) $("quest-modal").style.display = "none";
  if ($("task-modal")) $("task-modal").style.display = "block";
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
      selectOption(Number(btn.dataset.idx));
    });
  });
}

function selectOption(idx) {
  if (!activeTask) return;

  if (activeTask.mode === "health") {
    if (idx === 0) {
      healthActive = true;
      healthTarget = activeTask.meta?.meters || 30;
      healthMeters = 0;
      healthLast = null;

      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = "Tracking started.";
      }
      return;
    }

    if (idx === 1) {
      healthActive = false;
      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = "Cancelled.";
      }
      return;
    }
  }

  if (["battle", "speed", "activity", "family"].includes(activeTask.mode)) {
    if (idx === 0) {
      activeTask.passed = true;
      pendingReward = PASS_BONUS_COINS + (activeTask.meta?.rewardCoins || 0);

      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = activeTask.fact || "Completed. Reward ready.";
      }

      showRewardPanel(true);
      return;
    }

    if (idx === 2 || idx === 3) {
      activeTask.passed = true;
      pendingReward = 0;

      if ($("task-feedback")) {
        $("task-feedback").style.display = "block";
        $("task-feedback").innerText = idx === 2 ? "Skipped." : "Marked unsafe.";
      }
      return;
    }
  }

  const correct = idx === activeTask.answerIndex;
  activeTask.passed = correct;

  if ($("task-feedback")) {
    $("task-feedback").style.display = "block";
  }

  if (correct) {
    pendingReward = PASS_BONUS_COINS + (activeTask.meta?.rewardCoins || 0);
    if ($("task-feedback")) {
      $("task-feedback").innerText = `Correct. ${activeTask.fact || "Reward ready."}`;
    }
    showRewardPanel(true);
  } else {
    if ($("task-feedback")) {
      $("task-feedback").innerText = "Not quite. Try again.";
    }
  }
}

function finishMode() {
  if (!cur || !activeTask || !activeTask.passed) return;

  const ns = nodeState(cur.id);
  ns.completedModes.push(activeTask.mode);

  state.missionsCompleted += 1;
  updateRank();

  if ($("task-modal")) $("task-modal").style.display = "none";

  if (ns.completedModes.length >= state.captureNeed) {
    captureNode(cur);
  } else {
    openQuest();
  }

  save();
}

function captureNode(pin) {
  const ns = nodeState(pin.id);
  ns.cooldownUntil = Date.now() + 10 * 60 * 1000;
  ns.completedModes = [];

  pendingReward += CAPTURE_BONUS_COINS;

  if ($("task-modal")) $("task-modal").style.display = "block";
  if ($("task-title")) $("task-title").innerText = "NODE CAPTURED";
  if ($("task-desc")) $("task-desc").innerText = `Reward ready: +${pendingReward} coins`;
  if ($("task-options")) $("task-options").innerHTML = "";
  if ($("task-feedback")) $("task-feedback").style.display = "none";

  showRewardPanel(true);
  initPins();
}

function renderHomeLog() {
  const pins = getVisiblePins();
  const now = Date.now();
  let locked = 0;
  let seen = 0;

  const rows = pins.map((pin) => {
    const ns = nodeState(pin.id);
    const onCd = ns.cooldownUntil && now < ns.cooldownUntil;
    if (onCd) locked++;
    if (ns.completedModes.length || onCd) seen++;

    let status = "Fresh";
    if (onCd) status = "Captured";
    else if (ns.completedModes.length) {
      status = `Progress (${ns.completedModes.length}/${state.captureNeed})`;
    }

    return `<div class="home-row"><div><strong>${pin.n}</strong></div><div>${status}</div></div>`;
  });

  if ($("home-summary")) {
    $("home-summary").innerHTML = `Pins: <b>${pins.length}</b> | Seen: <b>${seen}</b> | Locked: <b>${locked}</b>`;
  }
  if ($("home-list")) {
    $("home-list").innerHTML = rows.join("");
  }
}

function wireButtons() {
  $("btn-home")?.addEventListener("click", () => {
    renderHomeLog();
    $("home-modal").style.display = "block";
  });

  $("btn-home-close")?.addEventListener("click", () => {
    $("home-modal").style.display = "none";
  });

  $("btn-settings")?.addEventListener("click", () => {
    $("settings-modal").style.display = "block";
  });

  $("btn-close-settings")?.addEventListener("click", () => {
    $("settings-modal").style.display = "none";
  });

  $("btn-close-quest")?.addEventListener("click", () => {
    $("quest-modal").style.display = "none";
  });

  $("btn-task-close")?.addEventListener("click", () => {
    $("task-modal").style.display = "none";
  });

  $("action-trigger")?.addEventListener("click", openQuest);
  $("btn-task-complete")?.addEventListener("click", finishMode);

  $("btn-award-kylan")?.addEventListener("click", () =>
    awardPointsTo("kylan", pendingReward)
  );
  $("btn-award-piper")?.addEventListener("click", () =>
    awardPointsTo("piper", pendingReward)
  );
  $("btn-award-khyl")?.addEventListener("click", () =>
    awardPointsTo("khyl", pendingReward)
  );
  $("btn-award-both")?.addEventListener("click", () =>
    awardPointsTo("both", pendingReward)
  );

  $("participant-select")?.addEventListener("change", (e) => {
    state.activeParticipant = e.target.value;
    save();
  });

  $("enter-radius")?.addEventListener("input", (e) => {
    state.enterRadiusM = Number(e.target.value || 30);
    save();
  });

  $("capture-need")?.addEventListener("input", (e) => {
    state.captureNeed = Number(e.target.value || 3);
    save();
  });

  document.querySelectorAll(".m-tile").forEach((tile) => {
    tile.addEventListener("click", () => launchMode(tile.dataset.mode));
  });

  $("btn-start")?.addEventListener("click", () => {
    if ($("pill-park")?.classList.contains("active")) state.currentExperience = "park";
    else if ($("pill-docks")?.classList.contains("active")) state.currentExperience = "docks";
    else state.currentExperience = "full";

    initPins();
    save();
  });
}

function boot() {
  updateRank();
  wireButtons();
  initMap();
  save();
}

window.addEventListener("DOMContentLoaded", boot);
