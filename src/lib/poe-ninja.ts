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
      variant: item.gemLevel ? `${item.gemLevel}/${item.gemQuality}` : (item.variant ?? undefined)
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

let leagueCache: string | null = null;
let leagueInFlight: Promise<string> | null = null;

/**
 * Resolves the current PC softcore challenge league via our /api/league proxy (which reads
 * GGG's official trade API), caching it for the lifetime of the page. Falls back to 'Standard'
 * if the lookup fails.
 */
export async function getCurrentLeague(): Promise<string> {
  if (leagueCache) return leagueCache;
  if (leagueInFlight) return leagueInFlight;

  leagueInFlight = axios.get('/api/league')
    .then(response => {
      leagueCache = response.data?.league || 'Standard';
      return leagueCache!;
    })
    .catch(error => {
      console.error('Error fetching current league:', error);
      return 'Standard';
    })
    .finally(() => {
      leagueInFlight = null;
    });

  return leagueInFlight;
}

/**
 * Identifies if an item is "High Value" (Meta-critical)
 */
export function isMetaItem(item: PoEItem, minChaosValue = 100): boolean {
  return item.chaosValue >= minChaosValue;
}
