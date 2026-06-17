import axios from 'axios';

export type TreeNodeType = 'Keystone' | 'Notable' | 'Ascendancy' | 'Mastery' | 'Normal';

export type TreeNodeInfo = {
  name: string;
  type: TreeNodeType;
  ascendancyName?: string;
  stats?: string[];
  /** Absolute canvas position, matching the official tree's layout. */
  x: number;
  y: number;
  /** IDs of directly connected nodes (edges), used to draw the path visually. */
  out?: string[];
  /** Mastery nodes only: every selectable effect, keyed by the id PoB's masteryEffects attribute uses. */
  masteryEffects?: { effect: number, stats: string[] }[];
};

export type TreeNodeMap = Record<string, TreeNodeInfo>;

const BASE_URL = '/api/tree-data';

let inFlight: Promise<TreeNodeMap> | null = null;
let cached: TreeNodeMap | null = null;

/**
 * Fetches the node ID -> name/type map from our server-side proxy (see /api/tree-data),
 * caching it for the lifetime of the page so multiple analyses (current + target) don't
 * re-fetch it.
 */
export async function getTreeNodeMap(): Promise<TreeNodeMap> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = axios.get(BASE_URL)
    .then(response => {
      cached = response.data || {};
      return cached!;
    })
    .catch(error => {
      console.error('Error fetching tree node data:', error);
      return {};
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
