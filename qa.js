// qa.js
import { PINS } from "./pins.js";

/**
 * QA Engine
 * - Works for all pins
 * - Different questions per pin + mode + tier
 * - Supports per-pin overrides
 *
 * tier: "kid" | "teen" | "adult"
 *
 * Usage:
 * const task = getQA(pinId, mode, tier, salt);
 * task => { q, options, answer, fact, meta? }
 */

// ============================
// KID QUIZ QUESTION POOL
// ============================
export const QUIZ_POOL_KID = [
  {
    q: "What was Furness Abbey mainly used for?",
    options: ["Living and praying", "Shopping", "Football", "Cinema"],
    answer: 0,
    fact: "Monks lived and prayed at Furness Abbey over 800 years ago.",
  },
  {
    q: "How old is Furness Abbey?",
    options: ["50 years", "100 years", "Over 800 years", "20 years"],
    answer: 2,
    fact: "It was founded in 1123.",
  },
  {
    q: "Who closed Furness Abbey?",
    options: ["A pirate", "King Henry VIII", "A mayor", "A farmer"],
    answer: 1,
    fact: "Henry VIII closed many monasteries in the 1500s.",
  },
  {
    q: "What colour stone is Furness Abbey made from?",
    options: ["Blue", "Red sandstone", "White marble", "Grey brick"],
    answer: 1,
    fact: "The red sandstone gives it its famous colour.",
  },
  {
    q: "Who lived at Furness Abbey?",
    options: ["Soldiers", "Monks", "Teachers", "Sailors"],
    answer: 1,
    fact: "Cistercian monks lived there.",
  },
  {
    q: "What made Barrow grow quickly in the 1800s?",
    options: ["Gold", "Iron ore", "Chocolate", "Oil"],
    answer: 1,
    fact: "Iron ore was discovered nearby in the 1840s.",
  },
  {
    q: "What does Barrow build today?",
    options: ["Cars", "Submarines", "Planes", "Tractors"],
    answer: 1,
    fact: "Submarines are still built in Barrow today.",
  },
  {
    q: "Where can you learn about shipbuilding history?",
    options: ["Dock Museum", "Park", "Beach", "Market"],
    answer: 0,
    fact: "The Dock Museum tells the story of Barrow’s shipbuilding.",
  },
  {
    q: "Did Barrow build ships during the World Wars?",
    options: ["Yes", "No"],
    answer: 0,
    fact: "Ships from Barrow served in both World Wars.",
  },
  {
    q: "Why were docks important?",
    options: ["Swimming", "Trade and ships", "Football", "Picnics"],
    answer: 1,
    fact: "The docks helped ships trade with the world.",
  },
  {
    q: "What connects Walney Island to Barrow?",
    options: ["Tunnel", "Bridge", "Helicopter", "Boat only"],
    answer: 1,
    fact: "Walney Bridge opened in 1908.",
  },
  {
    q: "What helps ships find their way near Walney?",
    options: ["Bonfires", "Lighthouse", "Flags", "Torches"],
    answer: 1,
    fact: "Walney Lighthouse guides ships safely.",
  },
  {
    q: "Is Walney an island?",
    options: ["Yes", "No"],
    answer: 0,
    fact: "Walney is one of England’s largest islands.",
  },
  {
    q: "What animals are common on Walney nature reserves?",
    options: ["Lions", "Birds", "Tigers", "Penguins"],
    answer: 1,
    fact: "Walney is famous for birdlife.",
  },
  {
    q: "What can you see at Earnse Bay?",
    options: ["Volcano", "Skyscrapers", "Sunsets", "Desert"],
    answer: 2,
    fact: "Earnse Bay is known for beautiful sunsets.",
  },
  {
    q: "What building shows Barrow’s civic pride?",
    options: ["Town Hall", "Supermarket", "Garage", "Cinema"],
    answer: 0,
    fact: "Barrow Town Hall opened in 1887.",
  },
  {
    q: "Who was Emlyn Hughes?",
    options: ["Footballer", "Sailor", "King", "Monk"],
    answer: 0,
    fact: "He was a famous footballer born in Barrow.",
  },
  {
    q: "What does the cenotaph remember?",
    options: ["Shopping days", "War heroes", "Festivals", "Markets"],
    answer: 1,
    fact: "The cenotaph honours those lost in war.",
  },
  {
    q: "What type of ships are built in Barrow today?",
    options: ["Fishing boats", "Submarines", "Cruise ships", "Yachts"],
    answer: 1,
    fact: "Modern submarines are built here.",
  },
  {
    q: "What helped move iron around Britain?",
    options: ["Bikes", "Railways", "Boats only", "Planes"],
    answer: 1,
    fact: "The Furness Railway helped transport iron.",
  },
  {
    q: "What kind of town was Barrow before industry?",
    options: ["Village", "Capital city", "Theme park", "Port only"],
    answer: 0,
    fact: "It was a small village before iron was found.",
  },
  {
    q: "What made Barrow famous worldwide?",
    options: ["Theme parks", "Shipbuilding", "Chocolate", "Gold"],
    answer: 1,
    fact: "Shipbuilding put Barrow on the map.",
  },
  {
    q: "What sits on Piel Island?",
    options: ["Castle", "Skyscraper", "Mall", "Airport"],
    answer: 0,
    fact: "Piel Castle was built to protect the coast.",
  },
  {
    q: "Why was Piel Castle built?",
    options: ["To protect coast", "For football", "For school", "For shopping"],
    answer: 0,
    fact: "It defended against attacks from the sea.",
  },
  {
    q: "What is the Dock Museum shaped like?",
    options: ["Ship", "Castle", "Plane", "Car"],
    answer: 0,
    fact: "It’s shaped like a ship.",
  },
  {
    q: "What sea is near Barrow?",
    options: ["North Sea", "Morecambe Bay", "Atlantic only", "Mediterranean"],
    answer: 1,
    fact: "Barrow sits beside Morecambe Bay.",
  },
  {
    q: "What happens with tides in Morecambe Bay?",
    options: ["Stay still", "Move quickly", "Freeze", "Disappear"],
    answer: 1,
    fact: "The tides are powerful and move fast.",
  },
  {
    q: "What year was Town Hall opened?",
    options: ["1887", "2001", "1750", "1920"],
    answer: 0,
    fact: "It opened during Queen Victoria’s reign.",
  },
  {
    q: "What kind of island is Walney?",
    options: [
      "One of the largest in England",
      "Tiny rock",
      "Floating island",
      "Secret island",
    ],
    answer: 0,
    fact: "Walney is one of England’s largest islands.",
  },
  {
    q: "What kind of class is Astute?",
    options: [
      "Submarine class",
      "School class",
      "Ship class only",
      "Plane class",
    ],
    answer: 0,
    fact: "Astute-class submarines are built in Barrow.",
  },
];

