'use client';

import type { SavedPoB } from '@/hooks/useSavedPoBs';

type Props = {
  current: SavedPoB[];
  target: SavedPoB[];
  mode: 'optimize' | 'reverse';
  onLoadCurrent: (pobString: string) => void;
  onLoadTarget: (pobString: string) => void;
  onDeleteCurrent: (id: string) => void;
  onDeleteTarget: (id: string) => void;
};

function PoBCard({
  entry,
  onLoad,
  onDelete,
  loadLabel,
  borderColor,
  loadColor,
}: {
  entry: SavedPoB;
  onLoad: () => void;
  onDelete: () => void;
  loadLabel: string;
  borderColor: string;
  loadColor: string;
}) {
  return (
    <div className={`flex items-center gap-2 p-2.5 bg-slate-950 border ${borderColor} rounded-xl hover:brightness-110 transition-all`}>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-slate-200 truncate">{entry.name}</p>
        <p className="text-[9px] text-slate-600 mt-0.5 font-mono">
          {new Date(entry.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <button
        onClick={onLoad}
        className={`px-2 py-1 text-[9px] font-black uppercase tracking-tight ${loadColor} rounded-lg transition-colors shrink-0`}
      >
        {loadLabel}
      </button>
      <button
        onClick={onDelete}
        className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-[13px] font-bold shrink-0"
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

export default function SavedPoBPanel({
  current,
  target,
  mode,
  onLoadCurrent,
  onLoadTarget,
  onDeleteCurrent,
  onDeleteTarget,
}: Props) {
  const hasAnything = current.length > 0 || target.length > 0;
  if (!hasAnything) return null;

  if (mode === 'reverse') {
    // Merge both lists, newest first, with a single Load action
    const all = [
      ...current.map(e => ({ ...e, slot: 'current' as const })),
      ...target.map(e => ({ ...e, slot: 'target' as const })),
    ].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    return (
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saved PoBs</p>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {all.map(entry => (
            <PoBCard
              key={`${entry.slot}-${entry.id}`}
              entry={entry}
              onLoad={() => entry.slot === 'current' ? onLoadCurrent(entry.pobString) : onLoadTarget(entry.pobString)}
              onDelete={() => entry.slot === 'current' ? onDeleteCurrent(entry.id) : onDeleteTarget(entry.id)}
              loadLabel="Load"
              borderColor="border-purple-900/30 hover:border-purple-800/50"
              loadColor="text-purple-400 bg-purple-900/20 border border-purple-800/30 hover:bg-purple-900/40"
            />
          ))}
        </div>
      </div>
    );
  }

  // Optimize mode: two columns, one per slot
  return (
    <div className="space-y-3 pt-4 border-t border-slate-800">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saved PoBs</p>
      <div className="grid grid-cols-2 gap-4">

        {/* Current / My Builds */}
        <div className="space-y-2">
          <p className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest border-b border-amber-900/20 pb-1">My Builds</p>
          {current.length === 0 ? (
            <p className="text-[10px] text-slate-700 italic px-1">Nothing saved yet</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
              {current.map(entry => (
                <PoBCard
                  key={entry.id}
                  entry={entry}
                  onLoad={() => onLoadCurrent(entry.pobString)}
                  onDelete={() => onDeleteCurrent(entry.id)}
                  loadLabel="Load"
                  borderColor="border-amber-900/25 hover:border-amber-800/40"
                  loadColor="text-amber-400 bg-amber-900/20 border border-amber-800/30 hover:bg-amber-900/40"
                />
              ))}
            </div>
          )}
        </div>

        {/* Target Builds */}
        <div className="space-y-2">
          <p className="text-[9px] font-black text-purple-500/80 uppercase tracking-widest border-b border-purple-900/20 pb-1">Target Builds</p>
          {target.length === 0 ? (
            <p className="text-[10px] text-slate-700 italic px-1">Nothing saved yet</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
              {target.map(entry => (
                <PoBCard
                  key={entry.id}
                  entry={entry}
                  onLoad={() => onLoadTarget(entry.pobString)}
                  onDelete={() => onDeleteTarget(entry.id)}
                  loadLabel="Load"
                  borderColor="border-purple-900/25 hover:border-purple-800/40"
                  loadColor="text-purple-400 bg-purple-900/20 border border-purple-800/30 hover:bg-purple-900/40"
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
