import { PoEItem, getPoENinjaItems, getCurrentLeague } from './poe-ninja';
import { getProgressionForSkill, ProgressionTier } from './meta-data';
import { getWikiItemIcon } from './wiki-images';

export type BuildItem = {
  name: string;
  slot: string;
  rarity: string;
  isMandatory: boolean;
  tier: ProgressionTier;
  icon?: string;
  type: 'Gear' | 'Flask' | 'Jewel';
  estimatedPrice?: number;
  levelRequirement?: number;
  progressionNote?: string;
  prefixes?: string[];
  suffixes?: string[];
  implicits?: string[];
  explicits?: string[];
  debugInfo?: string; // For troubleshooting classification
};

/**
 * Parses a raw PoB item string to extract its name and rarity.
 */
export function parseItemName(itemRaw: string): { name: string, rarity: string } {
  const lines = itemRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rarityLine = lines.find(l => l.toUpperCase().startsWith('RARITY:')) || '';
  const rarity = rarityLine.split(': ')[1]?.toUpperCase() || 'UNKNOWN';
  
  // The name is usually the first line that isn't Rarity and doesn't contain technical PoB data
  const filteredLines = lines.filter(l => 
    !l.toUpperCase().startsWith('RARITY:') && 
    !l.startsWith('--------') &&
    !l.startsWith('Unique ID:') &&
    !l.startsWith('Item Level:') &&
    !l.startsWith('Quality:') &&
    !l.startsWith('Sockets:') &&
    !l.startsWith('LevelReq:') &&
    !l.startsWith('Implicits:') &&
    !l.startsWith('Prefix:') &&
    !l.startsWith('Suffix:')
  );
  
  const nameLine = filteredLines[0] || 'Unknown Item';
  
  return { name: nameLine, rarity };
}

/**
 * Parses item stats (prefixes, suffixes, mods) from raw PoB text.
 */
export function parseItemStats(itemRaw: string) {
  const lines = itemRaw.split('\n').map(l => l.trim());
  const prefixes: string[] = [];
  const suffixes: string[] = [];
  const implicits: string[] = [];
  const explicits: string[] = [];
  
  let section = 'meta'; 
  let implicitCount = 0;
  let separatorCount = 0;

  lines.forEach(line => {
    if (line.startsWith('--------')) {
      separatorCount++;
      // Usually after the 2nd or 3rd separator we are in mods territory
      if (section === 'meta' && separatorCount >= 2) section = 'explicits';
      return;
    }
    
    // Detect Implicit Count
    if (line.startsWith('Implicits:')) {
      implicitCount = parseInt(line.split(':')[1]) || 0;
      section = 'implicits';
      if (implicitCount === 0) section = 'explicits';
      return;
    }

    // Detect Prefix/Suffix lines
    // PoB Format: Prefix: {range:0.5}(Tier: 1) Increased Mana
    const cleanMod = (l: string) => {
      // Keep {fractured} and {crafted} but remove {range:...}
      return l.replace(/\{range:[\d.]+\}/g, '').replace(/Prefix: /g, '').replace(/Suffix: /g, '').trim();
    };

    if (line.startsWith('Prefix:')) {
      const mod = cleanMod(line);
      if (mod && !mod.toLowerCase().includes('none')) prefixes.push(mod);
      return;
    }
    if (line.startsWith('Suffix:')) {
      const mod = cleanMod(line);
      if (mod && !mod.toLowerCase().includes('none')) suffixes.push(mod);
      return;
    }

    // If we are in implicits section
    if (section === 'implicits' && implicits.length < implicitCount) {
      if (line) implicits.push(line);
      if (implicits.length === implicitCount) section = 'explicits';
      return;
    }

    // Explicit Mods (for Uniques or items without P/S labels)
    const isMeta = line.startsWith('Rarity:') || 
                   line.startsWith('Unique ID:') || 
                   line.startsWith('Item Level:') || 
                   line.startsWith('Quality:') || 
                   line.startsWith('Sockets:') || 
                   line.startsWith('LevelReq:') ||
                   line.includes(' (Local ') ||
                   // More specific meta match for things like "Requires Level 70" or "12% increased Quality"
                   line.match(/^(Requires Level|Required Level) \d+/) ||
                   line.match(/^Item Class:/); 

    if (section === 'explicits' && line && !isMeta) {
      explicits.push(line);
    }
  });

  return { prefixes, suffixes, implicits, explicits };
}

