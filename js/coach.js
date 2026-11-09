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

    const compact = !!opts.compact;
    const tab = opts.tab || 'pos';

    function blockPos() {
      return (
        '<div class="coach-block">' +
        '<div class="coach-pos"><b>' + pos.nameZh + '</b> · <span class="coach-edge">' + pos.edge + '</span></div>' +
        '<p class="coach-p">' + pos.edgeDetail + ' 对手约 <b>' + pos.remaining + '</b> 人。</p>' +
        '</div>'
      );
    }
    function blockRange() {
      if (!range) return '<p class="coach-muted">暂无起手。</p>';
      return (
        '<div class="coach-block">' +
        '<div class="coach-hand"><span class="coach-key">' + range.key + '</span> ' + range.label + '</div>' +
        '<p class="coach-p">' + range.buckets.join(' · ') + '。' + range.fit + '</p>' +
        '<p class="coach-muted">开池宽约 ' + range.openGuide + '</p>' +
        '</div>'
      );
    }
    function blockEq() {
      let h = '<div class="coach-block">';
      if (eqRandom) {
        h +=
          '<p class="coach-p">' +
          eqRandom.vsLabel +
          '：<b class="coach-eq">' +
          eqRandom.win +
          '%</b>' +
          (eqRandom.tie ? '（平 ' + eqRandom.tie + '%）' : '') +
          '</p>';
      }
      if (eqTight) {
        h +=
          '<p class="coach-p">' +
          eqTight.vsLabel +
          '：<b class="coach-eq">' +
          eqTight.win +
          '%</b></p>';
      }
      h += '<p class="coach-muted">估计 · 非求解器 · ' + streetZh + '</p></div>';
      return h;
    }
    function blockGto() {
      const short = tips.slice(0, compact ? 3 : tips.length);
      return (
        '<div class="coach-block"><ul class="coach-tips">' +
        short.map((x) => '<li>' + x + '</li>').join('') +
        '</ul></div>'
      );
    }

    const dense = opts.dense || !compact;
    const sum =
      '<div class="coach-sum">' +
      '<span>' + pos.code + '</span>' +
      (range ? ' · <b>' + range.key + '</b>' : '') +
      (eqRandom ? ' · ~' + eqRandom.win + '%' : '') +
      (facing ? ' · 面对加注' : '') +
      ' · ' + streetZh +
      '</div>';

    let oddsHtml = '';
    if (table.actionIndex === heroIndex) {
      const toCall = Math.max(0, (table.currentBet || 0) - (hero.bet || 0));
      if (toCall > 0) {
        const pot = table.pot || 0;
        const pct = Math.round((toCall / (pot + toCall)) * 100);
        oddsHtml =
          '<div class="coach-block coach-odds">' +
          '<div class="coach-h">彩池赔率</div>' +
          '<p class="coach-p">跟注 <b>' + toCall + '</b> · 池 <b>' + pot +
          '</b> · 约需 <b class="coach-eq">' + pct + '%</b> 胜率打平</p>' +
          (eqRandom
            ? '<p class="coach-muted">当前估算 ~' + eqRandom.win + '%（随牌面更新）</p>'
            : '') +
          '</div>';
      }
    }

    let html = '';
    if (dense) {
      // Desktop: full live commentary stack (pos + range + equity + pot odds + GTO)
      html =
        sum +
        '<div class="coach-block"><div class="coach-h">① 位置 · ' + streetZh + '</div>' +
        blockPos().replace('class="coach-block"', 'class="coach-inner"') + '</div>' +
        '<div class="coach-block"><div class="coach-h">② 起手 / 范围</div>' +
        blockRange().replace('class="coach-block"', 'class="coach-inner"') + '</div>' +
        '<div class="coach-block"><div class="coach-h">③ 胜率估算</div>' +
        blockEq().replace('class="coach-block"', 'class="coach-inner"') + '</div>' +
        oddsHtml +
        '<div class="coach-block"><div class="coach-h">④ 倾向解说</div>' +
        blockGto().replace('class="coach-block"', 'class="coach-inner"') + '</div>';
    } else if (compact) {
      if (tab === 'range') html = blockRange();
      else if (tab === 'eq') html = blockEq() + oddsHtml;
      else if (tab === 'gto') html = blockGto();
      else html = blockPos() + oddsHtml;
      html = sum + html;
    } else {
      html = sum + blockPos() + blockRange() + blockEq() + oddsHtml + blockGto();
    }

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


  /**
   * Spot Q&A from current table state (educational heuristics, not a solver).
   * Returns { ok, answer, title }.
   */
  function answerQuestion(question, table, heroIndex, opts) {
    opts = opts || {};
    const q = String(question || '').trim();
    if (!q) {
      return { ok: false, title: '问答', answer: '请先输入你想问的问题。' };
    }
    if (!table) {
      return { ok: false, title: '问答', answer: '牌桌尚未开始。开桌发牌后再问本手判断。' };
    }
    const hero = table.players[heroIndex];
    if (!hero) {
      return { ok: false, title: '问答', answer: '找不到英雄座位。' };
    }
    const cardsReady = !!opts.cardsVisible && hero.hole && hero.hole.length >= 2;
    const ql0 = String(q).toLowerCase();
    const wantsHole =
      /跟|call|胜率|equity|起手|范围|该不该|怎么打|弃|open|raise|下注/.test(q) ||
      /call|equity|fold/.test(ql0);
    if (!cardsReady && wantsHole) {
      // Still allow pure pot-odds math without naming hole cards
      if (/赔率|odds|打平/.test(q) && table) {
        const heroBet = hero.bet || 0;
        const toCall = Math.max(0, (table.currentBet || 0) - heroBet);
        const pot = table.pot || 0;
        if (toCall > 0) {
          const pct = Math.round((toCall / (pot + toCall)) * 100);
          return {
            ok: true,
            title: '问答',
            answer:
              '（未亮手牌 · 仅赔率）当前跟注 ' +
              toCall +
              '、池约 ' +
              pot +
              '，大约需要 ' +
              pct +
              '% 胜率打平。看清手牌后可再问「该跟吗」。（教材启发式 · 非求解器）'
          };
        }
      }
      return {
        ok: true,
        title: '问答',
        answer: '发牌完成、看清你的两张底牌后再问本手判断（避免剧透）。也可先问「现在彩池赔率怎么样」。'
      };
    }
    if (!cardsReady) {
      return {
        ok: true,
        title: '问答',
        answer: '发牌完成后再结合本手牌作答。你可以问「什么是彩池赔率」或等手牌亮出。'
      };
    }

    const pos = heroSeatInfo(table, heroIndex);
    const range = rangeContext(hero.hole, pos.code);
    const street = table.street || 'preflop';
    const streetZh =
      { preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌', showdown: '摊牌' }[street] || street;
    const board =
      street === 'preflop'
        ? []
        : (table.community || []).slice(0, opts.boardRevealed != null ? opts.boardRevealed : 5);
    const villains = Math.max(
      1,
      table.players.filter((p, i) => i !== heroIndex && !p.folded && !p.satOut).length
    );
    const eqRandom = estimateEquity(hero.hole, board, Math.min(villains, 3), street === 'preflop' ? 220 : 180);
    const toCall = Math.max(0, (table.currentBet || 0) - (hero.bet || 0));
    const pot = table.pot || 0;
    const oddsPct = toCall > 0 ? Math.round((toCall / (pot + toCall)) * 100) : 0;
    const myTurn = table.actionIndex === heroIndex && !table.handOver;
    const facing = toCall > 0;
    const key = range ? range.key : '??';
    const disclaimer = '（教材启发式 · 非求解器）';

    const ql = q.toLowerCase();
    const askCall = /跟|call|跟注|该不该跟|要不要跟/.test(q) || /call/.test(ql);
    const askOdds = /赔率|odds|打平|需要多少/.test(q);
    const askEq = /胜率|equity|赢面|胜算|概率/.test(q);
    const askPos = /位置|起手|范围|怎么打|该不该开|open|fold|弃/.test(q);
    const askBet = /下注|加注|raise|bet|尺寸|多大/.test(q);
    const askCheck = /过牌|check|敲/.test(q);

    let lines = [];
    lines.push('局势：' + streetZh + ' · ' + pos.nameZh + '（' + pos.code + '）· 手牌 ' + key + (facing ? ' · 需跟 ' + toCall : ' · 无人要你跟注') + ' · 池 ' + pot + '。');

    if (askOdds || (askCall && facing)) {
      if (facing) {
        lines.push('彩池赔率：跟 ' + toCall + ' 打池 ' + pot + '，大约需要 ' + oddsPct + '% 胜率才打得平。');
        if (eqRandom) {
          const lean =
            eqRandom.win + 2 >= oddsPct
              ? '估算胜率略高于/接近打平线，跟注在数学上不亏；仍要看位置与对手范围。'
              : '估算胜率低于打平线，没有足够听牌/隐含赔率时倾向弃牌。';
          lines.push('粗算对 ' + eqRandom.vsLabel + ' 约 ' + eqRandom.win + '%。' + lean);
        }
      } else {
        lines.push('当前没有跟注额，谈「跟注赔率」意义不大。可关注价值下注或过牌控池。');
      }
    }

    if (askEq && !askOdds) {
      if (eqRandom) {
        lines.push('粗算胜率约 ' + eqRandom.win + '%（' + eqRandom.vsLabel + '）' + (eqRandom.tie ? '，平局约 ' + eqRandom.tie + '%' : '') + '。随公共牌变化会更新。');
      } else {
        lines.push('此刻胜率估算不可用，请等发牌完成后再问。');
      }
    }

    if (askCall && !askOdds) {
      if (!myTurn) {
        lines.push('现在还不是你的行动，先观察前位选择。');
      } else if (!facing) {
        lines.push('面前没有加注要跟。可考虑过牌或主动下注（看牌力与位置）。');
      } else if (eqRandom) {
        if (range && range.tier === 'premium') {
          lines.push('这是价值核心牌：多数场合倾向跟注甚至再加注建池，少慢玩。');
        } else if (eqRandom.win + 2 >= oddsPct) {
          lines.push('就赔率与粗算胜率看，跟注可接受；若只是弱高张且位置差，仍可纪律性弃牌。');
        } else {
          lines.push('赔率偏紧且牌力一般：教材倾向优先弃牌，把筹码留给更好的点。');
        }
      }
    }

    if (askPos || (!askCall && !askOdds && !askEq && !askBet && !askCheck)) {
      if (range) {
        lines.push('起手落点：' + range.label + '。' + range.fit);
        lines.push('该位置常见开池宽约：' + range.openGuide);
      }
      const tips = gtoTips(pos.code, range, street, facing);
      if (tips && tips.length > 1) lines.push(tips[1]);
    }

    if (askBet) {
      if (!myTurn) {
        lines.push('未轮到你时先计划：成牌偏价值尺寸，空气牌少无意义跟注。');
      } else if (street === 'preflop') {
        lines.push('翻前开池常见约 2–2.5bb；面对加注时 3-Bet 要有价值或明确阻挡牌理由。');
      } else {
        lines.push('翻后：干燥面可持续小注；湿润面放慢。价值下注讲清故事，别用中间尺寸乱打。');
      }
    }

    if (askCheck) {
      lines.push(facing ? '面对下注时不能过牌，只能跟/弃/再加。' : '无人下注时可过牌控池；作为开池方在湿润面也可更多过牌-决策。');
    }

    lines.push(disclaimer);
    return { ok: true, title: '本手问答', answer: lines.join('\n') };
  }

  global.PokerCoach = {
    analyze,
    answerQuestion,
    heroSeatInfo,
    rangeContext,
    estimateEquity,
    gtoTips
  };
})(typeof window !== 'undefined' ? window : globalThis);
