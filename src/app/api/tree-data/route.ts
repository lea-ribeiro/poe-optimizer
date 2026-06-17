import { NextResponse } from 'next/server';
import axios from 'axios';
import { TreeNodeInfo, TreeNodeMap, TreeNodeType } from '@/lib/tree-data';

/**
 * Proxies + slims down GGG's official passive skill tree data.
 *
 * The official tree page (https://www.pathofexile.com/passive-skill-tree) embeds a
 * `var passiveSkillTreeData = {...}` object (~6MB) whose `nodes` dictionary is keyed by the
 * exact same numeric node IDs that Path of Building exports in <Spec nodes="...">. We fetch
 * that page, extract the embedded object, and reduce it to just what we need to label a node
 * (name + Keystone/Notable/Ascendancy/Mastery classification), cached in-memory so we don't
 * re-fetch a multi-MB page on every analysis.
 */

const TREE_URL = 'https://www.pathofexile.com/passive-skill-tree';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cache: { data: TreeNodeMap; fetchedAt: number } | null = null;

/**
 * Extracts the JSON object assigned to `varName` in a script blob, respecting string
 * boundaries so braces inside string values (flavour text, etc.) don't break the scan.
 */
function extractAssignedObject(source: string, varName: string): string | null {
  const marker = `${varName} = {`;
  const start = source.indexOf(marker);
  if (start === -1) return null;

  const objStart = start + marker.length - 1; // position of the opening '{'
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = objStart; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.substring(objStart, i + 1);
      }
    }
  }

  return null;
}

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
  if (Array.isArray(raw.out) && raw.out.length > 0) info.out = raw.out.map(String);
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

async function fetchAndBuildTreeData(): Promise<TreeNodeMap> {
  const response = await axios.get(TREE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 20000,
    maxRedirects: 5,
  });

  const html: string = response.data;
  const jsonText = extractAssignedObject(html, 'passiveSkillTreeData');
  if (!jsonText) {
    throw new Error('Could not locate passiveSkillTreeData in tree page response.');
  }

  const parsed = JSON.parse(jsonText);
  const rawNodes = parsed.nodes || {};
  const groups = parsed.groups || {};
  const orbitRadii: number[] = parsed.constants?.orbitRadii || [];
  const skillsPerOrbit: number[] = parsed.constants?.skillsPerOrbit || [];

  const slim: TreeNodeMap = {};
  for (const [id, raw] of Object.entries(rawNodes)) {
    const info = classifyNode(raw, groups, orbitRadii, skillsPerOrbit);
    if (info) slim[id] = info;
  }

  return slim;
}

export async function GET() {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    console.log('[TreeDataProxy] Fetching fresh passive tree data...');
    const data = await fetchAndBuildTreeData();
    cache = { data, fetchedAt: now };
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
