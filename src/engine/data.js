// Mech Wars — game data: cards, frames, pilots, doctrines, twists.
// Numbers are first-pass and get tuned via tools/sim.mjs.

export const LIMBS = ['head', 'armL', 'armR', 'legs'];
export const LIMB_NAMES = { head: 'Head', armL: 'Left arm', armR: 'Right arm', legs: 'Legs' };
export const BASE_LIMB_HP = { head: 6, armL: 7, armR: 7, legs: 8 };

export const RULES = {
  coreMax: 20,
  // [minCore, energy] — first matching row wins
  energyTable: [[15, 4], [8, 3], [1, 2]],
  overdriveEnergy: 2,
  overdriveCost: 3,
  orderCost: 2,
  workshopSlots: 3,
  startHand: 5,
  handLimit: 8,
  baseAP: 1,           // +1 while legs are intact
  punch: 2,
  kick: 3,
  guardBlock: 3,
  guardMax: 4,
  exposeAfter: 2,      // destroyed limbs needed to expose the Core
  secondEnergy: 1,     // bonus energy on the second player's first turn
  shredLimb: 2,
  shredCore: -2,
};

// type: weapon | boost | plating | support | order
// slots: limbs it can be mounted / applied to
// stat: which number doctrine modifiers change, and by how much per step
export const CARDS = {
  // ---------- shared arsenal ----------
  pulse_rifle: { name: 'Pulse Rifle', type: 'weapon', cost: 2, build: 3, slots: ['armL', 'armR', 'head'], dmg: 4,
    text: 'Fires for 4.', stat: ['dmg', 1] },
  scrap_plating: { name: 'Scrap Plating', type: 'plating', cost: 1, build: 2, slots: ['head', 'armL', 'armR', 'legs'], hp: 3, armor: 1,
    text: '+3 HP and Armor 1 on a limb.', stat: ['hp', 2] },
  repair_pod: { name: 'Repair Pod', type: 'support', effect: 'repair', cost: 2, build: 2, amount: 4,
    text: 'Repairs a damaged limb for 4.', stat: ['amount', 2] },
  rebuild_kit: { name: 'Rebuild Kit', type: 'support', effect: 'rebuild', cost: 3, build: 3,
    text: 'Rebuilds a destroyed limb at full HP.' },
  core_patch: { name: 'Core Patch', type: 'support', effect: 'core', cost: 2, build: 3, amount: 3,
    text: 'Restores 3 Core.', stat: ['amount', 1] },
  drone_escort: { name: 'Drone Escort', type: 'support', effect: 'guard', cost: 2, build: 2, amount: 2,
    text: 'Gain 2 Guard drones.', stat: ['amount', 1] },
  energy_cell: { name: 'Energy Cell', type: 'support', effect: 'cell', cost: 1, build: 2, amount: 3,
    text: '+1 energy on each of your next 3 turns.', stat: ['amount', 1] },
  rush_order: { name: 'Rush Order', type: 'order', effect: 'rush', cost: 1,
    text: 'Crew order: a Workshop build finishes 1 turn sooner.' },
  scavenge: { name: 'Scavenge', type: 'order', effect: 'draw', cost: 1, amount: 2,
    text: 'Crew order: draw 2 cards.' },

  // ---------- Brakka (brawler) ----------
  wrecking_fists: { name: 'Wrecking Fists', type: 'boost', frame: 'brakka', sig: true, cost: 3, build: 3, slots: ['armL', 'armR'], punch: 3, shred: true,
    text: 'Signature. Punches from this arm deal +3 and Shred.', stat: ['punch', 1] },
  hydraulic_fist: { name: 'Hydraulic Fist', type: 'boost', frame: 'brakka', cost: 2, build: 2, slots: ['armL', 'armR'], punch: 1,
    text: 'Punches from this arm deal +1.', stat: ['punch', 1] },
  piston_boots: { name: 'Piston Boots', type: 'boost', frame: 'brakka', cost: 2, build: 3, slots: ['legs'], kick: 2, ap: 1,
    text: 'Kicks deal +2. +1 action each turn.', stat: ['kick', 1] },
  headbutt_crest: { name: 'Headbutt Crest', type: 'weapon', frame: 'brakka', cost: 2, build: 2, slots: ['head'], dmg: 3, shred: true,
    text: 'Headbutt for 3. Shred.', stat: ['dmg', 1] },
  adrenal_surge: { name: 'Adrenal Surge', type: 'order', effect: 'ap', frame: 'brakka', cost: 2, amount: 1,
    text: 'Pilot order: +1 action this turn.' },

  // ---------- Longshot (gunner) ----------
  rail_lance: { name: 'Rail Lance', type: 'weapon', frame: 'longshot', sig: true, cost: 4, build: 4, slots: ['armL', 'armR'], dmg: 7, pierce: 2, fire: 1,
    text: 'Signature. Fires for 7, Pierce 2. Costs 1 energy to fire.', stat: ['dmg', 1] },
  twin_autocannon: { name: 'Twin Autocannon', type: 'weapon', frame: 'longshot', cost: 3, build: 3, slots: ['armL', 'armR'], dmg: 6,
    text: 'Fires for 6.', stat: ['dmg', 1] },
  scope_visor: { name: 'Scope Visor', type: 'boost', frame: 'longshot', cost: 2, build: 2, slots: ['head'], weaponBonus: 1,
    text: 'All your weapons deal +1.' },
  missile_pod: { name: 'Missile Pod', type: 'weapon', frame: 'longshot', cost: 3, build: 3, slots: ['legs'], dmg: 4, pierce: 1,
    text: 'Fires for 4, Pierce 1. Replaces the kick.', stat: ['dmg', 1] },
  sniper_pistol: { name: 'Sniper Pistol', type: 'weapon', frame: 'longshot', cost: 1, build: 2, slots: ['armL', 'armR'], dmg: 3, snipe: true,
    text: 'Fires for 3. Snipe.', stat: ['dmg', 1] },

  // ---------- Bastion (tank) ----------
  aegis_dome: { name: 'Aegis Dome', type: 'boost', frame: 'bastion', sig: true, cost: 2, build: 2, slots: ['legs'], guardGen: 1,
    text: 'Signature. Gain 1 Guard drone at the start of each of your turns.' },
  tower_shield: { name: 'Tower Shield', type: 'boost', frame: 'bastion', cost: 3, build: 3, slots: ['armL', 'armR'], guardBlock: 5,
    text: 'Your Guard drones block 5 instead of 3.' },
  reinforced_plating: { name: 'Reinforced Plating', type: 'plating', frame: 'bastion', cost: 2, build: 3, slots: ['head', 'armL', 'armR', 'legs'], hp: 5, armor: 2,
    text: '+5 HP and Armor 2 on a limb.', stat: ['hp', 2] },
  shield_bash: { name: 'Shield Bash', type: 'weapon', frame: 'bastion', cost: 2, build: 2, slots: ['armL', 'armR'], dmg: 2, bash: true,
    text: 'Hits for 2, plus 1 per Guard drone you have.', stat: ['dmg', 1] },
  brace: { name: 'Brace', type: 'order', effect: 'guardNow', frame: 'bastion', cost: 1, amount: 1,
    text: 'Pilot order: gain 1 Guard drone now.' },

  // ---------- Specter (trickster) ----------
  oracle_eye: { name: 'Oracle Eye', type: 'boost', frame: 'specter', sig: true, cost: 3, build: 3, slots: ['head'], oracle: true,
    text: 'Signature. See the enemy hand and Workshop. All your attacks Snipe.' },
  ghost_blade: { name: 'Ghost Blade', type: 'weapon', frame: 'specter', cost: 2, build: 2, slots: ['armL', 'armR'], dmg: 4, snipe: true,
    text: 'Slashes for 4. Snipe.', stat: ['dmg', 1] },
  emp_spike: { name: 'EMP Spike', type: 'weapon', frame: 'specter', cost: 3, build: 3, slots: ['head'], dmg: 3, emp: true,
    text: 'Hits for 3. On hit, the enemy build closest to done is delayed 1 turn.', stat: ['dmg', 1] },
  phase_treads: { name: 'Phase Treads', type: 'boost', frame: 'specter', cost: 2, build: 2, slots: ['legs'], ap: 1, kick: 1,
    text: '+1 action each turn. Kicks deal +1.', stat: ['kick', 1] },
  sabotage: { name: 'Sabotage', type: 'order', effect: 'sabotage', frame: 'specter', cost: 2,
    text: 'Crew order: the enemy build closest to done is delayed 1 turn.' },
};

