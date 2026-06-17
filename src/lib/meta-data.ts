/**
 * Meta-Data: Stores archetype-specific progression signatures.
 */

export type ProgressionTier = 'Budget' | 'Core' | 'Luxury';

export type SlotProgression = {
  slot: string;
  steps: {
    tier: ProgressionTier;
    itemName: string;
    description: string;
    minPrice?: number;
    usagePercent?: number;
    isMandatory?: boolean;
    damageType?: 'Elemental' | 'Chaos' | 'Physical' | 'Any';
  }[];
};

export type BenchmarkInfo = {
  name: string;
  type: 'Item' | 'Gem' | 'Keystone' | 'Cluster' | 'Jewel';
  description: string;
  isMandatory?: boolean;
  damageType?: 'Elemental' | 'Chaos' | 'Physical' | 'Any';
  redundantWith?: string; // If the user has this string in PoB, this benchmark is redundant
};

export type ArchetypeProgression = {
  archetype: string;
  mainSkills: string[];
  slots: SlotProgression[];
  benchmarks: BenchmarkInfo[];
};

export const META_PROGRESSION: ArchetypeProgression[] = [
  {
    archetype: 'Kinetic Blast Wander',
    mainSkills: ['Kinetic Blast', 'Kinetic Blast of Clustering'],
    slots: [
      {
        slot: 'Belt',
        steps: [
          { tier: 'Budget', itemName: 'Rare Stygian Vise', description: 'Focus on Life, Resists, and Strength/Intelligence.' },
          { tier: 'Core', itemName: 'Headhunter', description: 'The premier belt for mapping.', minPrice: 1500, usagePercent: 35 },
          { tier: 'Luxury', itemName: 'Mageblood', description: 'Permanent flask uptime.', minPrice: 35000, usagePercent: 55 }
        ]
      },
      {
        slot: 'Weapon',
        steps: [
          { tier: 'Budget', itemName: "Piscator's Vigil", description: 'Best budget wand for elemental.', isMandatory: false, damageType: 'Elemental' },
          { tier: 'Core', itemName: 'Crafted Void Wand', description: 'High Flat Chaos + Attack Speed.', damageType: 'Chaos', usagePercent: 40 },
          { tier: 'Core', itemName: 'Crafted Imbued Wand', description: 'High Flat Elemental.', damageType: 'Elemental', usagePercent: 20 },
          { tier: 'Luxury', itemName: 'Mirror Tier Wand', description: 'Top-tier crafted wand.' }
        ]
      },
      {
        slot: 'Amulet',
        steps: [
          { tier: 'Budget', itemName: 'Rare Amulet', description: 'Attributes and Life.' },
          { tier: 'Core', itemName: 'The Eternal Struggle', description: 'Cull and stats.', usagePercent: 45, isMandatory: true },
          { tier: 'Luxury', itemName: 'Anathema', description: 'Scale curse limit with Power Charges. Mandatory for multi-curse setups.', isMandatory: false }
        ]
      }
    ],
    benchmarks: [
      { name: 'Greater Multiple Projectiles', type: 'Gem', description: 'Top-tier clear speed.', isMandatory: true },
      { name: 'Nimis', type: 'Item', description: 'Projectiles return to you.', isMandatory: true, redundantWith: 'Returning Projectiles' },
      { name: 'Point Blank', type: 'Keystone', description: 'Shotgunning damage.', isMandatory: true },
      { name: 'Large Cluster Jewel', type: 'Cluster', description: 'Feed the Fury / Fuel the Fight.', isMandatory: true },
      { name: 'Whispers of Doom', type: 'Keystone', description: 'Extra curse.', isMandatory: true, damageType: 'Any' }
    ]
  },
  {
    archetype: 'Toxic Rain Pathfinder',
    mainSkills: ['Toxic Rain', 'Toxic Rain of Withering'],
    slots: [
      {
        slot: 'Weapon',
        steps: [
          { tier: 'Budget', itemName: 'Rare Short Bow', description: 'Look for Attack Speed and +1 to Level of Socketed Gems.' },
          { tier: 'Core', itemName: '+3 Chaos Bow', description: '+1 to Level of Socketed Gems and +2 to Level of Socketed Chaos Gems.', isMandatory: true },
          { tier: 'Luxury', itemName: 'Widowhail', description: 'Extreme scaling for your Quiver stats.', usagePercent: 25 }
        ]
      },
      {
        slot: 'Body Armour',
        steps: [
          { tier: 'Budget', itemName: 'Rare Evasion Body Armour', description: 'High Life and Spell Suppression.' },
          { tier: 'Core', itemName: 'Lightning Coil', description: 'Phys-to-Lightning conversion for massive defense.', isMandatory: true, usagePercent: 65 }
        ]
      },
      {
        slot: 'Belt',
        steps: [
          { tier: 'Budget', itemName: 'Rare Leather Belt', description: 'Life and Flask nodes.' },
          { tier: 'Luxury', itemName: 'The Tides of Time', description: 'Ultimate Pathfinder belt for flask sustain.', minPrice: 8000 }
        ]
      }
    ],
    benchmarks: [
      { name: '37% Increased AoE', type: 'Item', description: 'Required for 5-pod overlap.', isMandatory: true },
      { name: '100% Spell Suppression', type: 'Keystone', description: 'Mandatory for red maps.', isMandatory: true },
      { name: 'Mirage Archer', type: 'Gem', description: 'Automated pod placement.', isMandatory: true }
    ]
  },
  {
    archetype: 'Righteous Fire Chieftain',
    mainSkills: ['Righteous Fire', 'Righteous Fire of Helical'],
    slots: [
      {
        slot: 'Body Armour',
        steps: [
          { tier: 'Budget', itemName: 'Cloak of Flame', description: 'Damage mitigation and early burn damage.', isMandatory: true },
          { tier: 'Core', itemName: 'Rare Astral Plate', description: 'High Life, % Life, and Purity of Fire effect.' }
        ]
      },
      {
        slot: 'Helmet',
        steps: [
          { tier: 'Budget', itemName: 'Rare Helmet', description: 'Life and Resistances.' },
          { tier: 'Core', itemName: 'Elder Helmet', description: 'Socketed Gems are supported by Burning Damage.', isMandatory: true, usagePercent: 55 }
        ]
      },
      {
        slot: 'Weapon',
        steps: [
          { tier: 'Budget', itemName: 'Rare Sceptre', description: 'Elemental Damage and Damage over Time Multiplier.' },
          { tier: 'Core', itemName: 'Rare Void Sceptre', description: '+1 to Level of All Fire Spell Skill Gems.', isMandatory: true }
        ]
      }
    ],
    benchmarks: [
      { name: '90% Maximum Fire Resistance', type: 'Keystone', description: 'Chieftain defensive cornerstone.', isMandatory: true },
      { name: 'Fire Trap', type: 'Gem', description: 'Necessary for single-target boss damage.', isMandatory: false }
    ]
  },
  {
    archetype: 'Lightning Strike Slayer',
    mainSkills: ['Lightning Strike', 'Lightning Strike of Arcing'],
    slots: [
      {
        slot: 'Weapon',
        steps: [
          { tier: 'Budget', itemName: 'Rare Imperial Claw', description: 'High Flat Elemental Damage and Attack Speed.' },
          { tier: 'Core', itemName: 'Paradoxica', description: 'Double damage for strike skills.', usagePercent: 30 },
          { tier: 'Luxury', itemName: 'Mirror Tier Claw', description: 'Triple T1 Elemental Damage with Crit.' }
        ]
      },
      {
        slot: 'Boots',
        steps: [
          { tier: 'Budget', itemName: 'Rare Boots', description: 'Life, Movement Speed, and Suppression.' },
          { tier: 'Core', itemName: "Ralakesh's Impatience", description: 'Maintain all charges permanently.', isMandatory: true, usagePercent: 80 }
        ]
      },
      {
        slot: 'Amulet',
        steps: [
          { tier: 'Budget', itemName: 'Rare Amulet', description: 'Stats and Life.' },
          { tier: 'Luxury', itemName: 'Crystallised Omniscience', description: 'Massive penetration scaling.', minPrice: 15000 }
        ]
      }
    ],
    benchmarks: [
      { name: 'The Interrogation', type: 'Cluster', description: 'Enables Secrets of Suffering.', isMandatory: true },
      { name: 'Trinity Support', type: 'Gem', description: 'Ensure you have resonance for all elements.', isMandatory: true },
      { name: 'Multistrike Support', type: 'Gem', description: 'Huge attack speed and damage multiplier.', isMandatory: true }
    ]
  },
  {
    archetype: 'Hexblast Miner',
    mainSkills: ['Hexblast', 'Hexblast of Contradiction'],
    slots: [
      {
        slot: 'Helmet',
        steps: [
          { tier: 'Budget', itemName: 'Rare Helmet', description: 'Life and Resistances.' },
          { tier: 'Core', itemName: 'Sandstorm Visage', description: 'Sets Hexblast base crit to your weapon crit.', isMandatory: true, usagePercent: 90 }
        ]
      },
      {
        slot: 'Ring 1',
        steps: [
          { tier: 'Budget', itemName: 'Rare Ring', description: 'Curse on Hit setup.' },
          { tier: 'Core', itemName: 'Profane Proxy', description: 'Automates curse application for Hexblast.', isMandatory: true, usagePercent: 75 }
        ]
      },
      {
        slot: 'Offhand',
        steps: [
          { tier: 'Budget', itemName: 'Rare Shield', description: 'Life and Spell Damage.' },
          { tier: 'Core', itemName: 'Rathpith Globe', description: 'Scale damage and crit with your life pool.', usagePercent: 45 }
        ]
      }
    ],
    benchmarks: [
      { name: 'Curse on Hit', type: 'Item', description: 'Required to trigger Hexblast damage.', isMandatory: true },
      { name: 'Minefield Support', type: 'Gem', description: 'Increased mine throw count.', isMandatory: true },
      { name: 'Dissolution of the Flesh', type: 'Jewel', description: 'Synergy with Rathpith Globe.', isMandatory: false }
    ]
  }
];

export function getProgressionForSkill(skillName: string): ArchetypeProgression | undefined {
  if (!skillName || skillName === 'Unknown') return undefined;
  const normalizedSearch = skillName.toLowerCase();
  return META_PROGRESSION.find(p => 
    p.mainSkills.some(s => {
      const normalizedMeta = s.toLowerCase();
      return normalizedSearch.includes(normalizedMeta) || normalizedMeta.includes(normalizedSearch);
    })
  );
}
