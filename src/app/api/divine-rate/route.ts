import { NextResponse } from 'next/server';
import axios from 'axios';

let cachedRate: number | null = null;
let cachedLeague = '';
let cacheExpiry = 0;
const CACHE_MS = 5 * 60 * 1000; // 5 min — divine rate can move quickly
const FALLBACK = 150;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league') || 'Standard';

  const now = Date.now();
  if (cachedRate !== null && cachedLeague === league && now < cacheExpiry) {
    return NextResponse.json({ rate: cachedRate });
  }

  try {
    // Correct endpoint: stash/current/currency/overview (not exchange/current/overview —
    // that path requires a different type param and returns a rate-pair format).
    // Response has lines[].currencyTypeName and lines[].chaosEquivalent.
    const url = `https://poe.ninja/poe1/api/economy/stash/current/currency/overview?league=${encodeURIComponent(league)}&type=Currency`;
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://poe.ninja/',
        'Accept': 'application/json',
      },
      timeout: 8000,
    });

    const lines: any[] = res.data?.lines || [];
    const divine = lines.find((l: any) =>
      (l.currencyTypeName || '').toLowerCase().includes('divine')
    );

    // receive.value: trades where someone pays chaos and gets divine.
    // This is the rate poe.ninja's UI displays (chaos per divine from live trades).
    // chaosEquivalent is a smoothed/lagged aggregate and diverges significantly from
    // the live rate — we fall back to it only if receive is missing.
    let rate = FALLBACK;
    const receiveRate = divine?.receive?.value;
    const equivalentRate = divine?.chaosEquivalent;
    if (receiveRate && receiveRate > 10) {
      rate = Math.round(receiveRate);
    } else if (equivalentRate && equivalentRate > 10) {
      rate = Math.round(equivalentRate);
    }

    cachedRate = rate;
    cachedLeague = league;
    cacheExpiry = now + CACHE_MS;

    return NextResponse.json({ rate });
  } catch (error: any) {
    console.error('[DivineRate] Failed to fetch:', error.message);
    return NextResponse.json({ rate: cachedRate ?? FALLBACK });
  }
}
