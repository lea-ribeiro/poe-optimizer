'use client';

import type { TreeDiffResult, TreeNodeEntry, MasteryDiffEntry, ClusterJewelDiff } from '@/lib/tree-engine';
import type { TreeNodeMap } from '@/lib/tree-data';
import TreeDiagram from './TreeDiagram';

type Props = {
  treeDiff: TreeDiffResult;
  treeNodeMap: TreeNodeMap;
  currentNodeIds: string[];
  targetNodeIds: string[];
  masteryDiff: MasteryDiffEntry[];
  clusterDiff: ClusterJewelDiff | null;
  isOpen: boolean;
  onToggle: () => void;
};

export default function TreeComparisonSection({
  treeDiff, treeNodeMap, currentNodeIds, targetNodeIds,
  masteryDiff, clusterDiff, isOpen, onToggle,
}: Props) {
  const diffGroups: { label: string; added: TreeNodeEntry[]; removed: TreeNodeEntry[] }[] = [
    { label: 'Keystones', added: treeDiff.keystonesOnlyInTarget, removed: treeDiff.keystonesOnlyInCurrent },
    { label: 'Notables', added: treeDiff.notablesOnlyInTarget, removed: treeDiff.notablesOnlyInCurrent },
    { label: 'Ascendancy', added: treeDiff.ascendancyOnlyInTarget, removed: treeDiff.ascendancyOnlyInCurrent },
  ];

  return (
    <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-visible">
      <button onClick={onToggle} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-3xl">
        <div className="flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center shadow-lg text-2xl">🌳</div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Tree Comparison</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Passive Allocation Differences</p>
          </div>
        </div>
        <span className="text-2xl text-slate-600">{isOpen ? '−' : '+'}</span>
      </button>

      {isOpen && (
        <div className="p-8 pt-0 space-y-8 animate-in slide-in-from-top-4 duration-500">
          <TreeDiagram nodeMap={treeNodeMap} currentIds={currentNodeIds} targetIds={targetNodeIds} />

          {diffGroups.map(({ label, added, removed }) =>
            (added.length > 0 || removed.length > 0) && (
              <div key={label} className="space-y-3">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">{label}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {added.length === 0 ? (
                      <p className="text-[11px] text-slate-600 italic">No {label.toLowerCase()} to allocate.</p>
                    ) : added.map(n => (
                      <div key={n.id} className="p-3 bg-green-950/10 border border-green-900/20 rounded-xl">
                        <p className="text-[12px] font-bold text-green-400">+ {n.name}</p>
                        {n.stats && <p className="text-[10px] text-slate-400 mt-1 leading-snug">{n.stats.join(' ')}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {removed.length === 0 ? (
                      <p className="text-[11px] text-slate-600 italic">Nothing to deallocate.</p>
                    ) : removed.map(n => (
                      <div key={n.id} className="p-3 bg-red-950/10 border border-red-900/20 rounded-xl opacity-70">
                        <p className="text-[12px] font-bold text-red-400">− {n.name}</p>
                        {n.stats && <p className="text-[10px] text-slate-400 mt-1 leading-snug">{n.stats.join(' ')}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {masteryDiff.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Masteries</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {masteryDiff.map(m => (
                  <div key={m.nodeId} className={`p-3 rounded-xl border ${m.status === 'removed' ? 'bg-red-950/10 border-red-900/20 opacity-70' : m.status === 'added' ? 'bg-green-950/10 border-green-900/20' : 'bg-amber-950/10 border-amber-900/20'}`}>
                    <p className={`text-[12px] font-bold ${m.status === 'removed' ? 'text-red-400' : m.status === 'added' ? 'text-green-400' : 'text-amber-400'}`}>
                      {m.status === 'added' ? '+ ' : m.status === 'removed' ? '− ' : ''}{m.masteryName}
                    </p>
                    {m.status === 'changed' ? (
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug space-y-1">
                        <p><span className="text-slate-600 uppercase font-black">Current: </span>{m.currentEffect}</p>
                        <p><span className="text-amber-500 uppercase font-black">Target: </span>{m.targetEffect}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">{m.currentEffect || m.targetEffect}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {clusterDiff && (clusterDiff.onlyInTarget.length > 0 || clusterDiff.onlyInCurrent.length > 0) && (
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Cluster Jewel Notables</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {clusterDiff.onlyInTarget.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">No new cluster notables.</p>
                  ) : clusterDiff.onlyInTarget.map((name, i) => (
                    <div key={i} className="p-3 bg-green-950/10 border border-green-900/20 rounded-xl">
                      <p className="text-[12px] font-bold text-green-400">+ {name}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {clusterDiff.onlyInCurrent.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">Nothing to remove.</p>
                  ) : clusterDiff.onlyInCurrent.map((name, i) => (
                    <div key={i} className="p-3 bg-red-950/10 border border-red-900/20 rounded-xl opacity-70">
                      <p className="text-[12px] font-bold text-red-400">− {name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-white/5 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-tighter text-slate-500">
            <span>{treeDiff.sharedNodeCount} shared nodes</span>
            <span className="text-green-500/70">+{treeDiff.minorNodesOnlyInTargetCount} minor nodes to allocate</span>
            <span className="text-red-500/70">−{treeDiff.minorNodesOnlyInCurrentCount} minor nodes to deallocate</span>
            {(treeDiff.unresolvedOnlyInTargetCount > 0 || treeDiff.unresolvedOnlyInCurrentCount > 0) && (
              <span className="text-slate-600">
                {treeDiff.unresolvedOnlyInTargetCount + treeDiff.unresolvedOnlyInCurrentCount} unresolved nodes (excluding named cluster notables above)
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
