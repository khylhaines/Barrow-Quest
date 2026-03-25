import { PINS } from "./pins.js";

/* =========================================================
   BARROW QUEST QA ENGINE
   FULL REPLACEMENT
   - exact pin override priority
   - qaGroup support for location-accurate history
   - zone fun pools kept separate from landmark history
   - anti-repeat support
   - stable question ids
   - start intro support
========================================================= */

function normaliseTier(tier = "kid") {
  return ["kid", "teen", "adult"].includes(tier) ? tier : "kid";
}

function seededIndex(length, salt = 0) {
  if (!length) return 0;
  const n = Math.abs(Number(salt) || 0);
  return n % length;
}

function pickOne(arr, salt = 0) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[seededIndex(arr.length, salt)];
}

function shuffleSeeded(arr, salt = 0) {
  const out = [...arr];
  let seed = Math.abs(Number(salt) || Date.now());

  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];

  for (const item of arr || []) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function combinePools(...pools) {
  return uniqBy(pools.flat().filter(Boolean), (item) => {
    if (typeof item === "string") return `str:${item}`;
    if (item?.id) return `id:${item.id}`;
    if (item?.q && Array.isArray(item?.options)) return `mcq:${item.q}`;
    if (item?.q && item?.a) return `riddle:${item.q}|${item.a}`;
    return JSON.stringify(item);
  });
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function makeQuestionId(prefix, entry) {
  if (entry?.id) return String(entry.id);
  if (typeof entry === "string") return `${prefix}_${slugify(entry)}`;
  if (entry?.q && Array.isArray(entry?.options)) {
    return `${prefix}_${slugify(entry.q)}`;
  }
  if (entry?.q && entry?.a) {
    return `${prefix}_${slugify(entry.q)}_${slugify(entry.a)}`;
  }
  return `${prefix}_item`;
}

function attachIds(pool, prefix) {
  return (pool || []).map((item, idx) => {
    if (typeof item === "string") {
      return {
        _type: "prompt",
        id: makeQuestionId(`${prefix}_${idx}`, item),
        value: item,
      };
    }

    return {
      ...item,
      id: makeQuestionId(`${prefix}_${idx}`, item),
    };
  });
}

function makePromptTask(prompt, mode = "activity", id = "prompt_task") {
  return {
    id,
    q: prompt,
    options: ["DONE", "NOT YET", "SKIP", "UNSAFE"],
    answer: 0,
    fact: "",
    meta: { promptOnly: true, mode },
  };
}

function makeFallbackTask(message, meta = {}) {
  return {
    id: `fallback_${slugify(message) || "task"}`,
    q: message,
    options: ["DONE", "NOT YET", "SKIP", "UNSAFE"],
    answer: 0,
    fact: "",
    meta: { fallback: true, ...meta },
  };
}

/* =========================================================
   SHARED RIDDLE / FUN CONTENT
========================================================= */

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

export const SPEED_POOL = {
  kid: [
    "10-Second Scan: Point to the nearest tree, sign, or bench.",
    "Quick Smile: Do your best explorer face.",
    "Hop Count: Hop 3 times safely.",
    "Fast Balance: Balance on one foot for 5 seconds.",
    "Find a Number: Spot any number quickly.",
    "Traffic Light: Freeze, walk, slow.",
  ],
  teen: [
    "Main Character Walk: 10 steps like you’re in a trailer.",
    "Sound ID: Name the loudest sound you hear.",
    "Speed Slogan: Invent a slogan for this place.",
    "Speed Memory: Look, turn away, name 3 things.",
    "Walk Like: Pirate, robot, or ninja.",
    "Boss Weakness: Pick a weakness fast.",
  ],
  adult: [
    "30-Second Observation: Name 3 details you’d miss if you rushed.",
    "Fast Risk Check: Name 1 hazard and 1 safe alternative.",
    "3-Point Scan: Exits, hazards, meeting point.",
    "Atmosphere Read: Peaceful, tense, busy, eerie.",
    "Detective Eye: What could hide a code here?",
    "Reward Logic: Coins, clue, map fragment, or key?",
  ],
};

export const BATTLE_POOL = {
  kid: [
    "Race: First to point at something green wins.",
    "Balance Duel: Who can stand on one foot longest?",
    "Rock-paper-scissors battle.",
    "Pose Duel: Best superhero pose wins.",
    "Statue Battle: Last person to move wins.",
  ],
  teen: [
    "Reaction Duel: Leader claps, first to clap back wins.",
    "Speed Debate: Best 3-word slogan wins.",
    "Stealth Walk: Quietest 10 steps wins.",
    "Memory Flash: Name 3 things after a quick look.",
    "Victory Pose Duel.",
  ],
  adult: [
    "Observation Duel: First to name 3 details wins.",
    "Logic Duel: First correct answer wins.",
    "Strategy Duel: Best plan in one sentence wins.",
    "Perspective Duel: Best insight wins.",
    "Route Planning Duel.",
  ],
};

export const FAMILY_POOL = {
  kid: [
    "Team Wave: Everyone do a big explorer wave together.",
    "Animal Parade: Each person do a different animal pose.",
    "Explorer Echo: One says mission, the others say accepted.",
    "Superhero Group Pose: Make a family hero pose.",
    "Victory Cheer: Make a family cheer together.",
  ],
  teen: [
    "Team Trailer Walk: 10 steps like your squad is in a game intro.",
    "Role Select: Pick roles fast — Scout, Tank, Healer, Guide.",
    "One-Line Team Motto: Invent a squad motto fast.",
    "Fast Memory Team: Name 3 things together.",
    "Group Win Pose: Final team victory pose.",
  ],
  adult: [
    "Family Check-In: Each person says one word for how they feel.",
    "Micro-Reflection: Name one thing you noticed because you slowed down.",
    "Safety Scan: Identify a meeting point nearby.",
    "Quick Gratitude: Each person name one good thing about today.",
    "Respect Check: How do we explore this place respectfully?",
  ],
};

export const ACTIVITY_POOL = {
  kid: [
    "Do an explorer pose for 5 seconds.",
    "Pretend to steer a ship.",
    "Give a respectful salute.",
    "Spot something colourful.",
    "Do a mini goal celebration.",
  ],
  teen: [
    "Do a 10-second main character walk.",
    "Make up a 1-line slogan for this spot.",
    "Do a stealth-walk 10 steps.",
    "Invent a fake legend about this place.",
    "Do a silent NPC idle animation.",
  ],
  adult: [
    "Notice 3 details most people would miss here.",
    "10 seconds silence, then say one word.",
    "Narrate this place like a vlog intro.",
    "Imagine this place 800 years ago. What changes?",
    "If this was a battle arena, what's the boss?",
  ],
};

/* =========================================================
   START INTROS
========================================================= */

export const PIN_START_INTROS = {
  home_base_marsh_st: {
    kid: "Home Base reached. This is where your Barrow Quest begins.",
    teen: "Home Base reached. This is your reset point before the map opens into bigger stories.",
    adult:
      "Home Base reached. This is your point of origin — where every route and decision begins.",
  },

  cenotaph_core: {
    kid: "The Cenotaph reached. This is a place to remember brave people and show respect.",
    teen: "The Cenotaph reached. This landmark is about memory, sacrifice, and respect.",
    adult:
      "The Cenotaph reached. You are entering a space of civic remembrance and collective memory.",
  },

  park_bandstand_core: {
    kid: "Park Bandstand reached. This is a fun place linked to music and performances.",
    teen: "Park Bandstand reached. This is a performance space and part of the park’s public life.",
    adult:
      "Park Bandstand reached. This pin marks a civic leisure structure built for gathering and performance.",
  },

  furness_abbey_core: {
    kid: "Furness Abbey reached. These old ruins are full of mystery and history.",
    teen: "Furness Abbey reached. This is one of the deepest history pins on the map.",
    adult:
      "Furness Abbey reached. You are entering one of the most historically charged sites in the region.",
  },

  town_hall_clock: {
    kid: "Town Hall Clock reached. This is one of the most important places in town.",
    teen: "Town Hall Clock reached. This landmark is part of the town’s civic heartbeat.",
    adult:
      "Town Hall Clock reached. You are standing at a civic time-marker and public symbol.",
  },

  dock_museum_anchor: {
    kid: "Dock Museum Anchor reached. This area is all about ships and Barrow’s dock history.",
    teen: "Dock Museum Anchor reached. This pin marks one of the strongest maritime identities on the map.",
    adult:
      "Dock Museum Anchor reached. You are stepping into Barrow’s maritime-industrial narrative.",
  },

  dock_museum_submarine: {
    kid: "Dock Museum Submarine reached. This is where Barrow’s ship story becomes huge.",
    teen: "Dock Museum Submarine reached. This landmark connects the town’s past and present through engineering.",
    adult:
      "Dock Museum Submarine reached. This is one of the clearest expressions of Barrow’s strategic-industrial identity.",
  },

  henry_schneider_statue: {
    kid: "Statue of Henry Schneider reached. This place remembers an important figure in Barrow’s history.",
    teen: "Statue of Henry Schneider reached. This is a landmark tied to people who helped Barrow grow.",
    adult:
      "Statue of Henry Schneider reached. This monument represents industrial change and public memory.",
  },

  james_ramsden_statue: {
    kid: "Statue of James Ramsden reached. This pin remembers one of the men linked to Barrow’s growth.",
    teen: "Statue of James Ramsden reached. This is one of the town’s memory-markers.",
    adult:
      "Statue of James Ramsden reached. This monument reflects leadership, ambition, and public memory.",
  },

  barrow_library: {
    kid: "Barrow Library reached. This is a place full of stories and facts.",
    teen: "Barrow Library reached. This pin is about knowledge, memory, and local culture.",
    adult:
      "Barrow Library reached. You are entering a civic archive of learning and memory.",
  },

  custom_house: {
    kid: "The Custom House reached. This building connects to trade and town history.",
    teen: "The Custom House reached. This pin is tied to movement, administration, and exchange.",
    adult:
      "The Custom House reached. This is a threshold building where trade and civic regulation meet.",
  },

  emlyn_hughes_statue: {
    kid: "Emlyn Hughes Statue reached. This pin celebrates a famous footballer from Barrow.",
    teen: "Emlyn Hughes Statue reached. This landmark shows how towns remember local people with wider fame.",
    adult:
      "Emlyn Hughes Statue reached. This monument reflects public memory through sport and civic pride.",
  },

  salthouse_mills: {
    kid: "Salthouse Mills reached. This is part of Barrow’s strong working history.",
    teen: "Salthouse Mills reached. This pin takes you into the industrial side of the map.",
    adult:
      "Salthouse Mills reached. This is an industrial memory-site shaped by labour and production.",
  },

  submarine_memorial: {
    kid: "Submarine Memorial reached. This place remembers people and work connected to the sea.",
    teen: "Submarine Memorial reached. This pin links memory with the town’s modern defence identity.",
    adult:
      "Submarine Memorial reached. This site binds remembrance to Barrow’s submarine legacy.",
  },

  walney_bridge_entrance: {
    kid: "Walney Bridge Entrance reached. This is the crossing point between Barrow and Walney.",
    teen: "Walney Bridge Entrance reached. This pin is about crossing, transition, and identity.",
    adult:
      "Walney Bridge Entrance reached. You are at a threshold structure where geography and identity meet.",
  },

  earnse_bay: {
    kid: "Earnse Bay reached. This is a big coastal place with sea air and wide views.",
    teen: "Earnse Bay reached. This pin opens the map outward into coast and horizon.",
    adult:
      "Earnse Bay reached. This is a landscape pin where weather, coast, and scale dominate.",
  },

  piel_castle: {
    kid: "Piel Castle reached. This island castle once helped protect the coast.",
    teen: "Piel Castle reached. This landmark feels separate for a reason — defence and the sea matter here.",
    adult:
      "Piel Castle reached. You are entering a defensive coastal site where isolation and strategy converge.",
  },

  roose_station_platform: {
    kid: "Roose Station Platform reached. Trains helped connect people and places.",
    teen: "Roose Station Platform reached. This pin is about movement and route networks.",
    adult:
      "Roose Station Platform reached. This site reflects transport infrastructure and everyday movement.",
  },
};

/* =========================================================
   QA GROUP CONTENT
   landmark-accurate pools
========================================================= */

export const QA_BY_GROUP = {
  town_history: {
    quiz: {
      kid: [
        {
          q: "What kind of place was Barrow before heavy industry?",
          options: [
            "A village",
            "A capital city",
            "A giant castle",
            "A theme park",
          ],
          answer: 0,
          fact: "Barrow began as a much smaller settlement before industrial growth.",
        },
        {
          q: "What helped Barrow grow quickly in the 1800s?",
          options: [
            "Iron and industry",
            "Banana farms",
            "Volcanoes",
            "Theme parks",
          ],
          answer: 0,
          fact: "Iron, docks, and industry helped Barrow grow fast.",
        },
      ],
      teen: [
        {
          q: "What best explains Barrow’s rapid growth?",
          options: [
            "Industry, iron, and shipbuilding",
            "Only farming",
            "Royal palaces",
            "Tourism alone",
          ],
          answer: 0,
          fact: "Barrow expanded rapidly through industry and shipbuilding.",
        },
        {
          q: "What kind of history do many central Barrow landmarks share?",
          options: [
            "Civic and industrial history",
            "Jungle history",
            "Desert history",
            "Volcanic history",
          ],
          answer: 0,
          fact: "Much of central Barrow reflects civic growth and industrial identity.",
        },
      ],
      adult: [
        {
          q: "How should central Barrow’s historic character be described?",
          options: [
            "Civic, industrial, and urban",
            "Purely rural",
            "Ancient royal",
            "Only recreational",
          ],
          answer: 0,
          fact: "Central Barrow reflects civic life, industry, and urban development.",
        },
        {
          q: "What ties many town-centre landmarks together?",
          options: [
            "Public life, memory, and growth",
            "Deep sea fishing only",
            "Airport logistics",
            "Monastic seclusion",
          ],
          answer: 0,
          fact: "Town-centre landmarks often express public life, memory, and growth.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Do town buildings help tell local history?",
          options: ["Yes", "No", "Only castles do", "Only beaches do"],
          answer: 0,
          fact: "Town buildings often help show how a place grew and changed.",
        },
      ],
      teen: [
        {
          q: "Why are town landmarks useful in local history?",
          options: [
            "They show how public life changed",
            "They replace maps",
            "They hide tunnels only",
            "They grow crops",
          ],
          answer: 0,
          fact: "Town landmarks help show how civic and daily life developed.",
        },
      ],
      adult: [
        {
          q: "What do civic landmarks often preserve?",
          options: [
            "Public memory and identity",
            "Only private wealth",
            "Only transport schedules",
            "Only military secrets",
          ],
          answer: 0,
          fact: "Civic landmarks often preserve public memory and identity.",
        },
      ],
    },
  },

  industry_history: {
    quiz: {
      kid: [
        {
          q: "What kind of work helped Barrow become famous?",
          options: [
            "Industry and shipbuilding",
            "Chocolate making",
            "Only farming",
            "Wizard school",
          ],
          answer: 0,
          fact: "Barrow became famous through industry and shipbuilding.",
        },
      ],
      teen: [
        {
          q: "What made Barrow important in industrial Britain?",
          options: [
            "Shipbuilding and heavy industry",
            "Only beaches",
            "Only theatre",
            "Only farming",
          ],
          answer: 0,
          fact: "Barrow became important through shipbuilding and heavy industry.",
        },
      ],
      adult: [
        {
          q: "What does an industrial landmark in Barrow usually point back to?",
          options: [
            "Labour, production, and growth",
            "Monastic prayer only",
            "Holiday tourism only",
            "Royal ceremony only",
          ],
          answer: 0,
          fact: "Industrial landmarks in Barrow often point to labour, production, and growth.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Did factories and mills change Barrow?",
          options: ["Yes", "No", "Only a little", "Not at all"],
          answer: 0,
          fact: "Factories, mills, and industry changed Barrow in major ways.",
        },
      ],
      teen: [
        {
          q: "Why do industrial sites matter historically?",
          options: [
            "They show how work shaped the town",
            "They are only decorative",
            "They replaced all roads",
            "They built castles",
          ],
          answer: 0,
          fact: "Industrial sites show how labour and production shaped the town.",
        },
      ],
      adult: [
        {
          q: "What is the historic value of industrial sites?",
          options: [
            "They preserve the story of labour and transformation",
            "They exist only for scenery",
            "They replaced civic life",
            "They were built mainly for tourism",
          ],
          answer: 0,
          fact: "Industrial sites preserve the story of labour and material transformation.",
        },
      ],
    },
  },

  statues_memorial: {
    quiz: {
      kid: [
        {
          q: "Why do towns have statues and memorials?",
          options: [
            "To remember people and events",
            "To hide treasure",
            "To launch rockets",
            "To grow food",
          ],
          answer: 0,
          fact: "Statues and memorials help towns remember people and events.",
        },
      ],
      teen: [
        {
          q: "What is the main purpose of a memorial or statue?",
          options: [
            "Public remembrance",
            "Road control",
            "Ticket sales",
            "Boat repair",
          ],
          answer: 0,
          fact: "Memorials and statues exist to support public remembrance.",
        },
      ],
      adult: [
        {
          q: "What do memorials and statues reveal about a town?",
          options: [
            "Who and what it chooses to remember",
            "Its crop yields",
            "Its underground caves",
            "Its weather patterns only",
          ],
          answer: 0,
          fact: "Memorials reveal who and what a town chooses to remember publicly.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Can statues help tell the story of a town?",
          options: ["Yes", "No", "Only maps can", "Only shops can"],
          answer: 0,
          fact: "Statues can help tell the story of a town and its people.",
        },
      ],
      teen: [
        {
          q: "Why are statues part of local history?",
          options: [
            "They preserve memory in public space",
            "They replace schools",
            "They run transport",
            "They build factories",
          ],
          answer: 0,
          fact: "Statues preserve memory in public space.",
        },
      ],
      adult: [
        {
          q: "What does a public statue most clearly do?",
          options: [
            "Turn memory into a visible civic object",
            "Direct road traffic",
            "Store official documents",
            "Control harbour trade",
          ],
          answer: 0,
          fact: "A public statue turns memory into a visible civic object.",
        },
      ],
    },
  },

  park_history: {
    quiz: {
      kid: [
        {
          q: "What kind of place is Barrow Park?",
          options: ["A park", "A harbour", "A factory", "An airport"],
          answer: 0,
          fact: "Barrow Park is one of the town’s important green spaces.",
        },
        {
          q: "What can people do in a park?",
          options: [
            "Play and relax",
            "Launch submarines",
            "Mine iron",
            "Build factories",
          ],
          answer: 0,
          fact: "Parks are made for play, walking, and shared public time.",
        },
      ],
      teen: [
        {
          q: "What makes the park good for quests?",
          options: [
            "Open space and landmarks",
            "Cargo cranes",
            "Runways",
            "Only shops",
          ],
          answer: 0,
          fact: "The park works well for quests because of its routes and landmarks.",
        },
        {
          q: "Why do parks matter in towns?",
          options: [
            "They create shared public space",
            "They replace ports",
            "They power factories",
            "They store cargo",
          ],
          answer: 0,
          fact: "Parks create shared public space in towns.",
        },
      ],
      adult: [
        {
          q: "What public role does a park often serve?",
          options: [
            "Leisure, memory, and social space",
            "Heavy freight movement",
            "Border control",
            "Industrial storage",
          ],
          answer: 0,
          fact: "Parks often serve leisure, memory, and social space.",
        },
        {
          q: "What best describes a strong park landmark?",
          options: [
            "A civic leisure feature",
            "A port loading tool",
            "A private military structure",
            "A freight yard device",
          ],
          answer: 0,
          fact: "Park landmarks are often civic leisure features within public space.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Can a park be an important part of town life?",
          options: ["Yes", "No", "Only roads matter", "Only factories matter"],
          answer: 0,
          fact: "Parks are important because they are shared spaces for the public.",
        },
      ],
      teen: [
        {
          q: "Why is a park part of local history?",
          options: [
            "It shows how towns value public leisure",
            "It replaces schools",
            "It acts like a factory",
            "It controls the sea",
          ],
          answer: 0,
          fact: "Parks show how towns create space for public leisure and gathering.",
        },
      ],
      adult: [
        {
          q: "How should a historic park be understood?",
          options: [
            "As designed public space",
            "As industrial overflow",
            "As transport-only land",
            "As unused leftover ground",
          ],
          answer: 0,
          fact: "A historic park should be understood as designed public space.",
        },
      ],
    },
  },

  park_cenotaph: {
    quiz: {
      kid: [
        {
          q: "What does the cenotaph honour?",
          options: [
            "Those lost in war",
            "Football winners",
            "Shop owners",
            "Bus drivers only",
          ],
          answer: 0,
          fact: "The cenotaph honours those lost in war.",
        },
      ],
      teen: [
        {
          q: "Why should a cenotaph be treated respectfully?",
          options: [
            "It is a memorial space",
            "It is a race track",
            "It is a market lane",
            "It is a skate zone",
          ],
          answer: 0,
          fact: "A cenotaph is a memorial space for remembrance.",
        },
      ],
      adult: [
        {
          q: "What civic purpose does a cenotaph serve?",
          options: [
            "Collective remembrance",
            "Retail promotion",
            "Cargo storage",
            "Traffic control",
          ],
          answer: 0,
          fact: "A cenotaph serves collective remembrance.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Is the cenotaph a place to remember people?",
          options: [
            "Yes",
            "No",
            "It is just decoration",
            "It is only for games",
          ],
          answer: 0,
          fact: "The cenotaph is a place for remembrance.",
        },
      ],
      teen: [
        {
          q: "What does the cenotaph show about the town?",
          options: [
            "That remembrance matters",
            "That only shopping matters",
            "That parks do not matter",
            "That roads are more important than memory",
          ],
          answer: 0,
          fact: "The cenotaph shows that remembrance matters in public life.",
        },
      ],
      adult: [
        {
          q: "Why is the cenotaph historically important?",
          options: [
            "It anchors public memory",
            "It stores old machinery",
            "It marks a rail junction",
            "It replaced a church",
          ],
          answer: 0,
          fact: "The cenotaph is historically important because it anchors public memory.",
        },
      ],
    },
  },

  abbey_history: {
    quiz: {
      kid: [
        {
          q: "Who lived at Furness Abbey long ago?",
          options: ["Monks", "Pirates", "Astronauts", "Robots"],
          answer: 0,
          fact: "Monks lived and worshipped at Furness Abbey.",
        },
        {
          q: "How old is Furness Abbey?",
          options: [
            "20 years",
            "100 years",
            "Over 800 years",
            "Built last week",
          ],
          answer: 2,
          fact: "Furness Abbey was founded in 1123.",
        },
      ],
      teen: [
        {
          q: "What kind of place was Furness Abbey?",
          options: [
            "A monastery",
            "A football ground",
            "A shopping centre",
            "A train station",
          ],
          answer: 0,
          fact: "Furness Abbey was a monastery.",
        },
        {
          q: "Which king closed many monasteries, including Furness Abbey?",
          options: ["Henry VIII", "King John", "Charles II", "Alfred"],
          answer: 0,
          fact: "Henry VIII dissolved monasteries across England.",
        },
      ],
      adult: [
        {
          q: "What was Furness Abbey’s main historic role?",
          options: [
            "Religious life and monastic power",
            "Modern retail",
            "Air travel",
            "Submarine launching",
          ],
          answer: 0,
          fact: "The abbey was a major religious and monastic site.",
        },
        {
          q: "What event ended Furness Abbey’s great power?",
          options: [
            "The Dissolution of the Monasteries",
            "A railway merger",
            "A coastal flood scheme",
            "A dock expansion",
          ],
          answer: 0,
          fact: "The Dissolution ended its monastic power.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Is Furness Abbey very old?",
          options: ["Yes", "No", "Only 20 years old", "Built last week"],
          answer: 0,
          fact: "Furness Abbey is hundreds of years old.",
        },
      ],
      teen: [
        {
          q: "What gives the abbey its strong atmosphere?",
          options: [
            "Ruins and history",
            "Airport lights",
            "Factory smoke",
            "Shopping signs",
          ],
          answer: 0,
          fact: "Its ruins and long history give it atmosphere.",
        },
      ],
      adult: [
        {
          q: "Why is Furness Abbey historically significant?",
          options: [
            "It reflects religious power and change",
            "It was a motorway junction",
            "It was a cinema complex",
            "It was a dock gate",
          ],
          answer: 0,
          fact: "Furness Abbey reflects major religious and political change.",
        },
      ],
    },
  },

  abbey_ghosts: {
    ghost: {
      kid: [
        "Stand still like you heard a ghost whisper.",
        "Do a brave monk pose.",
        "Point to where a ghost monk might appear.",
        "Whisper one word that fits the abbey.",
      ],
      teen: [
        "Name one thing here that makes the abbey feel eerie.",
        "Give this place a haunted-title in 3 words.",
        "Stand silent for 10 seconds and listen for echoes.",
        "What detail here would make the best ghost-story clue?",
      ],
      adult: [
        "Describe the abbey atmosphere in one word.",
        "What makes ruins especially effective for ghost stories?",
        "Does this place feel more haunted by memory, history, or imagination?",
        "What matters most here: stone, shadow, echo, or atmosphere?",
      ],
    },
  },

  docks_submarines: {
    quiz: {
      kid: [
        {
          q: "What is Barrow known for building today?",
          options: [
            "Submarines",
            "Chocolate castles",
            "Flying tractors",
            "Theme parks",
          ],
          answer: 0,
          fact: "Barrow is known for building submarines.",
        },
        {
          q: "Where can you learn about Barrow’s dock history?",
          options: ["Dock Museum", "Only the beach", "A farm", "A cinema"],
          answer: 0,
          fact: "The Dock Museum helps tell Barrow’s dock and ship story.",
        },
      ],
      teen: [
        {
          q: "Why are the docks important to Barrow?",
          options: [
            "They connect industry to trade",
            "They only grow food",
            "They replace roads",
            "They train actors",
          ],
          answer: 0,
          fact: "The docks supported shipbuilding, transport, and trade.",
        },
        {
          q: "Why is Barrow internationally known today?",
          options: [
            "Submarine building",
            "Volcano research",
            "Space launches",
            "Castle tourism",
          ],
          answer: 0,
          fact: "Barrow remains strongly associated with submarine construction.",
        },
      ],
      adult: [
        {
          q: "What gives Barrow continuing national importance?",
          options: [
            "Its defence and shipbuilding role",
            "Its medieval royal court",
            "Its airport network",
            "Its mountain agriculture",
          ],
          answer: 0,
          fact: "Barrow remains closely tied to defence manufacturing.",
        },
        {
          q: "Why are the docks historically significant in Barrow?",
          options: [
            "They enabled industrial output and connections",
            "They existed only for sport",
            "They replaced rail completely",
            "They were built only for tourism",
          ],
          answer: 0,
          fact: "The docks were critical to industrial transport and shipbuilding.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Did ships and docks help Barrow grow?",
          options: ["Yes", "No", "Only roads did", "Only farms did"],
          answer: 0,
          fact: "Ships and docks helped Barrow grow.",
        },
      ],
      teen: [
        {
          q: "What does the Dock Museum help preserve?",
          options: [
            "Barrow’s maritime and industrial story",
            "Only football history",
            "Only farming tools",
            "Only cinema posters",
          ],
          answer: 0,
          fact: "The Dock Museum preserves maritime and industrial history.",
        },
      ],
      adult: [
        {
          q: "What does the Dock Museum most strongly interpret?",
          options: [
            "Maritime industry, labour, and identity",
            "Luxury trade only",
            "Roman religion only",
            "Theatre culture only",
          ],
          answer: 0,
          fact: "The museum helps explain how shipbuilding shaped Barrow’s identity.",
        },
      ],
    },
  },

  islands_nature: {
    quiz: {
      kid: [
        {
          q: "What connects Walney Island to Barrow?",
          options: ["Bridge", "Volcano", "Castle wall", "Tunnel under London"],
          answer: 0,
          fact: "Walney Bridge connects Walney to Barrow.",
        },
        {
          q: "What can you often enjoy at coastal places like Earnse Bay?",
          options: [
            "Views and sea air",
            "Underground mines",
            "Skyscrapers",
            "Desert dunes",
          ],
          answer: 0,
          fact: "Coastal places are known for sea air, views, and changing weather.",
        },
      ],
      teen: [
        {
          q: "What is Walney known for as well as its size?",
          options: [
            "Wildlife and coastline",
            "Skyscrapers",
            "Coal mines",
            "Underground rail",
          ],
          answer: 0,
          fact: "Walney is known for wildlife, coastline, and birdlife.",
        },
        {
          q: "What kind of place is Piel Castle?",
          options: [
            "A coastal defensive castle",
            "A shopping arcade",
            "A train depot",
            "A factory",
          ],
          answer: 0,
          fact: "Piel Castle was built to help protect the coast.",
        },
      ],
      adult: [
        {
          q: "How should Walney be understood in relation to Barrow?",
          options: [
            "As part of the area’s wider coastal identity",
            "As an inland district",
            "As a market tunnel",
            "As a former abbey court",
          ],
          answer: 0,
          fact: "Walney adds an important coastal and ecological dimension to Barrow’s identity.",
        },
        {
          q: "What does Piel Castle symbolise in the wider landscape?",
          options: [
            "Coastal defence and strategic control",
            "Modern retail expansion",
            "Agricultural reform",
            "Airport planning",
          ],
          answer: 0,
          fact: "Piel Castle reflects the need to secure the coast and surrounding waters.",
        },
      ],
    },

    history: {
      kid: [
        {
          q: "Is Walney an island?",
          options: ["Yes", "No", "Only sometimes", "Only in winter"],
          answer: 0,
          fact: "Walney is one of England’s largest islands.",
        },
      ],
      teen: [
        {
          q: "Why do island and coast pins feel different from town pins?",
          options: [
            "They are shaped by sea and landscape",
            "They are full of factories only",
            "They are indoor only",
            "They have no history",
          ],
          answer: 0,
          fact: "Coastal pins feel different because sea and landscape change the experience.",
        },
      ],
      adult: [
        {
          q: "What does a coastal landmark often add to a route?",
          options: [
            "Scale, exposure, and atmosphere",
            "Only traffic noise",
            "Only retail",
            "Only street lighting",
          ],
          answer: 0,
          fact: "Coastal landmarks often add scale, exposure, and atmosphere.",
        },
      ],
    },
  },
};

/* =========================================================
   EXACT PIN OVERRIDES
   strongest priority
========================================================= */

export const QA_PIN_OVERRIDES = {
  home_base_marsh_st: {
    start: PIN_START_INTROS.home_base_marsh_st,
  },

  cenotaph_core: {
    start: PIN_START_INTROS.cenotaph_core,
    quiz: {
      kid: [
        {
          q: "What does the cenotaph remember?",
          options: [
            "War heroes",
            "Shopping days",
            "Markets",
            "Football matches",
          ],
          answer: 0,
          fact: "The cenotaph remembers people lost in war.",
        },
      ],
      teen: [
        {
          q: "Why should the cenotaph be treated with respect?",
          options: [
            "It is a memorial space",
            "It is a race track",
            "It is a market lane",
            "It is a game zone",
          ],
          answer: 0,
          fact: "The cenotaph is a memorial space for remembrance.",
        },
      ],
      adult: [
        {
          q: "What does the cenotaph most strongly represent?",
          options: [
            "Collective remembrance",
            "Retail activity",
            "Traffic management",
            "Tourist entertainment",
          ],
          answer: 0,
          fact: "The cenotaph represents collective remembrance.",
        },
      ],
    },
    history: {
      kid: [
        {
          q: "Is the cenotaph a place to remember people?",
          options: ["Yes", "No", "Only at night", "Only in summer"],
          answer: 0,
          fact: "The cenotaph is a place of remembrance.",
        },
      ],
      teen: [
        {
          q: "What does the cenotaph show about the town?",
          options: [
            "That remembrance matters",
            "That only roads matter",
            "That only sport matters",
            "That history is unimportant",
          ],
          answer: 0,
          fact: "The cenotaph shows that remembrance matters in public life.",
        },
      ],
      adult: [
        {
          q: "Why is the cenotaph historically important?",
          options: [
            "It anchors public memory",
            "It stores cargo",
            "It marks a shopping route",
            "It controls town traffic",
          ],
          answer: 0,
          fact: "The cenotaph is historically important because it anchors public memory.",
        },
      ],
    },
  },

  park_bandstand_core: {
    start: PIN_START_INTROS.park_bandstand_core,
    quiz: {
      kid: [
        {
          q: "What is a bandstand mainly used for?",
          options: [
            "Music and performances",
            "Fixing tractors",
            "Rocket launches",
            "Fishing boats",
          ],
          answer: 0,
          fact: "Bandstands are used for music and performances.",
        },
      ],
      teen: [
        {
          q: "What atmosphere fits a bandstand best?",
          options: [
            "Performance and celebration",
            "Heavy industry",
            "Freight loading",
            "Road repair",
          ],
          answer: 0,
          fact: "A bandstand is tied to performance and celebration.",
        },
      ],
      adult: [
        {
          q: "What public role does a bandstand often symbolise?",
          options: [
            "Shared entertainment and gathering",
            "Freight shipping",
            "Border defence",
            "Industrial storage",
          ],
          answer: 0,
          fact: "Bandstands often symbolise gathering and entertainment.",
        },
      ],
    },
  },

  furness_abbey_core: {
    start: PIN_START_INTROS.furness_abbey_core,
  },

  town_hall_clock: {
    start: PIN_START_INTROS.town_hall_clock,
    quiz: {
      kid: [
        {
          q: "What does a town hall clock help people do?",
          options: [
            "Know the time",
            "Bake bread",
            "Build ships",
            "Grow flowers",
          ],
          answer: 0,
          fact: "Clock landmarks helped towns run to a shared daily rhythm.",
        },
      ],
      teen: [
        {
          q: "Why are clock landmarks important in towns?",
          options: [
            "They help organise public life",
            "They replace libraries",
            "They launch trains",
            "They store cargo",
          ],
          answer: 0,
          fact: "Clock landmarks helped structure daily civic life.",
        },
      ],
      adult: [
        {
          q: "What does a civic clock most strongly represent?",
          options: [
            "Shared public rhythm",
            "Private wealth only",
            "Military secrecy",
            "Agricultural isolation",
          ],
          answer: 0,
          fact: "Civic clocks symbolise order, coordination, and shared urban time.",
        },
      ],
    },
  },

  barrow_library: {
    start: PIN_START_INTROS.barrow_library,
    quiz: {
      kid: [
        {
          q: "What do libraries help people do?",
          options: [
            "Learn and read",
            "Launch rockets",
            "Fix engines",
            "Catch fish",
          ],
          answer: 0,
          fact: "Libraries are places of learning, reading, and discovery.",
        },
      ],
      teen: [
        {
          q: "Why is a library important in a town?",
          options: [
            "It keeps knowledge available to everyone",
            "It replaces factories",
            "It controls traffic",
            "It stores submarines",
          ],
          answer: 0,
          fact: "Libraries are part of the public knowledge system of a town.",
        },
      ],
      adult: [
        {
          q: "What does a public library represent in civic life?",
          options: [
            "Shared access to knowledge",
            "Private military planning",
            "Trade regulation only",
            "Industrial extraction",
          ],
          answer: 0,
          fact: "A public library represents education, memory, and shared civic access to knowledge.",
        },
      ],
    },
  },

  james_ramsden_statue: {
    start: PIN_START_INTROS.james_ramsden_statue,
  },

  henry_schneider_statue: {
    start: PIN_START_INTROS.henry_schneider_statue,
  },

  custom_house: {
    start: PIN_START_INTROS.custom_house,
  },

  dock_museum_anchor: {
    start: PIN_START_INTROS.dock_museum_anchor,
  },

  dock_museum_submarine: {
    start: PIN_START_INTROS.dock_museum_submarine,
  },

  emlyn_hughes_statue: {
    start: PIN_START_INTROS.emlyn_hughes_statue,
  },

  salthouse_mills: {
    start: PIN_START_INTROS.salthouse_mills,
  },

  submarine_memorial: {
    start: PIN_START_INTROS.submarine_memorial,
  },

  walney_bridge_entrance: {
    start: PIN_START_INTROS.walney_bridge_entrance,
  },

  earnse_bay: {
    start: PIN_START_INTROS.earnse_bay,
  },

  piel_castle: {
    start: PIN_START_INTROS.piel_castle,
  },

  roose_station_platform: {
    start: PIN_START_INTROS.roose_station_platform,
  },

  abbey_boss: {
    boss: {
      kid: [
        {
          q: "Final Abbey Trial: Who lived here long ago?",
          options: ["Monks", "Aliens", "Pirates", "Cheese wizards"],
          answer: 0,
          fact: "Monks lived at Furness Abbey for centuries.",
        },
      ],
      teen: [
        {
          q: "FINAL BOSS: What event ended the abbey’s power?",
          options: [
            "The Dissolution of the Monasteries",
            "A volcano",
            "A railway crash",
            "A football riot",
          ],
          answer: 0,
          fact: "The Dissolution of the Monasteries ended its power.",
        },
      ],
      adult: [
        {
          q: "FINAL BOSS: What does Furness Abbey most strongly represent?",
          options: [
            "Religious power, memory, and political change",
            "Modern retail expansion",
            "Airport growth",
            "Weapons testing",
          ],
          answer: 0,
          fact: "It represents religious power, memory, and political change.",
        },
      ],
    },
  },

  park_boss_bandstand: {
    boss: {
      kid: [
        {
          q: "BOSS: Festival Revival! What is this place linked to?",
          options: [
            "Music and performance",
            "Mining",
            "Air travel",
            "Submarine docks",
          ],
          answer: 0,
          fact: "The bandstand is linked to music and public performance.",
        },
      ],
      teen: [
        {
          q: "BOSS: Festival Revival! What atmosphere fits this place best?",
          options: [
            "Performance and celebration",
            "Heavy industry",
            "Silent prayer only",
            "Airport security",
          ],
          answer: 0,
          fact: "This boss is tied to performance and celebration.",
        },
      ],
      adult: [
        {
          q: "BOSS: Festival Revival! What public role does a bandstand often symbolise?",
          options: [
            "Shared entertainment and gathering",
            "Freight shipping",
            "Border defence",
            "Agricultural storage",
          ],
          answer: 0,
          fact: "Bandstands often symbolise gathering and entertainment.",
        },
      ],
    },
  },

  park_boss_cenotaph: {
    boss: {
      kid: [
        {
          q: "BOSS: Memory Keeper! What does the cenotaph honour?",
          options: [
            "Those lost in war",
            "Football winners",
            "Train drivers",
            "Shop owners",
          ],
          answer: 0,
          fact: "The cenotaph honours those lost in war.",
        },
      ],
      teen: [
        {
          q: "BOSS: Memory Keeper! Why should this place be treated respectfully?",
          options: [
            "It is a memorial space",
            "It is a car park",
            "It is a skate zone",
            "It is a market lane",
          ],
          answer: 0,
          fact: "It is a memorial space for remembrance.",
        },
      ],
      adult: [
        {
          q: "BOSS: Memory Keeper! What civic purpose does a cenotaph serve?",
          options: [
            "Collective remembrance",
            "Retail promotion",
            "Cargo storage",
            "Ticket inspection",
          ],
          answer: 0,
          fact: "It serves collective remembrance.",
        },
      ],
    },
  },

  park_boss_skate: {
    boss: {
      kid: [
        {
          q: "BOSS: Park Champion! What matters most during a challenge?",
          options: [
            "Trying your best safely",
            "Cheating fast",
            "Giving up",
            "Ignoring everyone",
          ],
          answer: 0,
          fact: "The best win is doing your best safely.",
        },
      ],
      teen: [
        {
          q: "BOSS: Park Champion! What makes a strong challenger?",
          options: [
            "Confidence and control",
            "Chaos only",
            "Running away",
            "Breaking rules",
          ],
          answer: 0,
          fact: "A strong challenger shows confidence and control.",
        },
      ],
      adult: [
        {
          q: "BOSS: Park Champion! What does challenge mode reward most?",
          options: [
            "Skill, movement, and effort",
            "Noise only",
            "Stillness only",
            "Luck alone",
          ],
          answer: 0,
          fact: "Challenge mode rewards effort and skill.",
        },
      ],
    },
  },

  park_boss_mudman: {
    boss: {
      kid: [
        {
          q: "BOSS: Mudman Mystery! What best fits a mystery boss?",
          options: [
            "Clues and careful thinking",
            "Only shouting",
            "Only running",
            "Only sleeping",
          ],
          answer: 0,
          fact: "Mystery bosses are about clues and thinking.",
        },
      ],
      teen: [
        {
          q: "BOSS: Mudman Mystery! What wins a mystery challenge?",
          options: [
            "Observation and logic",
            "Random guessing only",
            "Ignoring clues",
            "Walking away",
          ],
          answer: 0,
          fact: "Observation and logic win mystery challenges.",
        },
      ],
      adult: [
        {
          q: "BOSS: Mudman Mystery! What makes mystery pins satisfying?",
          options: [
            "Pattern, clue, and reveal",
            "Pure noise",
            "Fast driving",
            "Ticket scanning",
          ],
          answer: 0,
          fact: "Mystery works through pattern, clue, and reveal.",
        },
      ],
    },
  },

  park_hidden_old_tree: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: What makes old trees special?",
          options: [
            "They hold age and history",
            "They are made of metal",
            "They float at sea",
            "They drive buses",
          ],
          answer: 0,
          fact: "Old trees can make places feel ancient and special.",
        },
      ],
      teen: [
        {
          q: "DISCOVERY: Why might an old tree feel important in a park?",
          options: [
            "It gives character and memory",
            "It runs the café",
            "It powers the lights",
            "It sells tickets",
          ],
          answer: 0,
          fact: "Old trees often give a park character and memory.",
        },
      ],
      adult: [
        {
          q: "DISCOVERY: What can an old tree add to a landscape?",
          options: [
            "Depth, age, and continuity",
            "Traffic control",
            "Retail signage",
            "Industrial noise",
          ],
          answer: 0,
          fact: "An old tree adds a sense of depth and continuity.",
        },
      ],
    },
  },

  park_hidden_quiet_bench: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: Why is a quiet bench useful in a park?",
          options: [
            "It gives a calm place to rest",
            "It launches boats",
            "It repairs trains",
            "It grows apples",
          ],
          answer: 0,
          fact: "Quiet places help explorers rest and notice more.",
        },
      ],
      teen: [
        {
          q: "DISCOVERY: What does a hidden quiet bench add to a map?",
          options: [
            "A pause point",
            "A boss arena",
            "A market route",
            "A repair station",
          ],
          answer: 0,
          fact: "Quiet bench spots create pause points in a route.",
        },
      ],
      adult: [
        {
          q: "DISCOVERY: What is valuable about hidden quiet spots?",
          options: [
            "They create reflection and contrast",
            "They produce power",
            "They direct traffic",
            "They store freight",
          ],
          answer: 0,
          fact: "Quiet hidden spots give reflection and contrast.",
        },
      ],
    },
  },

  park_hidden_secret_garden: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: What makes a secret garden feel special?",
          options: [
            "It feels hidden and magical",
            "It feels like a motorway",
            "It is noisy machinery",
            "It is a shipyard",
          ],
          answer: 0,
          fact: "Secret gardens feel special because they seem hidden and magical.",
        },
      ],
      teen: [
        {
          q: "DISCOVERY: Why do hidden garden spots work well in games?",
          options: [
            "They feel like secret rewards",
            "They feel like traffic jams",
            "They remove exploration",
            "They act like factories",
          ],
          answer: 0,
          fact: "Hidden gardens feel like secret rewards.",
        },
      ],
      adult: [
        {
          q: "DISCOVERY: What does a hidden garden add to a quest map?",
          options: [
            "Atmosphere and contrast",
            "Freight logistics",
            "Industrial output",
            "Street lighting only",
          ],
          answer: 0,
          fact: "A hidden garden adds atmosphere and contrast.",
        },
      ],
    },
  },

  park_hidden_lake_spot: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: What makes lake spots fun for explorers?",
          options: [
            "They are calm and scenic",
            "They are loud factories",
            "They are airport gates",
            "They are bus depots",
          ],
          answer: 0,
          fact: "Lake spots often feel calm and scenic.",
        },
      ],
      teen: [
        {
          q: "DISCOVERY: What vibe does a hidden lake spot usually give?",
          options: [
            "Calm and observation",
            "Panic and noise",
            "Cargo loading",
            "City traffic",
          ],
          answer: 0,
          fact: "Hidden lake spots work well as calm observation points.",
        },
      ],
      adult: [
        {
          q: "DISCOVERY: What does water add to a route experience?",
          options: [
            "Pause and atmosphere",
            "Only danger",
            "Only commerce",
            "Only speed",
          ],
          answer: 0,
          fact: "Water often adds pause and atmosphere.",
        },
      ],
    },
  },

  abbey_ghost_cloister: {
    ghost: {
      kid: [
        {
          q: "GHOST: Cloister Ghost! What should explorers use first in a spooky old place?",
          options: [
            "Courage and calm",
            "Shouting only",
            "Running into walls",
            "Throwing stones",
          ],
          answer: 0,
          fact: "The best explorers stay calm and brave.",
        },
      ],
      teen: [
        {
          q: "GHOST: Cloister Ghost! What gives a cloister its eerie power?",
          options: [
            "Silence, stone, and echo",
            "Traffic lights",
            "Loud music",
            "Shopping signs",
          ],
          answer: 0,
          fact: "Silent stone spaces and echoes give old cloisters their atmosphere.",
        },
      ],
      adult: [
        {
          q: "GHOST: Cloister Ghost! Why do enclosed ruin-spaces often feel haunted?",
          options: [
            "They combine memory, silence, and atmosphere",
            "They improve road traffic",
            "They generate electricity",
            "They hide market stalls",
          ],
          answer: 0,
          fact: "Enclosed ruins often feel haunted because place and imagination work together.",
        },
      ],
    },
  },

  abbey_headless_monk: {
    ghost: {
      kid: [
        {
          q: "GHOST ENCOUNTER: A monk appears in the mist. What should explorers use most?",
          options: [
            "Courage and calm",
            "Shouting only",
            "Running into walls",
            "Throwing mud",
          ],
          answer: 0,
          fact: "Ghost encounters work best with courage and calm.",
        },
      ],
      teen: [
        {
          q: "GHOST ENCOUNTER: What gives ghost stories their power?",
          options: [
            "Atmosphere and imagination",
            "Traffic lights",
            "Shopping receipts",
            "Bus timetables",
          ],
          answer: 0,
          fact: "Ghost stories work through atmosphere and imagination.",
        },
      ],
      adult: [
        {
          q: "GHOST ENCOUNTER: Why do haunted legends stay memorable?",
          options: [
            "They combine place, fear, and imagination",
            "They replace road signs",
            "They fuel factories",
            "They control harbour cranes",
          ],
          answer: 0,
          fact: "Haunted legends stay strong because they fuse place and imagination.",
        },
      ],
    },
  },

  abbey_whispering_trees: {
    ghost: {
      kid: [
        {
          q: "GHOST: Whispering Trees! What makes trees feel spooky in the wind?",
          options: [
            "Their sounds and shadows",
            "Their engines",
            "Their headlights",
            "Their concrete walls",
          ],
          answer: 0,
          fact: "Wind, shadows, and movement can make trees feel spooky.",
        },
      ],
      teen: [
        {
          q: "GHOST: Whispering Trees! What creates the eerie feeling here most?",
          options: [
            "Movement and sound",
            "Traffic cones",
            "Ticket barriers",
            "Shop windows",
          ],
          answer: 0,
          fact: "Movement and sound are often what make places feel eerie.",
        },
      ],
      adult: [
        {
          q: "GHOST: Whispering Trees! Why are natural spaces so effective in ghost stories?",
          options: [
            "Because sound, darkness, and uncertainty work together",
            "Because they improve Wi-Fi",
            "Because they store cargo",
            "Because they replace roads",
          ],
          answer: 0,
          fact: "Natural spaces often feel haunted because uncertainty and atmosphere build together.",
        },
      ],
    },
  },

  abbey_hidden_stone: {
    discovery: {
      kid: [
        {
          q: "DISCOVERY: A silent stone is hidden here. Why do stones matter in ruins?",
          options: [
            "They carry clues from the past",
            "They are remote controls",
            "They run trains",
            "They sell tickets",
          ],
          answer: 0,
          fact: "Stones in ruins can feel like clues from the past.",
        },
      ],
    },
  },

  abbey_hidden_mirror: {
    discovery: {
      teen: [
        {
          q: "DISCOVERY: Valley Mirror found. What do reflective hidden spots add?",
          options: [
            "Mood and mystery",
            "Cargo loading",
            "Market noise",
            "Traffic policing",
          ],
          answer: 0,
          fact: "Reflective hidden spots add mood and mystery.",
        },
      ],
    },
  },

  abbey_hidden_forge: {
    discovery: {
      adult: [
        {
          q: "DISCOVERY: Iron Forge Ruins found. What does a forge site suggest?",
          options: [
            "Labour and transformation",
            "Beach tourism only",
            "Airport lounges",
            "Religious silence only",
          ],
          answer: 0,
          fact: "Forge ruins suggest labour, heat, and transformation.",
        },
      ],
    },
  },
};

