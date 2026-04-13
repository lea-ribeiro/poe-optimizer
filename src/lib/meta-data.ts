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
  type: 'Item' | 'Gem' | 'Keystone' | 'Cluster';
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
