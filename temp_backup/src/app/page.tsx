'use client';

import { useState } from 'react';
import { processPoB } from '@/lib/pob-decoder';
import { analyzeBuildItems, BuildItem } from '@/lib/item-analyzer';
import { generateTreeRoadmap, TreeStage } from '@/lib/tree-engine';
import { analyzeBuildArchetype, BuildArchetype, getDynamicTips, generateOptimizationReport, OptimizationInsight } from '@/lib/pob-analyzer';
import { analyzeBuildGems, GemGroup } from '@/lib/gem-analyzer';
import { CAMPAIGN_MILESTONES, STARTER_PATHS } from '@/lib/leveling-data';

export default function Home() {
  const [pobString, setPobString] = useState('');
  const [targetPobString, setTargetPobString] = useState('');
  const [mode, setMode] = useState<'Optimize' | 'Reverse'>('Optimize');
  
  const [buildData, setBuildData] = useState<any>(null);
  const [targetBuildData, setTargetBuildData] = useState<any>(null);
  const [analyzedItems, setAnalyzedItems] = useState<BuildItem[]>([]);
  const [targetAnalyzedItems, setTargetAnalyzedItems] = useState<BuildItem[]>([]);
  const [archetype, setArchetype] = useState<BuildArchetype | null>(null);
  const [targetArchetype, setTargetArchetype] = useState<BuildArchetype | null>(null);
  const [gemGroups, setGemGroups] = useState<GemGroup[]>([]);
  const [targetGemGroups, setTargetGemGroups] = useState<GemGroup[]>([]);
  const [roadmap, setRoadmap] = useState<TreeStage[]>([]);
  
  const [targetKeystones, setTargetKeystones] = useState<string[]>([]);
  const [optimizationInsights, setOptimizationInsights] = useState<OptimizationInsight[]>([]);

  // UI Expansion States
  const [sections, setSections] = useState({
    target: false,
    comparison: true,
    journey: false,
    sockets: true
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDecode = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await processPoB(pobString);
      setBuildData(result);
      const arch = analyzeBuildArchetype(result);
      setArchetype(arch);
      const currentItems = await analyzeBuildItems(result, arch.mainSkillName, mode);
      setAnalyzedItems(currentItems);
      setRoadmap(generateTreeRoadmap(result));
      setGemGroups(await analyzeBuildGems(result));

      if (targetPobString) {
        const tResult = await processPoB(targetPobString);
        setTargetBuildData(tResult);
        const tArch = analyzeBuildArchetype(tResult);
        setTargetArchetype(tArch);
        const tItems = await analyzeBuildItems(tResult, tArch.mainSkillName, 'Optimize');
        setTargetAnalyzedItems(tItems);
        setTargetGemGroups(await analyzeBuildGems(tResult));

        const xmlString = JSON.stringify(tResult).toLowerCase();
        const commonKeystones = ['point blank', 'chaos inoculation', 'ghost dance', 'iron reflexes', 'unwavering stance', 'vaal pact', 'zealots oath', 'pain attunement', 'whispers of doom'];
        setTargetKeystones(commonKeystones.filter(k => xmlString.includes(k)));
      }

      setOptimizationInsights(generateOptimizationReport(result, arch));
    } catch (err: any) {
      setError(err.message || 'Failed to process build string.');
    } finally {
      setLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    const r = rarity.toUpperCase();
    if (r === 'UNIQUE') return 'text-[#af6025]'; // PoE Orange
    if (r === 'RARE') return 'text-[#ffff77]';   // PoE Yellow
    if (r === 'MAGIC') return 'text-[#8888ff]';  // PoE Blue
    return 'text-white';
  };

  // 1:1 Gear Comparison Logic
  const comparisonSlots = ['Weapon', 'Offhand', 'Body Armour', 'Helmet', 'Gloves', 'Boots', 'Amulet', 'Ring 1', 'Ring 2', 'Belt'];
  const gearComparison = comparisonSlots.map(slot => {
    const current = analyzedItems.find(i => i.slot === slot);
    const target = targetAnalyzedItems.find(i => i.slot === slot);
    const isMatched = current && target && (current.name.toLowerCase() === target.name.toLowerCase() || (current.rarity === 'RARE' && target.rarity === 'RARE'));
    
    return { slot, current, target, isMatched };
  });

  const ItemDisplay = ({ item, label }: { item?: BuildItem, label: string }) => {
    if (!item) return <div className="flex flex-col items-center gap-1 p-2 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 opacity-50 w-full"><div className="w-12 h-12 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-600">Empty</div><p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter text-center">{label}</p></div>;
    
    // For flasks, we want "Flask [number]" on top and the Name on bottom
    const topLabel = item.type === 'Flask' ? `Flask ${label}` : label;
    const subLabel = item.type === 'Flask' ? item.name : item.name;

    return (
      <div className="group relative flex flex-col items-center gap-1 p-2 bg-slate-950/50 rounded-xl border border-white/5 hover:border-white/10 transition-all w-full min-h-[100px] justify-start">
        {item.icon ? (
          <img src={item.icon} alt={item.name} className="w-12 h-12 object-contain drop-shadow-[0_0_5px_rgba(0,0,0,0.5)] mb-1" />
        ) : (
          <div className="w-12 h-12 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-600 mb-1">?</div>
        )}
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter text-center leading-tight line-clamp-1">{topLabel}</p>
        <p className={`text-[10px] font-bold text-center leading-tight line-clamp-2 mt-0.5 ${getRarityColor(item.rarity)}`}>
          {subLabel}
        </p>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans text-[13px]">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600 tracking-tight">PoE Optimizer</h1>
          <p className="text-slate-400 text-lg">Precision Build Analysis & Comparison</p>
        </header>

        {!buildData ? (
          <section className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">My Current PoB</h2>
                <textarea className="w-full h-40 p-4 bg-slate-950 text-amber-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono text-[10px]" placeholder="Paste your PoB..." value={pobString} onChange={(e) => setPobString(e.target.value)} />
              </div>
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Advanced Target PoB (Optional)</h2>
                <textarea className="w-full h-40 p-4 bg-slate-950 text-purple-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 font-mono text-[10px]" placeholder="Paste target PoB..." value={targetPobString} onChange={(e) => setTargetPobString(e.target.value)} />
              </div>
            </div>
            <button onClick={handleDecode} disabled={loading || !pobString} className={`w-full mt-6 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg uppercase tracking-widest`}>{loading ? 'Analyzing...' : 'Analyze Builds'}</button>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-700">
            {/* Sidebar */}
            <aside className="lg:col-span-1 space-y-6 text-[12px]">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <h3 className="text-amber-500 font-bold uppercase tracking-wider text-[10px] mb-4">Character Info</h3>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-400 uppercase font-black tracking-tighter">Skill</span><span className="text-white font-black truncate max-w-[60%]">{archetype?.mainSkillName}</span></div>
                  <div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-400 uppercase font-black tracking-tighter">Type</span><span className={`font-black tracking-widest ${archetype?.damageType === 'Chaos' ? 'text-purple-400' : 'text-amber-400'}`}>{archetype?.damageType}</span></div>
                  <div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-400 uppercase font-black tracking-tighter">DPS</span><span className="text-white font-mono font-black">{( (archetype?.totalDPS || 0) / 1000000).toFixed(1)}M</span></div>
                </div>
              </div>
              
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <h3 className="text-amber-500 font-bold uppercase tracking-wider text-[10px] mb-4">Optimization Gaps</h3>
                <div className="space-y-4">
                  {gearComparison.filter(g => !g.isMatched && g.target).map((g, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border-l-4 border-amber-600">
                      <p className="text-[9px] text-slate-500 uppercase font-black mb-1">{g.slot}</p>
                      <p className={`text-[11px] font-black ${getRarityColor(g.target?.rarity || '')}`}>{g.target?.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-12">
              
              {/* TARGET BREAKDOWN SECTION */}
              {targetBuildData && (
                <section className="bg-slate-900 rounded-3xl border border-purple-900/30 shadow-xl overflow-hidden">
                  <button onClick={() => toggleSection('target')} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center shadow-lg text-2xl">🏆</div>
                      <div><h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Target Breakdown</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Surgical View of the Advanced Build</p></div>
                    </div>
                    <span className="text-2xl text-slate-600">{sections.target ? '−' : '+'}</span>
                  </button>
                  {sections.target && (
                    <div className="p-8 pt-0 animate-in slide-in-from-top-4 duration-500">
                      <div className="flex flex-col lg:flex-row gap-8">
                        {/* LEFT: Gear & Flasks */}
                        <div className="flex-1 space-y-8">
                          <div>
                            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Equipment Matrix</h4>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                              {targetAnalyzedItems.filter(i => i.type === 'Gear').map((item, idx) => (
                                <ItemDisplay key={idx} item={item} label={item.slot} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Flask Utility</h4>
                            <div className="flex flex-wrap gap-4 pb-2">
                              {targetAnalyzedItems
                                .filter(i => i.type === 'Flask')
                                .sort((a, b) => {
                                  const numA = parseInt(a.slot.match(/\d+/)?.[0] || '0');
                                  const numB = parseInt(b.slot.match(/\d+/)?.[0] || '0');
                                  return numA - numB;
                                })
                                .map((item, idx) => (
                                  <div key={idx} className="min-w-[80px]"><ItemDisplay item={item} label={item.slot.replace('Flask ', '')} /></div>
                                ))}
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: Unique Jewels & Tree */}
                        <div className="w-full lg:w-[350px] space-y-8 bg-slate-950/30 p-6 rounded-3xl border border-white/5">
                          <div>
                            <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 text-center">Reference Jewels</h4>
                            <div className="grid grid-cols-3 gap-4">
                              {targetAnalyzedItems.filter(i => i.type === 'Jewel').map((item, i) => (
                                <ItemDisplay key={i} item={item} label="Jewel" />
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 text-center">Keystones</h4>
                            <div className="flex flex-wrap justify-center gap-2">
                              {targetKeystones.map((k, i) => <span key={i} className="px-3 py-1 bg-blue-900/20 text-blue-400 rounded-full border border-blue-900/30 text-[9px] font-black uppercase tracking-tighter shadow-sm">{k}</span>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* 1:1 COMPARISON SECTION */}
              {targetBuildData && (
                <section className="bg-slate-900 rounded-3xl border border-amber-900/30 shadow-xl overflow-hidden">
                  <button onClick={() => toggleSection('comparison')} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center shadow-lg text-2xl">⚖️</div>
                      <div><h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Gear Match-Up</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Comparison vs Target Build</p></div>
                    </div>
                    <span className="text-2xl text-slate-600">{sections.comparison ? '−' : '+'}</span>
                  </button>
                  {sections.comparison && (
                    <div className="p-8 pt-0 animate-in slide-in-from-top-4 duration-500">
                      <div className="grid grid-cols-1 gap-4">
                        {gearComparison.map((g, idx) => (
                          <div key={idx} className={`flex items-center gap-8 p-4 bg-slate-950 rounded-[2rem] border transition-all ${g.isMatched ? 'border-green-900/20' : 'border-white/5'}`}>
                            <div className="w-20 text-[10px] font-black text-amber-500 uppercase tracking-tighter text-center">{g.slot}</div>
                            <div className="flex-1 flex justify-between items-center gap-4">
                              <div className="flex-1 flex items-center justify-center gap-12">
                                <ItemDisplay item={g.current} label="My Progress" />
                                <div className={`text-2xl font-black ${g.isMatched ? 'text-green-500/30' : 'text-red-500/30'}`}>→</div>
                                <ItemDisplay item={g.target} label="Target Goal" />
                              </div>
                              <div className="w-32 text-right">
                                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${g.isMatched ? 'text-green-500 bg-green-500/10' : 'text-red-500 bg-red-500/10 animate-pulse'}`}>
                                  {g.isMatched ? 'Matched' : 'Upgrade'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* OPTIMIZATION JOURNEY SECTION */}
              <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
                <button onClick={() => toggleSection('journey')} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center shadow-lg text-2xl">🛤️</div>
                    <div><h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Optimization Journey</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Power Spike Timeline</p></div>
                  </div>
                  <span className="text-2xl text-slate-600">{sections.journey ? '−' : '+'}</span>
                </button>
                {sections.journey && (
                  <div className="p-8 pt-0 space-y-12 pl-12 border-l-2 border-slate-800 ml-14 animate-in slide-in-from-top-4 duration-500 mt-8">
                    {roadmap.map((stage, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-[43px] top-0 w-6 h-6 rounded-full bg-amber-600 border-4 border-slate-900 group-hover:scale-125 transition-transform shadow-lg shadow-amber-900/50"></div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">{stage.focus}</h4>
                        <p className="text-[11px] text-slate-400 mt-2 italic font-medium leading-relaxed bg-slate-950 p-4 rounded-2xl border border-white/5 inline-block">"{stage.description}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* SOCKET LINKS SECTION */}
              <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
                <button onClick={() => toggleSection('sockets')} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg text-2xl">💎</div>
                    <div><h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Socket Links</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gem Configuration Matrix</p></div>
                  </div>
                  <span className="text-2xl text-slate-600">{sections.sockets ? '−' : '+'}</span>
                </button>
                {sections.sockets && (
                  <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
                    {gemGroups.map((group, idx) => (
                      <div key={idx} className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden hover:border-blue-500/30 transition-colors shadow-xl">
                        <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                          <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest">{group.slot}</h4>
                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{group.links} Links</span>
                        </div>
                        <div className="p-5 space-y-3">
                          {group.gems.map((gem, gIdx) => (
                            <div key={gIdx} className="flex justify-between items-center text-[11px] py-1.5 border-b border-white/[0.02] last:border-0"><span className="text-slate-200 font-black">{gem.name}</span><span className="text-slate-600 font-mono font-bold tracking-tighter">LVL {gem.level}</span></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>
          </div>
        )}
      </div>
    </main>
  );
}