/* =========================================================
   RIDDLE BUILDERS
========================================================= */

const RIDDLE_FUNNY = {
  kid: [
    "A confused potato in a wizard hat",
    "Your dad’s lost TV remote",
    "A chicken wearing sunglasses",
    "A penguin driving a bus",
  ],
  teen: [
    "Your group chat at 2am",
    "A dramatic pigeon with attitude",
    "A seagull running a business",
    "Your mate after one hour of sleep",
  ],
  adult: [
    "That one drawer full of random cables",
    "Your sat-nav after a wrong turn",
    "A neighbour with strong opinions",
    "The weekly shop before payday",
  ],
};

const RIDDLE_CLOSE = {
  kid: ["A shadow", "A map", "A mirror", "A clock"],
  teen: ["An echo", "A sign", "A picture", "A tool"],
  adult: ["A symbol", "A signal", "A reflection", "A marker"],
};

const RIDDLE_VERY_CLOSE = {
  kid: ["A book", "A bottle", "A road", "A bell"],
  teen: ["A keypad", "A notebook", "A footprint", "A tower"],
  adult: ["A memory", "A pattern", "A route", "A record"],
};

function makeMcqFromRiddle(riddle, tier = "kid", salt = 0, forcedId = null) {
  if (!riddle?.q || !riddle?.a) {
    return makeFallbackTask("Broken riddle entry.", { mode: "logic" });
  }

  const correct = riddle.a;
  const funny = pickOne(RIDDLE_FUNNY[tier], salt + 11) || "A confused potato";
  const close = pickOne(RIDDLE_CLOSE[tier], salt + 22) || "A shadow";
  const veryClose = pickOne(RIDDLE_VERY_CLOSE[tier], salt + 33) || "A map";

  let options = [correct, veryClose, close, funny];
  options = [...new Set(options)];

  while (options.length < 4) {
    options.push(`Option ${options.length + 1}`);
  }

  const shuffled = shuffleSeeded(options, salt);
  const answer = shuffled.indexOf(correct);

  return {
    id: forcedId || riddle.id || makeQuestionId("logic", riddle),
    q: riddle.q,
    options: shuffled,
    answer,
    fact: riddle.a,
    meta: { type: "riddle", tier },
  };
}