const SHARED = ['pulse_rifle', 'pulse_rifle', 'scrap_plating', 'scrap_plating', 'repair_pod', 'repair_pod',
  'rebuild_kit', 'core_patch', 'drone_escort', 'energy_cell', 'rush_order', 'scavenge'];

export const FRAMES = {
  brakka: {
    name: 'Brakka', role: 'Brawler', color: '#FF8A3D', accent: '#FFD23F',
    blurb: 'Fists first. Every punch hits harder.',
    trait: 'Punches deal +1.',
    tune: { punchBonus: 1 },
    deck: [...SHARED, 'wrecking_fists', 'hydraulic_fist', 'hydraulic_fist', 'piston_boots', 'piston_boots', 'headbutt_crest', 'adrenal_surge', 'adrenal_surge'],
  },
  longshot: {
    name: 'Longshot', role: 'Gunner', color: '#3EC6FF', accent: '#E8F7FF',
    blurb: 'A walking gun rack. Weapons come off the line faster and hit harder.',
    trait: 'Weapons build 1 turn faster (minimum 2) and deal +1.',
    tune: { weaponHaste: 1, weaponBonus: 1 },
    deck: [...SHARED, 'rail_lance', 'twin_autocannon', 'twin_autocannon', 'scope_visor', 'missile_pod', 'missile_pod', 'sniper_pistol', 'sniper_pistol'],
  },
  bastion: {
    name: 'Bastion', role: 'Tank', color: '#3EE6A8', accent: '#1F8F6A',
    blurb: 'Outlast anything. Thick limbs and a drone wall.',
    trait: 'Limbs have +1 HP. Its Aegis Dome comes online fast.',
    tune: { limbBonus: 1 },
    deck: [...SHARED, 'aegis_dome', 'tower_shield', 'reinforced_plating', 'reinforced_plating', 'shield_bash', 'shield_bash', 'brace', 'brace'],
  },
  specter: {
    name: 'Specter', role: 'Trickster', color: '#B57BFF', accent: '#F2E6FF',
    blurb: 'Hard to pin down. Reads your plans and slows your crew.',
    trait: 'Evasive: the first hit against it each turn deals 1 less.',
    tune: { evade: 1 },
    deck: [...SHARED, 'oracle_eye', 'ghost_blade', 'ghost_blade', 'emp_spike', 'phase_treads', 'sabotage', 'sabotage', 'scavenge'],
  },
};

