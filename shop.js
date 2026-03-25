/* =========================================================
   BARROW QUEST SHOP SYSTEM
   - Uses progression.js player system
   - Handles purchases, unlocks, equips
========================================================= */

import { loadPlayer, savePlayer } from "./progression.js";

/* =========================================================
   SHOP ITEMS
========================================================= */

export const SHOP_ITEMS = [
  /* ===================== CHARACTERS ===================== */
  {
    id: "char_explorer",
    name: "Explorer Hero",
    type: "character",
    price: 0,
  },
  {
    id: "char_abbey_guard",
    name: "Abbey Guard",
    type: "character",
    price: 300,
  },
  {
    id: "char_ghost_hunter",
    name: "Ghost Hunter",
    type: "character",
    price: 300,
  },

  /* ===================== TRAILS ===================== */
  {
    id: "trail_spark",
    name: "Spark Trail",
    type: "trail",
    price: 60,
  },
  {
    id: "trail_gold",
    name: "Gold Glow",
    type: "trail",
    price: 150,
  },
  {
    id: "trail_mist",
    name: "Mist Trail",
    type: "trail",
    price: 120,
  },

  /* ===================== BOOSTS ===================== */
  {
    id: "boost_hint",
    name: "Hint Token",
    type: "boost",
    price: 25,
  },
  {
    id: "boost_skip",
    name: "Skip Question",
    type: "boost",
    price: 40,
  },
  {
    id: "boost_double",
    name: "Double Coins (10 mins)",
    type: "boost",
    price: 120,
  },

  /* ===================== PACKS ===================== */
  {
    id: "pack_ghost",
    name: "Ghost Pack",
    type: "pack",
    price: 250,
  },
  {
    id: "pack_abbey",
    name: "Abbey Pack",
    type: "pack",
    price: 250,
  },
];

/* =========================================================
   GET SHOP ITEMS WITH STATE
========================================================= */

export function getShopItems() {
  const player = loadPlayer();

  return SHOP_ITEMS.map((item) => ({
    ...item,
    owned: player.ownedItems.includes(item.id),
    affordable: player.coins >= item.price,
  }));
}

/* =========================================================
   BUY ITEM
========================================================= */

export function buyItem(itemId) {
  const player = loadPlayer();
  const item = SHOP_ITEMS.find((i) => i.id === itemId);

  if (!item) {
    return { success: false, message: "Item not found" };
  }

  if (player.ownedItems.includes(itemId)) {
    return { success: false, message: "Already owned" };
  }

  if (player.coins < item.price) {
    return { success: false, message: "Not enough coins" };
  }

  /* Deduct coins */
  player.coins -= item.price;

  /* Add to owned */
  player.ownedItems.push(itemId);

  /* Auto-equip characters */
  if (item.type === "character") {
    player.equippedCharacter = itemId;
  }

  savePlayer(player);

  return {
    success: true,
    item,
    player,
  };
}

/* =========================================================
   EQUIP ITEM
========================================================= */

export function equipItem(itemId) {
  const player = loadPlayer();

  if (!player.ownedItems.includes(itemId)) {
    return { success: false, message: "Not owned" };
  }

  const item = SHOP_ITEMS.find((i) => i.id === itemId);

  if (!item) {
    return { success: false, message: "Item not found" };
  }

  if (item.type === "character") {
    player.equippedCharacter = itemId;
  }

  if (item.type === "trail") {
    player.equippedTrail = itemId;
  }

  savePlayer(player);

  return {
    success: true,
    item,
    player,
  };
}

/* =========================================================
   GET PLAYER LOADOUT
========================================================= */

export function getLoadout() {
  const player = loadPlayer();

  return {
    character: player.equippedCharacter || "char_explorer",
    trail: player.equippedTrail || null,
  };
}

/* =========================================================
   DEBUG / TEST HELPERS
========================================================= */

export function giveCoins(amount = 100) {
  const player = loadPlayer();
  player.coins += amount;
  savePlayer(player);
  return player;
}