/* =========================================================
   HELPERS
========================================================= */

function getPinById(pinId) {
  if (!pinId || !Array.isArray(PINS)) return null;
  return PINS.find((p) => String(p.id) === String(pinId)) || null;
}

function getPinZone(pin) {
  return pin?.set || pin?.zone || "core";
}

function getPinGroup(pin) {
  return pin?.qaGroup || null;
}

function getRecentIds(input = {}) {
  const recent = input.recentQuestionIds || input.recentIds || [];
  return Array.isArray(recent) ? recent.map(String) : [];
}

function chooseEntryAvoidingRecent(pool, recentIds, salt = 0) {
  if (!pool.length) return null;

  const recentSet = new Set((recentIds || []).map(String));
  const filtered = pool.filter((item) => !recentSet.has(String(item.id)));

  if (filtered.length) return pickOne(filtered, salt);
  return pickOne(pool, salt);
}

function getExactPinOverride(pinId, mode, tier) {
  return (
    QA_PIN_OVERRIDES?.[pinId]?.[mode]?.[tier] ||
    QA_PIN_OVERRIDES?.[pinId]?.[mode]?.kid ||
    null
  );
}

function getGroupPool(group, mode, tier) {
  if (!group) return [];
  const groupBlock = QA_BY_GROUP?.[group];
  if (!groupBlock) return [];

  if (mode === "logic") {
    return attachIds(RIDDLE_POOL, `${group}_logic_${tier}`);
  }

  if (["activity", "battle", "family", "speed"].includes(mode)) {
    let merged = [];
    if (mode === "activity")
      merged = combinePools(ACTIVITY_POOL[tier] || [], ACTIVITY_POOL.kid || []);
    if (mode === "battle")
      merged = combinePools(BATTLE_POOL[tier] || [], BATTLE_POOL.kid || []);
    if (mode === "family")
      merged = combinePools(FAMILY_POOL[tier] || [], FAMILY_POOL.kid || []);
    if (mode === "speed")
      merged = combinePools(SPEED_POOL[tier] || [], SPEED_POOL.kid || []);
    return attachIds(merged, `${group}_${mode}_${tier}`);
  }

  const exact = groupBlock?.[mode]?.[tier] || [];
  const kidFallback = tier !== "kid" ? groupBlock?.[mode]?.kid || [] : [];

  return attachIds(
    combinePools(exact, kidFallback),
    `${group}_${mode}_${tier}`
  );
}