// ============================
// GLOBAL RIDDLE POOL
// ============================
export const RIDDLE_POOL = [
  { q: "What has keys but can’t open locks?", a: "A piano" },
  { q: "What has hands but can’t clap?", a: "A clock" },
  { q: "What gets wetter the more it dries?", a: "A towel" },
  { q: "I go up and down but never move. What am I?", a: "Stairs" },
  { q: "What has one eye but can’t see?", a: "A needle" },
  { q: "What has a neck but no head?", a: "A bottle" },
  { q: "What runs but never walks?", a: "Water" },
  { q: "What has many teeth but cannot bite?", a: "A comb" },
  { q: "What can you catch but not throw?", a: "A cold" },
  {
    q: "The more you take, the more you leave behind. What am I?",
    a: "Footsteps",
  },
  { q: "What comes down but never goes up?", a: "Rain" },
  { q: "What has cities but no houses?", a: "A map" },
  { q: "What can fill a room but takes up no space?", a: "Light" },
  { q: "What goes up but never comes down?", a: "Your age" },
  { q: "What is full of holes but still holds water?", a: "A sponge" },
  { q: "What is always coming but never arrives?", a: "Tomorrow" },
  { q: "What can’t be used until it’s broken?", a: "An egg" },
  { q: "What disappears when you say its name?", a: "Silence" },
  { q: "What has a ring but no finger?", a: "A phone" },
  { q: "What has branches but no leaves?", a: "A bank" },
];

