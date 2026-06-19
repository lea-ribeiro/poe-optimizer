'use client';

import type { BuildItem, ModComparison } from '@/lib/item-analyzer';
import { ItemDisplay, getRarityColor, getModColor, cleanMod } from './BuildPanel';

export type GearSlot = {
  slot: string;
  current?: BuildItem;
  target?: BuildItem;
  isMatched: boolean;
  upgrades: ModComparison[];
};

type Props = {
  gearComparison: GearSlot[];
  isOpen: boolean;
  onToggle: () => void;
};

export default function GearMatchUpSection({ gearComparison, isOpen, onToggle }: Props) {
  return (
    <section className="bg-slate-900 rounded-3xl border border-amber-900/30 shadow-xl overflow-visible">
      <button onClick={onToggle} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-3xl">
        <div className="flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center shadow-lg text-2xl">⚖️</div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Gear Match-Up</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Surgical Mod Comparison</p>
          </div>
        </div>
        <span className="text-2xl text-slate-600">{isOpen ? '−' : '+'}</span>
      </button>

      {isOpen && (
        <div className="p-8 pt-0 animate-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-1 gap-6">
            {gearComparison.map((g, idx) => (
              <div key={idx} className={`flex flex-col p-6 bg-slate-950 rounded-[2rem] border transition-all ${g.isMatched ? 'border-green-900/20' : 'border-white/5'}`}>
                <div className="flex items-center gap-8 mb-6">
                  <div className="w-24 text-[11px] font-black text-amber-500 uppercase tracking-tighter text-center">{g.slot}</div>
                  <div className="flex-1 flex justify-between items-center gap-12">
                    <div className="flex-1 flex items-center justify-center gap-12">
                      <ItemDisplay item={g.current} label="My Progress" />
                      <div className={`text-2xl font-black ${g.isMatched ? 'text-green-500/30' : 'text-red-500/30'}`}>→</div>
                      <ItemDisplay item={g.target} label="Target Goal" />
                    </div>
                    <div className="min-w-[150px] text-right">
                      <span className={`text-[11px] font-black px-4 py-2 rounded-full uppercase tracking-widest inline-block whitespace-nowrap ${g.upgrades.length === 0 ? 'text-green-500 bg-green-500/10' : 'text-amber-500 bg-amber-500/10 animate-pulse'}`}>
                        {g.upgrades.length === 0 ? 'Perfect Match' : `${g.upgrades.length} Improvements`}
                      </span>
                    </div>
                  </div>
                </div>

                {g.upgrades.length > 0 && (
                  <div className="mt-4 pt-6 border-t border-white/5 space-y-6">
                    {g.target?.rarity === 'UNIQUE' && g.current?.rarity !== 'UNIQUE' ? (
                      <div className="p-4 bg-purple-950/10 border border-purple-900/30 rounded-2xl flex flex-col items-center gap-2 text-center">
                        <p className="text-[11px] font-black text-purple-400 uppercase tracking-widest">Major Upgrade: Transition to Unique</p>
                        <p className="text-[13px] text-slate-300">Replace your rare item with <span className="text-amber-500 font-bold">{g.target.name}</span> for build-critical scaling.</p>
                        {g.target.estimatedPrice && (
                          <p className="text-[10px] font-black text-amber-500 uppercase">Estimated Cost: {Math.round(g.target.estimatedPrice)} Chaos</p>
                        )}
                      </div>
                    ) : (
                      <>
                        {g.upgrades.filter(u => u.type === 'Missing').length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Critical: Missing Modifiers</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {g.upgrades.filter(u => u.type === 'Missing').map((u, uIdx) => (
                                <div key={uIdx} className="p-4 bg-red-950/10 border border-red-900/20 rounded-2xl flex items-start gap-3">
                                  <div className="space-y-1">
                                    <p className={`text-[13px] font-bold leading-tight ${getModColor(u.mod)}`}>{cleanMod(u.mod)}</p>
                                    <p className="text-[10px] font-black uppercase text-red-400/70 tracking-tighter">Your item lacks this essential stat</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {g.upgrades.filter(u => u.type !== 'Missing').length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Performance: Stat Upgrades</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {g.upgrades.filter(u => u.type !== 'Missing').map((u, uIdx) => (
                                <div key={uIdx} className="p-4 bg-amber-950/10 border border-amber-900/20 rounded-2xl flex items-start gap-3">
                                  <div className="space-y-2">
                                    <p className={`text-[13px] font-bold leading-tight ${getModColor(u.mod)}`}>{cleanMod(u.mod)}</p>
                                    <div className="flex items-center gap-3">
                                      <span className="px-2 py-0.5 bg-slate-900 rounded text-[11px] text-slate-500 font-mono">{u.currentValue}</span>
                                      <span className="text-amber-500 text-xs">→</span>
                                      <span className="px-2 py-0.5 bg-amber-500/20 rounded text-[11px] text-amber-400 font-mono font-black">{u.targetValue}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
