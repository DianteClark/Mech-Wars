// Mech Wars v2 — game data: board, terrain, parts, mods, tactics, frames, pilots, doctrines, twists.
// Numbers are starting points, tuned with tools/sim.mjs.

export const W = 6;
export const H = 7;

export const LIMBS = ['head', 'armL', 'armR', 'legs'];
export const LIMB_NAMES = { head: 'Head', armL: 'Left arm', armR: 'Right arm', legs: 'Legs' };
export const BASE_LIMB_HP = { head: 5, armL: 6, armR: 6, legs: 7 };

export const RULES = {
  coreMax: 20,
  energyTable: [[15, 4], [8, 3], [1, 2]],   // [min Core, energy per turn]
  overdriveEnergy: 2,
  overdriveCost: 3,
  baseAP: 2,
  baseMobility: 2,
  startHand: 5,
  handLimit: 8,
  exposeAfter: 2,          // destroyed limbs needed to expose the Core
  shock: 1,                // every hit on a limb also deals this much to the Core
  collision: 2,            // damage per tile a pushed mech couldn't move (goes straight to the Core)
  braceMult: 0.5,
  chargeMult: 1.5,
  coverReduce: 2,          // forest / smoke vs direct fire
  guardBlock: 3,
  guardMax: 4,
  meterMax: 100,
  turnLimit: 60,           // total turns (30 each)
  meltdownTurn: 36,        // after this many total turns, each Core loses 1 at the start of its turn
  firstAP: 1,              // the first player's opening turn
  secondEnergy: 1,
};

// Terrain. hp: 0 = indestructible. becomes: what it turns into when destroyed.
export const TERRAIN = {
  open: { name: 'Open ground', cost: 1, blocks: false, cover: false, hp: 0, crash: 0 },
  forest: { name: 'Forest', cost: 2, blocks: false, cover: true, hp: 3, becomes: 'open', crash: 0, crashTake: 2,
    text: 'Costs 2 to enter. Cover: direct fire deals 2 less to a mech standing here.' },
  rubble: { name: 'Rubble', cost: 2, blocks: false, cover: false, hp: 3, becomes: 'open', crash: 1,
    text: 'Costs 2 to enter.' },
  building: { name: 'Building', cost: 99, blocks: true, cover: false, hp: 6, becomes: 'rubble', crash: 3, crashTake: 3,
    text: 'Blocks movement and direct fire. Pushing a mech into it deals +3. Becomes rubble when destroyed.' },
  mountain: { name: 'Mountain', cost: 99, blocks: true, cover: false, hp: 12, becomes: 'rubble', crash: 4, crashTake: 2,
    text: 'Blocks movement and direct fire. Pushing a mech into it deals +4. Becomes rubble when destroyed.' },
  river: { name: 'River', cost: 1, blocks: false, cover: false, hp: 0, crash: 0, river: true,
    text: 'Entering ends your move. A mech pushed into it is stuck: no Move next turn.' },
  wall: { name: 'Aegis wall', cost: 99, blocks: true, cover: false, hp: 6, becomes: 'open', crash: 2, crashTake: 2,
    text: 'An energy wall. Blocks movement and direct fire. Fades when destroyed.' },
};

// Base limb attacks (used when the limb has no part, or the part has no attack of its own).
export const BASE_ATTACKS = {
  head: { name: 'Vulcans', range: 'direct', reach: 3, dmg: 1, shape: 'single' },
  armL: { name: 'Jab', range: 'melee', reach: 1, dmg: 2, shape: 'single' },
  armR: { name: 'Jab', range: 'melee', reach: 1, dmg: 2, shape: 'single' },
  legs: { name: 'Kick', range: 'melee', reach: 1, dmg: 2, shape: 'single', push: 1 },
};

