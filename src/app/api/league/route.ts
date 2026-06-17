import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Resolves the current PC softcore challenge league dynamically via GGG's official trade API,
 * instead of hardcoding a league name that goes stale every few months. Falls back to
 * 'Standard' if the lookup fails for any reason (e.g. between leagues, API hiccup).
 */

const LEAGUES_URL = 'https://www.pathofexile.com/api/trade/data/leagues';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FALLBACK_LEAGUE = 'Standard';

let cache: { league: string; fetchedAt: number } | null = null;

async function fetchCurrentLeague(): Promise<string> {
  const response = await axios.get(LEAGUES_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
    timeout: 10000,
  });

  const leagues: { id: string, realm: string }[] = response.data?.result || [];

  // GGG lists the current softcore challenge league first for each realm; explicitly excluding
  // Hardcore/Ruthless/Standard variants is more robust than relying purely on ordering.
  const current = leagues.find(l =>
    l.realm === 'pc' &&
    l.id !== 'Standard' &&
    !l.id.includes('Hardcore') &&
    !l.id.includes('Ruthless')
  );

  return current?.id || FALLBACK_LEAGUE;
}

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ league: cache.league });
  }

  try {
    const league = await fetchCurrentLeague();
    cache = { league, fetchedAt: now };
    return NextResponse.json({ league });
  } catch (error: any) {
    console.error('[LeagueProxy] Fetch failed:', error.message);
    // Serve stale cache rather than falling back outright, if we have it.
    if (cache) return NextResponse.json({ league: cache.league });
    return NextResponse.json({ league: FALLBACK_LEAGUE });
  }
}
