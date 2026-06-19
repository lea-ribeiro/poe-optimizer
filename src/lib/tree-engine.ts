import { TreeNodeMap, TreeNodeInfo } from './tree-data';

/**
 * Extracts active node IDs from PoB data.
 */
export function getActiveNodeIds(pobData: any): string[] {
  try {
    const spec = pobData.PathOfBuilding.Tree[0].Spec[0];
    const nodesAttr = spec.$.nodes || '';
    return nodesAttr.split(',').filter((id: string) => id.length > 0);
  } catch (e) {
    console.error('Error extracting nodes:', e);
    return [];
  }
}

/**
 * Extracts which effect was chosen for each allocated Mastery node.
 * PoB stores this as <Spec masteryEffects="{nodeId,effectId},{nodeId,effectId}">, separate
 * from the `nodes` attribute (which only says a mastery is allocated, not which effect).
 */
export function getMasterySelections(pobData: any): Record<string, string> {
  try {
    const spec = pobData.PathOfBuilding.Tree[0].Spec[0];
    const attr = spec.$.masteryEffects || '';
    const selections: Record<string, string> = {};
    for (const match of attr.matchAll(/\{(\d+),(\d+)\}/g)) {
      selections[match[1]] = match[2];
    }
    return selections;
  } catch (e) {
    console.error('Error extracting mastery selections:', e);
    return {};
  }
}

/**
 * Extracts node IDs that are used as Sockets (Jewels/Clusters).
 */
export function getSocketNodeIds(pobData: any): string[] {
  try {
    const sockets = pobData.PathOfBuilding.Tree[0].Sockets?.[0]?.Socket || [];
    return sockets
      .filter((s: any) => s.$.itemId && s.$.itemId !== '0')
      .map((s: any) => s.$.nodeId);
  } catch (e) {
    return [];
  }
}

/**
 * Resolves a list of allocated node IDs into named/classified entries, dropping anything
 * the node map doesn't recognize (e.g. cluster jewel nodes, which aren't part of the base
 * tree dataset and don't have a stable global ID).
 */
export type TreeNodeEntry = TreeNodeInfo & { id: string };

export function resolveNodes(nodeIds: string[], nodeMap: TreeNodeMap): TreeNodeEntry[] {
  return nodeIds
    .map(id => {
      const info = nodeMap[id];
      return info ? { id, ...info } : null;
    })
    .filter((n): n is TreeNodeEntry => n !== null);
}

/** Convenience helper: just the Keystones allocated in a build. */
export function getKeystones(nodeIds: string[], nodeMap: TreeNodeMap): TreeNodeEntry[] {
  return resolveNodes(nodeIds, nodeMap).filter(n => n.type === 'Keystone');
}

export type TreeDiffResult = {
  keystonesOnlyInTarget: TreeNodeEntry[];
  keystonesOnlyInCurrent: TreeNodeEntry[];
  notablesOnlyInTarget: TreeNodeEntry[];
  notablesOnlyInCurrent: TreeNodeEntry[];
  ascendancyOnlyInTarget: TreeNodeEntry[];
  ascendancyOnlyInCurrent: TreeNodeEntry[];
  /** Mastery + small passive nodes get summarized as counts rather than listed individually. */
  minorNodesOnlyInTargetCount: number;
  minorNodesOnlyInCurrentCount: number;
  sharedNodeCount: number;
  /** Node IDs present in either tree but absent from the official dataset (e.g. cluster jewel nodes). */
  unresolvedOnlyInTargetCount: number;
  unresolvedOnlyInCurrentCount: number;
};

/**
 * Compares two builds' allocated passive trees and buckets the differences by significance:
 * Keystones/Notables/Ascendancy are called out individually since they drive build decisions;
 * everything else (small stat nodes, masteries) is summarized as a count.
 */
