import { PoEItem, getPoENinjaItems, getCurrentLeague } from './poe-ninja';
import { getProgressionForSkill, ProgressionTier } from './meta-data';

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
};

/**
 * Parses a raw PoB item string to extract its name and rarity.
 */
export function parseItemName(itemRaw: string): { name: string, rarity: string } {
  const lines = itemRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rarityLine = lines.find(l => l.toUpperCase().startsWith('RARITY:')) || '';
  const rarity = rarityLine.split(': ')[1]?.toUpperCase() || 'UNKNOWN';
  
  // The name is usually the first line that isn't Rarity
  const nameLine = lines.find(l => !l.toUpperCase().startsWith('RARITY:')) || 'Unknown Item';
  
  return { name: nameLine, rarity };
}

/**
 * Analyzes items from PoB data and cross-references with poe.ninja prices.
 */
export async function analyzeBuildItems(pobData: any, mainSkill?: string, mode: 'Optimize' | 'Reverse' = 'Optimize'): Promise<BuildItem[]> {
  const items: BuildItem[] = [];
  const league = getCurrentLeague();
  
  // 1. Fetch Market Data (including BaseTypes for rare icons)
  const categories = ['UniqueArmour', 'UniqueWeapon', 'UniqueAccessory', 'UniqueFlask', 'UniqueJewel', 'BaseType', 'ClusterJewel'];
  const marketData = await Promise.all(categories.map(cat => getPoENinjaItems(league, cat as any)));
  const allUniques = marketData.flat(); // Flatten everything for easy search
  const baseTypes = marketData[5];
  const clusterJewels = marketData[6];
  const allBaseTypes = [...baseTypes, ...clusterJewels];

  // DEBUG: Let's see what base types we actually got
  if (allBaseTypes.length > 0) {
    console.log(`[Analyzer] Fetched ${allUniques.length} items. BaseTypes: ${baseTypes.length}, ClusterJewels: ${clusterJewels.length}`);
  }

  // 2. Map Items to Slots
  const pobItemsRaw = pobData.PathOfBuilding.Items[0].Item || [];
  const pobItems = Array.isArray(pobItemsRaw) ? pobItemsRaw : [pobItemsRaw];
  
  const itemsContainer = pobData.PathOfBuilding.Items[0];
  const activeItemSetId = itemsContainer.$.activeItemSet || "1";
  const itemSetsRaw = itemsContainer.ItemSet || [];
  const itemSets = Array.isArray(itemSetsRaw) ? itemSetsRaw : [itemSetsRaw];
  const activeItemSet = itemSets.find((set: any) => set.$.id === activeItemSetId) || itemSets[0];

  const itemIdToSlot: Record<string, string> = {};
  
  // Helper to add slots to the map
  const addSlots = (slots: any[]) => {
    slots.forEach((s: any) => {
      const slotName = s.$.name;
      const itemId = s.$.itemId;
      if (itemId && itemId !== '0' && !slotName.toLowerCase().includes('swap')) {
        itemIdToSlot[itemId] = slotName;
      }
    });
  };

  // 1. Check slots in the active ItemSet (preferred)
  if (activeItemSet && activeItemSet.Slot) {
    const activeSlots = Array.isArray(activeItemSet.Slot) ? activeItemSet.Slot : [activeItemSet.Slot];
    addSlots(activeSlots);
  }

  // 2. Check slots directly under Items (fallback or additional)
  const topLevelSlotsRaw = itemsContainer.Slot || [];
  const topLevelSlots = Array.isArray(topLevelSlotsRaw) ? topLevelSlotsRaw : [topLevelSlotsRaw];
  addSlots(topLevelSlots);

  const metaProgression = mainSkill ? getProgressionForSkill(mainSkill) : undefined;

  pobItems.forEach((itemObj: any) => {
    const itemRaw = itemObj._ || itemObj;
    if (typeof itemRaw !== 'string') return;

    // Check if item is equipped or is a Jewel
    const slotRaw = itemIdToSlot[itemObj.$.id];
    const isJewelByText = itemRaw.toLowerCase().includes('jewel');
    
    // We process it if it has an assigned slot OR if it's a jewel (might be in cluster sockets)
    if (!slotRaw && !isJewelByText) return;

    const { name, rarity } = parseItemName(itemRaw);
    
    // Normalize Slot Name
    let slot = slotRaw || (isJewelByText ? 'Jewel' : 'Unknown');
    if (slot === 'Weapon 1') slot = 'Weapon';
    if (slot === 'Weapon 2') slot = 'Offhand';

    // Determine Type
    let type: BuildItem['type'] = 'Gear';
    if (slot.includes('Flask') || itemRaw.toLowerCase().includes('flask')) type = 'Flask';
    else if (slot.toLowerCase().includes('jewel') || slot.toLowerCase().includes('abyss') || isJewelByText) type = 'Jewel';

    // Extract level requirement
    let levelRequirement = 1;
    const levelMatch = itemRaw.match(/Level: (\d+)/) || itemRaw.match(/Required Level: (\d+)/);
    if (levelMatch) levelRequirement = parseInt(levelMatch[1]);

    // Find Icon & Price
    const marketItem = allUniques.find(u => name.toLowerCase() === u.name.toLowerCase() || name.includes(u.name));
    const price = marketItem?.chaosValue || 0;
    let icon = marketItem?.icon;

    // If Rare, try to find base item icon
    if (rarity === 'RARE' || rarity === 'MAGIC' || !icon) {
      const lines = itemRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // 1. Scan all lines to find one that matches a known BaseType or ClusterJewel
      for (const line of lines) {
        if (line.toUpperCase().startsWith('RARITY:')) continue;
        
        const cleanLine = line.toLowerCase();
        const match = allBaseTypes.find(b => {
          const bName = b.name.toLowerCase();
          return cleanLine === bName || cleanLine.includes(bName);
        });
        
        if (match) {
          icon = match.icon;
          break;
        }
      }

      // 2. Robust Fallbacks for common items that might miss in poe.ninja BaseType
      if (!icon) {
        const cleanName = name.toLowerCase();
        const itemText = itemRaw.toLowerCase();
        
        if (cleanName.includes('quicksilver flask') || itemText.includes('quicksilver flask')) {
          icon = 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvRmxhc2tzL1F1aWNrc2lsdmVyIiwidyI6MSwiaCI6Miwic2NhbGUiOjF9XQ/7397e682e5/Quicksilver.png';
        } else if (itemText.includes('large cluster jewel')) {
          icon = 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvSmV3ZWxzL0NsdXN0ZXJKZXdlbExhcmdlIiwidyI6MSwiaCI6MSwic2NhbGUiOjF9XQ/776097d622/ClusterJewelLarge.png';
        } else if (itemText.includes('medium cluster jewel')) {
          icon = 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvSmV3ZWxzL0NsdXN0ZXJKZXdlbE1lZGl1bSIsInciOjEsImgiOjEsInNjYWxlIjpxfV0/e62241517f/ClusterJewelMedium.png';
        } else if (itemText.includes('small cluster jewel')) {
          icon = 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvSmV3ZWxzL0NsdXN0ZXJKZXdlbFNtYWxsIiwidyI6MSwiaCI6MSwic2NhbGUiOjF9XQ/7a34266185/ClusterJewelSmall.png';
        }
      }

      if (icon) {
        console.log(`[Analyzer] Success: Found icon for ${name}`);
      } else {
        console.log(`[Analyzer] Failed: No base icon for ${name}`);
      }
    }

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

    items.push({
      name,
      slot,
      rarity,
      isMandatory: metaMandatory || price > 50,
      tier,
      icon,
      type,
      estimatedPrice: price,
      levelRequirement,
      progressionNote: rarity === 'UNIQUE' ? 'Core Unique for scaling.' : 'High-end Rare component.'
    });
  });

  return items;
}