// ============================
// KID HISTORY QUESTION POOL
// ============================
export const HISTORY_POOL_KID = [
  {
    q: "What was Furness Abbey mainly used for?",
    options: ["Living and praying", "Shopping", "Football", "Cinema"],
    answer: 0,
    fact: "Monks lived and prayed at Furness Abbey over 800 years ago.",
  },
  {
    q: "How old is Furness Abbey?",
    options: ["50 years", "100 years", "Over 800 years", "20 years"],
    answer: 2,
    fact: "It was founded in 1123.",
  },
  {
    q: "Who closed Furness Abbey?",
    options: ["A pirate", "King Henry VIII", "A mayor", "A farmer"],
    answer: 1,
    fact: "Henry VIII closed many monasteries in the 1500s.",
  },
  {
    q: "What made Barrow grow quickly in the 1800s?",
    options: ["Gold", "Iron ore", "Chocolate", "Oil"],
    answer: 1,
    fact: "Iron ore was discovered nearby in the 1840s.",
  },
  {
    q: "Where can you learn about shipbuilding history?",
    options: ["Dock Museum", "Park", "Beach", "Market"],
    answer: 0,
    fact: "The Dock Museum tells the story of Barrow’s shipbuilding.",
  },
  {
    q: "What does the cenotaph remember?",
    options: ["Shopping days", "War heroes", "Festivals", "Markets"],
    answer: 1,
    fact: "The cenotaph honours those lost in war.",
  },
];

// ============================
// SPEED CHALLENGE POOLS
// ============================
export const SPEED_POOL = {
  kid: [
    "10-Second Scan: Point to the nearest tree, bin, or sign.",
    "Statue Freeze: Freeze like a statue for 7 seconds.",
    "Colour Hunt: Find something red fast.",
    "Shape Spot: Find a circle quickly.",
    "Animal Ears: Make an animal pose for 5 seconds.",
    "Quiet Ninja: Walk 10 silent steps.",
    "Superhero Landing: Do a safe superhero landing pose.",
    "Count It: Count 5 steps forward, 5 back.",
    "Quick Smile: Do your best explorer face.",
    "Rock Paper Speed: Rock-paper-scissors best of 1.",
    "Shadow Spot: Find your shadow fast.",
    "Hop Count: Hop 3 times safely.",
    "Tall Small: Stretch tall, then crouch small.",
    "Wind Check: Feel the wind and point where it’s coming from.",
    "Quick Draw Air: Draw a star in the air.",
    "Fast Balance: Balance on one foot for 5 seconds.",
    "Find a Number: Spot any number quickly.",
    "Mirror Move: Copy the other person’s move.",
    "Traffic Light: Freeze, walk, slow.",
    "Quick Team Pose: Make a team pose in 5 seconds.",
  ],
  teen: [
    "Main Character Walk: 10 steps like you’re in a trailer.",
    "Photo Angle Switch: Low-angle pose then high-angle pose.",
    "Sound ID: Name the loudest sound you hear.",
    "One-Line Trailer: Finish 'In a world where…'",
    "Stealth Meter: 10 stealth steps.",
    "Speed Slogan: Invent a slogan for this place.",
    "Boss Intro: Say a boss name for this area.",
    "NPC Quote: Say a clean NPC quote.",
    "Zone Buff Pick: Choose a buff instantly.",
    "Fast Footwork: 6 quick side-steps.",
    "Find the Vibe: This place feels…",
    "Clue Spot: Find something that looks like a clue.",
    "Speed Memory: Look, turn away, name 3 things.",
    "Walk Like: Pirate, robot, or ninja.",
    "Fast Choice: Safe shortcut or scenic route.",
    "Character Swap: Swap who’s leader instantly.",
    "Landmark Judge: Rate this landmark 1–10.",
    "Quick Roleplay: Guard, Scout, or Wizard.",
    "Fast Team Plan: Next objective in 3 words.",
    "Boss Weakness: Pick a weakness fast.",
  ],
  adult: [
    "30-Second Observation: Name 3 details you’d miss if you rushed.",
    "History Snap: Guess the oldest-looking thing nearby and why.",
    "Micro-Route: Choose next waypoint based on safety or fun.",
    "One-Word Theme: Industry, Faith, Nature, or Memory.",
    "Fast Risk Check: Name 1 hazard and 1 safe alternative.",
    "Story Hook: Finish 'A monk hid…'",
    "Logic Switch: Is a shortcut always best?",
    "3-Point Scan: Exits, hazards, meeting point.",
    "Quick Time Guess: Guess the time without checking your phone.",
    "Treasure Math: If each node is 120 points, how many for 5?",
    "Fast Prioritise: Photo, clue, or rest.",
    "Atmosphere Read: Peaceful, tense, busy, eerie.",
    "Design Eye: What would make this place more questy?",
    "Ethical Choice: Respect or explore first?",
    "Historical Guess: What job might someone here have had in 1850?",
    "Boss Lore: Create a boss name and 1-line lore.",
    "Fast Constraint: Plan next 2 pins with a no-roads rule.",
    "Micro-Meditation: 10 seconds calm breathing.",
    "Detective Eye: What could hide a code here?",
    "Reward Logic: Coins, clue, map fragment, or key?",
  ],
};

