'use client';

import { useState, useEffect } from 'react';
import { processPoB } from '@/lib/pob-decoder';
import { analyzeBuildItems, BuildItem, compareItems, ModComparison } from '@/lib/item-analyzer';
import { getActiveNodeIds, getKeystones, compareTrees, TreeNodeEntry, TreeDiffResult, getMasterySelections, compareMasterySelections, MasteryDiffEntry, generateBFSTreeRoadmap, ReverseStage, compareClusterJewelNotables, ClusterJewelDiff } from '@/lib/tree-engine';
import { getTreeNodeMap, TreeNodeMap } from '@/lib/tree-data';
import ReverseEngineerPanel from '@/components/ReverseEngineerPanel';
import { analyzeBuildArchetype, BuildArchetype } from '@/lib/pob-analyzer';
import { analyzeBuildGems, GemGroup } from '@/lib/gem-analyzer';
import { useSavedPoBs } from '@/hooks/useSavedPoBs';
import SavedPoBPanel from '@/components/SavedPoBPanel';
import BuildPanel, { getRarityColor } from '@/components/BuildPanel';
import GearMatchUpSection from '@/components/GearMatchUpSection';
import TreeComparisonSection from '@/components/TreeComparisonSection';
import SocketLinksSection from '@/components/SocketLinksSection';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'optimize' | 'reverse'>('optimize');

  // ── Saved PoB management ─────────────────────────────────────────────────
  const { current: savedCurrent, target: savedTarget, save, remove } = useSavedPoBs();
  const [savingSlot, setSavingSlot] = useState<'current' | 'target' | 'reverse' | null>(null);
  const [saveName, setSaveName] = useState('');

  // ── League selection & live divine orb rate ──────────────────────────────
  const [selectedLeague, setSelectedLeague] = useState('');
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  const [divineRate, setDivineRate] = useState(150);

  // On mount: fetch current league + full league list in parallel
  useEffect(() => {
    Promise.all([
      fetch('/api/league').then(r => r.json()),
      fetch('/api/leagues').then(r => r.json()),
    ]).then(([leagueData, leaguesData]) => {
      const current = leagueData.league || 'Standard';
      const list: string[] = leaguesData.leagues || [current];
      setSelectedLeague(current);
      setAvailableLeagues(list.length ? list : [current]);
    }).catch(() => {
      setSelectedLeague('Standard');
      setAvailableLeagues(['Standard']);
    });
  }, []);

  // Re-fetch divine rate whenever the selected league changes
  useEffect(() => {
    if (!selectedLeague) return;
    fetch(`/api/divine-rate?league=${encodeURIComponent(selectedLeague)}`)
      .then(r => r.json())
      .then(data => { if (data.rate > 0) setDivineRate(data.rate); })
      .catch(() => {});
  }, [selectedLeague]);

  // ── Optimize mode state ──────────────────────────────────────────────────
  const [pobString, setPobString] = useState('');
  const [targetPobString, setTargetPobString] = useState('');

  const [buildData, setBuildData] = useState<any>(null);
  const [targetBuildData, setTargetBuildData] = useState<any>(null);
  const [analyzedItems, setAnalyzedItems] = useState<BuildItem[]>([]);
  const [targetAnalyzedItems, setTargetAnalyzedItems] = useState<BuildItem[]>([]);
  const [archetype, setArchetype] = useState<BuildArchetype | null>(null);
  const [targetArchetype, setTargetArchetype] = useState<BuildArchetype | null>(null);
  const [gemGroups, setGemGroups] = useState<GemGroup[]>([]);
  const [targetGemGroups, setTargetGemGroups] = useState<GemGroup[]>([]);

  const [currentKeystones, setCurrentKeystones] = useState<TreeNodeEntry[]>([]);
  const [targetKeystones, setTargetKeystones] = useState<TreeNodeEntry[]>([]);
  const [treeDiff, setTreeDiff] = useState<TreeDiffResult | null>(null);
  const [masteryDiff, setMasteryDiff] = useState<MasteryDiffEntry[]>([]);
  const [clusterDiff, setClusterDiff] = useState<ClusterJewelDiff | null>(null);
  const [budget, setBudget] = useState(0);
  const [treeNodeMap, setTreeNodeMap] = useState<TreeNodeMap>({});
  const [currentNodeIds, setCurrentNodeIds] = useState<string[]>([]);
  const [targetNodeIds, setTargetNodeIds] = useState<string[]>([]);

  // UI Expansion States
  const [sections, setSections] = useState({
    current: false,
    target: false,
    comparison: false,
    tree: false,
    sockets: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Reverse mode state ───────────────────────────────────────────────────
  const [reversePobString, setReversePobString] = useState('');
  const [reverseAnalyzed, setReverseAnalyzed] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [reverseClassName, setReverseClassName] = useState('');
  const [reverseAscendancyName, setReverseAscendancyName] = useState('');
  const [reverseBuildLevel, setReverseBuildLevel] = useState(0);
  const [reverseArchetype, setReverseArchetype] = useState<BuildArchetype | null>(null);
  const [reverseItems, setReverseItems] = useState<BuildItem[]>([]);
  const [reverseGemGroups, setReverseGemGroups] = useState<GemGroup[]>([]);
  const [reverseStages, setReverseStages] = useState<ReverseStage[]>([]);

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDecode = async () => {
    setLoading(true);
    setError(null);
    try {
      const treeNodeMap = await getTreeNodeMap();
      setTreeNodeMap(treeNodeMap);

      const result = await processPoB(pobString);
      setBuildData(result);
      const arch = analyzeBuildArchetype(result);
      setArchetype(arch);
      const currentItems = await analyzeBuildItems(result, arch.mainSkillName);
      setAnalyzedItems(currentItems);
      setGemGroups(await analyzeBuildGems(result));

      const currentIds = getActiveNodeIds(result);
      setCurrentNodeIds(currentIds);
      setCurrentKeystones(getKeystones(currentIds, treeNodeMap));

      if (targetPobString) {
        const tResult = await processPoB(targetPobString);
        setTargetBuildData(tResult);
        const tArch = analyzeBuildArchetype(tResult);
        setTargetArchetype(tArch);
        const tItems = await analyzeBuildItems(tResult, tArch.mainSkillName);
        setTargetAnalyzedItems(tItems);
        setTargetGemGroups(await analyzeBuildGems(tResult));

        const targetIds = getActiveNodeIds(tResult);
        setTargetNodeIds(targetIds);
        setTargetKeystones(getKeystones(targetIds, treeNodeMap));
        setTreeDiff(compareTrees(currentIds, targetIds, treeNodeMap));
        setMasteryDiff(compareMasterySelections(
          currentIds, targetIds,
          getMasterySelections(result), getMasterySelections(tResult),
          treeNodeMap
        ));
        setClusterDiff(compareClusterJewelNotables(result, tResult));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process build string.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetOptimize = () => {
    setBuildData(null);
    setTargetBuildData(null);
    setAnalyzedItems([]);
    setTargetAnalyzedItems([]);
    setArchetype(null);
    setTargetArchetype(null);
    setGemGroups([]);
    setTargetGemGroups([]);
    setCurrentKeystones([]);
    setTargetKeystones([]);
    setTreeDiff(null);
    setMasteryDiff([]);
    setClusterDiff(null);
    setCurrentNodeIds([]);
    setTargetNodeIds([]);
  };

  const handleReverseAnalyze = async () => {
    setReverseLoading(true);
    setReverseError(null);
    try {
      const nodeMap = await getTreeNodeMap();
      setTreeNodeMap(nodeMap);

      const result = await processPoB(reversePobString);
      const arch = analyzeBuildArchetype(result);
      setReverseArchetype(arch);

      const items = await analyzeBuildItems(result, arch.mainSkillName);
      setReverseItems(items);

      const gems = await analyzeBuildGems(result);
      setReverseGemGroups(gems);

      setReverseClassName(result.PathOfBuilding?.Build?.[0]?.$.className ?? '');
      setReverseAscendancyName(result.PathOfBuilding?.Build?.[0]?.$.ascendClassName ?? '');
      setReverseBuildLevel(parseInt(result.PathOfBuilding?.Build?.[0]?.$.level ?? '100'));

      setReverseStages(generateBFSTreeRoadmap(result, nodeMap));
      setReverseAnalyzed(true);
    } catch (err: any) {
      setReverseError(err.message || 'Failed to process PoB string.');
    } finally {
      setReverseLoading(false);
    }
  };

  // 1:1 Gear Comparison Logic
  const standardSlots = ['Weapon', 'Offhand', 'Weapon Swap', 'Offhand Swap', 'Body Armour', 'Helmet', 'Gloves', 'Boots', 'Amulet', 'Ring 1', 'Ring 2', 'Belt'];
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

      const isMatched = !!(current && target && current.name.toLowerCase() === target.name.toLowerCase());
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans text-[13px]">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600 tracking-tight">PoE Optimizer</h1>
          <p className="text-slate-400 text-lg">Precision Build Analysis & Comparison</p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Pricing league</span>
            {availableLeagues.length > 0 ? (
              <select
                value={selectedLeague}
                onChange={e => setSelectedLeague(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-black rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer hover:border-slate-500 transition-colors"
              >
                {availableLeagues.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-black text-slate-500 animate-pulse">Loading…</span>
            )}
            {divineRate !== 150 && selectedLeague && (
              <span className="text-[10px] font-mono text-amber-500/60">1 divine = {divineRate}c</span>
            )}
          </div>
        </header>

        {/* Tab Bar */}
        <div className="flex gap-2 border-b border-slate-800 pb-0 max-w-4xl mx-auto">
          <button
            onClick={() => setActiveTab('optimize')}
            className={`px-6 py-3 font-black uppercase tracking-widest text-[11px] rounded-t-xl transition-colors ${
              activeTab === 'optimize'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            ⚡ Optimize
          </button>
          <button
            onClick={() => setActiveTab('reverse')}
            className={`px-6 py-3 font-black uppercase tracking-widest text-[11px] rounded-t-xl transition-colors ${
              activeTab === 'reverse'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            🔄 Reverse Engineer
          </button>
        </div>

        {activeTab === 'optimize' && (!buildData ? (
          <section className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl max-w-4xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">My Current PoB</h2>
                  {pobString && (
                    <button onClick={() => { setSavingSlot(savingSlot === 'current' ? null : 'current'); setSaveName(''); }} className="text-[9px] font-black uppercase tracking-tight text-amber-500/70 hover:text-amber-400 transition-colors">
                      {savingSlot === 'current' ? 'Cancel' : '+ Save'}
                    </button>
                  )}
                </div>
                <textarea className="w-full h-40 p-4 bg-slate-950 text-amber-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 font-mono text-[10px]" placeholder="Paste your PoB..." value={pobString} onChange={(e) => setPobString(e.target.value)} />
                {savingSlot === 'current' && (
                  <div className="flex gap-2 items-center">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Name (optional)"
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { save(pobString, saveName, 'current'); setSavingSlot(null); setSaveName(''); }
                        if (e.key === 'Escape') { setSavingSlot(null); setSaveName(''); }
                      }}
                    />
                    <button onClick={() => { save(pobString, saveName, 'current'); setSavingSlot(null); setSaveName(''); }} className="px-3 py-1.5 text-[10px] font-black uppercase text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded-lg hover:bg-amber-900/40 transition-colors">Save</button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Target PoB (Optional)</h2>
                  {targetPobString && (
                    <button onClick={() => { setSavingSlot(savingSlot === 'target' ? null : 'target'); setSaveName(''); }} className="text-[9px] font-black uppercase tracking-tight text-purple-500/70 hover:text-purple-400 transition-colors">
                      {savingSlot === 'target' ? 'Cancel' : '+ Save'}
                    </button>
                  )}
                </div>
                <textarea className="w-full h-40 p-4 bg-slate-950 text-purple-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 font-mono text-[10px]" placeholder="Paste target PoB..." value={targetPobString} onChange={(e) => setTargetPobString(e.target.value)} />
                {savingSlot === 'target' && (
                  <div className="flex gap-2 items-center">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Name (optional)"
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { save(targetPobString, saveName, 'target'); setSavingSlot(null); setSaveName(''); }
                        if (e.key === 'Escape') { setSavingSlot(null); setSaveName(''); }
                      }}
                    />
                    <button onClick={() => { save(targetPobString, saveName, 'target'); setSavingSlot(null); setSaveName(''); }} className="px-3 py-1.5 text-[10px] font-black uppercase text-purple-400 bg-purple-900/20 border border-purple-800/30 rounded-lg hover:bg-purple-900/40 transition-colors">Save</button>
                  </div>
                )}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm font-bold bg-red-900/10 border border-red-900/30 rounded-xl px-4 py-3">{error}</p>}
            <button onClick={handleDecode} disabled={loading || !pobString} className="w-full py-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg uppercase tracking-widest transition-colors">{loading ? 'Analyzing...' : 'Analyze Builds'}</button>
            <SavedPoBPanel
              current={savedCurrent}
              target={savedTarget}
              mode="optimize"
              onLoadCurrent={str => setPobString(str)}
              onLoadTarget={str => setTargetPobString(str)}
              onDeleteCurrent={id => remove(id, 'current')}
              onDeleteTarget={id => remove(id, 'target')}
            />
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in duration-700">
            {/* Reset button */}
            <div className="lg:col-span-4 flex justify-end">
              <button
                onClick={handleResetOptimize}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                ← Analyze New Build
              </button>
            </div>
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
                  {totalImprovementCost > divineRate && (
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">
                      ≈ {(totalImprovementCost / divineRate).toFixed(1)} Divine Orbs
                      <span className="text-slate-600 ml-1">({divineRate}c each)</span>
                    </p>
                  )}
                </div>
              )}
              
              {targetBuildData && (
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                  <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-3">Budget Filter</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="No limit"
                      value={budget || ''}
                      onChange={e => setBudget(Number(e.target.value))}
                      className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                    />
                    <span className="text-[10px] text-slate-500 font-bold shrink-0">divine</span>
                  </div>
                  {budget > 0 && (
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] text-slate-600">≈ {Math.round(budget * divineRate).toLocaleString()}c</span>
                      <button onClick={() => setBudget(0)} className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                <h3 className="text-amber-500 font-bold uppercase tracking-wider text-[10px] mb-4">Optimization Gaps</h3>
                <div className="space-y-3">
                  {(() => {
                    const getPriority = (g: typeof gearComparison[0]) => {
                      const missingCount = g.upgrades.filter(u => u.type === 'Missing').length;
                      const isTargetUnique = (g.target?.rarity ?? '').toUpperCase() === 'UNIQUE';
                      // Critical: need a completely different item (empty slot, unique swap, or 4+ missing mods)
                      if (!g.current || isTargetUnique || missingCount >= 4) return 3;
                      // Priority: notably different item (2-3 significant missing mods)
                      if (missingCount >= 2) return 2;
                      return 1;
                    };
                    const budgetChaos = budget * divineRate;
                    const gapItems = gearComparison
                      .filter(g => !g.isMatched && g.target)
                      .filter(g => budget === 0 || !g.target?.estimatedPrice || g.target.estimatedPrice <= budgetChaos)
                      .sort((a, b) => {
                        const pd = getPriority(b) - getPriority(a);
                        if (pd !== 0) return pd;
                        return (b.target?.estimatedPrice || 0) - (a.target?.estimatedPrice || 0);
                      });
                    if (gapItems.length === 0) {
                      return <p className="text-[11px] text-slate-600 italic">{budget > 0 ? `No upgrades within ${budget} divine.` : 'No gaps detected.'}</p>;
                    }
                    return gapItems.map((g, idx) => {
                      const priority = getPriority(g);
                      const isTopCritical = idx === 0 && priority === 3;
                      const borderCls = priority === 3 ? 'border-red-600' : priority === 2 ? 'border-amber-500' : 'border-slate-700';
                      const badgeCls = priority === 3
                        ? 'text-red-400 bg-red-900/20 border-red-800/30'
                        : priority === 2
                          ? 'text-amber-400 bg-amber-900/20 border-amber-800/30'
                          : 'text-yellow-600 bg-yellow-900/10 border-yellow-800/20';
                      const badgeLabel = priority === 3 ? 'CRITICAL' : priority === 2 ? 'PRIORITY' : 'UPGRADE';
                      return (
                        <div key={idx} className={`p-3 bg-slate-950 rounded-lg border-l-4 ${borderCls}`}>
                          <div className="flex justify-between items-start mb-1 gap-1 flex-wrap">
                            <p className="text-[9px] text-slate-500 uppercase font-black shrink-0">{g.slot}</p>
                            <div className="flex items-center gap-1 flex-wrap justify-end">
                              {isTopCritical && (
                                <span className="text-[8px] font-black uppercase tracking-tight text-red-300 bg-red-900/30 border border-red-800/30 px-1.5 py-0.5 rounded-full">⚠ TOP PRIORITY</span>
                              )}
                              <span className={`text-[8px] font-black uppercase tracking-tight border px-1.5 py-0.5 rounded-full ${badgeCls}`}>{badgeLabel}</span>
                              {g.target?.estimatedPrice && g.target.estimatedPrice > 10 && (
                                <span className="text-[10px] text-amber-500 font-black">~{Math.round(g.target.estimatedPrice)}c</span>
                              )}
                            </div>
                          </div>
                          <p className={`text-[11px] font-black ${getRarityColor(g.target?.rarity || '')}`}>{g.target?.name}</p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-12 relative z-10">
              
              {/* CURRENT / TARGET BUILD PANELS */}
              {buildData && (
                <BuildPanel
                  title="Current Status"
                  subtitle="Snapshot of Your Active Build"
                  icon="🛡️"
                  borderColor="border-blue-900/30"
                  iconBg="bg-blue-600"
                  items={analyzedItems}
                  keystones={currentKeystones}
                  isOpen={sections.current}
                  onToggle={() => toggleSection('current')}
                  equipmentLabel="Active Equipment"
                  jewelsLabel="Active Jewels"
                  gearComparison={gearComparison}
                />
              )}
              {targetBuildData && (
                <BuildPanel
                  title="Target Breakdown"
                  subtitle="Surgical View of the Advanced Build"
                  icon="🏆"
                  borderColor="border-purple-900/30"
                  iconBg="bg-purple-600"
                  items={targetAnalyzedItems}
                  keystones={targetKeystones}
                  isOpen={sections.target}
                  onToggle={() => toggleSection('target')}
                  equipmentLabel="Equipment Matrix"
                  jewelsLabel="Reference Jewels"
                />
              )}

              {/* 1:1 COMPARISON SECTION */}
              {targetBuildData && (
                <GearMatchUpSection
                  gearComparison={gearComparison}
                  isOpen={sections.comparison}
                  onToggle={() => toggleSection('comparison')}
                />
              )}

              {/* TREE COMPARISON SECTION */}
              {targetBuildData && treeDiff && (
                <TreeComparisonSection
                  treeDiff={treeDiff}
                  treeNodeMap={treeNodeMap}
                  currentNodeIds={currentNodeIds}
                  targetNodeIds={targetNodeIds}
                  masteryDiff={masteryDiff}
                  clusterDiff={clusterDiff}
                  isOpen={sections.tree}
                  onToggle={() => toggleSection('tree')}
                />
              )}

              {/* SOCKET LINKS SECTION */}
              <SocketLinksSection
                gemGroups={gemGroups}
                targetGemGroups={targetGemGroups}
                isOpen={sections.sockets}
                onToggle={() => toggleSection('sockets')}
              />

            </div>
          </div>
        ))}

        {/* ── Reverse Engineer Tab ────────────────────────────────────────── */}
        {activeTab === 'reverse' && (
          <div className="max-w-7xl mx-auto">
            {!reverseAnalyzed ? (
              <section className="bg-slate-900 p-8 rounded-2xl border border-purple-900/30 shadow-2xl max-w-2xl mx-auto space-y-4">
                <div className="space-y-2">
                  <h2 className="text-lg font-black text-white uppercase tracking-tight">Endgame PoB</h2>
                  <p className="text-slate-400 text-sm">
                    Paste a level 95–100 endgame Path of Building export (e.g. from a guide) and we'll
                    reverse-engineer a leveling roadmap: which passive nodes to take at each campaign
                    milestone, which unique items to acquire, and the final gem setup to build toward.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PoB String</span>
                    {reversePobString && (
                      <button onClick={() => { setSavingSlot(savingSlot === 'reverse' ? null : 'reverse'); setSaveName(''); }} className="text-[9px] font-black uppercase tracking-tight text-purple-500/70 hover:text-purple-400 transition-colors">
                        {savingSlot === 'reverse' ? 'Cancel' : '+ Save'}
                      </button>
                    )}
                  </div>
                  <textarea
                    className="w-full h-48 p-4 bg-slate-950 text-purple-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 font-mono text-[10px] resize-none"
                    placeholder="Paste endgame PoB string here..."
                    value={reversePobString}
                    onChange={e => setReversePobString(e.target.value)}
                  />
                  {savingSlot === 'reverse' && (
                    <div className="flex gap-2 items-center">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Name (optional)"
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        value={saveName}
                        onChange={e => setSaveName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { save(reversePobString, saveName, 'current'); setSavingSlot(null); setSaveName(''); }
                          if (e.key === 'Escape') { setSavingSlot(null); setSaveName(''); }
                        }}
                      />
                      <button onClick={() => { save(reversePobString, saveName, 'current'); setSavingSlot(null); setSaveName(''); }} className="px-3 py-1.5 text-[10px] font-black uppercase text-purple-400 bg-purple-900/20 border border-purple-800/30 rounded-lg hover:bg-purple-900/40 transition-colors">Save</button>
                    </div>
                  )}
                </div>
                {reverseError && (
                  <p className="text-red-400 text-sm font-bold bg-red-900/10 border border-red-900/30 rounded-xl px-4 py-3">
                    {reverseError}
                  </p>
                )}
                <button
                  onClick={handleReverseAnalyze}
                  disabled={reverseLoading || !reversePobString}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-black rounded-xl shadow-lg uppercase tracking-widest transition-colors"
                >
                  {reverseLoading ? 'Analyzing...' : 'Generate Leveling Roadmap'}
                </button>
                <SavedPoBPanel
                  current={savedCurrent}
                  target={savedTarget}
                  mode="reverse"
                  onLoadCurrent={str => setReversePobString(str)}
                  onLoadTarget={str => setReversePobString(str)}
                  onDeleteCurrent={id => remove(id, 'current')}
                  onDeleteTarget={id => remove(id, 'target')}
                />
              </section>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    onClick={() => { setReverseAnalyzed(false); setReverseStages([]); }}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    ← Analyze New Build
                  </button>
                </div>
                {reverseArchetype && (
                  <ReverseEngineerPanel
                    className={reverseClassName}
                    ascendancyName={reverseAscendancyName}
                    buildLevel={reverseBuildLevel}
                    archetype={reverseArchetype}
                    items={reverseItems}
                    gemGroups={reverseGemGroups}
                    stages={reverseStages}
                    nodeMap={treeNodeMap}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