// Utility flask base names, keyed by a substring that survives prefix/suffix mangling
// (e.g. "Catalysed Quicksilver Flask of Adrenaline" still contains "quicksilver"). poe.ninja
// doesn't track these (no meaningful trade value), so they never get an icon from market data.
const FLASK_BASE_NAMES: Record<string, string> = {
  'quicksilver': 'Quicksilver Flask',
  'diamond': 'Diamond Flask',
  'granite': 'Granite Flask',
  'jade': 'Jade Flask',
  'quartz': 'Quartz Flask',
  'silver': 'Silver Flask',
  'stibnite': 'Stibnite Flask',
  'sulphur': 'Sulphur Flask',
  'basalt': 'Basalt Flask',
  'ruby': 'Ruby Flask',
  'sapphire': 'Sapphire Flask',
  'topaz': 'Topaz Flask',
};

/**
 * Best-effort guess at the canonical wiki page title for an item poe.ninja has no icon for.
 * Returns undefined when there isn't enough confidence to avoid a wasted lookup (e.g. a rare
 * item's randomly-generated name won't match any wiki page).
 */
function guessWikiPageTitle(name: string, type: BuildItem['type'], itemTextLow: string): string | undefined {
  if (type === 'Flask') {
    const cleanName = name.toLowerCase();
    const match = Object.keys(FLASK_BASE_NAMES).find(key => cleanName.includes(key));
    if (match) return FLASK_BASE_NAMES[match];
    // Life/Mana/Hybrid flask tiers (e.g. "Divine Life Flask") aren't affixed like utility
    // flasks are - the parsed name is already the exact base name.
    if (cleanName.includes('flask')) return name;
    return undefined;
  }

  // Cluster jewels are always Rare with a randomly-generated name, so `name` itself is
  // useless for a wiki lookup - detect the base size from the raw item text instead.
  if (itemTextLow.includes('large cluster jewel')) return 'Large Cluster Jewel';
  if (itemTextLow.includes('medium cluster jewel')) return 'Medium Cluster Jewel';
  if (itemTextLow.includes('small cluster jewel')) return 'Small Cluster Jewel';

  return undefined;
}

/**
 * Analyzes items from PoB data and cross-references with poe.ninja prices.
 */
