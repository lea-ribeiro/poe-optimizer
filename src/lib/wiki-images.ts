import axios from 'axios';

/**
 * Fetches an item icon URL via our server-side proxy (see /api/wiki-icon), which queries
 * poewiki.net. This must go through our own server - calling poewiki.net directly from the
 * browser triggers a CORS preflight (due to the custom User-Agent header poewiki.net wants)
 * that its preflight response doesn't allowlist, so the browser blocks the request outright.
 */
export async function getWikiItemIcon(itemName: string): Promise<string | undefined> {
  try {
    const response = await axios.get('/api/wiki-icon', { params: { name: itemName } });
    return response.data?.icon || undefined;
  } catch (error) {
    console.error(`Wiki icon fetch failed for ${itemName}:`, error);
    return undefined;
  }
}
