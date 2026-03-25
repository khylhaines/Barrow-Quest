export const ROUTES = {
  core: {
    id: "core",
    name: "Full Barrow Map",
    mode: "open",
    set: "core",
    description: "Your original full Barrow map with all classic pins.",
  },

  abbey: {
    id: "abbey",
    name: "Furness Abbey Quest",
    mode: "guided",
    set: "abbey",
    bossPinId: "abbey_boss",

    starts: {
      red_river: {
        id: "red_river",
        name: "Red River Walk Start",
        startPinId: "abbey_redriver_start",
        orderedPins: [
          "abbey_redriver_start",
          "abbey_redriver_bridge",
          "abbey_redriver_bend",
          "abbey_valley_view",
          "abbey_amphitheatre_entry",
          "abbey_amphitheatre_top",
          "abbey_gate",
          "abbey_church",
          "abbey_cloister",
          "abbey_chapter_house",
          "abbey_viewpoint",
          "abbey_boss",
        ],
      },

      hospital: {
        id: "hospital",
        name: "Hospital Side Start",
        startPinId: "abbey_hospital_entry",
        orderedPins: [
          "abbey_hospital_entry",
          "abbey_hospital_field",
          "abbey_amphitheatre_top",
          "abbey_gate",
          "abbey_church",
          "abbey_cloister",
          "abbey_chapter_house",
          "abbey_viewpoint",
          "abbey_boss",
        ],
      },

      manor: {
        id: "manor",
        name: "Manor Hall Start",
        startPinId: "abbey_manor_gate",
        orderedPins: [
          "abbey_manor_gate",
          "abbey_outer_field",
          "abbey_entry_path",
          "abbey_amphitheatre_entry",
          "abbey_amphitheatre_top",
          "abbey_gate",
          "abbey_church",
          "abbey_cloister",
          "abbey_chapter_house",
          "abbey_viewpoint",
          "abbey_boss",
        ],
      },

      woodland: {
        id: "woodland",
        name: "Woodland Start",
        startPinId: "abbey_woodland_entry",
        orderedPins: [
          "abbey_woodland_entry",
          "abbey_monk_path",
          "abbey_farmland",
          "abbey_amphitheatre_entry",
          "abbey_amphitheatre_top",
          "abbey_gate",
          "abbey_church",
          "abbey_cloister",
          "abbey_chapter_house",
          "abbey_viewpoint",
          "abbey_boss",
        ],
      },

      visitor: {
        id: "visitor",
        name: "Car Park / Visitor Start",
        startPinId: "abbey_carpark",
        orderedPins: [
          "abbey_carpark",
          "abbey_ticket_gate",
          "abbey_cafe",
          "abbey_visitor_area",
          "abbey_gate",
          "abbey_church",
          "abbey_cloister",
          "abbey_chapter_house",
          "abbey_viewpoint",
          "abbey_boss",
        ],
      },
    },

    hiddenPins: [
      "abbey_hidden_stone",
      "abbey_hidden_mirror",
      "abbey_hidden_forge",
    ],

    ghostPins: [
      "abbey_ghost_cloister",
      "abbey_headless_monk",
      "abbey_whispering_trees",
    ],
  },

  park: {
    id: "park",
    name: "Barrow Park Adventure",
    mode: "dynamic",
    set: "park",

    starts: {
      parkroad: {
        id: "parkroad",
        name: "Park Road Start",
        startPinId: "park_start_parkave",
        suggestedTheme: "festival",
      },

      abbeyroad: {
        id: "abbeyroad",
        name: "Abbey Road Start",
        startPinId: "park_start_abbeyroad",
        suggestedTheme: "festival",
      },

      daltonroad: {
        id: "daltonroad",
        name: "Dalton Road Start",
        startPinId: "park_start_daltonroad",
        suggestedTheme: "history",
      },

      greengate: {
        id: "greengate",
        name: "Greengate Start",
        startPinId: "park_start_greengate",
        suggestedTheme: "nature",
      },

      leisure: {
        id: "leisure",
        name: "Leisure Start",
        startPinId: "park_start_leisure",
        suggestedTheme: "challenge",
      },

      cemetery: {
        id: "cemetery",
        name: "Cemetery Start",
        startPinId: "park_start_cemetery",
        suggestedTheme: "history",
      },
    },

    themes: {
      festival: {
        id: "festival",
        name: "Festival Story",
        pins: [
          "park_bandstand",
          "park_cafe",
          "park_bowls",
          "park_golf",
          "park_open_field",
        ],
        bossPinId: "park_boss_bandstand",
      },

      history: {
        id: "history",
        name: "History Story",
        pins: ["park_cenotaph", "park_mini_railway"],
        bossPinId: "park_boss_cenotaph",
      },

      mystery: {
        id: "mystery",
        name: "Mystery Story",
        pins: [
          "park_mudman",
          "park_parrot_corner",
          "park_hidden_old_tree",
          "park_hidden_quiet_bench",
          "park_hidden_secret_garden",
        ],
        bossPinId: "park_boss_mudman",
      },

      challenge: {
        id: "challenge",
        name: "Challenge Story",
        pins: [
          "park_skate_park",
          "park_gym_park",
          "park_pirate_ship",
          "park_leisure_centre",
        ],
        bossPinId: "park_boss_skate",
      },

      nature: {
        id: "nature",
        name: "Nature Story",
        pins: [
          "park_lake",
          "park_bridge",
          "park_boat_hut",
          "park_flower_gardens",
          "park_hidden_lake_spot",
        ],
        bossPinId: null,
      },
    },

    bossRules: {
      park_boss_bandstand: {
        theme: "festival",
        needed: 3,
      },

      park_boss_cenotaph: {
        theme: "history",
        needed: 2,
      },

      park_boss_mudman: {
        theme: "mystery",
        needed: 2,
        needsHidden: "park_hidden_secret_garden",
      },

      park_boss_skate: {
        theme: "challenge",
        needed: 3,
      },
    },

    hiddenRules: {
      park_hidden_old_tree: {
        theme: "mystery",
        needed: 2,
      },

      park_hidden_secret_garden: {
        theme: "mystery",
        needed: 2,
      },

      park_hidden_lake_spot: {
        theme: "nature",
        needed: 2,
      },

      park_hidden_quiet_bench: {
        totalCompleted: 3,
      },
    },
  },
};
