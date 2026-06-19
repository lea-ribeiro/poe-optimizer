'use client';

import type { BuildItem, ModComparison } from '@/lib/item-analyzer';
import type { TreeNodeEntry } from '@/lib/tree-engine';

export function getRarityColor(rarity: string) {
  const r = rarity.toUpperCase();
  if (r === 'UNIQUE') return 'text-[#af6025]';
  if (r === 'RARE') return 'text-[#ffff77]';
  if (r === 'MAGIC') return 'text-[#8888ff]';
  return 'text-white';
}

export function getModColor(mod: string) {
  if (mod.includes('{fractured}')) return 'text-[#5a4b34] font-bold';
  if (mod.includes('{crafted}')) return 'text-[#c1e0f4]';
  return 'text-slate-300';
}

export function cleanMod(mod: string) {
  return mod.replace(/\{.*?\}/g, '').trim();
}

export function ItemDisplay({
  item,
  label,
  tooltipDirection = 'top',
  status = 'none',
}: {
  item?: BuildItem;
  label: string;
  tooltipDirection?: 'top' | 'bottom';
  status?: 'none' | 'incremental' | 'critical';
}) {
  if (!item) {
    return (
      <div className="flex flex-col items-center gap-1 p-2 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 opacity-50 w-full h-full min-h-[110px]">
        <div className="w-12 h-12 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-600">Empty</div>
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter text-center">{label}</p>
      </div>
    );
  }

  const topLabel = item.type === 'Flask' ? `Flask ${label}` : label;
  const tooltipPosition = tooltipDirection === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  let borderStyle = 'border-white/5 bg-slate-950/50';
  let dotColor = '';
  if (status === 'critical') {
    borderStyle = 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)] bg-red-900/5';
    dotColor = 'bg-red-500';
  } else if (status === 'incremental') {
    borderStyle = 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)] bg-amber-900/5';
    dotColor = 'bg-amber-500';
  }

  return (
    <div className={`group relative flex flex-col items-center gap-1 p-2 rounded-xl border hover:border-white/20 hover:z-50 transition-all w-full h-full min-h-[110px] justify-start cursor-help ${borderStyle}`}>
      {status !== 'none' && (
        <div
          className={`absolute -top-1.5 -right-1.5 w-3 h-3 ${dotColor} rounded-full border-2 border-slate-950 z-10 animate-pulse`}
          title={status === 'critical' ? 'Critical Upgrade Needed' : 'Incremental Improvement Available'}
        />
      )}
      {item.icon ? (
        <img src={item.icon} alt={item.name} className="w-12 h-12 object-contain drop-shadow-[0_0_5px_rgba(0,0,0,0.5)] mb-1" />
      ) : (
        <div className="w-12 h-12 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] text-slate-600 mb-1">?</div>
      )}
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter text-center leading-tight line-clamp-1">{topLabel}</p>
      <div className="flex-1 flex items-center justify-center w-full">
        <p className={`text-[11px] font-bold text-center leading-tight line-clamp-2 ${getRarityColor(item.rarity)}`}>{item.name}</p>
      </div>

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
}

type SlotStatus = {
  slot: string;
  current?: BuildItem;
  upgrades: ModComparison[];
};

type BuildPanelProps = {
  title: string;
  subtitle: string;
  icon: string;
  borderColor: string;
  iconBg: string;
  items: BuildItem[];
  keystones: TreeNodeEntry[];
  isOpen: boolean;
  onToggle: () => void;
  equipmentLabel?: string;
  jewelsLabel?: string;
  gearComparison?: SlotStatus[];
};

function getItemStatus(
  slot: string,
  name: string,
  gearComparison?: SlotStatus[],
): 'none' | 'incremental' | 'critical' {
  if (!gearComparison) return 'none';
  const comp = gearComparison.find(g => g.slot === slot || g.current?.name === name);
  if (!comp) return 'none';
  if (comp.upgrades.some(u => u.type === 'Missing')) return 'critical';
  if (comp.upgrades.length > 0) return 'incremental';
  return 'none';
}

export default function BuildPanel({
  title, subtitle, icon, borderColor, iconBg,
  items, keystones, isOpen, onToggle,
  equipmentLabel = 'Active Equipment',
  jewelsLabel = 'Active Jewels',
  gearComparison,
}: BuildPanelProps) {
  const gear = items.filter(i => i.type === 'Gear');
  const flasks = items
    .filter(i => i.type === 'Flask')
    .sort((a, b) => parseInt(a.slot.match(/\d+/)?.[0] || '0') - parseInt(b.slot.match(/\d+/)?.[0] || '0'));
  const jewels = items.filter(i => i.type === 'Jewel');

  return (
    <section className={`bg-slate-900 rounded-3xl border ${borderColor} shadow-xl overflow-visible`}>
      <button onClick={onToggle} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-3xl">
        <div className="flex items-center gap-4 text-left">
          <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center shadow-lg text-2xl`}>{icon}</div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{title}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{subtitle}</p>
          </div>
        </div>
        <span className="text-2xl text-slate-600">{isOpen ? '−' : '+'}</span>
      </button>

      {isOpen && (
        <div className="p-8 pt-0 animate-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-8">
              <div>
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">{equipmentLabel}</h4>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                  {gear.map((item, idx) => (
                    <ItemDisplay
                      key={idx}
                      item={item}
                      label={item.slot}
                      tooltipDirection="bottom"
                      status={getItemStatus(item.slot, item.name, gearComparison)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Flask Utility</h4>
                <div className="flex flex-wrap gap-4 pb-2">
                  {flasks.map((item, idx) => (
                    <div key={idx} className="min-w-[80px]">
                      <ItemDisplay
                        item={item}
                        label={item.slot.replace('Flask ', '')}
                        tooltipDirection="bottom"
                        status={getItemStatus(item.slot, item.name, gearComparison)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[350px] space-y-8 bg-slate-950/30 p-6 rounded-3xl border border-white/5">
              <div>
                <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 text-center">{jewelsLabel}</h4>
                <div className="grid grid-cols-3 gap-4">
                  {jewels.map((item, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <ItemDisplay
                        item={item}
                        label="Jewel"
                        tooltipDirection="bottom"
                        status={getItemStatus(item.slot, item.name, gearComparison)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2 text-center">Keystones</h4>
                <div className="flex flex-wrap justify-center gap-2">
                  {keystones.map((k, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-900/20 text-blue-400 rounded-full border border-blue-900/30 text-[9px] font-black uppercase tracking-tighter shadow-sm">
                      {k.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
