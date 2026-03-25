/* =========================================================
   BARROW QUEST PROGRESSION SYSTEM
   - Persistent (localStorage)
   - Coins, XP, Levels
   - Stats tracking
   - Badge unlocking
========================================================= */

const STORAGE_KEY = "barrow_quest_player";

/* =========================================================
   DEFAULT PLAYER
========================================================= */

function createDefaultPlayer() {
  return {
    coins: 0,
    xp: 0,
    level: 1,

    badges: [],
    titles: [],
    equippedTitle: null,

    ownedItems: [],
    equippedCharacter: "explorer",

    stats: {
      pinsVisited: 0,
      quizzesCorrect: 0,
      activitiesDone: 0,
      logicSolved: 0,
      familyTasks: 0,
      bossesBeaten: 0,
      discoveries: 0,
      respectMoments: 0,
    },
  };
}

/* =========================================================
   LOAD / SAVE
========================================================= */

export function loadPlayer() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return createDefaultPlayer();
    return JSON.parse(data);
  } catch {
    return createDefaultPlayer();
  }
}

export function savePlayer(player) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
}

/* =========================================================
   LEVEL SYSTEM
========================================================= */

function getXPForNextLevel(level) {
  return 100 + level * 50;
}

function handleLevelUp(player) {
  let needed = getXPForNextLevel(player.level);

  let levelUps = 0;

  while (player.xp >= needed) {
    player.xp -= needed;
    player.level += 1;
    levelUps++;

    needed = getXPForNextLevel(player.level);
  }

  return levelUps;
}

/* =========================================================
   BADGES
========================================================= */

const BADGES = [
  {
    id: "first_steps",
    name: "First Steps",
    check: (p) => p.stats.pinsVisited >= 1,
  },
  {
    id: "town_explorer",
    name: "Town Explorer",
    check: (p) => p.stats.pinsVisited >= 10,
  },
  {
    id: "action_scout",
    name: "Action Scout",
    check: (p) => p.stats.activitiesDone >= 20,
  },
  {
    id: "clue_finder",
    name: "Clue Finder",
    check: (p) => p.stats.logicSolved >= 5,
  },
  {
    id: "team_player",
    name: "Team Player",
    check: (p) => p.stats.familyTasks >= 5,
  },
  {
    id: "boss_rookie",
    name: "Boss Rookie",
    check: (p) => p.stats.bossesBeaten >= 1,
  },
  {
    id: "memory_keeper",
    name: "Memory Keeper",
    check: (p) => p.stats.respectMoments >= 5,
  },
  {
    id: "discoverer",
    name: "Discoverer",
    check: (p) => p.stats.discoveries >= 3,
  },
];

function checkBadges(player) {
  const unlocked = [];

  for (const badge of BADGES) {
    if (badge.check(player) && !player.badges.includes(badge.id)) {
      player.badges.push(badge.id);
      unlocked.push(badge.name);
    }
  }

  return unlocked;
}

/* =========================================================
   REWARD HANDLER
========================================================= */

export function applyReward({ mode = "quiz", correct = true }) {
  const player = loadPlayer();

  let coins = 0;
  let xp = 0;

  /* ===== MODE REWARDS ===== */

  switch (mode) {
    case "activity":
      coins = 5;
      xp = 5;
      player.stats.activitiesDone++;
      break;

    case "quiz":
      if (correct) {
        coins = 10;
        xp = 10;
        player.stats.quizzesCorrect++;
      }
      break;

    case "logic":
      coins = 15;
      xp = 15;
      player.stats.logicSolved++;
      break;

    case "family":
      coins = 10;
      xp = 8;
      player.stats.familyTasks++;
      break;

    case "boss":
      coins = 50;
      xp = 50;
      player.stats.bossesBeaten++;
      break;

    case "discovery":
      coins = 20;
      xp = 20;
      player.stats.discoveries++;
      break;

    case "ghost":
      coins = 8;
      xp = 8;
      player.stats.respectMoments++;
      break;

    default:
      coins = 5;
      xp = 5;
  }

  /* ===== APPLY ===== */

  player.coins += coins;
  player.xp += xp;
  player.stats.pinsVisited++;

  const levelUps = handleLevelUp(player);
  const newBadges = checkBadges(player);

  savePlayer(player);

  return {
    coins,
    xp,
    levelUps,
    newBadges,
    player,
  };
}

/* =========================================================
   HELPERS
========================================================= */

export function getPlayer() {
  return loadPlayer();
}

export function resetPlayer() {
  const p = createDefaultPlayer();
  savePlayer(p);
  return p;
}