// Card types: part (replaces a limb), mod (sticks onto a limb), tactic (instant).
// attack: { name, range: melee|direct|artillery, reach, dmg, shape, heavy, energy, push, pull, lock, ignoreBrace, wall }
// shape: single | plus | sq2 | row | line3
export const CARDS = {
  // ---------------------------------------------------------------- shared parts
  cannon_arm: { name: 'Cannon Arm', type: 'part', slot: 'arm', cost: 2, hp: 8,
    attack: { name: 'Cannon', range: 'direct', reach: 4, dmg: 4, shape: 'single' },
    text: 'Replaces an arm. Cannon: direct fire, range 4, 4 damage.' },
  thruster_legs: { name: 'Thruster Legs', type: 'part', slot: 'legs', cost: 2, hp: 8, mobility: 3,
    text: 'Replaces legs. Mobility 3.' },
  // ---------------------------------------------------------------- shared mods
  plating: { name: 'Armor Plating', type: 'mod', slots: ['head', 'armL', 'armR', 'legs'], cost: 1, hp: 2, armor: 1,
    text: 'Sticks onto a limb: +2 HP and Armor 1 (each hit on it deals 1 less).' },
  // ---------------------------------------------------------------- shared tactics
  repair_kit: { name: 'Repair Kit', type: 'tactic', effect: 'repair', target: 'limb', cost: 1, amount: 4,
    text: 'Repairs one of your limbs for 4.' },
  rebuild_kit: { name: 'Rebuild Kit', type: 'tactic', effect: 'rebuild', target: 'deadLimb', cost: 2,
    text: 'Rebuilds a destroyed limb as a base limb at full HP.' },
  core_patch: { name: 'Core Patch', type: 'tactic', effect: 'core', cost: 2, amount: 3,
    text: 'Restores 3 Core.' },
  drone_escort: { name: 'Guard Drones', type: 'tactic', effect: 'guard', cost: 2, amount: 2,
    text: 'Gain 2 Guard drones. Each blocks 3 damage from one hit.' },
  energy_cell: { name: 'Energy Cell', type: 'tactic', effect: 'cell', cost: 1, amount: 3,
    text: '+1 energy on each of your next 3 turns.' },
  scavenge: { name: 'Scavenge', type: 'tactic', effect: 'draw', cost: 1, amount: 2,
    text: 'Draw 2 cards.' },
  rush_order: { name: 'Rush Order', type: 'tactic', effect: 'rush', cost: 1,
    text: 'Every part in your Workshop lands right now.' },

  // ---------------------------------------------------------------- Brakka (brawler)
  hammer_arm: { name: 'Wrecking Hammer', type: 'part', slot: 'arm', frame: 'brakka', sig: true, cost: 3, hp: 10,
    attack: { name: 'Hammer', range: 'melee', reach: 1, dmg: 5, shape: 'single', push: 2 },
    text: 'Signature. Replaces an arm. Hammer: melee, 5 damage, push 2.' },
  drill_arm: { name: 'Drill Arm', type: 'part', slot: 'arm', frame: 'brakka', cost: 2, hp: 9,
    attack: { name: 'Drill', range: 'melee', reach: 1, dmg: 5, shape: 'single', ignoreBrace: true },
    text: 'Replaces an arm. Drill: melee, 5 damage, ignores brace.' },
  tread_legs: { name: 'Tread Legs', type: 'part', slot: 'legs', frame: 'brakka', cost: 2, hp: 11, rough: true, pushResist: 1, mobility: 2,
    attack: { name: 'Ram', range: 'melee', reach: 1, dmg: 3, shape: 'single', push: 2 },
    text: 'Replaces legs. Ignores rough terrain, pushes on you are 1 shorter. Ram: melee, 3 damage, push 2.' },
  spikes: { name: 'Ram Spikes', type: 'mod', slots: ['armL', 'armR', 'legs'], frame: 'brakka', cost: 1, crashBonus: 2, hp: 1,
    text: 'Sticks onto a limb: every collision you cause deals +2.' },
  adrenal: { name: 'Adrenal Surge', type: 'tactic', effect: 'ap', frame: 'brakka', cost: 2, amount: 1,
    text: '+1 action this turn.' },

  // ---------------------------------------------------------------- Longshot (gunner)
  rail_lance_arm: { name: 'Rail Lance', type: 'part', slot: 'arm', frame: 'longshot', sig: true, cost: 3, hp: 7,
    attack: { name: 'Rail shot', range: 'direct', reach: 6, dmg: 10, shape: 'single', heavy: true, energy: 1 },
    text: 'Signature. Replaces an arm. Rail shot: heavy, direct fire, range 6, 10 damage. Costs 1 energy to fire.' },
  gatling_arm: { name: 'Gatling Arm', type: 'part', slot: 'arm', frame: 'longshot', cost: 2, hp: 8,
    attack: { name: 'Gatling', range: 'direct', reach: 3, dmg: 5, shape: 'single' },
    text: 'Replaces an arm. Gatling: direct fire, range 3, 5 damage.' },
  missile_crown: { name: 'Missile Crown', type: 'part', slot: 'head', frame: 'longshot', cost: 2, hp: 6,
    attack: { name: 'Missiles', range: 'artillery', reach: 4, dmg: 4, shape: 'sq2' },
    text: 'Replaces the head. Missiles: artillery, range 4, 4 damage across a 2×2 area.' },
  sensor_head: { name: 'Sensor Head', type: 'part', slot: 'head', frame: 'longshot', cost: 2, hp: 7, rangeBonus: 2,
    attack: { name: 'Vulcans', range: 'direct', reach: 5, dmg: 2, shape: 'single' },
    text: 'Replaces the head. All direct fire +2 range. Vulcans: range 5, 2 damage.' },
  scope: { name: 'Long Scope', type: 'mod', slots: ['head', 'armL', 'armR'], frame: 'longshot', cost: 1, reach: 1, dmgBonus: 1, hp: 1,
    text: 'Sticks onto a limb: its attack gets +1 range and +1 damage.' },
  hover_legs: { name: 'Hover Legs', type: 'part', slot: 'legs', frame: 'longshot', cost: 2, hp: 7, hover: true, mobility: 3,
    text: 'Replaces legs. Mobility 3, rivers don’t stop you and can’t trap you.' },

  // ---------------------------------------------------------------- Bastion (tank)
  aegis_head: { name: 'Aegis Projector', type: 'part', slot: 'head', frame: 'bastion', sig: true, cost: 3, hp: 8,
    attack: { name: 'Aegis wall', range: 'artillery', reach: 3, dmg: 0, shape: 'single', wall: true },
    text: 'Signature. Replaces the head. Aegis wall: raise a 6 HP wall on an open tile within 3.' },
  shield_arm: { name: 'Shield Arm', type: 'part', slot: 'arm', frame: 'bastion', cost: 2, hp: 12, armor: 1, globalArmor: 1,
    attack: { name: 'Shield bash', range: 'melee', reach: 1, dmg: 3, shape: 'single', push: 1 },
    text: 'Replaces an arm. Every hit on your mech deals 1 less. Shield bash: melee, 3 damage, push 1.' },
  mortar_arm: { name: 'Mortar Arm', type: 'part', slot: 'arm', frame: 'bastion', cost: 2, hp: 9,
    attack: { name: 'Mortar', range: 'artillery', reach: 5, dmg: 6, shape: 'plus', heavy: true, energy: 1 },
    text: 'Replaces an arm. Mortar: heavy artillery, range 5, 6 damage across a plus shape. Costs 1 energy to fire.' },
  anchor_legs: { name: 'Anchor Legs', type: 'part', slot: 'legs', frame: 'bastion', cost: 2, hp: 13, anchor: true, mobility: 1,
    text: 'Replaces legs. Can’t be pushed or pulled. Mobility 1.' },
  heavy_plating: { name: 'Heavy Plating', type: 'mod', slots: ['head', 'armL', 'armR', 'legs'], frame: 'bastion', cost: 2, hp: 5, armor: 2,
    text: 'Sticks onto a limb: +5 HP and Armor 2.' },
  demolition: { name: 'Demolition Charge', type: 'tactic', effect: 'demolish', target: 'tile', range: 3, frame: 'bastion', cost: 1, amount: 8,
    text: 'Deal 8 damage to terrain within 3 tiles (a mech standing there takes 2).' },

  // ---------------------------------------------------------------- Specter (trickster)
  phase_legs: { name: 'Phase Drive', type: 'part', slot: 'legs', frame: 'specter', sig: true, cost: 3, hp: 7, phase: true, mobility: 3,
    text: 'Signature. Replaces legs. Move becomes a teleport to any open tile within 3, ignoring terrain.' },
  harpoon_arm: { name: 'Harpoon Arm', type: 'part', slot: 'arm', frame: 'specter', cost: 2, hp: 7,
    attack: { name: 'Harpoon', range: 'direct', reach: 4, dmg: 2, shape: 'single', pull: 3 },
    text: 'Replaces an arm. Harpoon: direct fire, range 4, 2 damage, pull 3.' },
  blade_arm: { name: 'Beam Blade', type: 'part', slot: 'arm', frame: 'specter', cost: 2, hp: 7,
    attack: { name: 'Beam blade', range: 'melee', reach: 1, dmg: 6, shape: 'single' },
    text: 'Replaces an arm. Beam blade: melee, 6 damage.' },
  emp_head: { name: 'EMP Crest', type: 'part', slot: 'head', frame: 'specter', cost: 2, hp: 6,
    attack: { name: 'EMP pulse', range: 'direct', reach: 4, dmg: 1, shape: 'single', lock: true },
    text: 'Replaces the head. EMP pulse: direct fire, range 4, 1 damage, locks the target (no Move next turn).' },
  emp_net: { name: 'EMP Net', type: 'tactic', effect: 'lockFoe', frame: 'specter', cost: 2, range: 4,
    text: 'If the enemy is within 4 tiles, lock them: no Move next turn.' },
  smoke: { name: 'Smoke Screen', type: 'tactic', effect: 'smoke', frame: 'specter', cost: 1,
    text: 'Until your next turn you have cover: direct fire on you deals 2 less, and heavy locks on your tile miss.' },
};