function getZoneFunPool(zone, mode, tier) {
  if (mode === "logic") {
    return attachIds(RIDDLE_POOL, `${zone}_logic_${tier}`);
  }

  if (mode === "activity") {
    return attachIds(
      combinePools(ACTIVITY_POOL[tier] || [], ACTIVITY_POOL.kid || []),
      `${zone}_activity_${tier}`
    );
  }

  if (mode === "battle") {
    return attachIds(
      combinePools(BATTLE_POOL[tier] || [], BATTLE_POOL.kid || []),
      `${zone}_battle_${tier}`
    );
  }

  if (mode === "family") {
    return attachIds(
      combinePools(FAMILY_POOL[tier] || [], FAMILY_POOL.kid || []),
      `${zone}_family_${tier}`
    );
  }

  if (mode === "speed") {
    return attachIds(
      combinePools(SPEED_POOL[tier] || [], SPEED_POOL.kid || []),
      `${zone}_speed_${tier}`
    );
  }

  if (mode === "ghost") {
    if (zone === "abbey") {
      return attachIds(
        combinePools(
          QA_BY_GROUP.abbey_ghosts.ghost?.[tier] || [],
          tier !== "kid" ? QA_BY_GROUP.abbey_ghosts.ghost?.kid || [] : []
        ),
        `${zone}_ghost_${tier}`
      );
    }

    const genericGhost = {
      kid: [
        "Stand still for 5 seconds and listen for the tiniest sound nearby.",
        "Do a spooky statue pose.",
        "Point at the place a ghost might hide.",
        "Whisper one word that fits this place.",
      ],
      teen: [
        "Name one thing here that feels eerie.",
        "Give this place a ghost-story title.",
        "Stand silent for 10 seconds and listen.",
        "Say a one-line warning for this area.",
      ],
      adult: [
        "Describe the atmosphere here in one word.",
        "What detail makes this place feel unsettled or still?",
        "Stand quietly for 10 seconds and notice the soundscape.",
        "What would make this location work in a local ghost story?",
      ],
    };

    return attachIds(
      combinePools(genericGhost[tier] || [], genericGhost.kid || []),
      `${zone}_ghost_${tier}`
    );
  }

  if (
    mode === "quiz" ||
    mode === "history" ||
    mode === "boss" ||
    mode === "discovery"
  ) {
    return [];
  }

  return [];
}

