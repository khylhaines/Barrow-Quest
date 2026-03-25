// ai_verify.js
// Lightweight “pose verification” using MediaPipe Pose + camera.
// - Runs in-browser
// - Verifies simple templates: still, tpose, victory, hands_together
// - Saves verified photos into IndexedDB

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) {
      resolve();
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

async function ensureMediaPipePoseLoaded() {
  if (window.Pose && window.Camera) return;

  await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js");
  await loadScript(
    "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js"
  );
}

function kp(landmarks, idx) {
  return landmarks?.[idx] || null;
}

function dist(a, b) {
  if (!a || !b) return 999;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function above(a, b, pad = 0.02) {
  if (!a || !b) return false;
  return a.y < b.y - pad;
}

function near(a, b, max = 0.07) {
  return dist(a, b) <= max;
}

function roughlySameY(a, b, tol = 0.06) {
  if (!a || !b) return false;
  return Math.abs(a.y - b.y) <= tol;
}

function roughlyStraightArm(shoulder, elbow, wrist, tol = 0.18) {
  if (!shoulder || !elbow || !wrist) return false;
  const a = dist(shoulder, elbow);
  const b = dist(elbow, wrist);
  const c = dist(shoulder, wrist);
  return Math.abs(a + b - c) < tol;
}

function visibilityOK(landmarks, minVis = 0.45) {
  if (!landmarks) return false;
  const sampleIdx = [11, 12, 13, 14, 15, 16];

  for (const i of sampleIdx) {
    const p = landmarks[i];
    if (!p) return false;
    if (typeof p.visibility === "number" && p.visibility < minVis) {
      return false;
    }
  }

  return true;
}

function verifyTemplate(landmarks, template) {
  if (!landmarks) return { ok: false, reason: "No pose found" };

  if (!visibilityOK(landmarks)) {
    return { ok: false, reason: "Pose unclear — step back" };
  }

  const LS = kp(landmarks, 11);
  const RS = kp(landmarks, 12);
  const LE = kp(landmarks, 13);
  const RE = kp(landmarks, 14);
  const LW = kp(landmarks, 15);
  const RW = kp(landmarks, 16);
  const LH = kp(landmarks, 23);
  const RH = kp(landmarks, 24);

  if (!LS || !RS || !LW || !RW || !LH || !RH) {
    return { ok: false, reason: "Pose not fully visible" };
  }

  if (template === "still") {
    const shouldersAboveHips = above(LS, LH, 0.01) && above(RS, RH, 0.01);
    const wristsBelowShoulders = !above(LW, LS, 0.0) && !above(RW, RS, 0.0);

    return shouldersAboveHips && wristsBelowShoulders
      ? { ok: true, reason: "Still pose verified" }
      : { ok: false, reason: "Stand tall, arms relaxed" };
  }

  if (template === "tpose") {
    const yOK = roughlySameY(LW, LS) && roughlySameY(RW, RS);
    const armsOK =
      roughlyStraightArm(LS, LE, LW) && roughlyStraightArm(RS, RE, RW);

    return yOK && armsOK
      ? { ok: true, reason: "T-Pose verified" }
      : { ok: false, reason: "Arms straight out like a T" };
  }

  if (template === "victory") {
    const handsUp = above(LW, LS) && above(RW, RS);

    return handsUp
      ? { ok: true, reason: "Victory pose verified" }
      : { ok: false, reason: "Hands up above shoulders" };
  }

  if (template === "hands_together") {
    const together = near(LW, RW, 0.08);
    const chestBand =
      LW.y > Math.min(LS.y, RS.y) && LW.y < Math.max(LH.y, RH.y);

    return together && chestBand
      ? { ok: true, reason: "Hands-together pose verified" }
      : { ok: false, reason: "Put hands together at chest height" };
  }

  return { ok: false, reason: "Unknown template" };
}

/* =========================================================
   INDEXED DB
========================================================= */

const DB_NAME = "bq_ai_gallery_v1";
const DB_STORE = "photos";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(DB_STORE)) {
        const store = db.createObjectStore(DB_STORE, { keyPath: "id" });
        store.createIndex("byTime", "ts");
        store.createIndex("byPin", "pinId");
        store.createIndex("byChild", "child");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(entry) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(entry);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPhotos(limit = 200) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const idx = store.index("byTime");
    const out = [];

    idx.openCursor(null, "prev").onsuccess = (e) => {
      const cur = e.target.result;
      if (cur && out.length < limit) {
        out.push(cur.value);
        cur.continue();
      } else {
        resolve(out);
      }
    };

    tx.onerror = () => reject(tx.error);
  });
}

export async function clearPhotos() {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* =========================================================
   MAIN VERIFIER
========================================================= */

export async function createAIVerifier({ videoEl, canvasEl, statusEl }) {
  await ensureMediaPipePoseLoaded();

  let pose = null;
  let camera = null;
  let latestLandmarks = null;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  pose = new window.Pose({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  pose.onResults((res) => {
    latestLandmarks = res.poseLandmarks || null;

    if (!canvasEl || !videoEl) return;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    if (latestLandmarks) {
      ctx.fillStyle = "rgba(0,255,255,0.9)";
      for (const p of latestLandmarks) {
        const x = p.x * canvasEl.width;
        const y = p.y * canvasEl.height;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  async function start() {
    if (!videoEl) {
      setStatus("No video element.");
      return;
    }

    setStatus("Starting camera…");

    camera = new window.Camera(videoEl, {
      onFrame: async () => {
        await pose.send({ image: videoEl });
      },
      width: 640,
      height: 480,
    });

    await camera.start();
    setStatus("Camera ready. Copy the pose then press CAPTURE.");
  }

  async function stop() {
    try {
      if (camera) camera.stop();
    } catch {}

    camera = null;
    latestLandmarks = null;
    setStatus("Stopped.");
  }

  async function captureAndVerify({
    template,
    pinId,
    pinName,
    child = "Both",
    taskLabel = "Pose Challenge",
    autosave = true,
  }) {
    if (!videoEl) {
      return { ok: false, reason: "No video element" };
    }

    const snapCanvas = canvasEl || document.createElement("canvas");
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;

    snapCanvas.width = w;
    snapCanvas.height = h;

    const ctx = snapCanvas.getContext("2d");
    if (!ctx) {
      return { ok: false, reason: "Canvas unavailable" };
    }

    ctx.drawImage(videoEl, 0, 0, w, h);

    const verdict = verifyTemplate(latestLandmarks, template);

    const blob = await new Promise((resolve) =>
      snapCanvas.toBlob(resolve, "image/jpeg", 0.88)
    );

    if (verdict.ok && autosave && blob) {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      await savePhoto({
        id,
        ts: Date.now(),
        pinId: pinId ?? null,
        pinName: pinName ?? "",
        child,
        taskLabel,
        template,
        blob,
      });
    }

    return verdict;
  }

  return {
    start,
    stop,
    captureAndVerify,
  };
}
