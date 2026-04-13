import { getPoENinjaGems, getCurrentLeague } from './poe-ninja';

export type GemInfo = {
  name: string;
  level: number;
  quality: number;
  source: 'Vendor' | 'Drop Only' | 'Exceptional' | 'Vaal' | 'Transfigured';
  acquisition?: string;
  price?: number;
};

export type GemGroup = {
  label: string;
  slot: string;
  links: number;
  gems: GemInfo[];
};

const GEM_DB: Record<string, { act: number, npc: string, quest: string, classes?: string[] }> = {
  'holy strike': { act: 1, npc: 'Nessa', quest: 'Twilight Strand', classes: ['Templar'] },
  'minion damage': { act: 1, npc: 'Nessa', quest: 'The Caged Brute', classes: ['Witch', 'Templar', 'Scion'] },
  'added lightning damage': { act: 1, npc: 'Nessa', quest: 'The Caged Brute', classes: ['Witch', 'Shadow', 'Templar', 'Scion'] },
  'despair': { act: 3, npc: 'Clarissa', quest: 'Lost in Love', classes: ['Witch', 'Shadow', 'Ranger', 'Scion'] },
  'conductivity': { act: 3, npc: 'Clarissa', quest: 'Lost in Love', classes: ['Witch', 'Shadow', 'Templar', 'Scion'] },
  'raise spectre': { act: 3, npc: 'Clarissa', quest: 'A Fixture of Fate', classes: ['Witch'] },
  'minion pact': { act: 10, npc: 'Boss Drop', quest: 'Catarina' },
  'companionship': { act: 0, npc: 'Aukuna, the Black Sekhema', quest: 'Legion/Timeless' },
};

const DROP_ONLY_LIST = ['empower', 'enlighten', 'enhance', 'portal', 'added chaos damage', 'companionship'];

export async function analyzeBuildGems(pobData: any): Promise<GemGroup[]> {
  const gemGroups: Map<string, GemGroup> = new Map();
  const league = getCurrentLeague();
  const marketGems = await getPoENinjaGems(league);
  const characterClass = pobData.PathOfBuilding?.Build?.[0]?.$.className || 'Witch';

  const processGem = (gemObj: any): GemInfo | null => {
    const d = gemObj.$ || gemObj;
    if (!d || d.enabled === 'false') return null;

    const rawName = d.nameSpec;
    if (!rawName) return null;

    // Filter out skills that are not actual socketed gems
    // Real gems in PoB have a gemId or a skillId starting with Metadata/Items/Gems
    const skillId = d.skillId || '';
    const gemId = d.gemId || '';
    const isRealGem = gemId.startsWith('Metadata/Items/Gems') || skillId.startsWith('Metadata/Items/Gems');
    
    // Some transfigured gems might not have the prefix in some PoB versions, 
    // but they usually have a variant name in nameSpec. 
    // We also allow gems that are in our market database.
    const isKnownSpecial = rawName.includes(' of ') || rawName.startsWith('Awakened') || DROP_ONLY_LIST.includes(rawName.toLowerCase());
    
    if (!isRealGem && !isKnownSpecial && !GEM_DB[rawName.toLowerCase()]) {
      // If it's not a real gem and not in our database/special list, it's likely an item-granted skill
      return null;
    }

    const normName = rawName.toLowerCase().replace(' support', '').trim();
    const level = parseInt(d.level || '1');
    const quality = parseInt(d.quality || '0');

    let source: GemInfo['source'] = 'Vendor';
    let acquisition = 'Act 6: Lilly Roth';
    let found = false;

    if (DROP_ONLY_LIST.includes(normName) || normName === 'minion pact') {
      source = 'Drop Only';
      acquisition = normName === 'minion pact' ? 'Boss Drop: Catarina.' : 'Drop Only / Imbuing.';
      found = true;
    } else if (GEM_DB[normName]) {
      const info = GEM_DB[normName];
      const canBuy = !info.classes || info.classes.includes(characterClass);
      acquisition = canBuy ? `Act ${info.act}: ${info.npc}` : `Act 3: Siosa (Library)`;
      found = true;
    } else if (rawName.startsWith('Awakened') || rawName.includes('Exceptional')) {
      source = 'Exceptional';
      acquisition = 'Endgame Boss Drop.';
      found = true;
    } else if (rawName.includes(' of ')) {
      source = 'Transfigured';
      acquisition = 'Labyrinth Divine Font.';
      found = true;
    }

    if (!found && level < 10) acquisition = 'Act 1: Nessa / Act 2: Yeena';

    // Robust price matching
    let price = 0;
    const isExceptional = ['empower', 'enlighten', 'enhance'].includes(normName);
    
    // Always try to find a price if it's level 20+ or quality 20+, or if it's a special gem.
    // Also try to find a base price for level 1 gems if they are special.
    const searchNames = [rawName];
    if (!rawName.toLowerCase().includes('support') && !['shield charge', 'flame dash'].includes(normName)) {
      searchNames.push(`${rawName} Support`);
    }
    if (rawName.toLowerCase().includes('support')) {
      searchNames.push(rawName.replace(/ Support$/i, ''));
    }

    const targetLevel = isExceptional ? Math.min(level, 4) : Math.min(level, 21);
    const variants = [
      `${targetLevel}/${quality}`,
      `${targetLevel}/20`,
      `${targetLevel}/0`,
      '1/0', '20/20', '21/20'
    ];

    for (const sName of searchNames) {
      // 1. Try exact variant match
      for (const v of variants) {
        const match = marketGems.find(g => g.name.toLowerCase() === sName.toLowerCase() && g.variant === v);
        if (match) { price = match.chaosValue; break; }
      }
      if (price > 0) break;
      
      // 2. Try any match for this name (usually gives the most common variant price)
      const anyMatch = marketGems.find(g => g.name.toLowerCase() === sName.toLowerCase());
      if (anyMatch) { price = anyMatch.chaosValue; break; }
    }

    return { name: rawName, level, quality, source, acquisition, price: price || 0 };
  };

  const findGroups = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;

    // Check if this is a Skill group
    if (obj.Gem || (obj.$ && obj.$.label)) {
      const d = obj.$ || {};
      const slot = (d.slot || 'Unset').trim();

      // Skip weapon swap gems only
      if (slot.toLowerCase().includes('swap')) {
        return;
      }

      if (d.enabled !== 'false' && obj.Gem) {
        const rawGems = Array.isArray(obj.Gem) ? obj.Gem : [obj.Gem];
        const gemsInGroup: GemInfo[] = [];

        rawGems.forEach(g => {
          const processed = processGem(g);
          if (processed) gemsInGroup.push(processed);
        });

        if (gemsInGroup.length > 0) {
          // Keep the slot specific (e.g., Ring 1 vs Ring 2) but merge multiple skill groups in the same slot
          const slot = (d.slot || 'Unset').trim();
          
          if (!gemGroups.has(slot)) {
            gemGroups.set(slot, {
              label: d.label || gemsInGroup[0].name,
              slot: slot,
              links: gemsInGroup.length,
              gems: []
            });
          }
          
          const group = gemGroups.get(slot)!;
          group.gems.push(...gemsInGroup);
          // Update links to be the max links found in this slot's skill groups
          group.links = Math.max(group.links, gemsInGroup.length);
        }
      }
    }

    // Recurse
    Object.values(obj).forEach(val => {
      if (Array.isArray(val)) {
        val.forEach(v => findGroups(v));
      } else if (typeof val === 'object') {
        findGroups(val);
      }
    });
  };

  findGroups(pobData);

  return Array.from(gemGroups.values());
}