// ============================
// BATTLE CHALLENGE POOLS
// ============================
export const BATTLE_POOL = {
  kid: [
    "Race: First to point at something green wins.",
    "Balance Duel: Who can stand on one foot longest?",
    "Speed Point: First to point at the tallest thing wins.",
    "Rock-paper-scissors battle.",
    "Echo Battle: First to repeat the location name wins.",
    "Shadow Duel: First to step on someone’s shadow wins.",
    "Animal Sound Battle: Funniest animal noise wins.",
    "Treasure Grab: First to touch something metal wins.",
    "Quick Count: First to count 5 steps wins.",
    "Pose Duel: Best superhero pose wins.",
    "Statue Battle: Last person to move wins.",
    "Hop Race: First to do 3 hops wins.",
    "Shape Race: First to find a circle wins.",
    "Smile Battle: Biggest smile wins.",
    "Victory Cheer: Loudest cheer wins.",
  ],
  teen: [
    "Reaction Duel: Leader claps, first to clap back wins.",
    "Speed Debate: Best 3-word slogan wins.",
    "Balance Battle: Last standing on one foot wins.",
    "Stealth Walk: Quietest 10 steps wins.",
    "Speed Riddle: First answer wins.",
    "Point Race: First to spot something historic wins.",
    "Rock-paper-scissors best of 3.",
    "Sound Spot: First to name the loudest sound wins.",
    "Memory Flash: Name 3 things after a quick look.",
    "Mini Story: Best 1-line story wins.",
    "Explorer Command: Fastest to obey the command wins.",
    "Soundtrack Duel: Best soundtrack idea wins.",
    "Explorer Pose Duel.",
    "Quick Compliment Duel.",
    "Victory Pose Duel.",
  ],
  adult: [
    "Observation Duel: First to name 3 details wins.",
    "Logic Duel: First correct answer wins.",
    "Memory Duel: First to recall 4 objects wins.",
    "Strategy Duel: Best plan in one sentence wins.",
    "History Guess Duel.",
    "Navigation Duel: Point safest direction.",
    "Fast Risk Spot: Identify hazard fastest.",
    "Treasure Logic Duel.",
    "Perspective Duel: Best insight wins.",
    "Design Idea Duel.",
    "Story Duel: Best quick story wins.",
    "Location Theme Duel.",
    "Route Planning Duel.",
    "Historical Role Guess Duel.",
    "Time Guess Duel.",
  ],
};