export const FRAME_ORDER = ['brakka', 'longshot', 'bastion', 'specter'];
export const UNLOCK_COST = { specter: 200 };

export const PILOTS = {
  redline: { name: 'Vex “Redline”', style: 'Ace', text: 'Overdrive costs 1 less Core.' },
  okafor: { name: 'Mara Okafor', style: 'Tactician', text: 'The first card you play each turn costs 1 less.' },
  gus: { name: 'Old Gus', style: 'Mechanic', text: 'When a build finishes on a limb, that limb is repaired for 2.' },
  kai: { name: 'Kai Tanaka', style: 'Duelist', text: 'Your first attack each turn deals +1.' },
};
export const PILOT_ORDER = ['redline', 'okafor', 'gus', 'kai'];

// mod = stat steps applied when a build completes
export const DOCTRINES = {
  standard: { name: 'Standard', short: 'Standard', text: 'Normal build times and quality.', time: 0, mod: 0 },
  rush: { name: 'Rush Crew', short: 'Rush', text: 'Builds finish 1 turn sooner (min 2) but come out 1 step weaker.', time: -1, mod: -1 },
  master: { name: 'Master Crafters', short: 'Master', text: 'Builds take 1 turn longer but come out 1 step stronger.', time: 1, mod: 1 },
  firepower: { name: 'Specialists: Firepower', short: 'Firepower', text: 'Weapons and strike boosts come out 1 step stronger.', time: 0, mod: 0, focus: 'fire' },
  armor: { name: 'Specialists: Armor', short: 'Armor', text: 'Plating, repairs and drones come out 1 step stronger.', time: 0, mod: 0, focus: 'armor' },
};
export const DOCTRINE_ORDER = ['standard', 'rush', 'master', 'firepower', 'armor'];

// Tower twists apply to the player for a stretch of floors.
export const TWISTS = {
  brownout: { name: 'Brownout', text: 'Your Core makes 1 less energy each turn.' },
  norepair: { name: 'No repairs', text: 'You can’t play Repair Pods, Rebuild Kits or Core Patches.' },
  shortage: { name: 'Parts shortage', text: 'Your Workshop has 1 fewer slot.' },
  hotcore: { name: 'Hot core', text: 'Overdrive costs 1 more Core.' },
  armored: { name: 'Armored foe', text: 'Enemy limbs have +2 HP.' },
  ambush: { name: 'Ambush', text: 'The enemy goes first and starts with a Guard drone.' },
};
export const TWIST_ORDER = Object.keys(TWISTS);