function resolvePinStartIntro(pinId, tier = "kid") {
  return (
    QA_PIN_OVERRIDES?.[pinId]?.start?.[tier] ||
    QA_PIN_OVERRIDES?.[pinId]?.start?.kid ||
    PIN_START_INTROS?.[pinId]?.[tier] ||
    PIN_START_INTROS?.[pinId]?.kid ||
    ""
  );
}

function resolvePool({ pinId, pin, zone, group, mode, tier }) {
  const exactOverride = getExactPinOverride(pinId, mode, tier);
  if (Array.isArray(exactOverride) && exactOverride.length) {
    return {
      pool: attachIds(exactOverride, `${pinId}_${mode}_${tier}`),
      source: "pin-exact",
    };
  }

  if (pin?.hidden && mode === "discovery") {
    const hiddenOverride =
      QA_PIN_OVERRIDES?.[pinId]?.discovery?.[tier] ||
      QA_PIN_OVERRIDES?.[pinId]?.discovery?.kid ||
      [];

    if (Array.isArray(hiddenOverride) && hiddenOverride.length) {
      return {
        pool: attachIds(hiddenOverride, `${pinId}_discovery_${tier}`),
        source: "pin-discovery",
      };
    }
  }

  const groupPool = getGroupPool(group, mode, tier);
  if (groupPool.length) {
    return {
      pool: groupPool,
      source: `group-${group}`,
    };
  }

  const zoneFunPool = getZoneFunPool(zone, mode, tier);
  if (zoneFunPool.length) {
    return {
      pool: zoneFunPool,
      source: `zone-fun-${zone}`,
    };
  }

  return {
    pool: [],
    source: "none",
  };
}

