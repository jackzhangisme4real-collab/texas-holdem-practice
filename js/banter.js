/**
 * Sparse Chinese table-talk / atmosphere lines (HSP-ish flavor).
 */
(function (global) {
  'use strict';

  const LINES = {
    fold: [
      '这手我过了。',
      '先观望。',
      '没必要硬碰。',
      '收收手。'
    ],
    bigRaise: [
      '压力给足。',
      '这注有点沉。',
      '听听牌力说话。',
      '桌上气氛陡然紧了。'
    ],
    threeBet: [
      '3-Bet 来了。',
      '不想便宜看牌。',
      '再抬一层。'
    ],
    call: [
      '看看下一张。',
      '赔率还行，跟一手。',
      '平跟，不闹事。'
    ],
    win: [
      '这口汤不错。',
      '筹码进袋。',
      '今晚手气站边了。'
    ],
    allin: [
      '全下！桌上一静。',
      '没有退路了。',
      '命运交给摊牌。'
    ],
    check: [
      '免费看牌。',
      '先过。'
    ]
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function lineFor(actionType, meta) {
    meta = meta || {};
    if (actionType === 'fold') return pick(LINES.fold);
    if (actionType === 'allin') return pick(LINES.allin);
    if (actionType === 'check') return Math.random() < 0.35 ? pick(LINES.check) : null;
    if (actionType === 'call') return Math.random() < 0.4 ? pick(LINES.call) : null;
    if (actionType === 'raise' || actionType === 'bet') {
      if (meta.level >= 2) return pick(LINES.threeBet);
      if (meta.big) return pick(LINES.bigRaise);
      return Math.random() < 0.45 ? pick(LINES.bigRaise) : null;
    }
    if (actionType === 'win') return pick(LINES.win);
    return null;
  }

  global.PokerBanter = { lineFor, LINES };
})(typeof window !== 'undefined' ? window : globalThis);