const SHARED = ['cannon_arm', 'thruster_legs', 'plating', 'plating', 'repair_kit', 'repair_kit', 'rebuild_kit',
  'core_patch', 'drone_escort', 'energy_cell', 'scavenge', 'rush_order'];

export const FRAMES = {
  brakka: {
    name: 'Brakka', role: 'Brawler', color: '#D2463A', accent: '#E4B23C',
    blurb: 'Charge in and smash enemies into walls.',
    trait: 'Collisions you cause deal +2.',
    tune: { crashBonus: 2 },
    deck: [...SHARED, 'hammer_arm', 'drill_arm', 'drill_arm', 'tread_legs', 'spikes', 'spikes', 'adrenal', 'adrenal'],
  },
  longshot: {
    name: 'Longshot', role: 'Gunner', color: '#3D6ED6', accent: '#F0C238',
    blurb: 'Hold the sightlines and snipe parts off from range.',
    trait: 'Direct fire gets +1 range.',
    tune: { directRange: 1 },
    deck: [...SHARED, 'rail_lance_arm', 'gatling_arm', 'gatling_arm', 'missile_crown', 'sensor_head', 'scope', 'scope', 'hover_legs'],
  },
  bastion: {
    name: 'Bastion', role: 'Tank', color: '#6E875A', accent: '#E39A2E',
    blurb: 'Hold ground, raise walls, and shell everything in range.',
    trait: 'Limbs have +3 HP. Pushes on you are 1 shorter.',
    tune: { limbBonus: 3, pushResist: 1 },
    deck: [...SHARED, 'aegis_head', 'shield_arm', 'mortar_arm', 'mortar_arm', 'anchor_legs', 'heavy_plating', 'heavy_plating', 'demolition'],
  },
  specter: {
    name: 'Specter', role: 'Trickster', color: '#9B7BFF', accent: '#FF5C9A',
    blurb: 'Three actions a turn. Lock, pull and slip away.',
    trait: '3 actions each turn. Limbs have 1 less HP.',
    tune: { ap: 1, limbBonus: -1 },
    deck: [...SHARED, 'phase_legs', 'harpoon_arm', 'harpoon_arm', 'blade_arm', 'blade_arm', 'emp_head', 'emp_net', 'smoke'],
  },
};

