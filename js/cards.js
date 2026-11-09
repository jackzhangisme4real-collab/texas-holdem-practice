/**
 * Deck, card helpers, and hand evaluation for Texas Hold'em.
 * Ranks: 2-14 (Ace high). Suits: s h d c.
 */
(function (global) {
  'use strict';

  const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const SUITS = ['s', 'h', 'd', 'c'];
  const RANK_LABEL = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  };
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const SUIT_COLOR = { s: 'black', h: 'red', d: 'red', c: 'black' };

  const CATEGORY = {
    HIGH_CARD: 0,
    ONE_PAIR: 1,
    TWO_PAIR: 2,
    THREE_KIND: 3,
    STRAIGHT: 4,
    FLUSH: 5,
    FULL_HOUSE: 6,
    FOUR_KIND: 7,
    STRAIGHT_FLUSH: 8
  };

  const CATEGORY_NAME_ZH = [
    '高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'
  ];

  function cardId(rank, suit) {
    return RANK_LABEL[rank] + suit;
  }

  function makeCard(rank, suit) {
    return {
      rank,
      suit,
      id: cardId(rank, suit),
      label: RANK_LABEL[rank],
      symbol: SUIT_SYMBOL[suit],
      color: SUIT_COLOR[suit]
    };
  }

  function createDeck() {
    const deck = [];
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push(makeCard(r, s));
      }
    }
    return deck;
  }

  function shuffle(deck, rng) {
    const rand = rng || Math.random;
    const a = deck.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function parseCard(str) {
    const m = String(str).trim().match(/^(10|[2-9]|[JQKA])([shdc])$/i);
    if (!m) throw new Error('Invalid card: ' + str);
    const label = m[1].toUpperCase();
    const suit = m[2].toLowerCase();
    let rank;
    if (label === 'A') rank = 14;
    else if (label === 'K') rank = 13;
    else if (label === 'Q') rank = 12;
    else if (label === 'J') rank = 11;
    else rank = parseInt(label, 10);
    return makeCard(rank, suit);
  }

  /** Rank frequency map for a list of cards */
  function rankCounts(cards) {
    const m = {};
    for (const c of cards) {
      m[c.rank] = (m[c.rank] || 0) + 1;
    }
    return m;
  }

  function suitCounts(cards) {
    const m = {};
    for (const c of cards) {
      m[c.suit] = (m[c.suit] || 0) + 1;
    }
    return m;
  }

  /**
   * Best 5-card hand from 5–7 cards.
   * Returns { category, ranks: number[5] desc kickers, nameZh, cards }
   * Comparison: higher category wins; else lexicographic ranks.
   */
  function evaluateHand(cards) {
    if (!cards || cards.length < 5) {
      throw new Error('Need at least 5 cards to evaluate');
    }
    const combos = combinations(cards, 5);
    let best = null;
    for (const five of combos) {
      const scored = scoreFive(five);
      if (!best || compareHands(scored, best) > 0) {
        best = scored;
      }
    }
    return best;
  }

  function combinations(arr, k) {
    const out = [];
    const n = arr.length;
    function rec(start, path) {
      if (path.length === k) {
        out.push(path.slice());
        return;
      }
      for (let i = start; i <= n - (k - path.length); i++) {
        path.push(arr[i]);
        rec(i + 1, path);
        path.pop();
      }
    }
    rec(0, []);
    return out;
  }

  function scoreFive(five) {
    const sorted = five.slice().sort((a, b) => b.rank - a.rank);
    const rc = rankCounts(sorted);
    const sc = suitCounts(sorted);
    const isFlush = Object.values(sc).some((n) => n === 5);
    const uniqueRanks = Object.keys(rc).map(Number).sort((a, b) => b - a);

    // Straight detection (Ace-low wheel: A-2-3-4-5)
    let straightHigh = 0;
    const ranksAsc = uniqueRanks.slice().sort((a, b) => a - b);
    if (uniqueRanks.length === 5) {
      if (uniqueRanks[0] - uniqueRanks[4] === 4) {
        straightHigh = uniqueRanks[0];
      } else if (
        uniqueRanks.includes(14) &&
        uniqueRanks.includes(2) &&
        uniqueRanks.includes(3) &&
        uniqueRanks.includes(4) &&
        uniqueRanks.includes(5)
      ) {
        straightHigh = 5; // wheel
      }
    }

    const counts = Object.entries(rc)
      .map(([r, c]) => ({ rank: +r, count: c }))
      .sort((a, b) => b.count - a.count || b.rank - a.rank);

    let category;
    let ranks;

    if (straightHigh && isFlush) {
      category = CATEGORY.STRAIGHT_FLUSH;
      ranks = [straightHigh, 0, 0, 0, 0];
    } else if (counts[0].count === 4) {
      category = CATEGORY.FOUR_KIND;
      ranks = [counts[0].rank, counts[1].rank, 0, 0, 0];
    } else if (counts[0].count === 3 && counts[1].count === 2) {
      category = CATEGORY.FULL_HOUSE;
      ranks = [counts[0].rank, counts[1].rank, 0, 0, 0];
    } else if (isFlush) {
      category = CATEGORY.FLUSH;
      ranks = sorted.map((c) => c.rank);
    } else if (straightHigh) {
      category = CATEGORY.STRAIGHT;
      ranks = [straightHigh, 0, 0, 0, 0];
    } else if (counts[0].count === 3) {
      category = CATEGORY.THREE_KIND;
      const kickers = counts.slice(1).map((x) => x.rank).sort((a, b) => b - a);
      ranks = [counts[0].rank, kickers[0], kickers[1], 0, 0];
    } else if (counts[0].count === 2 && counts[1].count === 2) {
      category = CATEGORY.TWO_PAIR;
      const pairs = [counts[0].rank, counts[1].rank].sort((a, b) => b - a);
      ranks = [pairs[0], pairs[1], counts[2].rank, 0, 0];
    } else if (counts[0].count === 2) {
      category = CATEGORY.ONE_PAIR;
      const kickers = counts.slice(1).map((x) => x.rank).sort((a, b) => b - a);
      ranks = [counts[0].rank, kickers[0], kickers[1], kickers[2], 0];
    } else {
      category = CATEGORY.HIGH_CARD;
      ranks = sorted.map((c) => c.rank);
    }

    while (ranks.length < 5) ranks.push(0);

    return {
      category,
      ranks,
      nameZh: CATEGORY_NAME_ZH[category],
      cards: sorted
    };
  }

  function compareHands(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    for (let i = 0; i < 5; i++) {
      if (a.ranks[i] !== b.ranks[i]) return a.ranks[i] - b.ranks[i];
    }
    return 0;
  }

  function describeHandStrength(hand) {
    const r = (n) => RANK_LABEL[n] || '';
    switch (hand.category) {
      case CATEGORY.STRAIGHT_FLUSH:
        return hand.ranks[0] === 14 ? '皇家同花顺' : hand.nameZh + '（至 ' + r(hand.ranks[0]) + '）';
      case CATEGORY.FOUR_KIND:
        return '四条 ' + r(hand.ranks[0]);
      case CATEGORY.FULL_HOUSE:
        return '葫芦 ' + r(hand.ranks[0]) + ' 满 ' + r(hand.ranks[1]);
      case CATEGORY.FLUSH:
        return '同花（高牌 ' + r(hand.ranks[0]) + '）';
      case CATEGORY.STRAIGHT:
        return '顺子（至 ' + r(hand.ranks[0]) + '）';
      case CATEGORY.THREE_KIND:
        return '三条 ' + r(hand.ranks[0]);
      case CATEGORY.TWO_PAIR:
        return '两对 ' + r(hand.ranks[0]) + ' 与 ' + r(hand.ranks[1]);
      case CATEGORY.ONE_PAIR:
        return '一对 ' + r(hand.ranks[0]);
      default:
        return '高牌 ' + r(hand.ranks[0]);
    }
  }

  global.PokerCards = {
    RANKS,
    SUITS,
    RANK_LABEL,
    SUIT_SYMBOL,
    CATEGORY,
    CATEGORY_NAME_ZH,
    makeCard,
    createDeck,
    shuffle,
    parseCard,
    evaluateHand,
    compareHands,
    describeHandStrength,
    scoreFive
  };
})(typeof window !== 'undefined' ? window : globalThis);