/* =========================================================
   MAIN EXPORTS
========================================================= */

export function getPinStartIntro(pinId, tier = "kid") {
  return resolvePinStartIntro(pinId, normaliseTier(tier));
}

export function getQA(input = {}) {
  const pinId = input.pinId || null;
  const pin = getPinById(pinId);
  const zone = input.zone || getPinZone(pin);
  const group = getPinGroup(pin);
  const mode = input.mode || "quiz";
  const tier = normaliseTier(input.tier || "kid");
  const recentIds = getRecentIds(input);

  const rawSalt = Number(input.salt || Date.now());
  const stableSalt =
    rawSalt +
    String(pinId || "none").length * 97 +
    String(zone).length * 37 +
    String(mode).length * 19 +
    String(tier).length * 11 +
    String(group || "nogroup").length * 13;

  const { pool, source } = resolvePool({
    pinId,
    pin,
    zone,
    group,
    mode,
    tier,
  });

  if (!pool.length) {
    return makeFallbackTask(
      `No ${mode} content found for ${pinId || zone} (${tier}).`,
      {
        pinId,
        zone,
        group,
        mode,
        tier,
        source,
      }
    );
  }

  const picked = chooseEntryAvoidingRecent(pool, recentIds, stableSalt);

  if (!picked) {
    return makeFallbackTask("No task could be chosen.", {
      pinId,
      zone,
      group,
      source,
      mode,
      tier,
    });
  }

  if (mode === "logic" && picked?.q && picked?.a) {
    const built = makeMcqFromRiddle(picked, tier, stableSalt, picked.id);
    built.meta = {
      ...(built.meta || {}),
      zone,
      group,
      pinId,
      source,
      mode,
      tier,
      questionId: built.id,
    };
    return built;
  }

  if (picked?.q && Array.isArray(picked?.options)) {
    const originalOptions = [...picked.options];
    const correctText = originalOptions[picked.answer];
    const shuffledOptions = shuffleSeeded(originalOptions, stableSalt + 123);
    const answer = shuffledOptions.indexOf(correctText);

    return {
      ...picked,
      options: shuffledOptions,
      answer,
      meta: {
        ...(picked.meta || {}),
        zone,
        group,
        pinId,
        source,
        mode,
        tier,
        questionId: picked.id,
      },
    };
  }

  if (picked?._type === "prompt" && typeof picked.value === "string") {
    return {
      ...makePromptTask(picked.value, mode, picked.id),
      meta: {
        zone,
        group,
        pinId,
        source,
        mode,
        tier,
        promptOnly: true,
        questionId: picked.id,
      },
    };
  }

  if (typeof picked === "string") {
    return {
      ...makePromptTask(picked, mode),
      meta: {
        zone,
        group,
        pinId,
        source,
        mode,
        tier,
        promptOnly: true,
        questionId: makeQuestionId(
          `${zone}_${group || "nogroup"}_${mode}_${tier}`,
          picked
        ),
      },
    };
  }

  return makeFallbackTask("Task format not recognised.", {
    zone,
    group,
    pinId,
    source,
    mode,
    tier,
  });
}