// ============================
// FAMILY CHALLENGE POOLS
// ============================
export const FAMILY_POOL = {
  kid: [
    "Team Wave: Everyone do a big explorer wave together.",
    "Animal Parade: Each person do a different animal pose.",
    "Colour Hunt Team: Together find something blue.",
    "Explorer Echo: One says mission, the others say accepted.",
    "Funny Walk Race: Do 5 silly steps together.",
    "Freeze Squad: Everyone freeze like statues.",
    "Treasure Point: All point at the most interesting thing nearby.",
    "Team Smile: Biggest smiles for 3 seconds.",
    "Shadow Team: Stand together and look for your shadows.",
    "Superhero Group Pose: Make a family hero pose.",
    "Quiet Mission: Walk 5 silent steps together.",
    "Mini March: March in place like explorers.",
    "Nature Team: Together find something green.",
    "Fast Count: Count to 10 together.",
    "Robot Team: Walk like robots for 5 seconds.",
    "Treasure Guard Circle: Guard invisible treasure.",
    "One-Word Family Vibe: Each person says one word.",
    "Team Hop: Hop 3 times together.",
    "Explorer Hands: High-five or thumbs-up all round.",
    "Victory Cheer: Make a family cheer together.",
  ],
  teen: [
    "Team Trailer Walk: 10 steps like your squad is in a game intro.",
    "Role Select: Pick roles fast — Scout, Tank, Healer, Guide.",
    "Group Poster Pose: Make a dramatic team pose.",
    "One-Line Team Motto: Invent a squad motto fast.",
    "Fast Debate: Best family power-up here?",
    "Vibe Call: Calm, weird, epic, or busy?",
    "Stealth Family: 8 quiet steps together.",
    "Emoji Match Team: Pick 2 emojis that fit this place.",
    "Boss Warning: Invent a warning for this area.",
    "Fast Memory Team: Name 3 things together.",
    "Squad Formation: Stand in a triangle or line.",
    "Quick Story: Make a 2-sentence story together.",
    "Photo Pose Practice: Do a clean team pose.",
    "Zone Call: Civic, Nature, Docks, or Ruins?",
    "Hero Landing Team: Safe dramatic landing pose.",
    "Fast Team Safety: Point to the best meeting spot.",
    "Mini Challenge Plan: Say the next objective in 3 words.",
    "Boss Name Team: Invent a boss name for this place.",
    "Adventure Voice: Say quest complete dramatically.",
    "Group Win Pose: Final team victory pose.",
  ],
  adult: [
    "Family Check-In: Each person says one word for how they feel.",
    "Micro-Reflection: Name one thing you noticed because you slowed down.",
    "History Guess Team: Guess what happened here long ago.",
    "Safety Scan: Identify a meeting point nearby.",
    "Shared Focus: Spend 5 seconds noticing details silently.",
    "Route Decision: Pick the next route based on fun or safety.",
    "Family Briefing: Explain the next objective in 10 words.",
    "Quick Gratitude: Each person name one good thing about today.",
    "Memory Spark: Say what this place reminds you of.",
    "Observation Team: Name 3 details most people would miss.",
    "Mini Story Build: Each person adds one sentence.",
    "Energy Check: Decide if the group needs rest, pace, or fun.",
    "Quiet Minute Lite: 10 seconds calm breathing together.",
    "Treasure Logic: If this place held a clue, where would it be hidden?",
    "Quick Design Eye: What would make this place more magical for kids?",
    "Historic Imagination: What job might someone here have done?",
    "Atmosphere Read: Peaceful, busy, eerie, or proud?",
    "Group Focus Reset: 3 slow breaths, then continue.",
    "Reflective Prompt: What part of today has been best so far?",
    "Respect Check: How do we explore this place respectfully?",
  ],
};

