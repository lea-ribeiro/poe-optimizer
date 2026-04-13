export type LevelingMilestone = {
  act: string;
  level: number;
  objective: string;
  benchmarks: string[];
  tips: string[];
};

export type StarterPath = {
  archetype: string;
  skills: { level: number; gem: string; note: string }[];
};

export const STARTER_PATHS: Record<string, StarterPath> = {
  'Minion': {
    archetype: 'Minion',
    skills: [
      { level: 1, gem: 'Raise Zombie / Holy Strike', note: 'Zombies provide early meatshield. Use Holy Strike for single target.' },
      { level: 4, gem: 'Summon Raging Spirit (SRS)', note: 'Vendor Recipe: Magic Wand + Alteration + Ruby Ring = +1 Fire Gems wand.' },
      { level: 12, gem: 'Absolution', note: 'Strongest leveling minion skill. Link with Added Lightning and Minion Damage.' },
      { level: 38, gem: 'Unleash Support', note: 'Crucial for SRS/Absolution feel. Buy from Petarus and Vanja in Act 4.' }
    ]
  },
  'Spell': {
    archetype: 'Spell',
    skills: [
      { level: 1, gem: 'Freezing Pulse', note: 'Great clear. Use Arcane Surge (lvl 1) for mana and damage.' },
      { level: 12, gem: 'Rolling Magma / Arc', note: 'Vendor Recipe: Magic Wand + Alteration + Topaz Ring = +1 Lightning Gems wand.' },
      { level: 28, gem: 'Divine Blast / Eye of Winter', note: 'Major power spike. Look for 4-links in Act 3 vendor (Hargan).' }
    ]
  },
  'Attack': {
    archetype: 'Attack',
    skills: [
      { level: 1, gem: 'Splitting Steel', note: 'Use Chance to Bleed early. High clear speed with Pierce.' },
      { level: 12, gem: 'Sunder / Spectral Helix', note: 'Vendor Recipe: Weapon + Rustic Sash + Blacksmith\'s Whetsone = Incr. Phys Damage.' },
      { level: 31, gem: 'Precise Technique', note: 'Huge damage boost if your Accuracy is higher than your Life.' }
    ]
  }
};

export const CAMPAIGN_MILESTONES: LevelingMilestone[] = [
  {
    act: 'Acts 1-3',
    level: 28,
    objective: 'The Library / Siosa',
    benchmarks: ['Lightning Res 75% for Dominus', 'Movement Speed Boots (10%+)'],
    tips: [
      'Complete "A Fixture of Fate" in Act 3 to buy almost any gem from Siosa.',
      'Check vendors for 3-links and Movement Speed boots every time you level up.',
      'Use the Flat Damage wand/weapon recipe (Ring + Alteration + Magic Item).'
    ]
  },
  {
    act: 'Acts 4-6',
    level: 45,
    objective: 'First Lab / Lilly Roth',
    benchmarks: ['1500+ Life', 'All Elemental Resists 75%'],
    tips: [
      'Lilly Roth in Act 6 sells ALL gems once you clear "Falling in Love".',
      'First Labyrinth is a massive power spike - don\'t skip it!',
      'Kill Kitava in Act 5: You will lose 30% all resistances. Prep gear before!'
    ]
  },
  {
    act: 'Acts 7-10',
    level: 68,
    objective: 'Merciless Lab / Mapping Prep',
    benchmarks: ['3000+ Life', 'Chaos Res > 0%', 'Primary Skill 5-Link'],
    tips: [
      'Get your 3rd Ascendancy (Merciless Lab) before killing Act 10 Kitava.',
      'Use "Corrupted Gaze" or "The Porcupine" div cards for an easy 6-link starter.',
      'Farm Blood Aqueduct (Act 9) for "Humility" cards if you need a Tabula Rasa.'
    ]
  }
];
