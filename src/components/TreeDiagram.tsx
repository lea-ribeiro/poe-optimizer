'use client';

import { useMemo, useRef } from 'react';
import { TreeNodeMap } from '@/lib/tree-data';

type Status = 'shared' | 'add' | 'remove';

type Props = {
  nodeMap: TreeNodeMap;
  currentIds: string[];
  targetIds: string[];
};

const STATUS_COLOR: Record<Status, string> = {
  shared: '#60a5fa', // blue-400
  add: '#4ade80',    // green-400
  remove: '#f87171', // red-400
};

const PADDING = 400;
const BG_NODE_R = 16;
const BG_EDGE_COLOR = '#1e293b';
const BIG_NODE_TYPES = new Set(['Keystone', 'Notable', 'Ascendancy']);

function statusOf(id: string, currentSet: Set<string>, targetSet: Set<string>): Status | null {
  const inCurrent = currentSet.has(id);
  const inTarget = targetSet.has(id);
  if (inCurrent && inTarget) return 'shared';
  if (inTarget) return 'add';
  if (inCurrent) return 'remove';
  return null;
}

/**
 * Renders allocated-node subgraph(s) (main tree + any ascendancies involved) at their real
 * in-game positions, with a dim full-tree backdrop for orientation and the current/target
 * diff highlighted on top. Pan/zoom is done by mutating a <g transform> via refs instead of
 * React state, so dragging doesn't re-render the few thousand background nodes/edges.
 */
export default function TreeDiagram({ nodeMap, currentIds, targetIds }: Props) {
  const currentSet = useMemo(() => new Set(currentIds), [currentIds]);
  const targetSet = useMemo(() => new Set(targetIds), [targetIds]);

  const { mainEntries, ascendancyGroups } = useMemo(() => {
    const main: [string, TreeNodeMap[string]][] = [];
    const asc: Map<string, [string, TreeNodeMap[string]][]> = new Map();

    Object.entries(nodeMap).forEach(([id, info]) => {
      if (info.type === 'Ascendancy' && info.ascendancyName) {
        const list = asc.get(info.ascendancyName) || [];
        list.push([id, info]);
        asc.set(info.ascendancyName, list);
      } else if (info.type !== 'Ascendancy') {
        main.push([id, info]);
      }
    });

    // Only keep ascendancies actually relevant to either build, to avoid rendering every
    // ascendancy in the game for no reason.
    const relevantAsc = new Map<string, [string, TreeNodeMap[string]][]>();
    asc.forEach((list, name) => {
      const isRelevant = list.some(([id]) => currentSet.has(id) || targetSet.has(id));
      if (isRelevant) relevantAsc.set(name, list);
    });

    return { mainEntries: main, ascendancyGroups: relevantAsc };
  }, [nodeMap, currentSet, targetSet]);

  return (
    <div className="space-y-8">
      <TreePanel
        title="Passive Tree"
        entries={mainEntries}
        currentSet={currentSet}
        targetSet={targetSet}
        focusOnHighlighted
      />
      {Array.from(ascendancyGroups.entries()).map(([name, entries]) => (
        <TreePanel
          key={name}
          title={`Ascendancy: ${name}`}
          entries={entries}
          currentSet={currentSet}
          targetSet={targetSet}
          focusOnHighlighted={false}
        />
      ))}
    </div>
  );
}

