import { NextResponse } from 'next/server';
import axios from 'axios';
import { SpriteRect, TreeNodeInfo, TreeNodeMap, TreeNodeType } from '@/lib/tree-data';

/**
 * Proxies + slims down GGG's official passive skill tree data.
 *
 * GGG publishes the tree data as raw JSON at github.com/grindinggear/skilltree-export.
 * The `nodes` dictionary is keyed by the exact same numeric node IDs that Path of Building
 * exports in <Spec nodes="...">. We fetch and slim it down to just what we need (name,
 * type, position, connections), cached in-memory so we don't re-fetch 6MB on every analysis.
 */

const TREE_URL = 'https://raw.githubusercontent.com/grindinggear/skilltree-export/master/data.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Increment when TreeNodeInfo schema changes to force cache rebuild without restarting the server.
const SCHEMA_VERSION = 4;

let cache: { data: TreeNodeMap; fetchedAt: number; version: number } | null = null;


/**
 * Computes a node's absolute canvas position from its group's origin plus its orbit
 * radius/angle. This is the same formula the official tree (and every third-party tree
 * viewer) uses: orbitIndex steps evenly around the orbit, 0 pointing up, clockwise.
 */
function computePosition(raw: any, groups: any, orbitRadii: number[], skillsPerOrbit: number[]): { x: number, y: number } | null {
  const group = groups[raw.group];
  if (!group || raw.orbit === undefined || raw.orbitIndex === undefined) return null;

  const radius = orbitRadii[raw.orbit] ?? 0;
  const slots = skillsPerOrbit[raw.orbit] ?? 1;
  const angle = raw.orbitIndex * (2 * Math.PI / slots);

  return {
    x: group.x + radius * Math.sin(angle),
    y: group.y - radius * Math.cos(angle),
  };
}

function classifyNode(raw: any, groups: any, orbitRadii: number[], skillsPerOrbit: number[]): TreeNodeInfo | null {
  if (!raw || !raw.name) return null;

  const position = computePosition(raw, groups, orbitRadii, skillsPerOrbit);
  if (!position) return null; // Nodes without a placed position aren't part of the visual tree.

  let type: TreeNodeType = 'Normal';
  if (raw.ascendancyName) type = 'Ascendancy';
  else if (raw.isKeystone) type = 'Keystone';
  else if (raw.isNotable) type = 'Notable';
  else if (raw.isMastery) type = 'Mastery';

  const info: TreeNodeInfo = { name: raw.name, type, x: position.x, y: position.y };
  if (raw.ascendancyName) info.ascendancyName = raw.ascendancyName;
  if (raw.isNotable) info.isNotable = true;
  // spriteRect is populated by the caller after sprite data is parsed.
  // The GGG export stores edges directionally: `out` lists edges going "outward" (away from
  // the tree center) and `in` lists edges going "inward". The PoE passive tree is undirected,
  // so BFS must follow both directions — combine them into a single adjacency list.
  const outEdges: any[] = Array.isArray(raw.out) ? raw.out : [];
  const inEdges: any[] = Array.isArray(raw['in']) ? raw['in'] : [];
  const allEdges = [...outEdges, ...inEdges];
  if (allEdges.length > 0) info.out = [...new Set(allEdges.map(String))];
  // Only keep stat text for the node types we actually surface in the UI; keeps payload small.
  if (type !== 'Normal' && Array.isArray(raw.stats) && raw.stats.length > 0) {
    info.stats = raw.stats;
  }
  // Masteries don't carry their own stats - the chosen effect's stats live here instead,
  // keyed by effect id (matches PoB's <Spec masteryEffects="{nodeId,effectId}"> attribute).
  if (type === 'Mastery' && Array.isArray(raw.masteryEffects) && raw.masteryEffects.length > 0) {
    info.masteryEffects = raw.masteryEffects.map((e: any) => ({ effect: e.effect, stats: e.stats || [] }));
  }
  return info;
}