export const FRAME_ORDER = ['brakka', 'longshot', 'bastion', 'specter'];
export const UNLOCK_COST = { specter: 200 };

export const PILOTS = {
  redline: { name: 'Vex “Redline”', style: 'Ace', text: 'Overdrive costs 1 less Core.',
    special: 'Redline Rush', specialText: '+1 action, and your next attack deals +3.' },
  okafor: { name: 'Mara Okafor', style: 'Tactician', text: 'The first card you install each turn costs 1 less.',
    special: 'Tactical Scan', specialText: '+1 action and draw 2 cards.' },
  gus: { name: 'Old Gus', style: 'Mechanic', text: 'Parts arrive with +2 HP.',
    special: 'Field Repair', specialText: 'Repair every limb for 4 and rebuild one destroyed limb.' },
  kai: { name: 'Kai Tanaka', style: 'Duelist', text: 'Your first attack each turn deals +1.',
    special: 'Iaido', specialText: 'Your next attack this turn deals +6 and ignores brace.' },
};
export const PILOT_ORDER = ['redline', 'okafor', 'gus', 'kai'];

// time: turns until a part arrives (0 = instant). mod: quality steps applied to the part.
export const DOCTRINES = {
  standard: { name: 'Standard', short: 'Standard', text: 'Parts arrive next turn.', time: 1, mod: 0 },
  rush: { name: 'Rush Crew', short: 'Rush', text: 'Parts arrive instantly but with 2 less HP and 1 less damage.', time: 0, mod: -1 },
  master: { name: 'Master Crafters', short: 'Master', text: 'Parts take 2 turns but arrive with +2 HP and +1 damage.', time: 2, mod: 1 },
  firepower: { name: 'Specialists: Firepower', short: 'Firepower', text: 'Parts arrive next turn with +1 damage.', time: 1, mod: 0, focus: 'fire' },
  armor: { name: 'Specialists: Armor', short: 'Armor', text: 'Parts arrive next turn with +3 HP.', time: 1, mod: 0, focus: 'armor' },
};
export const DOCTRINE_ORDER = ['standard', 'rush', 'master', 'firepower', 'armor'];