export function compareTrees(currentNodeIds: string[], targetNodeIds: string[], nodeMap: TreeNodeMap): TreeDiffResult {
  const currentSet = new Set(currentNodeIds);
  const targetSet = new Set(targetNodeIds);

  const onlyInTarget = targetNodeIds.filter(id => !currentSet.has(id));
  const onlyInCurrent = currentNodeIds.filter(id => !targetSet.has(id));
  const sharedNodeCount = targetNodeIds.filter(id => currentSet.has(id)).length;

  const bucket = (ids: string[]) => {
    const result = { keystones: [] as TreeNodeEntry[], notables: [] as TreeNodeEntry[], ascendancy: [] as TreeNodeEntry[], minorCount: 0, unresolvedCount: 0 };
    ids.forEach(id => {
      const info = nodeMap[id];
      if (!info) { result.unresolvedCount++; return; }
      const entry: TreeNodeEntry = { id, ...info };
      if (entry.type === 'Ascendancy') result.ascendancy.push(entry);
      else if (entry.type === 'Keystone') result.keystones.push(entry);
      else if (entry.type === 'Notable') result.notables.push(entry);
      else if (entry.type !== 'Mastery') result.minorCount++; // Normal nodes only - masteries get their own dedicated diff (see compareMasterySelections)
    });
    return result;
  };

  const targetBucket = bucket(onlyInTarget);
  const currentBucket = bucket(onlyInCurrent);

  return {
    keystonesOnlyInTarget: targetBucket.keystones,
    keystonesOnlyInCurrent: currentBucket.keystones,
    notablesOnlyInTarget: targetBucket.notables,
    notablesOnlyInCurrent: currentBucket.notables,
    ascendancyOnlyInTarget: targetBucket.ascendancy,
    ascendancyOnlyInCurrent: currentBucket.ascendancy,
    minorNodesOnlyInTargetCount: targetBucket.minorCount,
    minorNodesOnlyInCurrentCount: currentBucket.minorCount,
    sharedNodeCount,
    unresolvedOnlyInTargetCount: targetBucket.unresolvedCount,
    unresolvedOnlyInCurrentCount: currentBucket.unresolvedCount,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Reverse-Engineering: BFS-based leveling roadmap from a single endgame PoB
// ────────────────────────────────────────────────────────────────────────────

export type ReverseStage = {
  id: string;
  label: string;
  levelRange: string;
  labNote?: string;
  /** All nodes allocated cumulatively up to and including this stage (for tree viz). */
  cumulativeNodeIds: string[];
  /** Only the nodes newly added in this specific stage. */
  newNodeIds: string[];
  newKeystones: TreeNodeEntry[];
  newNotables: TreeNodeEntry[];
  newAscendancy: TreeNodeEntry[];
  /** Count of plain Normal-type nodes added this stage (not surfaced individually). */
  minorCount: number;
};

const STAGE_DEFS: Array<{ id: string; label: string; levelRange: string; labNote?: string; ptCap: number }> = [
  { id: 'acts123',   label: 'Campaign: Acts 1–3',  levelRange: 'Level 1–28',  labNote: undefined,                              ptCap: 33 },
  { id: 'acts46',    label: 'Campaign: Acts 4–6',  levelRange: 'Level 29–45', labNote: 'Complete First Labyrinth',             ptCap: 55 },
  { id: 'acts710',   label: 'Campaign: Acts 7–10', levelRange: 'Level 46–68', labNote: 'Complete Second Labyrinth',            ptCap: 80 },
  { id: 'earlymaps', label: 'Early Mapping',        levelRange: 'Level 68–90', labNote: 'Complete Third Labyrinth (Act 8+)',    ptCap: 100 },
  { id: 'endgame',   label: 'Endgame',              levelRange: 'Level 90+',   labNote: 'Complete Fourth Labyrinth (Uber Lab)', ptCap: Infinity },
];

/**
 * BFS through ONLY the allocated subgraph (only traversing edges between allocated nodes),
 * starting at startId. Every prefix of the returned list forms a valid, connected PoE
 * passive tree state — no node appears unless a path of allocated nodes connects it back
 * to the class start. This is the critical property that makes stage snapshots credible.
 */
function bfsAllocatedOrder(startId: string, allocatedSet: Set<string>, nodeMap: TreeNodeMap): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (allocatedSet.has(id)) order.push(id);

    const node = nodeMap[id];
    if (!node?.out) continue;
    for (const neighborId of node.out) {
      if (!visited.has(neighborId) && allocatedSet.has(neighborId)) {
        queue.push(neighborId);
      }
    }
  }

  return order;
}

/**
 * Takes a single endgame PoB and generates a 5-stage leveling roadmap by:
 *  1. Finding the class start node (via class name match in nodeMap)
 *  2. BFS through ONLY the allocated subgraph — every prefix is a connected, valid tree
 *  3. Bucketing into campaign/mapping stages by passive-point milestones
 *  4. Staging ascendancy nodes 2-per-lab across the later stages
 */
