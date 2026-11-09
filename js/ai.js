/**
 * Simple style-based AI for practice table. Not GTO — varied entertainment opponents.
 */
(function (global) {
  'use strict';

  const Cards = () => global.PokerCards;
  const Engine = () => global.PokerEngine;

  /** Rough preflop strength 0–1 from two hole cards */
  function preflopStrength(hole) {
    if (!hole || hole.length < 2) return 0;
    const [a, b] = hole[0].rank >= hole[1].rank ? hole : [hole[1], hole[0]];
    const suited = hole[0].suit === hole[1].suit;
    const paired = a.rank === b.rank;
    let s = 0;
    if (paired) {
      s = 0.55 + (a.rank - 2) * 0.035;
    } else {
      s = (a.rank + b.rank) / 40;
      if (suited) s += 0.08;
      const gap = a.rank - b.rank;
      if (gap === 1) s += 0.05;
      else if (gap === 2) s += 0.02;
      else if (gap >= 5) s -= 0.06;
      if (a.rank >= 14) s += 0.06;
      if (a.rank >= 13 && b.rank >= 10) s += 0.05;
    }
    return Math.max(0, Math.min(1, s));
  }

  function madeStrength(hole, board) {
    if (!board || board.length < 3) return preflopStrength(hole);
    const hand = Cards().evaluateHand(hole.concat(board));
    const cat = hand.category;
    // Map category to 0–1 with some kicker noise
    const base = [0.15, 0.35, 0.5, 0.62, 0.72, 0.78, 0.88, 0.95, 0.99][cat];
    return base + hand.ranks[0] * 0.001;
  }

  function styleParams(style, difficulty) {
    const diff = {
      easy: { loose: 0.12, agg: -0.1, bluff: 0.05 },
      normal: { loose: 0, agg: 0, bluff: 0.1 },
      hard: { loose: -0.08, agg: 0.1, bluff: 0.14 }
    }[difficulty] || { loose: 0, agg: 0, bluff: 0.1 };

    const base = {
      tight: { open: 0.62, call: 0.55, raise: 0.78, bluff: 0.04, size: 0.45 },
      nit: { open: 0.72, call: 0.65, raise: 0.85, bluff: 0.02, size: 0.4 },
      loose: { open: 0.38, call: 0.35, raise: 0.6, bluff: 0.18, size: 0.55 },
      aggressive: { open: 0.48, call: 0.42, raise: 0.55, bluff: 0.22, size: 0.7 },
      balanced: { open: 0.52, call: 0.48, raise: 0.68, bluff: 0.12, size: 0.55 }
    }[style] || { open: 0.52, call: 0.48, raise: 0.68, bluff: 0.12, size: 0.55 };

    return {
      open: clamp(base.open + diff.loose, 0.25, 0.85),
      call: clamp(base.call + diff.loose, 0.25, 0.85),
      raise: clamp(base.raise + diff.agg, 0.4, 0.95),
      bluff: clamp(base.bluff + diff.bluff, 0, 0.35),
      size: clamp(base.size + diff.agg * 0.5, 0.35, 0.85)
    };
  }

  function clamp(x, a, b) {
    return Math.max(a, Math.min(b, x));
  }

  function potOdds(toCall, pot) {
    if (toCall <= 0) return 0;
    return toCall / (pot + toCall);
  }

  function chooseAction(table, playerIndex) {
    const p = table.players[playerIndex];
    const legal = Engine().legalActions(table, playerIndex);
    const params = styleParams(p.style, table.difficulty);
    const strength =
      table.community.length >= 3
        ? madeStrength(p.hole, table.community)
        : preflopStrength(p.hole);

    const toCall = legal.toCall || 0;
    const pot = table.pot;
    const odds = potOdds(toCall, pot);
    const roll = Math.random();

    // Facing a bet
    if (toCall > 0) {
      // All-in short call if tiny
      if (toCall >= p.chips) {
        if (strength > params.call - 0.1 || roll < params.bluff * 0.5) {
          return { type: 'allin' };
        }
        return { type: 'fold' };
      }

      // Raise for value / bluff
      if (legal.raise && strength >= params.raise && roll < 0.45 + strength * 0.3) {
        return makeRaise(table, p, legal, params, strength);
      }
      if (legal.raise && strength < 0.35 && roll < params.bluff) {
        return makeRaise(table, p, legal, params, 0.4);
      }

      // Call by pot odds + strength
      const callThreshold = params.call + odds * 0.5;
      if (strength >= callThreshold - 0.15 || (strength > 0.4 && odds < 0.3)) {
        if (legal.call) return { type: 'call' };
        return { type: 'allin' };
      }
      // Loose styles call wider
      if (strength >= params.call - 0.25 && roll < 0.35) {
        if (legal.call) return { type: 'call' };
      }
      return legal.fold ? { type: 'fold' } : { type: 'check' };
    }

    // No bet to us — check / bet
    if (legal.bet) {
      if (strength >= params.open || roll < params.bluff) {
        return makeBet(table, p, legal, params, strength);
      }
      return { type: 'check' };
    }
    if (legal.check) return { type: 'check' };
    if (legal.call) return { type: 'call' };
    return { type: 'fold' };
  }

  function makeBet(table, p, legal, params, strength) {
    const pot = Math.max(table.pot, table.bigBlind);
    let size = Math.floor(pot * (0.5 + params.size * 0.5) * (0.7 + strength * 0.5));
    size = Math.max(legal.minBet, size);
    let raiseTo = p.bet + size;
    raiseTo = Math.min(raiseTo, legal.maxBet);
    if (raiseTo >= legal.maxBet || p.chips <= size) return { type: 'allin' };
    return { type: 'bet', amount: raiseTo };
  }

  function makeRaise(table, p, legal, params, strength) {
    const pot = Math.max(table.pot, table.bigBlind);
    let raiseTo = Math.floor(table.currentBet + Math.max(table.minRaise, pot * params.size));
    if (strength > 0.85) raiseTo = Math.floor(table.currentBet + pot * (0.8 + params.size));
    raiseTo = Math.max(legal.minRaiseTo, raiseTo);
    raiseTo = Math.min(raiseTo, legal.maxBet);
    if (raiseTo >= legal.maxBet || raiseTo - p.bet >= p.chips) return { type: 'allin' };
    if (raiseTo <= table.currentBet) {
      return legal.call ? { type: 'call' } : { type: 'allin' };
    }
    return { type: 'raise', amount: raiseTo };
  }

  /** Short Chinese comment about AI intent for teaching feed (optional) */
  function explainDecision(style, strength, type) {
    const s =
      strength > 0.75 ? '牌力较强' : strength > 0.45 ? '牌力一般' : '牌力偏弱';
    const map = {
      fold: '选择弃牌，避免在不利赔率下硬跟。',
      check: '免费看下一张牌，保持底池控制。',
      call: '跟注：赔率或牌力尚可接受。',
      bet: '主动下注施压或价值下注。',
      raise: '加注：放大优势或迫使对手放弃。',
      allin: '全下：两极化（超强或施压）。'
    };
    return '（' + style + '）' + s + ' → ' + (map[type] || type);
  }

  global.PokerAI = {
    preflopStrength,
    madeStrength,
    chooseAction,
    explainDecision,
    potOdds
  };
})(typeof window !== 'undefined' ? window : globalThis);
