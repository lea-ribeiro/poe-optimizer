/**
 * Tree Engine for Path of Exile Build Optimization
 * Focuses on decomposing a level 100 tree into leveling stages.
 */

export type TreeStage = {
  level: number;
  points: number;
  focus: string;
  recommendedNodes: string[];
  description: string;
};

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
 * Analyzes the tree and provides a breakdown by level.
 * Intelligently removes late-game nodes like Clusters/Jewels for early stages.
 */
export function generateTreeRoadmap(pobData: any): TreeStage[] {
  const allNodes = getActiveNodeIds(pobData);
  const socketNodes = getSocketNodeIds(pobData);
  
  const totalPoints = allNodes.length;
  const targetLevel = parseInt(pobData.PathOfBuilding.Build?.[0]?.$.level) || 100;

  // Logic: Identify "Skeleton" nodes (non-jewel nodes)
  const skeletonNodes = allNodes.filter(id => !socketNodes.includes(id));
  
  // Stages definition
  const stages: TreeStage[] = [
    {
      level: 72,
      points: Math.min(Math.floor(totalPoints * 0.70), skeletonNodes.length),
      focus: 'Core Survivability & Pathing',
      description: 'Remove all Cluster Jewels and non-essential Jewel slots. Focus on Life, Resistances, and primary Attribute requirements.',
      recommendedNodes: skeletonNodes.slice(0, 80) // Simplified heuristic
    },
    {
      level: 90,
      points: Math.floor(totalPoints * 0.88),
      focus: 'Major Damage & First Clusters',
      description: 'Introduce your first Large Cluster Jewel setup. Start picking up critical Jewel slots for Unique Jewels.',
      recommendedNodes: allNodes.slice(0, 100)
    },
    {
      level: targetLevel,
      points: totalPoints,
      focus: 'Final Optimization & Min-Maxing',
      description: 'Fill remaining Jewel slots with Adorned/Abyss jewels. Take remaining 5% damage/utility nodes.',
      recommendedNodes: allNodes
    }
  ];

  return stages;
}

/**
 * Heuristic to identify if a node is likely a "Key" node (Keystone).
 * In PoB XML, we would need to cross-reference with a data map,
 * but for now we can use node count as a proxy for complexity.
 */
export function estimateBuildComplexity(nodes: string[]): 'Low' | 'Medium' | 'High' {
  if (nodes.length > 115) return 'High';
  if (nodes.length > 90) return 'Medium';
  return 'Low';
}
