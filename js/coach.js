/**
 * Offline GTO-flavored coaching assist (Chinese).
 * Educational approximations — NOT solver-perfect GTO output.
 */
(function (global) {
  'use strict';

  const Cards = () => global.PokerCards;
  const Ranges = () => global.PokerRanges;

  /** 6-max seats relative to dealer button */
  function heroSeatInfo(table, heroIndex) {
    const n = table.players.length;
    const dealer = table.dealerIndex;
    const sb = table.sbIndex;
    const bb = table.bbIndex;
    const alive = table.players.filter((p) => !p.satOut && p.chips > 0).length;

    let code = 'MP';
    let nameZh = '中位 (MP)';
    if (heroIndex === sb) {
      code = 'SB';
      nameZh = '小盲 (SB)';
    } else if (heroIndex === bb) {
      code = 'BB';
      nameZh = '大盲 (BB)';
    } else if (heroIndex === dealer) {
      code = 'BTN';
      nameZh = '庄家按钮 (BTN)';
    } else {
      // Preflop order after BB: UTG → … → CO → (BTN handled above)
      const utg = (bb + 1) % n;
      const beforeBtn = [];
      let s = utg;
      let guard = 0;
      while (s !== dealer && guard++ < n) {
        if (s !== sb && s !== bb) beforeBtn.push(s);
        s = (s + 1) % n;
      }
      const idx = beforeBtn.indexOf(heroIndex);
      const last = beforeBtn.length - 1;
      if (idx === 0) {
        code = 'EP';
        nameZh = '枪口/前位 (UTG)';
      } else if (idx === last) {
        code = 'CO';
        nameZh = '关煞位 (CO)';
      } else if (idx === 1) {
        code = 'MP';
        nameZh = '中位偏前 (HJ/MP)';
      } else {
        code = 'MP';
        nameZh = '中位 (MP)';
      }
    }

    const remaining = table.players.filter(
      (p, i) => i !== heroIndex && !p.folded && !p.satOut && p.chips > 0
    ).length;

    let edge = '中性';
    let edgeDetail = '';
    if (code === 'BTN' || code === 'CO') {
      edge = '位置优势';
      edgeDetail =
        '你更晚行动，能看到多数人的选择再决定。同样起手牌在后位应比前位打得更宽、更主动。';
    } else if (code === 'SB') {
      edge = '位置劣势';
      edgeDetail =
        '翻牌后你通常最先行动，信息最少。翻前可适度防守，但别用垃圾牌硬扛加注。';
    } else if (code === 'BB') {
      edge = '有折扣、位置仍差';
      edgeDetail =
        '已投入大盲，跟注更便宜；但翻后仍常处劣势。面对后位偷鸡可扩大防守，面对前位强加注要收紧。';
    } else if (code === 'EP') {
      edge = '位置劣势';
      edgeDetail =
        '你最早表态，后面还有多人。开池范围应收紧：强牌加注，边缘牌多弃。';
    } else {
      edge = '中性偏谨慎';
      edgeDetail = '中位开池要比后位紧一档；被再加注时优先考虑强牌继续。';
    }

    return {
      code,
      nameZh,
      edge,
      edgeDetail,
      remaining,
      alive,
      dealerIndex: dealer
    };
  }

  /** Which open/call buckets this hand roughly fits */
  function rangeContext(hole, posCode) {
    const R = Ranges();
    const info = R.classify(hole);
    if (!info) return null;
    const key = info.key;

    const openByPos = {
      EP: '约 10–14%（超强+强对+部分同花 A/K）',
      MP: '约 14–18%',
      CO: '约 22–28%',
      BTN: '约 35–45%（可混入更多同花连张/后门）',
      SB: '约 25–35%（常直接加注，少 limps）',
      BB: '防守范围更宽（视开池位置/尺度）'
    };

    let fit = '';
    let buckets = [];
    if (info.tier === 'premium') {
      buckets = ['超强开池范围', '几乎任意位置 3-Bet/再加注价值'];
      fit = '落在各位置核心开池与 3-Bet 价值区。';
    } else if (info.tier === 'strong') {
      buckets = ['强开池范围', '后位可 3-Bet 混合'];
      fit =
        posCode === 'EP' || posCode === 'MP'
          ? '前/中位可开；面对紧 3-Bet 要谨慎。'
          : '后位开池舒适；可对前位开池考虑轻 3-Bet。';
    } else if (info.tier === 'playable') {
      buckets = ['后位开池/混入', '便宜看翻的投机牌'];
      fit =
        posCode === 'BTN' || posCode === 'CO'
          ? '较符合后位加宽的开池范围。'
          : '前位偏边缘，多数教材建议直接弃或极少混入。';
    } else {
      buckets = ['多数位置弃牌区'];
      fit = '通常不在标准开池范围内；除非盲位便宜防守，否则优先弃牌练纪律。';
    }

    return {
      key,
      tier: info.tier,
      label: info.label,
      tip: info.tip,
      buckets,
      fit,
      openGuide: openByPos[posCode] || openByPos.MP
    };
  }

  function handChenScore(hole) {
    // Rough Chen formula for preflop strength heuristic
    if (!hole || hole.length < 2) return 0;
    const scoreRank = (r) => {
      if (r === 14) return 10;
      if (r === 13) return 8;
      if (r === 12) return 7;
      if (r === 11) return 6;
      return r / 2;
    };
    const a = hole[0];
    const b = hole[1];
    const hi = a.rank >= b.rank ? a : b;
    const lo = a.rank >= b.rank ? b : a;
    let s = scoreRank(hi.rank);
    if (hi.rank === lo.rank) {
      s = Math.max(s * 2, 5);
    } else {
      const gap = hi.rank - lo.rank - 1;
      if (gap === 1) s -= 1;
      else if (gap === 2) s -= 2;
      else if (gap === 3) s -= 4;
      else if (gap >= 4) s -= 5;
      if (hi.suit === lo.suit) s += 2;
    }
    return s;
  }

  /**
   * Monte Carlo equity vs random opponent(s). Honest estimate.
   * @returns {{ win:number, tie:number, trials:number, vsLabel:string }}
   */
  function estimateEquity(heroHole, community, villainCount, trials) {
    const C = Cards();
    trials = trials || 220;
    villainCount = Math.max(1, Math.min(villainCount || 1, 5));
    community = (community || []).filter(Boolean);
    if (!heroHole || heroHole.length < 2) return null;

    const used = {};
    heroHole.forEach((c) => { used[c.id] = true; });
    community.forEach((c) => { used[c.id] = true; });

    let deck = C.createDeck().filter((c) => !used[c.id]);
    let wins = 0;
    let ties = 0;
    const needBoard = Math.max(0, 5 - community.length);

    for (let t = 0; t < trials; t++) {
      deck = C.shuffle(deck);
      let i = 0;
      const board = community.slice();
      for (let b = 0; b < needBoard; b++) board.push(deck[i++]);
      const villains = [];
      for (let v = 0; v < villainCount; v++) {
        villains.push([deck[i++], deck[i++]]);
      }
      const heroHand = C.evaluateHand(heroHole.concat(board));
      let heroBest = true;
      let tieCount = 0;
      for (let v = 0; v < villains.length; v++) {
        const vh = C.evaluateHand(villains[v].concat(board));
        const cmp = C.compareHands(heroHand, vh);
        if (cmp < 0) {
          heroBest = false;
          tieCount = 0;
          break;
        }
        if (cmp === 0) tieCount += 1;
      }
      if (!heroBest) continue;
      if (tieCount > 0) ties += 1;
      else wins += 1;
    }

    const winPct = Math.round((wins / trials) * 1000) / 10;
    const tiePct = Math.round((ties / trials) * 1000) / 10;
    return {
      win: winPct,
      tie: tiePct,
      trials,
      vsLabel:
        villainCount === 1
          ? '随机一人'
          : '随机 ' + villainCount + ' 人'
    };
  }

  /** Equity vs a tighter "typical continuing" subset via Chen filter */
  function estimateEquityVsTight(heroHole, community, trials) {
    const C = Cards();
    trials = trials || 180;
    community = (community || []).filter(Boolean);
    if (!heroHole || heroHole.length < 2) return null;
    const used = {};
    heroHole.forEach((c) => { used[c.id] = true; });
    community.forEach((c) => { used[c.id] = true; });
    let deck0 = C.createDeck().filter((c) => !used[c.id]);
    let wins = 0;
    let ties = 0;
    let done = 0;
    const needBoard = Math.max(0, 5 - community.length);
    let guard = 0;
    while (done < trials && guard < trials * 40) {
      guard += 1;
      let deck = C.shuffle(deck0.slice());
      let i = 0;
      const vHole = [deck[i++], deck[i++]];
      if (handChenScore(vHole) < 6) continue; // rough top ~35-45%
      const board = community.slice();
      for (let b = 0; b < needBoard; b++) board.push(deck[i++]);
      const heroHand = C.evaluateHand(heroHole.concat(board));
      const vh = C.evaluateHand(vHole.concat(board));
      const cmp = C.compareHands(heroHand, vh);
      if (cmp > 0) wins += 1;
      else if (cmp === 0) ties += 1;
      done += 1;
    }
    if (done === 0) return null;
    return {
      win: Math.round((wins / done) * 1000) / 10,
      tie: Math.round((ties / done) * 1000) / 10,
      trials: done,
      vsLabel: '偏强继续范围（粗滤）'
    };
  }

  function gtoTips(posCode, rangeInfo, street, facingRaise) {
    const tips = [];
    tips.push('以下为教材式 GTO 倾向，用于建立直觉；非求解器精确频率。');

    if (street === 'preflop') {
      if (posCode === 'BTN' || posCode === 'CO') {
        tips.push('后位：未开池时用标准开池尺度（约 2–2.5bb）主动进攻；可混入同花连张与后门 Ax。');
        tips.push('面对前位开池：超强牌价值 3-Bet；中等同花连张可选择跟注；垃圾高张多弃。');
      } else if (posCode === 'EP' || posCode === 'MP') {
        tips.push('前/中位：开池范围收紧；开了之后面对 3-Bet，没有强牌优先弃，避免“沉没成本”。');
      } else if (posCode === 'SB') {
        tips.push('小盲：少平跟。要么加注争夺，要么弃牌；平跟后位置最差。');
      } else if (posCode === 'BB') {
        tips.push('大盲：对后位偷鸡用偏宽防守；对 UTG/EP 开池收紧到强牌与好投机牌。');
      }
      if (rangeInfo) {
        if (rangeInfo.tier === 'premium') {
          tips.push('这手属于价值核心：优先加注/再加注建池，少慢玩。');
        } else if (rangeInfo.tier === 'fold') {
          tips.push('这手多在弃牌区：练「收紧」比硬玩更接近长期 GTO 纪律。');
        } else if (facingRaise) {
          tips.push('面对加注：先问位置与对手范围——没有继续权益时弃牌往往是 +EV。');
        }
      }
    } else if (street === 'flop') {
      tips.push('翻牌：作为开池方，在干燥面可高频持续下注；湿润面放慢，更多过牌-决策。');
      tips.push('作为防守方：强听牌/强对继续；空气牌多数弃，别用「已投入」说服自己。');
    } else if (street === 'turn') {
      tips.push('转牌：成牌提高价值下注；听牌看赔率与隐含赔率；被二次开火时范围要更强。');
    } else if (street === 'river') {
      tips.push('河牌：要么价值，要么诈唬（有阻断/压力），少「中间路线」无意义跟注。');
    } else {
      tips.push('摊牌后复盘：这手在该位置的开/弃是否符合范围纪律？');
    }
    return tips;
  }

  function analyze(table, heroIndex, opts) {
    opts = opts || {};
    const hero = table.players[heroIndex];
    if (!hero || !hero.hole || hero.hole.length < 2) {
      return {
        ok: false,
        title: 'GTO 练手助手',
        html: '<p class="coach-muted">发到你的底牌后，这里会给出位置、范围与胜率估算。</p>'
      };
    }

    const pos = heroSeatInfo(table, heroIndex);
    const range = rangeContext(hero.hole, pos.code);
    const street = table.street || 'preflop';
    const board =
      street === 'preflop'
        ? []
        : (table.community || []).slice(0, opts.boardRevealed != null ? opts.boardRevealed : 5);

    const villains = Math.max(
      1,
      table.players.filter((p, i) => i !== heroIndex && !p.folded && !p.satOut).length
    );

    const eqRandom = estimateEquity(hero.hole, board, Math.min(villains, 3), street === 'preflop' ? 240 : 200);
    const eqTight =
      street === 'preflop' || board.length >= 3
        ? estimateEquityVsTight(hero.hole, board, 160)
        : null;

    const facing =
      table.actionIndex === heroIndex &&
      table.players.some((p, i) => i !== heroIndex && (p.bet || 0) > (hero.bet || 0));

    const tips = gtoTips(pos.code, range, street, facing);

    const streetZh =
      { preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌', showdown: '摊牌' }[street] ||
      street;

    let html = '';
    html += '<div class="coach-block">';
    html += '<div class="coach-h">① 位置 · ' + streetZh + '</div>';
    html +=
      '<div class="coach-pos"><b>' +
      pos.nameZh +
      '</b> · <span class="coach-edge">' +
      pos.edge +
      '</span></div>';
    html +=
      '<p class="coach-p">' +
      pos.edgeDetail +
      ' 当前对手仍在手数：约 <b>' +
      pos.remaining +
      '</b> 人。</p>';
    html += '</div>';

    html += '<div class="coach-block">';
    html += '<div class="coach-h">② 起手牌 / 范围语境</div>';
    if (range) {
      html +=
        '<div class="coach-hand"><span class="coach-key">' +
        range.key +
        '</span> ' +
        range.label +
        '</div>';
      html +=
        '<p class="coach-p">粗分桶：' +
        range.buckets.join('、') +
        '。' +
        range.fit +
        '</p>';
      html +=
        '<p class="coach-p coach-muted">教材参考：本位置常规开池宽度 ' +
        range.openGuide +
        '（6-max 粗估）。</p>';
    } else {
      html += '<p class="coach-p">暂无起手数据。</p>';
    }
    html += '</div>';

    html += '<div class="coach-block">';
    html += '<div class="coach-h">③ 胜率估算 <span class="coach-tag">估计 · 非求解器</span></div>';
    if (eqRandom) {
      html +=
        '<p class="coach-p">对 <b>' +
        eqRandom.vsLabel +
        '</b>：约 <b class="coach-eq">' +
        eqRandom.win +
        '%</b> 胜' +
        (eqRandom.tie ? '，平局约 ' + eqRandom.tie + '%' : '') +
        ' <span class="coach-muted">（' +
        eqRandom.trials +
        ' 次抽样）</span></p>';
    }
    if (eqTight) {
      html +=
        '<p class="coach-p">对 <b>' +
        eqTight.vsLabel +
        '</b>：约 <b class="coach-eq">' +
        eqTight.win +
        '%</b> 胜' +
        (eqTight.tie ? '，平局约 ' + eqTight.tie + '%' : '') +
        '</p>';
    }
    html +=
      '<p class="coach-muted">说明：离线蒙特卡洛近似，用于建立感觉；真 GTO 还依赖筹码深度、行动线与对手范围。</p>';
    html += '</div>';

    html += '<div class="coach-block">';
    html += '<div class="coach-h">④ 轻量 GTO 倾向</div>';
    html += '<ul class="coach-tips">' + tips.map((x) => '<li>' + x + '</li>').join('') + '</ul>';
    html += '</div>';

    return {
      ok: true,
      title: 'GTO 练手助手',
      html,
      pos,
      range,
      eqRandom,
      eqTight
    };
  }

  global.PokerCoach = {
    analyze,
    heroSeatInfo,
    rangeContext,
    estimateEquity,
    gtoTips
  };
})(typeof window !== 'undefined' ? window : globalThis);
