import axios from 'axios';

const BASE_URL = '/api/poe-ninja'; // Now using our own Next.js API Proxy

export type PoEItem = {
  name: string;
  chaosValue: number;
  divineValue?: number;
  listingCount: number;
  icon: string;
  variant?: string;
};

/**
 * Fetches item overview from our local proxy.
 */
export async function getPoENinjaItems(league: string, type: string): Promise<PoEItem[]> {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        league,
        type,
      },
    });

    if (!response.data.lines) return [];

    return response.data.lines.map((item: any) => ({
      name: item.name,
      chaosValue: item.chaosValue,
      divineValue: item.divineValue,
      listingCount: item.listingCount,
      icon: item.icon,
      variant: item.gemLevel ? `${item.gemLevel}/${item.gemQuality}` : undefined
    }));
  } catch (error) {
    console.error(`Error fetching proxy items (${type}):`, error);
    return [];
  }
}

/**
 * Fetches Skill Gem data specifically.
 */
export async function getPoENinjaGems(league: string): Promise<PoEItem[]> {
  return getPoENinjaItems(league, 'SkillGem');
}

/**
 * Helper to get the current league. 
 * Defaulting to 'Standard' if 'Settlers' is gone, 
 * but in a real scenario we'd fetch this from the PoE API.
 */
export function getCurrentLeague(): string {
  return 'Mirage'; // Updated for PoE 3.28 in April 2026
}

/**
 * Identifies if an item is "High Value" (Meta-critical)
 */
export function isMetaItem(item: PoEItem, minChaosValue = 100): boolean {
  return item.chaosValue >= minChaosValue;
}