// ============================
// ACTIVITY CHALLENGE POOLS
// ============================
export const ACTIVITY_POOL = {
  kid: [
    "HOME BASE: Create a secret team handshake.",
    "MORRISONS: Spot something red in 10 seconds.",
    "SALTHOUSE MILLS: March like a factory boss.",
    "CENOTAPH: Give a respectful salute.",
    "BANDSTAND: March up the steps like a hero.",
    "PARK RAILWAY: Pretend you're the conductor.",
    "BOATING LAKE: Count 3 ducks or birds.",
    "BRIDGEGATE: Point which way you’d explore.",
    "FRYERS LANE: Spot something old.",
    "FLASHLIGHT BEND: Walk quietly for 10 steps.",
    "RED RIVER WALK: Count 5 steps slowly.",
    "FURNESS ABBEY: Pretend you're a medieval guard.",
    "DOCK MUSEUM: Pretend to steer a ship.",
    "TOWN HALL CLOCK: Count down from 5.",
    "CUSTOM HOUSE: Pretend to check passports.",
    "THE FORUM: Pretend you're on stage.",
    "LIBRARY: Whisper a fun fact.",
    "HENRY SCHNEIDER: Stand strong like a statue.",
    "JAMES RAMSDEN: Give a short mayor speech.",
    "OLD FIRE STATION: Pretend to spray a hose.",
    "MARKET HALL: Spot something colourful.",
    "DUKE OF EDINBURGH: Name your favourite drink.",
    "EMLYN HUGHES: Do a mini goal celebration.",
    "GRAVING DOCK: Pretend to hammer metal.",
    "SLAG BANK: Climb safely and look around.",
  ],
  teen: [
    "Do a 10-second main character walk.",
    "Take a poster pose angle.",
    "Make up a 1-line slogan for this spot.",
    "Do a stealth-walk 10 steps.",
    "Pick the most industrial sound you can hear.",
    "Film a 3-second aesthetic clip.",
    "Give one plant a superhero name.",
    "Do a calm-breath reset.",
    "Find wind direction and do a storm survivor pose.",
    "Invent a fake legend about this place.",
    "Pick a doorway and pose like you’re entering a boss arena.",
    "Point toward town and do a scout report.",
    "Choose the best viewpoint and rate it.",
    "Do a silent NPC idle animation.",
    "Pick a street name and remix it into a rap line.",
  ],
  adult: [
    "Create an elite squad name right now.",
    "Find the weirdest product label.",
    "Strike a dramatic industrial pose.",
    "10 seconds silence, then say one word.",
    "Deliver a 5-second hype speech.",
    "Narrate this place like a vlog intro.",
    "Invent a dramatic backstory for a boat.",
    "Choose the most chaotic direction and defend it.",
    "Give an abandoned object a story.",
    "Do a dramatic slow turn like you're being followed.",
    "Rate the vibe 1 to 10 and justify it.",
    "Imagine this place 800 years ago. What changes?",
    "Name a metal band after this location.",
    "If you could rewind 1 hour, would you?",
    "Movie trailer voice: In a town where…",
    "Pick a random word and create a conspiracy theory.",
    "Hero or villain origin story?",
    "Give a 10-second political speech.",
    "Invent a ridiculous emergency.",
    "If this was a battle arena, what's the boss?",
  ],
};

// ============================
// OPTIONAL: per-pin overrides
// ============================
export const QA_OVERRIDES = {
  // Example:
  // 12: {
  // activity: {
  // kid: [
  // {
  // q: "FURNESS ABBEY: Pretend you're a medieval guard.",
  // options: ["Done", "Not yet", "Skip", "Unsafe"],
  // answer: 0,
  // fact: "Ancient energy felt."
  // }
  // ]
  // }
  // }
};

// ============================
// Public API
// ============================
export function getQA(pinId, mode, tier, salt = 0) {
  const ov = QA_OVERRIDES?.[pinId]?.[mode]?.[tier];
  if (Array.isArray(ov) && ov.length) {
    return pick(ov, seed(pinId, mode, tier, salt));
  }

  const pin = PINS.find((p) => p.id === pinId);
  if (!pin) {
    return {
      q: "Unknown pin. Missing from PINS.",
      options: ["OK", "OK", "OK", "OK"],
      answer: 0,
      fact: "",
    };
  }

  return generateQA(pin, mode, tier, salt);
}

// ============================
// Generator
// ============================
function generateQA(pin, mode, tier, salt) {
  const z = normalizeZone(pin.zone);
  const s = seed(pin.id, mode, tier, salt);

  if (mode === "health") {
    const meters = tier === "kid" ? 30 : 80;
    return {
      q:
        tier === "kid"
          ? `HEALTH QUEST: Walk ${meters} metres to power up your explorer energy.`
          : `HEALTH: Walk ${meters} metres.`,
      options: ["START", "CANCEL"],
      answer: 0,
      fact: "Tip: keep your phone steady for better GPS.",
      meta: { meters },
    };
  }

  if (mode === "activity") return buildActivity(pin, z, tier, s);
  if (mode === "family") return buildFamily(pin, z, tier, s);
  if (mode === "quiz") return buildQuiz(pin, z, tier, s);
  if (mode === "history") return buildHistory(pin, z, tier, s);
  if (mode === "logic") return buildLogic(pin, z, tier, s);
  if (mode === "speed") return buildSpeed(pin, z, tier, s);
  return buildBattle(pin, z, tier, s);
}

