'use client';

import { useState } from 'react';
import { processPoB } from '@/lib/pob-decoder';
import { analyzeBuildItems, BuildItem, compareItems, ModComparison } from '@/lib/item-analyzer';
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
    comparison: false,
    journey: false,
    sockets: false
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

  const getModColor = (mod: string) => {
    if (mod.includes('{fractured}')) return 'text-[#5a4b34] font-bold'; // Fractured
    if (mod.includes('{crafted}')) return 'text-[#c1e0f4]'; // Crafted
    return 'text-slate-300';
  };

  const cleanMod = (mod: string) => mod.replace(/\{.*?\}/g, '').trim();

  // 1:1 Gear Comparison Logic
  const standardSlots = ['Weapon', 'Offhand', 'Body Armour', 'Helmet', 'Gloves', 'Boots', 'Amulet', 'Ring 1', 'Ring 2', 'Belt'];
  const jewelSlots = Array.from(new Set([
    ...analyzedItems.filter(i => i.type === 'Jewel').map(i => i.slot),
    ...targetAnalyzedItems.filter(i => i.type === 'Jewel').map(i => i.slot)
  ])).sort();

  const comparisonSlots = [...standardSlots, ...jewelSlots];
  
  const gearComparison = comparisonSlots
    .map(slot => {
      let current = analyzedItems.find(i => i.slot === slot);
      let target = targetAnalyzedItems.find(i => i.slot === slot);

      // Special handling for Jewels: if we have a Jewel slot with no target/current, 
      // try to find a matching jewel by name in the other list to align them
      if (slot.startsWith('Jewel') || slot.includes('Jewel')) {
        if (current && !target) {
          target = targetAnalyzedItems.find(i => i.type === 'Jewel' && i.name.toLowerCase() === current?.name.toLowerCase());
        } else if (target && !current) {
          current = analyzedItems.find(i => i.type === 'Jewel' && i.name.toLowerCase() === target?.name.toLowerCase());
        }
      }

      const isMatched = current && target && (current.name.toLowerCase() === target.name.toLowerCase());
      const mods = compareItems(current, target);
      const upgrades = mods.filter(m => m.type !== 'Match');
      
      return { slot, current, target, isMatched, upgrades };
    })
    .filter((g, index, self) => {
      // Filter out duplicates that might occur due to name-matching logic
      if (!g.current && !g.target) return false;
      
      // If this item was already matched in a previous slot, skip it
      const isDuplicate = self.slice(0, index).some(prev => 
        (g.current && prev.current === g.current) || 
        (g.target && prev.target === g.target)
      );
      
      return !isDuplicate;
    });

  const totalImprovementCost = gearComparison.reduce((sum, g) => {
    if (!g.isMatched && g.target && g.target.estimatedPrice) {
      return sum + g.target.estimatedPrice;
    }
    return sum;
  }, 0) + gemGroups.reduce((sum, group) => {
    const targetGroup = targetGemGroups.find(tg => tg.slot === group.slot);
    if (!targetGroup) return sum;
    
    let groupGemCost = 0;
    group.gems.forEach(gem => {
      const targetGem = targetGroup.gems.find(tg => tg.name.toLowerCase() === gem.name.toLowerCase());
      if (targetGem && (targetGem.level > gem.level || targetGem.quality > gem.quality) && targetGem.price) {
        groupGemCost += targetGem.price;
      }
    });
    return sum + groupGemCost;
  }, 0);

  const ItemDisplay = ({ item, label, tooltipDirection = 'top' }: { item?: BuildItem, label: string, tooltipDirection?: 'top' | 'bottom' }) => {
    if (!item) return <div className="flex flex-col items-center gap-1 p-2 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 opacity-50 w-full"><div className="w-12 h-12 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-600">Empty</div><p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter text-center">{label}</p></div>;
    
    const topLabel = item.type === 'Flask' ? `Flask ${label}` : label;
    const subLabel = item.name;

    const tooltipPosition = tooltipDirection === 'top' 
      ? "bottom-full mb-2" 
      : "top-full mt-2";

    return (
      <div className="group relative flex flex-col items-center gap-1 p-2 bg-slate-950/50 rounded-xl border border-white/5 hover:border-white/20 hover:z-50 transition-all w-full min-h-[100px] justify-start cursor-help">
        {item.icon ? (
          <img src={item.icon} alt={item.name} className="w-12 h-12 object-contain drop-shadow-[0_0_5px_rgba(0,0,0,0.5)] mb-1" />
        ) : (
          <div className="w-12 h-12 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-600 mb-1">?</div>
        )}
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter text-center leading-tight line-clamp-1">{topLabel}</p>
        <p className={`text-[11px] font-bold text-center leading-tight line-clamp-2 mt-0.5 ${getRarityColor(item.rarity)}`}>
          {subLabel}
        </p>

        {/* TOOLTIP */}
        <div className={`absolute z-[100] ${tooltipPosition} left-1/2 -translate-x-1/2 w-80 p-5 bg-slate-950 border border-slate-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 pointer-events-none transition-all scale-95 group-hover:scale-100 ring-1 ring-white/10`}>
          <div className="space-y-4">
            <div className="border-b border-white/10 pb-2 text-center">
              <p className={`text-base font-black uppercase tracking-tight ${getRarityColor(item.rarity)}`}>{item.name}</p>
              <p className="text-[11px] text-slate-500 font-bold uppercase">{item.rarity} {item.slot}</p>
            </div>

            {item.implicits && item.implicits.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-blue-400/10 w-fit">Implicits</p>
                {item.implicits.map((m, i) => <p key={i} className="text-[14px] text-blue-100 leading-snug">{cleanMod(m)}</p>)}
              </div>
            )}

            {((item.prefixes?.length || 0) > 0 || (item.suffixes?.length || 0) > 0) && (
              <div className="space-y-4">
                {(item.prefixes?.length || 0) > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest border-b border-amber-500/10 w-fit">Prefixes</p>
                    {item.prefixes?.map((p, i) => <p key={i} className={`text-[14px] leading-snug italic ${getModColor(p)}`}>• {cleanMod(p)}</p>)}
                  </div>
                )}
                {(item.suffixes?.length || 0) > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-purple-500/70 uppercase tracking-widest border-b border-purple-500/10 w-fit">Suffixes</p>
                    {item.suffixes?.map((s, i) => <p key={i} className={`text-[14px] leading-snug italic ${getModColor(s)}`}>• {cleanMod(s)}</p>)}
                  </div>
                )}
              </div>
            )}

            {item.explicits && item.explicits.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modifiers</p>
                {item.explicits.map((m, i) => <p key={i} className={`text-[14px] leading-snug ${getModColor(m)}`}>{cleanMod(m)}</p>)}
              </div>
            )}

            {item.debugInfo && (
              <div className="pt-2 border-t border-white/5 opacity-30 hover:opacity-100 transition-opacity">
                <p className="text-[8px] font-mono text-slate-600 break-all">{item.debugInfo}</p>
              </div>
            )}
          </div>
        </div>
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
            <aside className="lg:col-span-1 space-y-6 text-[12px] relative z-0">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <h3 className="text-amber-500 font-bold uppercase tracking-wider text-[10px] mb-4">Character Info</h3>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-400 uppercase font-black tracking-tighter">Skill</span><span className="text-white font-black truncate max-w-[60%]">{archetype?.mainSkillName}</span></div>
                  <div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-400 uppercase font-black tracking-tighter">Type</span><span className={`font-black tracking-widest ${archetype?.damageType === 'Chaos' ? 'text-purple-400' : 'text-amber-400'}`}>{archetype?.damageType}</span></div>
                  <div className="flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-400 uppercase font-black tracking-tighter">DPS</span><span className="text-white font-mono font-black">{( (archetype?.totalDPS || 0) / 1000000).toFixed(1)}M</span></div>
                </div>
              </div>

              {targetBuildData && totalImprovementCost > 0 && (
                <div className="bg-slate-900 p-6 rounded-2xl border border-amber-500/30 shadow-xl bg-gradient-to-br from-slate-900 to-amber-900/10">
                  <h3 className="text-amber-500 font-bold uppercase tracking-wider text-[10px] mb-4">Total Improvement Cost</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white">{Math.round(totalImprovementCost).toLocaleString()}</span>
                    <span className="text-amber-500 font-bold uppercase text-[10px]">Chaos</span>
                  </div>
                  {totalImprovementCost > 150 && (
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">
                      ≈ { (totalImprovementCost / 150).toFixed(1) } Divine Orbs
                    </p>
                  )}
                </div>
              )}
              
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <h3 className="text-amber-500 font-bold uppercase tracking-wider text-[10px] mb-4">Optimization Gaps</h3>
                <div className="space-y-4">
                  {gearComparison.filter(g => !g.isMatched && g.target).map((g, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border-l-4 border-amber-600">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[9px] text-slate-500 uppercase font-black">{g.slot}</p>
                        {g.target?.estimatedPrice && g.target.estimatedPrice > 10 && (
                          <span className="text-[10px] text-amber-500 font-black">~{Math.round(g.target.estimatedPrice)}c</span>
                        )}
                      </div>
                      <p className={`text-[11px] font-black ${getRarityColor(g.target?.rarity || '')}`}>{g.target?.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-12 relative z-10">
              
              {/* TARGET BREAKDOWN SECTION */}
              {targetBuildData && (
                <section className="bg-slate-900 rounded-3xl border border-purple-900/30 shadow-xl overflow-visible">
                  <button onClick={() => toggleSection('target')} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-3xl">
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
                              {targetAnalyzedItems
                                .filter(i => i.type === 'Gear')
                                .map((item, idx) => (
                                  <ItemDisplay key={idx} item={item} label={item.slot} tooltipDirection="bottom" />
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
                                  <div key={idx} className="min-w-[80px]"><ItemDisplay item={item} label={item.slot.replace('Flask ', '')} tooltipDirection="bottom" /></div>
                                ))}
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: Unique Jewels & Tree */}
                        <div className="w-full lg:w-[350px] space-y-8 bg-slate-950/30 p-6 rounded-3xl border border-white/5">
                          <div>
                            <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 text-center">Reference Jewels</h4>
                            <div className="grid grid-cols-3 gap-4">
                              {targetAnalyzedItems
                                .filter(i => i.type === 'Jewel')
                                .map((item, i) => (
                                  <div key={i} className="flex flex-col items-center">
                                    <ItemDisplay item={item} label="Jewel" tooltipDirection="bottom" />
                                  </div>
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
                <section className="bg-slate-900 rounded-3xl border border-amber-900/30 shadow-xl overflow-visible">
                  <button onClick={() => toggleSection('comparison')} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-3xl">
                    <div className="flex items-center gap-4 text-left">
                      <div className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center shadow-lg text-2xl">⚖️</div>
                      <div><h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Gear Match-Up</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Surgical Mod Comparison</p></div>
                    </div>
                    <span className="text-2xl text-slate-600">{sections.comparison ? '−' : '+'}</span>
                  </button>
                  {sections.comparison && (
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
                            
                            {/* MOD COMPARISON LIST */}
                            {g.upgrades.length > 0 && (
                              <div className="mt-4 pt-6 border-t border-white/5 space-y-6">
                                {/* UNIQUE TRANSITION CASE */}
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
                                    {/* PRIORITY: MISSING MODS */}
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

                                    {/* OPTIMIZATIONS: TIER/VALUE UPGRADES */}
                                    {g.upgrades.filter(u => u.type !== 'Missing').length > 0 && (
                                      <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Performance: Stat Upgrades (+5 points min)</p>
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
              )}

              {/* OPTIMIZATION JOURNEY SECTION */}
              <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-visible">
                <button onClick={() => toggleSection('journey')} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-3xl">
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
              <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-visible">
                <button onClick={() => toggleSection('sockets')} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-3xl">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg text-2xl">💎</div>
                    <div><h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Socket Links</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gem Configuration Matrix</p></div>
                  </div>
                  <span className="text-2xl text-slate-600">{sections.sockets ? '−' : '+'}</span>
                </button>
                {sections.sockets && (
                  <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
                    {gemGroups.map((group, idx) => {
                      const targetGroup = targetGemGroups.find(tg => tg.slot === group.slot);
                      
                      return (
                        <div key={idx} className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden hover:border-blue-500/30 transition-colors shadow-xl flex flex-col">
                          <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                            <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest">{group.slot}</h4>
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{group.links} Links</span>
                          </div>
                          <div className="p-5 space-y-3 flex-1">
                            {group.gems.map((gem, gIdx) => {
                              const targetGem = targetGroup?.gems.find(tg => tg.name.toLowerCase() === gem.name.toLowerCase());
                              const isUpgrade = targetGem && (targetGem.level > gem.level || targetGem.quality > gem.quality);

                              return (
                                <div key={gIdx} className="flex flex-col py-1.5 border-b border-white/[0.02] last:border-0">
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className={`font-black ${isUpgrade ? 'text-amber-400' : 'text-slate-200'}`}>{gem.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-600 font-mono font-bold tracking-tighter">
                                        {gem.level}/{gem.quality}%
                                      </span>
                                      {isUpgrade && (
                                        <>
                                          <span className="text-amber-500 text-[10px]">→</span>
                                          <span className="text-amber-400 font-mono font-bold tracking-tighter">
                                            {targetGem.level}/{targetGem.quality}%
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
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