export function generateBFSTreeRoadmap(pobData: any, nodeMap: TreeNodeMap): ReverseStage[] {
  const className: string = pobData.PathOfBuilding?.Build?.[0]?.$.className ?? '';
  const ascendancyClass: string = pobData.PathOfBuilding?.Build?.[0]?.$.ascendClassName ?? '';
  const allNodeIds = getActiveNodeIds(pobData);
  const allocatedSet = new Set(allNodeIds);

  const ascNodeIds = allNodeIds.filter(id => nodeMap[id]?.type === 'Ascendancy');
  const regularNodeIds = allNodeIds.filter(id => {
    const n = nodeMap[id];
    return n && n.type !== 'Ascendancy';
  });
  const regularSet = new Set(regularNodeIds);

  // Split ascendancy nodes into:
  // - classAsc: nodes from the player's own ascendancy class, obtained from the 4 labs
  // - altAsc: league-mechanic nodes (Farrul, Breachlord, Aul, etc.) that require
  //           endgame map content, NOT labs — always go into the final Endgame stage
  const classAscIds = ascNodeIds.filter(id => nodeMap[id]?.ascendancyName === ascendancyClass);
  const altAscIds   = ascNodeIds.filter(id => nodeMap[id]?.ascendancyName !== ascendancyClass);
  const classAscSet = new Set(classAscIds);

  // The gateway node (named after the ascendancy class, e.g. "Necromancer") is
  // auto-allocated when you first ascend — it costs no ascendancy points. We include
  // it in cumulativeNodeIds (for the tree visualization) but NOT in newNodeIds (counts).
  const gatewayId = classAscIds.find(id =>
    nodeMap[id]?.name?.toLowerCase() === ascendancyClass.toLowerCase()
  ) ?? null;

  // BFS-order the class ascendancy nodes so shallower (earlier-lab) nodes come first.
  // The entry node is identifiable as the one with an out-edge pointing outside the
  // ascendancy set — that edge goes to the unallocated ascendancy gateway node.
  const ascEntryId = classAscIds.find(id =>
    (nodeMap[id]?.out ?? []).some(nid => !classAscSet.has(nid))
  ) ?? classAscIds[0] ?? null;
  const orderedClassAsc = ascEntryId
    ? bfsAllocatedOrder(ascEntryId, classAscSet, nodeMap)
    : classAscIds;

  // Find the class start node — it's the allocated node whose name matches the class.
  let startId: string | null = null;
  if (className) {
    for (const [id, info] of Object.entries(nodeMap)) {
      if (info.name.toLowerCase() === className.toLowerCase() && allocatedSet.has(id)) {
        startId = id;
        break;
      }
    }
  }

  // Fallback: the regular (non-ascendancy) allocated node with the fewest allocated
  // neighbors. Class start nodes sit at the tree's outer edge with very few connections,
  // so this identifies a reasonable root even without an exact name match.
  if (!startId && regularNodeIds.length > 0) {
    let minNeighbors = Infinity;
    for (const id of regularNodeIds) {
      const count = (nodeMap[id]?.out ?? []).filter(n => regularSet.has(n)).length;
      if (count < minNeighbors) { minNeighbors = count; startId = id; }
    }
  }

  // BFS through only the allocated regular subgraph — every prefix is a connected tree.
  const orderedRegularIds = startId
    ? bfsAllocatedOrder(startId, regularSet, nodeMap)
    : regularNodeIds;

  // Each lab unlocks 1 ascendancy notable (plus any connector/path nodes needed to reach it).
  // Walk the BFS-ordered class ascendancy list, advancing to the next lab each time we hit
  // a notable node, so each stage gets at most 1 notable in its text breakdown.
  const ascPerLab: string[][] = [[], [], [], []];
  let labIdx = 0;
  for (const id of orderedClassAsc) {
    if (labIdx >= 4) { ascPerLab[3].push(id); continue; }
    ascPerLab[labIdx].push(id);
    if (nodeMap[id]?.isNotable && labIdx < 3) labIdx++;
  }

  let cumulative: string[] = [];
  const stages: ReverseStage[] = [];

  STAGE_DEFS.forEach((def, i) => {
    const prevCap = i === 0 ? 0 : STAGE_DEFS[i - 1].ptCap;
    const stageRegular = orderedRegularIds.slice(prevCap, def.ptCap);
    const baseAsc = i > 0 ? (ascPerLab[i - 1] ?? []) : [];
    // League-mechanic ascendancy (Farrul, Breachlord, etc.) only unlocks via endgame
    // map content, so push it all into the final Endgame stage.
    const stageAsc = i === STAGE_DEFS.length - 1 ? [...baseAsc, ...altAscIds] : baseAsc;
    // Exclude the gateway from the per-stage point count; it's auto-allocated on first
    // ascension and costs no ascendancy points. It stays in cumulativeNodeIds so the
    // tree visualization marks it as allocated.
    const newNodeIds = [...stageRegular, ...stageAsc.filter(id => id !== gatewayId)];
    cumulative = [...cumulative, ...stageRegular, ...stageAsc];

    const resolved = resolveNodes(newNodeIds, nodeMap);
    stages.push({
      id: def.id,
      label: def.label,
      levelRange: def.levelRange,
      labNote: def.labNote,
      cumulativeNodeIds: [...cumulative],
      newNodeIds,
      newKeystones: resolved.filter(n => n.type === 'Keystone'),
      newNotables: resolved.filter(n => n.type === 'Notable'),
      newAscendancy: resolved.filter(n => n.type === 'Ascendancy' && n.isNotable),
      minorCount: newNodeIds.filter(id => nodeMap[id]?.type === 'Normal').length,
    });
  });

  return stages;
}

