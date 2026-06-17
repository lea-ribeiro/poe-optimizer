import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * Server-side proxy for poewiki.net's icon lookup.
 *
 * This must be a server-side proxy, not a direct browser call: poewiki.net's API does send
 * `Access-Control-Allow-Origin: *`, but setting a custom User-Agent header (good etiquette for
 * a third-party API) makes the browser send a CORS preflight, and poewiki.net's preflight
 * response doesn't allowlist `user-agent` - so the browser blocks the real request even though
 * curl/Node testing (which doesn't enforce CORS at all) never reveals this.
 */

const WIKI_API = 'https://www.poewiki.net/w/api.php';
const USER_AGENT = 'PoEOptimizer/1.0 (contact: leandro@example.com) build-optimizer-tool';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // icons don't change; cache generously

const cache = new Map<string, { icon: string | null, fetchedAt: number }>();

async function fetchIconFromWiki(itemName: string): Promise<string | null> {
  const cargoUrl = `${WIKI_API}?action=cargoquery&tables=items&fields=inventory_icon&where=name=%22${encodeURIComponent(itemName)}%22&format=json&origin=*`;
  const cargoResp = await axios.get(cargoUrl, { headers: { 'User-Agent': USER_AGENT } });

  // Cargo's response key is the literal field label with a space, not the snake_case field name.
  const iconFile = cargoResp.data?.cargoquery?.[0]?.title?.['inventory icon'];
  if (!iconFile) return null;

  const imageInfoUrl = `${WIKI_API}?action=query&titles=${encodeURIComponent(iconFile)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
  const infoResp = await axios.get(imageInfoUrl, { headers: { 'User-Agent': USER_AGENT } });

  const pages = infoResp.data?.query?.pages;
  if (!pages) return null;

  const pageId = Object.keys(pages)[0];
  return pages[pageId]?.imageinfo?.[0]?.url || null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }

  const cached = cache.get(name);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ icon: cached.icon });
  }

  try {
    const icon = await fetchIconFromWiki(name);
    cache.set(name, { icon, fetchedAt: Date.now() });
    return NextResponse.json({ icon });
  } catch (error: any) {
    console.error(`[WikiIconProxy] Fetch failed for "${name}":`, error.message);
    return NextResponse.json({ icon: null });
  }
}
