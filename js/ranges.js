/**
 * Beginner starting-hand range hints (6-max rough guide).
 */
(function (global) {
  'use strict';

  // Categories for display
  const PREMIUM = new Set(['AA','KK','QQ','JJ','AKs','AKo']);
  const STRONG = new Set(['TT','99','AQs','AJs','KQs','AQo','ATs','KJs']);
  const PLAYABLE = new Set([
    '88','77','66','AJo','A9s','A8s','A7s','A5s','A4s','A3s','A2s',
    'KQo','KTs','QJs','JTs','T9s','98s','87s','76s','KJo','QJo','QTs','J9s'
  ]);

  function holeKey(hole) {
    if (!hole || hole.length < 2) return null;
    const r = (c) => PokerCards.RANK_LABEL[c.rank];
    const a = hole[0];
    const b = hole[1];
    const hi = a.rank >= b.rank ? a : b;
    const lo = a.rank >= b.rank ? b : a;
    if (hi.rank === lo.rank) return r(hi) + r(lo);
    const suited = hi.suit === lo.suit ? 's' : 'o';
    return r(hi) + r(lo) + suited;
  }

  function classify(hole) {
    const key = holeKey(hole);
    if (!key) return null;
    let tier = 'fold';
    let label = '建议弃牌 / 边缘';
    let color = 'muted';
    let tip = '前位更应收紧；除非赔率极好，否则优先弃牌练纪律。';
    if (PREMIUM.has(key)) {
      tier = 'premium';
      label = '超强牌 · 可加注/再加注';
      color = 'gold';
      tip = '几乎任何位置都该主动进攻，注意别慢玩把对手放进来。';
    } else if (STRONG.has(key)) {
      tier = 'strong';
      label = '强牌 · 适合开池/跟加注（视位置）';
      color = 'ok';
      tip = '后位可更宽；面对再加注要分清对手风格。';
    } else if (PLAYABLE.has(key)) {
      tier = 'playable';
      label = '可玩牌 · 多在后位或便宜看翻牌';
      color = 'accent';
      tip = '前位谨慎；同花连张看翻牌后的成牌潜力。';
    }
    return { key, tier, label, color, tip };
  }

  /** Compact grid of suggested opens for display */
  function chartRows() {
    return [
      { title: '超强', cards: 'AA KK QQ JJ AKs AKo', note: '几乎总该加注' },
      { title: '强', cards: 'TT 99 AQs AJs KQs AQo ATs', note: '多数位置可开' },
      { title: '可玩', cards: '中小对 · 同花连张 · 同花 A高', note: '后位/便宜池' },
      { title: '弃', cards: '杂烂高张、深缺口、前位弱牌', note: '新手优先收紧' }
    ];
  }

  global.PokerRanges = { holeKey, classify, chartRows, PREMIUM, STRONG, PLAYABLE };
})(typeof window !== 'undefined' ? window : globalThis);