export type ClusterJewelDiff = {
  onlyInTarget: string[];
  onlyInCurrent: string[];
};

function extractClusterJewelNotables(pobData: any): string[] {
  try {
    const items = pobData.PathOfBuilding.Items[0].Item || [];
    const itemArray = Array.isArray(items) ? items : [items];
    const notables: string[] = [];
    for (const item of itemArray) {
      const text = (item._ ?? item ?? '').toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        // "Added Passive Skill is X" names an actual notable; "Added Small Passive Skills..."
        // describes filler nodes — exclude those.
        if (trimmed.startsWith('Added Passive Skill is ') && !trimmed.toLowerCase().includes('small passive')) {
          notables.push(trimmed.slice('Added Passive Skill is '.length).trim());
        }
      }
    }
    return notables;
  } catch {
    return [];
  }
}

export function compareClusterJewelNotables(currentPobData: any, targetPobData: any): ClusterJewelDiff {
  const currentNotables = extractClusterJewelNotables(currentPobData);
  const targetNotables = extractClusterJewelNotables(targetPobData);

  const toCounts = (arr: string[]) => {
    const map = new Map<string, number>();
    for (const n of arr) map.set(n, (map.get(n) || 0) + 1);
    return map;
  };

  const currentCounts = toCounts(currentNotables);
  const targetCounts = toCounts(targetNotables);

  const onlyInTarget: string[] = [];
  for (const [name, count] of targetCounts) {
    const diff = count - (currentCounts.get(name) || 0);
    for (let i = 0; i < diff; i++) onlyInTarget.push(name);
  }

  const onlyInCurrent: string[] = [];
  for (const [name, count] of currentCounts) {
    const diff = count - (targetCounts.get(name) || 0);
    for (let i = 0; i < diff; i++) onlyInCurrent.push(name);
  }

  return { onlyInTarget, onlyInCurrent };
}

export type MasteryDiffEntry = {
  nodeId: string;
  masteryName: string;
  currentEffect?: string;
  targetEffect?: string;
  status: 'added' | 'removed' | 'changed';
};

/**
 * Compares which Mastery effects were chosen between two builds. A Mastery node being
 * allocated in both builds doesn't mean much on its own - what matters is which of its several
 * possible effects was picked, which `compareTrees` can't see (it only knows node IDs, not the
 * separate masteryEffects selection attribute).
 */
export function compareMasterySelections(
  currentNodeIds: string[],
  targetNodeIds: string[],
  currentSelections: Record<string, string>,
  targetSelections: Record<string, string>,
  nodeMap: TreeNodeMap
): MasteryDiffEntry[] {
  const currentSet = new Set(currentNodeIds);
  const targetSet = new Set(targetNodeIds);

  const masteryIds = new Set([
    ...currentNodeIds.filter(id => nodeMap[id]?.type === 'Mastery'),
    ...targetNodeIds.filter(id => nodeMap[id]?.type === 'Mastery'),
  ]);

  const getEffectStats = (info: TreeNodeInfo, effectId?: string): string | undefined => {
    if (!effectId || !info.masteryEffects) return undefined;
    return info.masteryEffects.find(e => String(e.effect) === effectId)?.stats.join(' ');
  };

  const results: MasteryDiffEntry[] = [];
  masteryIds.forEach(id => {
    const info = nodeMap[id];
    if (!info) return;

    const inCurrent = currentSet.has(id);
    const inTarget = targetSet.has(id);
    const currentEffect = getEffectStats(info, currentSelections[id]);
    const targetEffect = getEffectStats(info, targetSelections[id]);

    if (inTarget && !inCurrent) {
      results.push({ nodeId: id, masteryName: info.name, targetEffect, status: 'added' });
    } else if (inCurrent && !inTarget) {
      results.push({ nodeId: id, masteryName: info.name, currentEffect, status: 'removed' });
    } else if (inCurrent && inTarget && currentSelections[id] !== targetSelections[id]) {
      results.push({ nodeId: id, masteryName: info.name, currentEffect, targetEffect, status: 'changed' });
    }
  });

  return results;
}