function TreePanel({ title, entries, currentSet, targetSet, focusOnHighlighted }: {
  title: string;
  entries: [string, TreeNodeMap[string]][];
  currentSet: Set<string>;
  targetSet: Set<string>;
  focusOnHighlighted: boolean;
}) {
  const gRef = useRef<SVGGElement>(null);
  const transform = useRef({ x: 0, y: 0, scale: 1 });
  const dragState = useRef<{ startX: number, startY: number, origX: number, origY: number } | null>(null);

  const applyTransform = () => {
    const g = gRef.current;
    if (!g) return;
    const { x, y, scale } = transform.current;
    g.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
  };

  const zoom = (factor: number) => {
    transform.current = { ...transform.current, scale: Math.min(6, Math.max(0.2, transform.current.scale * factor)) };
    applyTransform();
  };

  const resetView = () => {
    transform.current = { x: 0, y: 0, scale: 1 };
    applyTransform();
  };

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: transform.current.x, origY: transform.current.y };
  };
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    transform.current = { ...transform.current, x: dragState.current.origX + dx, y: dragState.current.origY + dy };
    applyTransform();
  };
  const endDrag = () => { dragState.current = null; };

  const nodeStatus = (id: string) => statusOf(id, currentSet, targetSet);

  const viewBox = useMemo(() => {
    const relevant = focusOnHighlighted
      ? entries.filter(([id]) => nodeStatus(id) !== null)
      : entries;

    const points = relevant.length > 0 ? relevant : entries;
    if (points.length === 0) return '0 0 1000 1000';

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(([, info]) => {
      minX = Math.min(minX, info.x); maxX = Math.max(maxX, info.x);
      minY = Math.min(minY, info.y); maxY = Math.max(maxY, info.y);
    });

    minX -= PADDING; maxX += PADDING; minY -= PADDING; maxY += PADDING;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, currentSet, targetSet, focusOnHighlighted]);

  const nodeMapById = useMemo(() => new Map(entries), [entries]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="flex justify-between items-center px-5 py-3 border-b border-slate-800">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <div className="flex gap-2">
          <button onClick={() => zoom(1.3)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold">+</button>
          <button onClick={() => zoom(1 / 1.3)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold">−</button>
          <button onClick={resetView} className="px-3 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase">Reset</button>
        </div>
      </div>

      <svg
        viewBox={viewBox}
        className="w-full h-[480px] bg-slate-950 cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <g ref={gRef}>
          {/* Background: dim full tree for orientation */}
          <g opacity={0.5}>
            {entries.map(([id, info]) => (info.out || []).map(targetId => {
              const other = nodeMapById.get(targetId);
              if (!other) return null;
              return (
                <line key={`${id}-${targetId}`} x1={info.x} y1={info.y} x2={other.x} y2={other.y} stroke={BG_EDGE_COLOR} strokeWidth={6} />
              );
            }))}
            {entries.map(([id, info]) => (
              <circle key={id} cx={info.x} cy={info.y} r={BG_NODE_R} fill="#334155" />
            ))}
          </g>

          {/* Highlighted: current/target diff */}
          <g>
            {entries.map(([id, info]) => (info.out || []).map(targetId => {
              const status = nodeStatus(id);
              const otherStatus = nodeStatus(targetId);
              if (!status || !otherStatus) return null;
              const other = nodeMapById.get(targetId);
              if (!other) return null;
              const color = status === 'add' || otherStatus === 'add' ? STATUS_COLOR.add
                : status === 'remove' || otherStatus === 'remove' ? STATUS_COLOR.remove
                : STATUS_COLOR.shared;
              return (
                <line key={`hl-${id}-${targetId}`} x1={info.x} y1={info.y} x2={other.x} y2={other.y} stroke={color} strokeWidth={14} opacity={0.85} />
              );
            }))}
            {entries.map(([id, info]) => {
              const status = nodeStatus(id);
              if (!status) return null;
              const isBig = BIG_NODE_TYPES.has(info.type);
              const r = isBig ? 42 : 22;
              return (
                <g key={id}>
                  <circle cx={info.x} cy={info.y} r={r} fill={STATUS_COLOR[status]} stroke="#0f172a" strokeWidth={6} opacity={status === 'remove' ? 0.75 : 1}>
                    <title>{info.name}{info.stats ? `\n${info.stats.join('\n')}` : ''}</title>
                  </circle>
                  {isBig && (
                    <text x={info.x} y={info.y + r + 38} textAnchor="middle" fontSize={34} fontWeight={900} fill={STATUS_COLOR[status]} style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 8 }}>
                      {info.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="flex gap-5 px-5 py-3 border-t border-slate-800 text-[10px] font-bold uppercase tracking-tighter">
        <span className="flex items-center gap-1.5 text-blue-400"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" />Shared</span>
        <span className="flex items-center gap-1.5 text-green-400"><span className="w-2.5 h-2.5 rounded-full bg-green-400" />Allocate</span>
        <span className="flex items-center gap-1.5 text-red-400"><span className="w-2.5 h-2.5 rounded-full bg-red-400" />Deallocate</span>
        <span className="text-slate-600">Drag to pan, +/− to zoom</span>
      </div>
    </div>
  );
}