function buildQuiz(pin, zone, tier, s) {
  if (tier === "kid" && QUIZ_POOL_KID.length) {
    const item = QUIZ_POOL_KID[s % QUIZ_POOL_KID.length];
    return {
      q: `QUIZ: ${item.q}`,
      options: item.options,
      answer: item.answer,
      fact: item.fact || "",
    };
  }

  const zoneChoices = [
    "Civic",
    "Docks",
    "Nature",
    "Walney/Coastal",
    "Abbey/Ruins",
    "Outskirts",
    "Residential",
  ];

  const correctZone = zoneLabel(zone);
  const opts = shuffleUnique(
    [
      correctZone,
      ...pickMany(
        zoneChoices.filter((x) => x !== correctZone),
        3,
        s + 11
      ),
    ],
    s + 12
  );

  return {
    q: `QUIZ: Which zone-tag best fits "${pin.n}"?`,
    options: opts,
    answer: opts.indexOf(correctZone),
    fact: `Zone tag: ${correctZone}.`,
  };
}

function buildHistory(pin, zone, tier, s) {
  if (tier === "kid" && HISTORY_POOL_KID.length) {
    const item = HISTORY_POOL_KID[s % HISTORY_POOL_KID.length];
    return {
      q: `HISTORY: ${item.q}`,
      options: item.options,
      answer: item.answer,
      fact: item.fact || "",
    };
  }

  const packs = {
    Civic: [
      ["Town buildings", "Markets", "Libraries", "Memorials"],
      "Civic spots link to services, memorials, and public buildings.",
    ],
    Docks: [
      ["Shipbuilding", "Trade", "Cranes", "Docks"],
      "Docks zones link to shipbuilding and waterfront work.",
    ],
    Nature: [
      ["Parks", "Wildlife", "Lakes", "Gardens"],
      "Nature zones are about green space and quieter exploration.",
    ],
    "Walney/Coastal": [
      ["Beaches", "Wind", "Birds", "Sea landmarks"],
      "Walney and coastal zones focus on sea, wind, and beaches.",
    ],
    "Abbey/Ruins": [
      ["Stone ruins", "Old paths", "History trails", "Quiet spots"],
      "Abbey and ruins zones lean into old stonework and ancient atmosphere.",
    ],
    Outskirts: [
      ["Edges of town", "Paths", "Views", "Shortcuts"],
      "Outskirts are walking routes, views, and connecting paths.",
    ],
    Residential: [
      ["Homes", "Local streets", "Everyday places", "Neighbourhoods"],
      "Residential zones are everyday streets and community areas.",
    ],
  };

  const z = zoneLabel(zone);
  const pack = packs[z] || packs.Civic;
  const correct = pack[0][0];
  const options = shuffleUnique([correct, ...pack[0].slice(1)], s + 22);

  return {
    q:
      tier === "teen"
        ? `HISTORY: Quick take — what theme fits "${pin.n}"?`
        : `HISTORY: What theme best fits "${pin.n}"?`,
    options,
    answer: options.indexOf(correct),
    fact: pack[1],
  };
}

function buildLogic(pin, zone, tier, s) {
  const r = RIDDLE_POOL[s % RIDDLE_POOL.length];
  const options = shuffleUnique(
    [r.a, "I don't know", "Something else", "Not sure"],
    s + 77
  );

  return {
    q: `RIDDLE: ${r.q}`,
    options,
    answer: options.indexOf(r.a),
    fact: `Answer: ${r.a}`,
  };
}