export async function analyzeBuildItems(pobData: any, mainSkill?: string, mode: 'Optimize' | 'Reverse' = 'Optimize'): Promise<BuildItem[]> {
  const items: BuildItem[] = [];
  const pendingWikiLookups: { item: BuildItem, queryName: string }[] = [];
  const league = await getCurrentLeague();
  
  // 1. Fetch Market Data Sequentially with fallback logic
  const categories = ['UniqueArmour', 'UniqueWeapon', 'UniqueAccessory', 'UniqueFlask', 'UniqueJewel', 'BaseType', 'ClusterJewel'];
  const marketData: any[] = [];
  
  for (const cat of categories) {
    try {
      console.log(`[ItemAnalyzer] Fetching category: ${cat}`);
      const data = await getPoENinjaItems(league, cat as any);
      marketData.push(data);
      // Aggressive delay to prevent poe.ninja block
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error(`Failed to fetch category ${cat}:`, e);
      marketData.push([]);
    }
  }

  const allUniques = marketData.slice(0, 5).flat(); 
  const baseTypes = marketData[5] || [];
  const clusterJewels = marketData[6] || [];
  const allBaseTypes = [...baseTypes, ...clusterJewels];

  // Map Items to Slots
  const pobItemsRaw = pobData.PathOfBuilding.Items[0].Item || [];
  const pobItems = Array.isArray(pobItemsRaw) ? pobItemsRaw : [pobItemsRaw];
  
  const itemsContainer = pobData.PathOfBuilding.Items[0];
  const activeItemSetId = itemsContainer.$.activeItemSet || "1";
  const itemSetsRaw = itemsContainer.ItemSet || [];
  const itemSets = Array.isArray(itemSetsRaw) ? itemSetsRaw : [itemSetsRaw];
  const activeItemSet = itemSets.find((set: any) => set.$.id === activeItemSetId) || itemSets[0];

  const itemIdToSlot: Record<string, string> = {};
  
  // Helper to add slots to the map. Weapon swap ("Weapon 1 Swap"/"Weapon 2 Swap" in PoB) is
  // included - it's normalized to its own "Weapon Swap"/"Offhand Swap" slot names below, so it
  // naturally flows through the same comparison UI as the main loadout without being mixed in.
  const addSlots = (slots: any[]) => {
    slots.forEach((s: any) => {
      const slotName = s.$.name;
      const itemId = s.$.itemId;
      if (itemId && itemId !== '0') {
        itemIdToSlot[itemId] = slotName;
      }
    });
  };

  if (activeItemSet && activeItemSet.Slot) {
    const activeSlots = Array.isArray(activeItemSet.Slot) ? activeItemSet.Slot : [activeItemSet.Slot];
    addSlots(activeSlots);
  }

  const topLevelSlotsRaw = itemsContainer.Slot || [];
  const topLevelSlots = Array.isArray(topLevelSlotsRaw) ? topLevelSlotsRaw : [topLevelSlotsRaw];
  addSlots(topLevelSlots);

  const metaProgression = mainSkill ? getProgressionForSkill(mainSkill) : undefined;

  pobItems.forEach((itemObj: any) => {
    const itemRaw = itemObj._ || itemObj;
    if (typeof itemRaw !== 'string') return;

    const slotRaw = itemIdToSlot[itemObj.$.id];
    const isJewelByText = itemRaw.toLowerCase().includes('jewel') || itemRaw.toLowerCase().includes('abyss');
    
    // If it's not in a slot and not a jewel, skip it
    if (!slotRaw && !isJewelByText) return;

    const { name, rarity } = parseItemName(itemRaw);
    const { prefixes, suffixes, implicits, explicits } = parseItemStats(itemRaw);
    
    const itemText = itemRaw.toLowerCase();
    // More robust Item Class detection (case insensitive, looks for the exact line)
    const lines = itemRaw.split('\n');
    const itemClassLine = lines.find(l => l.toLowerCase().startsWith('item class:')) || '';
    const itemClass = itemClassLine.split(':')[1]?.trim().toLowerCase() || '';

    // Determine type with a hierarchy: 
    // 1. Explicit Item Class (most reliable)
    // 2. Slot Name (reliable for jewels)
    // 3. Keyword check (fallback for unslotted jewels)
    
    let type: BuildItem['type'] = 'Gear';
    const hasAbyssalSocket = itemText.includes('has 1 abyssal socket') || itemText.includes('has 2 abyssal sockets');
    const isJewelMatch = (itemClass.includes('jewel') || isJewelByText || slotRaw?.toLowerCase().includes('jewel')) && !hasAbyssalSocket;
    
    const isGearMatch = itemClass.includes('amulet') || itemClass.includes('belt') || itemClass.includes('ring') || 
                        itemClass.includes('glove') || itemClass.includes('boot') || itemClass.includes('helmet') || 
                        itemClass.includes('armour') || itemClass.includes('weapon') || itemClass.includes('shield') || 
                        hasAbyssalSocket;

    if (isJewelMatch && !isGearMatch) {
      type = 'Jewel';
    } else if (itemClass.includes('flask') || itemText.includes('flask')) {
      type = 'Flask';
    }

    // Normalize Slot Name
    let slot = slotRaw;
    if (!slot) {
      if (type === 'Jewel') slot = `Jewel: ${name}`;
      else slot = 'Unknown';
    }

    if (slot === 'Weapon 1') slot = 'Weapon';
    if (slot === 'Weapon 2') slot = 'Offhand';
    if (slot === 'Weapon 1 Swap') slot = 'Weapon Swap';
    if (slot === 'Weapon 2 Swap') slot = 'Offhand Swap';
    
    // For Gear Match-Up to work, unique jewels need a consistent slot naming if unslotted
    if (type === 'Jewel' && rarity === 'UNIQUE' && !slot.startsWith('Jewel:')) {
      slot = `Jewel: ${name}`;
    }

    const debugInfo = `Class: ${itemClass} | Slot: ${slotRaw} | type: ${type} | isJewelByText: ${isJewelByText}`;

    let levelRequirement = 1;
    const levelMatch = itemRaw.match(/Level: (\d+)/) || itemRaw.match(/Required Level: (\d+)/);
    if (levelMatch) levelRequirement = parseInt(levelMatch[1]);

    const marketItem = allUniques.find(u => name.toLowerCase() === u.name.toLowerCase() || name.includes(u.name));
    let price = marketItem?.chaosValue || 0;

    // Advanced Jewel Pricing Logic
    if (type === 'Jewel' && rarity === 'UNIQUE') {
      const allMods = [...implicits, ...explicits];
      
      if (name.includes('Watcher\'s Eye')) {
        // Find aura mods: "while affected by [Aura]"
        const auraMods = allMods.filter(m => m.toLowerCase().includes('while affected by'));
        if (auraMods.length >= 2) {
          // Double/Triple Watcher's are extremely expensive
          price = Math.max(price, 5000); // 5000c as a floor for multi-mod
        } else if (auraMods.some(m => ['hatred', 'discipline', 'determination', 'grace'].some(a => m.toLowerCase().includes(a)))) {
          price = Math.max(price, 500); // Meta single auras
        }
      } else if (name.includes('Forbidden Flame') || name.includes('Forbidden Flesh')) {
        // Extract the passive name: "Allocates [Passive] if you have the matching..."
        const passiveMatch = allMods.join(' ').match(/Allocates ([\w\s]+) if/i);
        if (passiveMatch) {
          const passive = passiveMatch[1].trim();
          // High-value nodes (example list, ideally would be data-driven)
          const highValueNodes = ['Vile Bastion', 'Profane Bloom', 'Unnatural Calm', 'Aspect of Carnage', 'Forbidden Power'];
          if (highValueNodes.includes(passive)) price = Math.max(price, 4000);
          else price = Math.max(price, 200);
        }
      } else if (name.includes('The Light of Meaning')) {
        // Extract the stat: "[Stat] in Radius"
        const statMatch = allMods.join(' ').match(/(\d+)% increased ([\w\s]+) in Radius/i) || 
                          allMods.join(' ').match(/Adds (\d+) to (\d+) ([\w\s]+) in Radius/i);
        if (statMatch) {
          const stat = statMatch[3] || statMatch[2];
          if (stat.toLowerCase().includes('energy shield') || stat.toLowerCase().includes('chaos damage')) price = Math.max(price, 1500);
          else price = Math.max(price, 300);
        }
      }
    }

    let icon = marketItem?.icon;

    if (rarity === 'RARE' || rarity === 'MAGIC' || !icon) {
      // Detect influence and special properties from item text
      const influence = itemText.includes('shaper item') ? 'Shaper'
        : itemText.includes('elder item') ? 'Elder'
        : itemText.includes('crusader item') ? 'Crusader'
        : itemText.includes('redeemer item') ? 'Redeemer'
        : itemText.includes('hunter item') ? 'Hunter'
        : itemText.includes('warlord item') ? 'Warlord'
        : null;
      const isFractured = itemText.includes('{fractured}') || itemText.includes('fractured item');
      const is6L = /Sockets:\s*[RGBW]-[RGBW]-[RGBW]-[RGBW]-[RGBW]-[RGBW]/i.test(itemRaw);

      const itemLines = itemRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (const line of itemLines) {
        if (line.toUpperCase().startsWith('RARITY:')) continue;
        const cleanLine = line.toLowerCase();
        // Prefer an influence-matched variant, fall back to non-influenced base
        let bestMatch: PoEItem | null = null;
        for (const b of allBaseTypes) {
          const bName = b.name.toLowerCase();
          if (cleanLine === bName || cleanLine.includes(bName)) {
            if (influence && b.variant === influence) { bestMatch = b; break; }
            if (!bestMatch) bestMatch = b;
          }
        }
        if (bestMatch) {
          icon = bestMatch.icon;
          if (price === 0 && bestMatch.chaosValue > 0) price = bestMatch.chaosValue;
          break;
        }
      }

      // Heuristic floor for rares poe.ninja doesn't individually track
      if (price === 0 && rarity === 'RARE') {
        const allMods = [...prefixes, ...suffixes];
        const t1Count = allMods.filter(m => m.includes('(Tier: 1)')).length;
        const t2Count = allMods.filter(m => m.includes('(Tier: 2)')).length;
        let est = 5;
        if (is6L) est += 150;
        if (isFractured) est += 40;
        est += t1Count * 35;
        est += t2Count * 8;
        price = est;
      }
    }

    // Items poe.ninja has no pricing/icon data for (utility flasks and cluster jewel bases
    // aren't traded/tracked there) get resolved against the wiki below, after this loop.
    const wikiQueryName = icon ? undefined : guessWikiPageTitle(name, type, itemText.toLowerCase());

    let metaMandatory = false;
    if (metaProgression) {
      metaProgression.slots.forEach(s => {
        const step = s.steps.find(st => name.toLowerCase().includes(st.itemName.toLowerCase()));
        if (step) metaMandatory = step.isMandatory || false;
      });
    }

    let tier: ProgressionTier = 'Budget';
    if (price > 1000) tier = 'Luxury';
    else if (price > 100 || rarity === 'UNIQUE') tier = 'Core';

    const newItem: BuildItem = {
      name,
      slot,
      rarity,
      isMandatory: metaMandatory || price > 50,
      tier,
      icon,
      type,
      estimatedPrice: price,
      levelRequirement,
      progressionNote: rarity === 'UNIQUE' ? 'Core Unique for scaling.' : 'High-end Rare component.',
      prefixes,
      suffixes,
      implicits,
      explicits
    };
    items.push(newItem);
    if (wikiQueryName) pendingWikiLookups.push({ item: newItem, queryName: wikiQueryName });
  });

  // Resolve any icons poe.ninja couldn't provide against the wiki, in parallel.
  await Promise.all(pendingWikiLookups.map(async ({ item, queryName }) => {
    item.icon = await getWikiItemIcon(queryName);
  }));

  return items;
}

