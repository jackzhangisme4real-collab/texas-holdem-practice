/**
 * Texas Hold'em table engine: blinds, betting rounds, side pots, showdown.
 */
(function (global) {
  'use strict';

  const STREET = { PREFLOP: 'preflop', FLOP: 'flop', TURN: 'turn', RIVER: 'river', SHOWDOWN: 'showdown' };

  function createPlayer(id, name, chips, isHuman, style) {
    return {
      id,
      name,
      chips,
      isHuman: !!isHuman,
      style: style || 'balanced',
      hole: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      satOut: false,
      actedThisRound: false
    };
  }

  function createTable(opts) {
    const o = opts || {};
    return {
      smallBlind: o.smallBlind || 5,
      bigBlind: o.bigBlind || 10,
      startingChips: o.startingChips || 1000,
      difficulty: o.difficulty || 'normal', // easy | normal | hard
      street: STREET.PREFLOP,
      deck: [],
      community: [],
      pot: 0,
      sidePots: [],
      currentBet: 0,
      minRaise: 0,
      dealerIndex: 0,
      sbIndex: -1,
      bbIndex: -1,
      actionIndex: -1,
      lastAggressor: -1,
      handNumber: 0,
      players: [],
      history: [],
      handOver: false,
      winners: [],
      waitingForHuman: false,
      lastTip: null,
      showdownResults: null
    };
  }

  function seatedActive(p) {
    return p && !p.satOut && p.chips > 0;
  }

  function inHand(p) {
    return seatedActive(p) || (p && p.allIn && !p.folded && p.hole && p.hole.length);
  }

  function notFolded(p) {
    return p && !p.folded && (p.chips > 0 || p.allIn) && p.hole && p.hole.length;
  }

  function canAct(p) {
    return p && !p.folded && !p.allIn && p.chips > 0 && p.hole && p.hole.length;
  }

  function nextSeat(table, from, pred) {
    const n = table.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (from + i) % n;
      if (pred(table.players[idx], idx)) return idx;
    }
    return -1;
  }

  function countNotFolded(table) {
    return table.players.filter(notFolded).length;
  }

  function countCanAct(table) {
    return table.players.filter(canAct).length;
  }

  function resetForHand(table) {
    table.street = STREET.PREFLOP;
    table.community = [];
    table.pot = 0;
    table.sidePots = [];
    table.currentBet = 0;
    table.minRaise = table.bigBlind;
    table.handOver = false;
    table.winners = [];
    table.waitingForHuman = false;
    table.showdownResults = null;
    table.history = [];
    table.lastAggressor = -1;
    for (const p of table.players) {
      p.hole = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = false;
      p.allIn = false;
      p.actedThisRound = false;
      if (p.chips <= 0) p.satOut = true;
    }
  }

  function dealHand(table, rng) {
    const Cards = global.PokerCards;
    resetForHand(table);

    const alive = table.players.filter(seatedActive);
    if (alive.length < 2) {
      table.handOver = true;
      table.lastTip = { title: '牌局结束', body: '桌上可继续游戏的玩家不足两人。点「重新开桌」再来一局。' };
      return { ok: false, reason: 'not_enough_players' };
    }

    table.handNumber += 1;
    table.deck = Cards.shuffle(Cards.createDeck(), rng);

    // Advance dealer among seated
    table.dealerIndex = nextSeat(table, table.dealerIndex, (p) => seatedActive(p));
    if (table.handNumber === 1) {
      // first hand: dealer already 0 or set externally
      const firstAlive = table.players.findIndex(seatedActive);
      table.dealerIndex = firstAlive;
    }

    const numAlive = table.players.filter(seatedActive).length;
    if (numAlive === 2) {
      // heads-up: dealer is SB
      table.sbIndex = table.dealerIndex;
      table.bbIndex = nextSeat(table, table.dealerIndex, (p) => seatedActive(p));
    } else {
      table.sbIndex = nextSeat(table, table.dealerIndex, (p) => seatedActive(p));
      table.bbIndex = nextSeat(table, table.sbIndex, (p) => seatedActive(p));
    }

    // Deal 2 hole cards each
    for (let round = 0; round < 2; round++) {
      let idx = nextSeat(table, table.dealerIndex, (p) => seatedActive(p));
      const start = idx;
      do {
        table.players[idx].hole.push(table.deck.pop());
        idx = nextSeat(table, idx, (p) => seatedActive(p));
      } while (idx !== start);
    }

    // Post blinds
    postBlind(table, table.sbIndex, table.smallBlind, '小盲');
    postBlind(table, table.bbIndex, table.bigBlind, '大盲');
    table.currentBet = Math.max(
      table.players[table.sbIndex].bet,
      table.players[table.bbIndex].bet
    );
    table.minRaise = table.bigBlind;
    table.lastAggressor = table.bbIndex;

    // First to act preflop: left of BB
    table.actionIndex = nextSeat(table, table.bbIndex, (p) => canAct(p));
    if (table.actionIndex < 0) {
      // everyone all-in on blinds
      advanceStreet(table);
    } else {
      prepareActor(table);
    }
    return { ok: true };
  }

  function postBlind(table, idx, amount, label) {
    const p = table.players[idx];
    const pay = Math.min(amount, p.chips);
    p.chips -= pay;
    p.bet += pay;
    p.totalBet += pay;
    table.pot += pay;
    if (p.chips === 0) p.allIn = true;
    table.history.push({ type: 'blind', playerId: p.id, amount: pay, label });
  }

  function prepareActor(table) {
    const p = table.players[table.actionIndex];
    if (!p) return;
    if (p.isHuman) {
      table.waitingForHuman = true;
    } else {
      table.waitingForHuman = false;
    }
  }

  function legalActions(table, playerIndex) {
    const p = table.players[playerIndex];
    if (!canAct(p) || table.actionIndex !== playerIndex || table.handOver) {
      return { fold: false, check: false, call: false, callAmount: 0, bet: false, raise: false, allIn: false, minBet: 0, maxBet: 0, minRaiseTo: 0 };
    }
    const toCall = table.currentBet - p.bet;
    const canCheck = toCall <= 0;
    const canCall = toCall > 0 && p.chips > 0;
    const callAmount = Math.min(toCall, p.chips);
    // Bet: no current bet (or everyone matched at 0 beyond blinds handled via raise)
    const canBet = toCall <= 0 && p.chips > 0 && table.currentBet === 0;
    // Raise: there is a current bet and player can put more than call
    const canRaise = toCall >= 0 && p.chips > toCall && table.currentBet > 0;
    const minRaiseTo = table.currentBet + table.minRaise;
    const maxBet = p.chips + p.bet; // absolute total bet for this street
    return {
      fold: toCall > 0,
      check: canCheck,
      call: canCall && callAmount < p.chips,
      callAmount,
      bet: canBet,
      raise: canRaise,
      allIn: p.chips > 0,
      minBet: table.bigBlind,
      maxBet,
      minRaiseTo: Math.min(minRaiseTo, maxBet),
      toCall
    };
  }

  /**
   * Apply human/AI action.
   * action: { type: 'fold'|'check'|'call'|'bet'|'raise'|'allin', amount?: number }
   * For bet/raise, amount is the TOTAL bet on this street (raise-to).
   */
  function applyAction(table, playerIndex, action) {
    if (table.handOver) return { ok: false, reason: 'hand_over' };
    if (playerIndex !== table.actionIndex) return { ok: false, reason: 'not_your_turn' };
    const p = table.players[playerIndex];
    const legal = legalActions(table, playerIndex);
    const type = action.type;

    if (type === 'fold') {
      if (!legal.fold && legal.toCall > 0) {
        // allow fold anytime facing a bet
      }
      if (legal.toCall <= 0 && !legal.fold) {
        // folding when can check — allow but unusual
      }
      p.folded = true;
      p.actedThisRound = true;
      table.history.push({ type: 'fold', playerId: p.id });
    } else if (type === 'check') {
      if (!legal.check) return { ok: false, reason: 'cannot_check' };
      p.actedThisRound = true;
      table.history.push({ type: 'check', playerId: p.id });
    } else if (type === 'call') {
      if (!legal.call && !(legal.allIn && legal.toCall > 0)) return { ok: false, reason: 'cannot_call' };
      const pay = Math.min(table.currentBet - p.bet, p.chips);
      p.chips -= pay;
      p.bet += pay;
      p.totalBet += pay;
      table.pot += pay;
      if (p.chips === 0) p.allIn = true;
      p.actedThisRound = true;
      table.history.push({ type: 'call', playerId: p.id, amount: pay });
    } else if (type === 'bet' || type === 'raise') {
      let raiseTo = action.amount;
      if (raiseTo == null) return { ok: false, reason: 'need_amount' };
      raiseTo = Math.floor(raiseTo);
      if (type === 'bet' && !legal.bet && !legal.allIn) return { ok: false, reason: 'cannot_bet' };
      if (type === 'raise' && !legal.raise && raiseTo < legal.maxBet) {
        // short all-in raise still ok
      }
      const need = raiseTo - p.bet;
      if (need <= 0) return { ok: false, reason: 'bad_amount' };
      if (need > p.chips) return { ok: false, reason: 'not_enough_chips' };

      const prevBet = table.currentBet;
      const isAllIn = need === p.chips;
      // Validate min raise unless all-in short
      if (!isAllIn) {
        if (prevBet === 0) {
          if (raiseTo < legal.minBet) return { ok: false, reason: 'below_min_bet' };
        } else {
          if (raiseTo < legal.minRaiseTo) return { ok: false, reason: 'below_min_raise' };
        }
      }

      p.chips -= need;
      p.bet += need;
      p.totalBet += need;
      table.pot += need;
      if (p.chips === 0) p.allIn = true;

      const raiseSize = p.bet - prevBet;
      if (p.bet > prevBet) {
        if (raiseSize >= table.minRaise || !isAllIn) {
          if (raiseSize >= table.minRaise) table.minRaise = raiseSize;
        }
        table.currentBet = p.bet;
        table.lastAggressor = playerIndex;
        // reset acted flags for others who can still act
        for (const o of table.players) {
          if (o !== p && canAct(o)) o.actedThisRound = false;
        }
      }
      p.actedThisRound = true;
      table.history.push({
        type: prevBet === 0 ? 'bet' : 'raise',
        playerId: p.id,
        amount: need,
        to: p.bet
      });
    } else if (type === 'allin') {
      const raiseTo = p.bet + p.chips;
      return applyAction(table, playerIndex, {
        type: table.currentBet === 0 ? 'bet' : (raiseTo > table.currentBet ? 'raise' : 'call'),
        amount: raiseTo
      });
    } else {
      return { ok: false, reason: 'unknown_action' };
    }

    return afterAction(table);
  }

  function afterAction(table) {
    // Everyone folded except one?
    const alive = table.players.filter(notFolded);
    if (alive.length === 1) {
      awardTo(table, alive[0], table.pot, true);
      return { ok: true, handOver: true };
    }

    if (bettingRoundComplete(table)) {
      advanceStreet(table);
      return { ok: true, streetAdvanced: true, handOver: table.handOver };
    }

    // Next actor
    table.actionIndex = nextSeat(table, table.actionIndex, (p) => canAct(p) && !p.actedThisRound);
    // Also players who need to match current bet
    if (table.actionIndex < 0) {
      table.actionIndex = nextSeat(table, table.actionIndex >= 0 ? table.actionIndex : table.dealerIndex, (p) => {
        return canAct(p) && (p.bet < table.currentBet || !p.actedThisRound);
      });
    }
    // Recheck completion
    if (bettingRoundComplete(table)) {
      advanceStreet(table);
      return { ok: true, streetAdvanced: true, handOver: table.handOver };
    }

    // Find next who hasn't matched or hasn't acted
    let idx = table.actionIndex;
    if (idx < 0 || !canAct(table.players[idx]) || (table.players[idx].actedThisRound && table.players[idx].bet >= table.currentBet)) {
      idx = nextUnresolved(table, table.actionIndex >= 0 ? table.actionIndex : table.lastAggressor);
    }
    table.actionIndex = idx;
    if (table.actionIndex < 0 || bettingRoundComplete(table)) {
      advanceStreet(table);
      return { ok: true, streetAdvanced: true, handOver: table.handOver };
    }
    prepareActor(table);
    return { ok: true, handOver: false };
  }

  function nextUnresolved(table, from) {
    const n = table.players.length;
    const start = from < 0 ? table.dealerIndex : from;
    for (let i = 1; i <= n; i++) {
      const idx = (start + i) % n;
      const p = table.players[idx];
      if (!canAct(p)) continue;
      if (p.bet < table.currentBet || !p.actedThisRound) return idx;
    }
    return -1;
  }

  function bettingRoundComplete(table) {
    const actors = table.players.filter(canAct);
    if (actors.length === 0) return true;
    // All who can act have acted and matched current bet (or are all-in handled separately)
    for (const p of table.players) {
      if (!canAct(p)) continue;
      if (!p.actedThisRound) return false;
      if (p.bet < table.currentBet) return false;
    }
    return true;
  }

  function collectBetsToPot(table) {
    // pot already updated incrementally; just reset street bets
    for (const p of table.players) {
      p.bet = 0;
      p.actedThisRound = false;
    }
    table.currentBet = 0;
    table.minRaise = table.bigBlind;
  }

  function advanceStreet(table) {
    collectBetsToPot(table);

    const alive = table.players.filter(notFolded);
    if (alive.length === 1) {
      awardTo(table, alive[0], table.pot, true);
      return;
    }

    // If at most one player can still bet, run out board and showdown
    const actionable = table.players.filter(canAct);
    const needBoard = () => {
      if (table.street === STREET.PREFLOP) {
        // burn + flop 3
        table.deck.pop();
        table.community.push(table.deck.pop(), table.deck.pop(), table.deck.pop());
        table.street = STREET.FLOP;
      } else if (table.street === STREET.FLOP) {
        table.deck.pop();
        table.community.push(table.deck.pop());
        table.street = STREET.TURN;
      } else if (table.street === STREET.TURN) {
        table.deck.pop();
        table.community.push(table.deck.pop());
        table.street = STREET.RIVER;
      } else if (table.street === STREET.RIVER) {
        doShowdown(table);
        return false;
      }
      return true;
    };

    if (table.street === STREET.RIVER) {
      doShowdown(table);
      return;
    }

    if (actionable.length <= 1) {
      // deal remaining board
      while (table.street !== STREET.SHOWDOWN && table.community.length < 5) {
        if (table.street === STREET.PREFLOP) {
          table.deck.pop();
          table.community.push(table.deck.pop(), table.deck.pop(), table.deck.pop());
          table.street = STREET.FLOP;
        } else if (table.street === STREET.FLOP) {
          table.deck.pop();
          table.community.push(table.deck.pop());
          table.street = STREET.TURN;
        } else if (table.street === STREET.TURN) {
          table.deck.pop();
          table.community.push(table.deck.pop());
          table.street = STREET.RIVER;
        } else break;
      }
      doShowdown(table);
      return;
    }

    needBoard();
    if (table.handOver) return;

    // First to act postflop: left of dealer
    table.actionIndex = nextSeat(table, table.dealerIndex, (p) => canAct(p));
    table.lastAggressor = -1;
    if (table.actionIndex < 0) {
      advanceStreet(table);
      return;
    }
    prepareActor(table);
  }

  function buildSidePots(table) {
    // Players who contributed and didn't fold (folded players' chips stay in pot but they can't win)
    const contrib = table.players
      .map((p, i) => ({ i, p, amount: p.totalBet }))
      .filter((x) => x.amount > 0);

    const levels = [...new Set(contrib.map((x) => x.amount))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const level of levels) {
      const layer = level - prev;
      if (layer <= 0) continue;
      let amount = 0;
      const eligible = [];
      for (const x of contrib) {
        if (x.amount >= level) {
          amount += layer;
          if (!x.p.folded) eligible.push(x.i);
        } else if (x.amount > prev) {
          amount += x.amount - prev;
          if (!x.p.folded) eligible.push(x.i);
        }
      }
      // Fix eligibility: anyone who put at least `level` chips and not folded
      const elig = table.players
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => !p.folded && p.totalBet >= level)
        .map(({ i }) => i);

      // Recalculate amount properly
      let amt = 0;
      for (const p of table.players) {
        const paid = Math.min(p.totalBet, level) - Math.min(p.totalBet, prev);
        if (paid > 0) amt += paid;
      }
      if (amt > 0 && elig.length) {
        pots.push({ amount: amt, eligible: elig });
      }
      prev = level;
    }
    // Fallback single pot
    if (!pots.length) {
      const elig = table.players.map((p, i) => (!p.folded && p.totalBet > 0 ? i : -1)).filter((i) => i >= 0);
      pots.push({ amount: table.pot, eligible: elig.length ? elig : table.players.map((p, i) => (!p.folded ? i : -1)).filter((i) => i >= 0) });
    }
    return pots;
  }

  function doShowdown(table) {
    table.street = STREET.SHOWDOWN;
    const Cards = global.PokerCards;
    const contenders = table.players
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => notFolded(p));

    const evaluations = contenders.map(({ p, i }) => {
      const hand = Cards.evaluateHand(p.hole.concat(table.community));
      return { i, p, hand, desc: Cards.describeHandStrength(hand) };
    });

    const pots = buildSidePots(table);
    const awards = [];
    let remaining = table.pot;

    for (const pot of pots) {
      const eligEvals = evaluations.filter((e) => pot.eligible.includes(e.i));
      if (!eligEvals.length) continue;
      eligEvals.sort((a, b) => Cards.compareHands(b.hand, a.hand));
      const best = eligEvals[0].hand;
      const winners = eligEvals.filter((e) => Cards.compareHands(e.hand, best) === 0);
      const share = Math.floor(pot.amount / winners.length);
      let leftover = pot.amount - share * winners.length;
      for (const w of winners) {
        const gain = share + (leftover > 0 ? 1 : 0);
        if (leftover > 0) leftover -= 1;
        w.p.chips += gain;
        remaining -= gain;
        awards.push({ playerId: w.p.id, amount: gain, hand: w.hand, desc: w.desc, pot: pot.amount });
      }
    }

    // Safety: if rounding left chips
    if (remaining > 0 && evaluations.length) {
      evaluations[0].p.chips += remaining;
    }

    table.pot = 0;
    table.handOver = true;
    table.waitingForHuman = false;
    table.showdownResults = {
      evaluations: evaluations.map((e) => ({
        playerId: e.p.id,
        name: e.p.name,
        hole: e.p.hole,
        hand: e.hand,
        desc: e.desc
      })),
      awards
    };
    table.winners = awards;
    table.history.push({ type: 'showdown', awards });
  }

  function awardTo(table, player, amount, foldedWin) {
    player.chips += amount;
    table.pot = 0;
    table.handOver = true;
    table.waitingForHuman = false;
    table.winners = [{ playerId: player.id, amount, foldedWin: !!foldedWin }];
    table.showdownResults = {
      evaluations: [],
      awards: table.winners,
      foldWin: true,
      winnerName: player.name
    };
    table.history.push({ type: 'fold_win', playerId: player.id, amount });
  }

  function setupDefaultTable(opts) {
    const table = createTable(opts);
    const chips = table.startingChips;
    const names = [
      { name: '你', human: true, style: 'human' },
      { name: '稳妥哥', human: false, style: 'tight' },
      { name: '浪哥', human: false, style: 'loose' },
      { name: '火力全开', human: false, style: 'aggressive' },
      { name: '均衡酱', human: false, style: 'balanced' },
      { name: '石头人', human: false, style: 'nit' }
    ];
    table.players = names.map((n, i) => createPlayer(i, n.name, chips, n.human, n.style));
    table.dealerIndex = 0;
    return table;
  }

  global.PokerEngine = {
    STREET,
    createPlayer,
    createTable,
    setupDefaultTable,
    dealHand,
    applyAction,
    legalActions,
    canAct,
    notFolded,
    seatedActive
  };
})(typeof window !== 'undefined' ? window : globalThis);