// Tower twists. Rule twists apply to the player; battlefield twists change the map.
export const TWISTS = {
  brownout: { name: 'Brownout', text: 'Your Core makes 1 less energy each turn.' },
  norepair: { name: 'No repairs', text: 'You can’t use Repair Kits, Rebuild Kits or Core Patches.' },
  hotcore: { name: 'Hot core', text: 'Overdrive costs 1 more Core.' },
  flooded: { name: 'Flooded', text: 'Rivers have overrun the battlefield.' },
  fog: { name: 'Fog', text: 'Direct fire has 2 less range for both mechs.' },
  fortress: { name: 'Fortress', text: 'The enemy starts with Heavy Plating on every limb.' },
  ambush: { name: 'Ambush', text: 'The enemy goes first and starts with 2 Guard drones.' },
};
export const TWIST_ORDER = Object.keys(TWISTS);

export const MAP_THEMES = {
  city: { name: 'City block', weights: { building: 5, rubble: 2, forest: 1, mountain: 0, river: 0 } },
  forest: { name: 'Old forest', weights: { forest: 6, mountain: 1, building: 0, rubble: 1, river: 1 } },
  canyon: { name: 'Canyon', weights: { mountain: 5, rubble: 3, forest: 0, building: 0, river: 0 } },
  delta: { name: 'River delta', weights: { river: 0, forest: 3, rubble: 1, building: 1, mountain: 1 }, river: true },
};
export const THEME_ORDER = ['city', 'forest', 'canyon', 'delta'];
