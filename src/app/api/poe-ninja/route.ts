import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league') || 'Standard';
  const type = searchParams.get('type');

  if (!type) {
    return NextResponse.json({ error: 'Missing type' }, { status: 400 });
  }

  const isCurrency = ['Currency', 'Fragment'].includes(type);

  if (isCurrency) {
    // poe.ninja's legacy /api/data/currencyoverview was retired along with itemoverview (see
    // note below); its replacement (/poe1/api/economy/exchange/current/overview) returns a
    // structurally different shape (rate-based, not chaosValue-based) that nothing in this app
    // currently consumes. Not implemented since there's no live caller - add proper mapping in
    // poe-ninja.ts if a Currency/Fragment lookup is ever actually needed.
    return NextResponse.json({ error: 'Currency/Fragment lookups are not implemented against the current poe.ninja API' }, { status: 501 });
  }

  // poe.ninja retired the old `/api/data/itemoverview` endpoint at some point after the
  // community docs were written (it now 404s unconditionally, for every league/type). Their
  // current site (an Astro app) calls this instead - same query params and response shape
  // (lines[].chaosValue/.icon/.name), just a different path with a literal "current" version
  // segment. Found by pulling apart poe.ninja's own JS bundles, since this isn't documented
  // anywhere yet.
  const tryFetch = async (targetLeague: string) => {
    const url = `https://poe.ninja/poe1/api/economy/stash/current/item/overview?league=${targetLeague}&type=${type}`;
    console.log(`[PoENinjaProxy] Fetching: ${url}`);
    
    return axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://poe.ninja/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    });
  };

  try {
    // Try provided league, then fallback to Standard
    const attempts = [league, 'Standard'];
    let lastError;
    
    for (const attempt of attempts) {
      try {
        const response = await tryFetch(attempt);
        if (response.data && response.data.lines) {
          return NextResponse.json(response.data);
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`[PoENinjaProxy] Failed ${attempt}: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    throw lastError || new Error('Failed to fetch from all sources');
  } catch (error: any) {
    console.error(`[PoENinjaProxy] Final Error (${type}):`, error.message);
    return NextResponse.json({ error: `Failed to fetch ${type}` }, { status: 500 });
  }
}
