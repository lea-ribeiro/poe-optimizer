'use client';

import { useState, useEffect } from 'react';

export type SavedPoB = {
  id: string;
  name: string;
  pobString: string;
  savedAt: string;
};

export type PoBSlot = 'current' | 'target';

const KEYS: Record<PoBSlot, string> = {
  current: 'poe-optimizer-saved-current',
  target:  'poe-optimizer-saved-target',
};

function load(slot: PoBSlot): SavedPoB[] {
  try {
    const raw = localStorage.getItem(KEYS[slot]);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persist(slot: PoBSlot, entries: SavedPoB[]) {
  try { localStorage.setItem(KEYS[slot], JSON.stringify(entries)); } catch {}
}

export function useSavedPoBs() {
  const [current, setCurrent] = useState<SavedPoB[]>([]);
  const [target, setTarget]   = useState<SavedPoB[]>([]);

  useEffect(() => {
    setCurrent(load('current'));
    setTarget(load('target'));
  }, []);

  const save = (pobString: string, name: string, slot: PoBSlot) => {
    if (!pobString.trim()) return;
    const entry: SavedPoB = {
      id: Date.now().toString(),
      name: name.trim() || `PoB ${new Date().toLocaleDateString()}`,
      pobString: pobString.trim(),
      savedAt: new Date().toISOString(),
    };
    const setter = slot === 'current' ? setCurrent : setTarget;
    setter(prev => {
      const updated = [entry, ...prev];
      persist(slot, updated);
      return updated;
    });
  };

  const remove = (id: string, slot: PoBSlot) => {
    const setter = slot === 'current' ? setCurrent : setTarget;
    setter(prev => {
      const updated = prev.filter(s => s.id !== id);
      persist(slot, updated);
      return updated;
    });
  };

  return { current, target, save, remove };
}