/** Builds a map from icon path (Art/2DArt/...) to sprite rect, merging notableActive + keystoneActive. */
function buildSpriteCoords(sprites: any): Map<string, SpriteRect> {
  const map = new Map<string, SpriteRect>();
  const ZOOM = '0.5';
  for (const spriteKey of ['notableActive', 'keystoneActive']) {
    const sheet = sprites?.[spriteKey]?.[ZOOM];
    if (!sheet) continue;
    const { filename: sheetUrl, w: sheetW, h: sheetH, coords } = sheet;
    for (const [iconPath, rect] of Object.entries(coords as Record<string, any>)) {
      if (!map.has(iconPath)) {
        map.set(iconPath, { sheetUrl, sheetW, sheetH, x: rect.x, y: rect.y, w: rect.w, h: rect.h });
      }
    }
  }
  return map;
}

async function fetchAndBuildTreeData(): Promise<TreeNodeMap> {
  const response = await axios.get(TREE_URL, {
    headers: {
      'User-Agent': 'poe-optimizer/1.0',
      'Accept': 'application/json',
    },
    timeout: 30000,
    maxRedirects: 3,
  });

  const parsed = response.data;
  const rawNodes: Record<string, any> = parsed.nodes || {};
  const groups: Record<string, any> = parsed.groups || {};
  const orbitRadii: number[] = parsed.constants?.orbitRadii || [];
  const skillsPerOrbit: number[] = parsed.constants?.skillsPerOrbit || [];

  if (Object.keys(rawNodes).length === 0) {
    throw new Error('Tree data response contained no nodes — data format may have changed.');
  }

  const spriteCoords = buildSpriteCoords(parsed.sprites || {});
  console.log(`[TreeDataProxy] Sprite map built: ${spriteCoords.size} icon entries`);

  // In newer GGG exports the JSON key may differ from the numeric node ID that PoB
  // exports (the `skill` field). Build a key→skill map so we can re-index correctly
  // and convert the `out` edge arrays to use skill IDs as well.
  const keyToSkill: Record<string, string> = {};
  let hasMismatch = false;
  for (const [id, raw] of Object.entries(rawNodes)) {
    if (raw?.skill !== undefined) {
      const skillStr = String(raw.skill);
      keyToSkill[id] = skillStr;
      if (skillStr !== id) hasMismatch = true;
    }
  }

  const slim: TreeNodeMap = {};
  for (const [id, raw] of Object.entries(rawNodes)) {
    const info = classifyNode(raw, groups, orbitRadii, skillsPerOrbit);
    if (!info) continue;

    // Re-map out edges to skill IDs if the format uses a different primary key.
    if (hasMismatch && info.out) {
      info.out = info.out.map(neighborKey => keyToSkill[neighborKey] ?? neighborKey);
    }

    // Resolve icon path to sprite sheet crop coordinates.
    const iconPath = raw.icon as string | undefined;
    if (iconPath && (raw.isKeystone || (raw.ascendancyName && raw.isNotable))) {
      const rect = spriteCoords.get(iconPath);
      if (rect) info.spriteRect = rect;
    }

    const skillId = keyToSkill[id] ?? id;
    slim[skillId] = info;
  }

  const sampleKeys = Object.keys(slim).slice(0, 5);
  console.log(`[TreeDataProxy] Built nodeMap: ${Object.keys(slim).length} nodes. hasMismatch=${hasMismatch}. Sample IDs: ${sampleKeys.join(', ')}`);

  return slim;
}

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS && cache.version === SCHEMA_VERSION) {
    return NextResponse.json(cache.data);
  }

  try {
    console.log('[TreeDataProxy] Fetching fresh passive tree data...');
    const data = await fetchAndBuildTreeData();
    cache = { data, fetchedAt: now, version: SCHEMA_VERSION };
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[TreeDataProxy] Fetch failed:', error.message);

    // Serve stale data rather than failing outright, if we have it.
    if (cache) {
      console.warn('[TreeDataProxy] Serving stale cache after fetch failure.');
      return NextResponse.json(cache.data);
    }

    return NextResponse.json({ error: 'Failed to fetch passive tree data' }, { status: 500 });
  }
}