function buildSpeed(pin, zone, tier, s) {
  const t = tier === "teen" ? "teen" : tier === "kid" ? "kid" : "adult";
  const pool = SPEED_POOL[t] || SPEED_POOL.kid;
  const prompt = pick(pool, s + 900);
  const options = ["DONE", "NOT YET", "SKIP", "UNSAFE"];

  return {
    q: `SPEED: ${prompt}`,
    options,
    answer: 0,
    fact:
      t === "kid"
        ? "Quick challenge. Keep it safe."
        : t === "teen"
        ? "Fast challenge. Keep it safe and clean."
        : "Fast challenge. Safety first.",
    meta: { speed: true },
  };
}

function buildBattle(pin, zone, tier, s) {
  const t = tier === "teen" ? "teen" : tier === "kid" ? "kid" : "adult";
  const pool = BATTLE_POOL[t] || BATTLE_POOL.kid;
  const prompt = pick(pool, s + 880);
  const options = ["WINNER DECIDED", "REMATCH", "SKIP", "UNSAFE"];

  return {
    q: `BATTLE: ${prompt}`,
    options,
    answer: 0,
    fact: "Battle complete. Points ready to award.",
    meta: { battle: true },
  };
}

function buildFamily(pin, zone, tier, s) {
  const t = tier === "teen" ? "teen" : tier === "kid" ? "kid" : "adult";
  const pool = FAMILY_POOL[t] || FAMILY_POOL.kid;
  const options = ["DONE", "NOT YET", "SKIP", "UNSAFE"];

  const p1 = pick(pool, s + 950);
  const p2 = pick(pool, s + 951);
  const p3 = pick(pool, s + 952);

  return {
    q: `FAMILY CHAIN:
1) ${p1}
2) ${p2}
3) ${p3}`,
    options,
    answer: 0,
    fact:
      t === "kid"
        ? "Family chain complete — explorer family bonus unlocked."
        : t === "teen"
        ? "Squad chain complete — bonus unlocked."
        : "Family chain complete — teamwork bonus unlocked.",
    meta: {
      family: true,
      familyChain: true,
      chainSteps: [p1, p2, p3],
      rewardCoins: t === "kid" ? 150 : t === "teen" ? 200 : 250,
      badge:
        t === "kid"
          ? "Explorer Family Badge"
          : t === "teen"
          ? "Squad Link Badge"
          : "Family Quest Badge",
    },
  };
}

function buildActivity(pin, zone, tier, s) {
  const options = ["DONE", "NOT YET", "SKIP", "UNSAFE"];
  const t = tier === "teen" ? "teen" : tier === "kid" ? "kid" : "adult";
  const pool = ACTIVITY_POOL[t] || ACTIVITY_POOL.kid;
  const prompt = pick(pool, s + 71);

  return {
    q: `ACTIVITY: ${prompt}`,
    options,
    answer: 0,
    fact: "Activity complete. Keep it safe.",
    meta: { activity: true },
  };
}

// ============================
// Helpers
// ============================
function normalizeZone(zone) {
  const z = String(zone || "").toLowerCase();
  if (z.includes("civic")) return "Civic";
  if (z.includes("dock") || z.includes("industrial")) return "Docks";
  if (z.includes("nature") || z.includes("park")) return "Nature";
  if (z.includes("walney") || z.includes("coast") || z.includes("sea"))
    return "Walney/Coastal";
  if (z.includes("abbey") || z.includes("ruin")) return "Abbey/Ruins";
  if (z.includes("outskirt")) return "Outskirts";
  if (z.includes("residential")) return "Residential";
  return "Civic";
}

function zoneLabel(z) {
  return normalizeZone(z);
}

function seed(pinId, mode, tier, salt = 0) {
  let h = 2166136261;
  const str = `${pinId}|${mode}|${tier}|${salt}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, s) {
  return arr[s % arr.length];
}

function pickMany(arr, n, s) {
  const out = [];
  const copy = [...arr];
  let x = s >>> 0;
  while (out.length < n && copy.length) {
    const idx = x % copy.length;
    out.push(copy.splice(idx, 1)[0]);
    x = (x * 1103515245 + 12345) >>> 0;
  }
  return out;
}

function shuffleUnique(arr, s) {
  const a = [...arr];
  let x = s >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 1664525 + 1013904223) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
