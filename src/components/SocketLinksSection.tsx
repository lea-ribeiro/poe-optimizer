'use client';

import type { GemGroup } from '@/lib/gem-analyzer';

type Props = {
  gemGroups: GemGroup[];
  targetGemGroups: GemGroup[];
  isOpen: boolean;
  onToggle: () => void;
};

export default function SocketLinksSection({ gemGroups, targetGemGroups, isOpen, onToggle }: Props) {
  const allSlots = Array.from(new Set([...gemGroups.map(g => g.slot), ...targetGemGroups.map(g => g.slot)]));

  return (
    <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-visible">
      <button onClick={onToggle} className="w-full p-8 flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-3xl">
        <div className="flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg text-2xl">💎</div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Socket Links</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gem Configuration Matrix</p>
          </div>
        </div>
        <span className="text-2xl text-slate-600">{isOpen ? '−' : '+'}</span>
      </button>

      {isOpen && (
        <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
          {allSlots.map((slot, idx) => {
            const group = gemGroups.find(g => g.slot === slot);
            const targetGroup = targetGemGroups.find(tg => tg.slot === slot);
            const missingGems = targetGroup?.gems.filter(tg => !group?.gems.some(g => g.name.toLowerCase() === tg.name.toLowerCase())) || [];
            const linksGap = targetGroup && group && targetGroup.links > group.links;

            return (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden hover:border-blue-500/30 transition-colors shadow-xl flex flex-col">
                <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                  <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest">{slot}</h4>
                  {linksGap ? (
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-500">{group!.links}</span>
                      <span className="text-amber-500"> → {targetGroup!.links} Links</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{(group || targetGroup)!.links} Links</span>
                  )}
                </div>
                <div className="p-5 space-y-3 flex-1">
                  {!group && (
                    <p className="text-[10px] text-red-400 font-black uppercase tracking-tighter mb-2">You don't have this set up yet</p>
                  )}
                  {(group?.gems || []).map((gem, gIdx) => {
                    const targetGem = targetGroup?.gems.find(tg => tg.name.toLowerCase() === gem.name.toLowerCase());
                    const isUpgrade = targetGem && (targetGem.level > gem.level || targetGem.quality > gem.quality);
                    const displayPrice = isUpgrade ? targetGem?.price : gem.price;

                    return (
                      <div key={gIdx} className="flex flex-col py-1.5 border-b border-white/[0.02] last:border-0">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className={`font-black ${isUpgrade ? 'text-amber-400' : 'text-slate-200'}`}>{gem.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-mono font-bold tracking-tighter">{gem.level}/{gem.quality}%</span>
                            {isUpgrade && (
                              <>
                                <span className="text-amber-500 text-[10px]">→</span>
                                <span className="text-amber-400 font-mono font-bold tracking-tighter">{targetGem.level}/{targetGem.quality}%</span>
                              </>
                            )}
                            {displayPrice && displayPrice > 1 && (
                              <span className="text-[9px] text-amber-500/60 font-mono">~{Math.round(displayPrice)}c</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {missingGems.map((gem, gIdx) => (
                    <div key={`missing-${gIdx}`} className="flex flex-col py-1.5 border-b border-white/[0.02] last:border-0">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-black text-red-400">+ {gem.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-red-400/70 font-mono font-bold tracking-tighter">{gem.level}/{gem.quality}%</span>
                          {gem.price && gem.price > 1 && (
                            <span className="text-[9px] text-amber-500/60 font-mono">~{Math.round(gem.price)}c</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
