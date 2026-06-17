'use client';

import { useState } from 'react';
import { TreeNodeMap } from '@/lib/tree-data';
import { ReverseStage } from '@/lib/tree-engine';
import { BuildArchetype } from '@/lib/pob-analyzer';
import { BuildItem } from '@/lib/item-analyzer';
import { GemGroup } from '@/lib/gem-analyzer';
import TreeDiagram from '@/components/TreeDiagram';

type Props = {
  className: string;
  ascendancyName: string;
  buildLevel: number;
  archetype: BuildArchetype;
  items: BuildItem[];
  gemGroups: GemGroup[];
  stages: ReverseStage[];
  nodeMap: TreeNodeMap;
};

const STAGE_RING = [
  'border-green-500/50',
  'border-blue-500/50',
  'border-purple-500/50',
  'border-amber-500/50',
  'border-red-500/50',
];
const STAGE_BG = [
  'bg-green-500/5',
  'bg-blue-500/5',
  'bg-purple-500/5',
  'bg-amber-500/5',
  'bg-red-500/5',
];
const STAGE_TEXT = [
  'text-green-400',
  'text-blue-400',
  'text-purple-400',
  'text-amber-400',
  'text-red-400',
];

export default function ReverseEngineerPanel({
  className,
  ascendancyName,
  buildLevel,
  archetype,
  items,
  gemGroups,
  stages,
  nodeMap,
}: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const stage = stages[selectedIdx];
  const prevIds = selectedIdx > 0 ? stages[selectedIdx - 1].cumulativeNodeIds : [];
  const uniqueItems = items.filter(i => i.rarity === 'UNIQUE').sort(
    (a, b) => (b.estimatedPrice ?? 0) - (a.estimatedPrice ?? 0)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Build Overview */}
      <div className="bg-slate-900 rounded-2xl border border-purple-900/30 p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center text-lg shrink-0">🔄</div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Leveling Roadmap</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Reverse-engineered from level {buildLevel} endgame PoB</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Class', value: className, sub: ascendancyName, subColor: 'text-purple-400' },
            { label: 'Main Skill', value: archetype.mainSkillName, sub: archetype.damageType, subColor: 'text-amber-400' },
            { label: 'Defense', value: archetype.defenseType, sub: archetype.isCrit ? 'Critical Strike' : 'Non-Crit', subColor: 'text-slate-400' },
            { label: 'Endgame DPS', value: `${(archetype.totalDPS / 1_000_000).toFixed(1)}M`, sub: 'Combined DPS', subColor: 'text-slate-400' },
          ].map(({ label, value, sub, subColor }) => (
            <div key={label} className="p-3 bg-slate-950 rounded-xl">
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">{label}</p>
              <p className="text-sm font-black text-white mt-0.5">{value}</p>
              {sub && <p className={`text-[10px] font-bold mt-0.5 ${subColor}`}>{sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Stage Stepper */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stages.map((s, idx) => {
          const isActive = idx === selectedIdx;
          const isEmpty = s.newNodeIds.length === 0;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedIdx(idx)}
              disabled={isEmpty}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                isActive
                  ? `${STAGE_RING[idx]} ${STAGE_BG[idx]}`
                  : isEmpty
                  ? 'border-slate-800 bg-slate-900/30 opacity-40 cursor-not-allowed'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-500'
              }`}
            >
              <p className={`text-[9px] font-black uppercase tracking-widest ${isActive ? STAGE_TEXT[idx] : 'text-slate-500'}`}>
                Stage {idx + 1}
              </p>
              <p className={`text-[11px] font-black mt-0.5 leading-tight ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {s.label}
              </p>
              <p className="text-[9px] text-slate-600 mt-1">{s.levelRange}</p>
              <p className={`text-[10px] font-bold mt-2 ${isActive ? STAGE_TEXT[idx] : 'text-slate-600'}`}>
                {isEmpty ? 'No new nodes' : `+${s.newNodeIds.length} nodes`}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Stage Detail */}
      {stage && stage.newNodeIds.length > 0 && (
        <div className={`bg-slate-900 rounded-3xl border ${STAGE_RING[selectedIdx]} ${STAGE_BG[selectedIdx]} p-8 space-y-8`}>
          {/* Stage Header */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-2">
              <h3 className={`text-2xl font-black uppercase tracking-tighter ${STAGE_TEXT[selectedIdx]}`}>
                {stage.label}
              </h3>
              <p className="text-slate-400 text-sm">{stage.levelRange}</p>
              {stage.labNote && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-400 font-black text-[10px] uppercase tracking-widest">{stage.labNote}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className={`text-4xl font-black ${STAGE_TEXT[selectedIdx]}`}>{stage.cumulativeNodeIds.length}</p>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">total nodes</p>
              <p className="text-[9px] text-slate-600 mt-1">+{stage.newNodeIds.length} this stage</p>
            </div>
          </div>

          {/* Node Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Keystones */}
            {stage.newKeystones.length > 0 && (
              <div className="space-y-3">
                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest border-b border-amber-500/10 pb-2">
                  Keystones
                </p>
                {stage.newKeystones.map(n => (
                  <div key={n.id} className="p-3 bg-amber-950/15 border border-amber-900/30 rounded-xl">
                    <p className="text-[12px] font-black text-amber-400">{n.name}</p>
                    {n.stats && (
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">{n.stats.join(' ')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Ascendancy */}
            {stage.newAscendancy.length > 0 && (
              <div className="space-y-3">
                <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest border-b border-purple-500/10 pb-2">
                  Ascendancy
                </p>
                {stage.newAscendancy.map(n => (
                  <div key={n.id} className="p-3 bg-purple-950/15 border border-purple-900/30 rounded-xl">
                    <p className="text-[12px] font-black text-purple-400">{n.name}</p>
                    {n.stats && (
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">{n.stats.join(' ')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Notables + Minor Count */}
            {(stage.newNotables.length > 0 || stage.minorCount > 0) && (
              <div className="space-y-2">
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-500/10 pb-2">
                  Notables
                </p>
                {stage.newNotables.slice(0, 8).map(n => (
                  <div key={n.id} className="px-3 py-2 bg-blue-950/10 border border-blue-900/20 rounded-lg">
                    <p className="text-[11px] font-bold text-blue-300">{n.name}</p>
                    {n.stats && (
                      <p className="text-[9px] text-slate-500 mt-0.5 leading-snug line-clamp-1">{n.stats[0]}</p>
                    )}
                  </div>
                ))}
                {stage.newNotables.length > 8 && (
                  <p className="text-[10px] text-slate-500 px-1">+{stage.newNotables.length - 8} more notables</p>
                )}
                {stage.minorCount > 0 && (
                  <p className="text-[10px] text-slate-500 px-1 font-bold pt-1">
                    + {stage.minorCount} minor stat nodes along the path
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tree Visualization */}
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Passive Tree — Blue = already allocated · Green = allocate this stage
            </p>
            <TreeDiagram nodeMap={nodeMap} currentIds={prevIds} targetIds={stage.cumulativeNodeIds} />
          </div>
        </div>
      )}

      {/* Key Unique Items */}
      {uniqueItems.length > 0 && (
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest">Key Unique Items</h3>
            <p className="text-[10px] text-slate-500 mt-1">All uniques used in this endgame build, sorted by price</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {uniqueItems.map((item, i) => (
              <div key={i} className="p-3 bg-slate-950 rounded-xl border border-[#af6025]/20 flex items-center gap-3">
                {item.icon ? (
                  <img src={item.icon} alt={item.name} className="w-10 h-10 object-contain shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-[#af6025] truncate">{item.name}</p>
                  <p className="text-[9px] text-slate-500 uppercase">{item.slot}</p>
                  {item.estimatedPrice ? (
                    <p className="text-[10px] text-amber-500 font-bold mt-0.5">~{Math.round(item.estimatedPrice)}c</p>
                  ) : (
                    <p className="text-[10px] text-slate-600 mt-0.5">price unknown</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Endgame Gem Setup */}
      {gemGroups.length > 0 && (
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-black text-blue-500 uppercase tracking-widest">Endgame Gem Setup</h3>
            <p className="text-[10px] text-slate-500 mt-1">Final socket links from the PoB — build toward these during leveling</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gemGroups.map((group, i) => (
              <div key={i} className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider">{group.slot}</p>
                  <p className="text-[10px] font-black text-blue-500 uppercase">{group.links}L</p>
                </div>
                <div className="p-4 space-y-2">
                  {group.gems.map((gem, j) => (
                    <div key={j} className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-200 truncate">{gem.name}</span>
                      <span className="text-slate-500 font-mono shrink-0 ml-2">{gem.level}/{gem.quality}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
