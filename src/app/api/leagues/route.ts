import { NextResponse } from 'next/server';
import axios from 'axios';

let cache: { leagues: string[]; fetchedAt: number } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h — same TTL as /api/league

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_MS) {
    return NextResponse.json({ leagues: cache.leagues });
  }

  try {
    const response = await axios.get('https://www.pathofexile.com/api/trade/data/leagues', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    const all: { id: string; realm: string }[] = response.data?.result || [];

    // Only PC softcore leagues (no Hardcore, no Ruthless variants).
    // Current challenge league first, Standard last — GGG's API ordering is already correct,
    // we just strip the variants we don't need.
    const leagues = all
      .filter(l => l.realm === 'pc' && !l.id.includes('Hardcore') && !l.id.includes('Ruthless'))
      .map(l => l.id);

    cache = { leagues, fetchedAt: now };
    return NextResponse.json({ leagues });
  } catch (error: any) {
    console.error('[LeaguesProxy] Fetch failed:', error.message);
    if (cache) return NextResponse.json({ leagues: cache.leagues });
    return NextResponse.json({ leagues: ['Standard'] });
  }
}
