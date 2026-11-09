/**
 * Offline local progress — per-device solo practice only (localStorage).
 * No accounts, no multiplayer, no real money.
 */
(function (global) {
  'use strict';

  const KEY = 'th_practice_progress_v2';

  /** Stakes ladders — practice chips only */
  const TABLES = [
    {
      id: 'micro',
      name: '入门桌',
      blurb: '每人起步 1000 · 盲注 5/10',
      smallBlind: 5,
      bigBlind: 10,
      startStack: 1000,
      minStack: 0,
      aiBuyIn: 1000
    },
    {
      id: 'small',
      name: '进阶桌',
      blurb: '盲注 25/50 · 建议筹码 ≥ 1000',
      smallBlind: 25,
      bigBlind: 50,
      startStack: 2500,
      minStack: 1000,
      aiBuyIn: 2500
    },
    {
      id: 'mid',
      name: '中级桌',
      blurb: '盲注 50/100 · 建议筹码 ≥ 2500',
      smallBlind: 50,
      bigBlind: 100,
      startStack: 5000,
      minStack: 2500,
      aiBuyIn: 5000
    },
    {
      id: 'high',
      name: '高额练习桌',
      blurb: '盲注 100/200 · 建议筹码 ≥ 5000',
      smallBlind: 100,
      bigBlind: 200,
      startStack: 10000,
      minStack: 5000,
      aiBuyIn: 10000
    }
  ];

  function defaultProgress() {
    return {
      version: 2,
      tableId: 'micro',
      stack: 1000,
      difficulty: 'normal',
      theme: 'q',
      sfx: true,
      showRange: true,
      hands: 0,
      won: 0,
      folded: 0,
      startChips: 1000,
      ledger: [],
      updatedAt: Date.now()
    };
  }

  function tableById(id) {
    return TABLES.find((t) => t.id === id) || TABLES[0];
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultProgress();
      const data = JSON.parse(raw);
      const base = defaultProgress();
      const merged = Object.assign(base, data || {});
      if (!tableById(merged.tableId)) merged.tableId = 'micro';
      merged.stack = Math.max(0, Math.floor(Number(merged.stack) || 0));
      return merged;
    } catch (e) {
      return defaultProgress();
    }
  }

  function save(progress) {
    try {
      const p = Object.assign({}, progress, { updatedAt: Date.now(), version: 2 });
      localStorage.setItem(KEY, JSON.stringify(p));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
  }

  /** Can sit this table with current stack? */
  function canSit(tableId, stack) {
    const t = tableById(tableId);
    return stack >= (t.minStack || 0);
  }

  global.PokerPersist = {
    KEY,
    TABLES,
    tableById,
    defaultProgress,
    load,
    save,
    clear,
    canSit
  };
})(typeof window !== 'undefined' ? window : globalThis);