export type ModComparison = {
  mod: string;
  type: 'Missing' | 'TierUpgrade' | 'ValueUpgrade' | 'Match';
  currentValue?: string;
  targetValue?: string;
};

// Minimum delta required to surface a ValueUpgrade, keyed by stat keyword.
// Flat threshold (5) is too coarse: 5 life is noise but 5% resistance matters.
const MOD_DIFF_THRESHOLDS: Array<{ pattern: RegExp; min: number }> = [
  { pattern: /maximum life|maximum mana|maximum energy shield/i, min: 25 },
  { pattern: /resist(ance)?/i, min: 4 },
  { pattern: /to strength|to dexterity|to intelligence/i, min: 10 },
  { pattern: /critical strike (chance|multiplier)/i, min: 5 },
  { pattern: /increased (attack|cast) speed/i, min: 3 },
  { pattern: /increased.*damage|more.*damage/i, min: 5 },
  { pattern: /adds.*damage/i, min: 5 },
];

function getModDiffThreshold(modText: string): number {
  for (const { pattern, min } of MOD_DIFF_THRESHOLDS) {
    if (pattern.test(modText)) return min;
  }
  return 5;
}

/**
 * Compares two items and returns a list of differences.
 */
export function compareItems(current?: BuildItem, target?: BuildItem): ModComparison[] {
  if (!target) return [];
  
  const comparisons: ModComparison[] = [];
  const currentMods = current ? [
    ...(current.implicits || []), 
    ...(current.prefixes || []), 
    ...(current.suffixes || []), 
    ...(current.explicits || [])
  ] : [];

  const targetMods = [
    ...(target.implicits || []), 
    ...(target.prefixes || []), 
    ...(target.suffixes || []), 
    ...(target.explicits || [])
  ];

  const getTier = (m: string) => {
    const match = m.match(/\(Tier: (\d+)\)/);
    return match ? parseInt(match[1]) : null;
  };

  const getBaseMod = (m: string) => {
    // Remove tags and tiers for base comparison
    return m.replace(/\{.*?\}/g, '').replace(/\(Tier: \d+\)/g, '').replace(/[\d.]+/g, '#').trim().toLowerCase();
  };

  const getFirstNum = (m: string) => {
    const match = m.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  };

  targetMods.forEach(tMod => {
    const tBase = getBaseMod(tMod);
    const tTier = getTier(tMod);
    
    // Find matching mod in current
    const match = currentMods.find(cMod => getBaseMod(cMod) === tBase);

    if (!match) {
      comparisons.push({ mod: tMod, type: 'Missing' });
    } else {
      const cTier = getTier(match);
      
      // In PoE, lower Tier number = Better (Tier 1 > Tier 2)
      if (tTier !== null && cTier !== null && tTier < cTier) {
        comparisons.push({ 
          mod: tMod.replace(/\{.*?\}/g, '').replace(/\(Tier: \d+\)/, '').trim(), 
          type: 'TierUpgrade', 
          currentValue: `Tier ${cTier}`, 
          targetValue: `Tier ${tTier}` 
        });
      } else {
        const tVal = getFirstNum(tMod);
        const cVal = getFirstNum(match);

        if (tVal !== null && cVal !== null) {
          const diff = tVal - cVal;
          if (diff >= getModDiffThreshold(tMod)) {
            comparisons.push({
              mod: tMod.replace(/\{.*?\}/g, '').replace(/\(Tier: \d+\)/, '').trim(),
              type: 'ValueUpgrade',
              currentValue: `${cVal}`,
              targetValue: `${tVal}`
            });
          } else {
            comparisons.push({ mod: tMod, type: 'Match' });
          }
        } else if (tMod !== match && !match.includes(tMod) && !tMod.includes(match)) {
          comparisons.push({ 
            mod: tMod.replace(/\{.*?\}/g, '').replace(/\(Tier: \d+\)/, '').trim(), 
            type: 'ValueUpgrade',
            currentValue: match.replace(/\{.*?\}/g, '').replace(/\(Tier: \d+\)/, '').trim(),
            targetValue: tMod.replace(/\{.*?\}/g, '').replace(/\(Tier: \d+\)/, '').trim()
          });
        } else {
          comparisons.push({ mod: tMod, type: 'Match' });
        }
      }
    }
  });

  return comparisons;
}

