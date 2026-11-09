/**
 * Hand action lineage + pro action captions (Call 50, 3-Bet 200, …).
 */
(function (global) {
  'use strict';

  function analyze(table) {
    if (!table || !table.players) {
      return { byPlayer: {}, timeline: [] };
    }
    return reparse(table);
  }

  function raiseLabel(level) {
    if (level <= 1) return { en: 'Bet', zh: '开枪' };
    if (level === 2) return { en: '3-Bet', zh: '3-Bet' };
    if (level === 3) return { en: '4-Bet', zh: '4-Bet' };
    if (level === 4) return { en: '5-Bet', zh: '5-Bet' };
    return { en: 'Raise', zh: '加注' };
  }

  function reparse(table) {
    const byPlayer = {};
    const timeline = [];
    table.players.forEach((p) => {
      byPlayer[p.id] = {
        putCount: 0,
        labels: [],
        lastLabel: null,
        lastActionEn: null,
        lastAmount: null,
        lastDisplay: null,
        opened: false
      };
    });

    function nameOf(id) {
      const p = table.players.find((x) => x.id === id);
      return p ? p.name : '?';
    }

    function setLast(bp, en, amount, zh) {
      bp.lastActionEn = en;
      bp.lastAmount = amount != null ? amount : null;
      bp.lastDisplay = amount != null && amount !== '' ? en + ' ' + amount : en;
      bp.lastLabel = zh || en;
      if (zh && !bp.labels.includes(zh)) bp.labels.push(zh);
      if (en && !bp.labels.includes(en)) bp.labels.push(en);
    }

    let aggro = 0;
    for (const h of table.history || []) {
      if (!h || h.playerId == null) continue;
      const bp = byPlayer[h.playerId];
      if (!bp) continue;
      const nm = nameOf(h.playerId);
      const pl = table.players.find((x) => x.id === h.playerId);
      const isAllIn = !!(pl && pl.allIn);

      if (h.type === 'blind') continue;

      if (h.type === 'fold') {
        setLast(bp, 'Fold', null, '弃牌');
        timeline.push({ playerId: h.playerId, name: nm, label: 'Fold', detail: '' });
        continue;
      }
      if (h.type === 'check') {
        setLast(bp, 'Check', null, '过牌');
        timeline.push({ playerId: h.playerId, name: nm, label: 'Check', detail: '' });
        continue;
      }
      if (h.type === 'call') {
        bp.putCount += 1;
        const amt = h.amount != null ? h.amount : pl ? pl.bet : null;
        const en = isAllIn ? 'All-in' : 'Call';
        const showAmt = isAllIn && pl && pl.bet ? pl.bet : amt;
        setLast(bp, en, showAmt, isAllIn ? '全下' : '平跟');
        timeline.push({
          playerId: h.playerId,
          name: nm,
          label: showAmt != null ? en + ' ' + showAmt : en,
          detail: ''
        });
        continue;
      }
      if (h.type === 'bet') {
        aggro = 1;
        bp.putCount += 1;
        const to = h.to != null ? h.to : h.amount;
        const en = isAllIn ? 'All-in' : 'Bet';
        setLast(bp, en, to, isAllIn ? '全下' : '开枪');
        bp.opened = true;
        timeline.push({
          playerId: h.playerId,
          name: nm,
          label: to != null ? en + ' ' + to : en,
          detail: ''
        });
        continue;
      }
      if (h.type === 'raise') {
        aggro += 1;
        bp.putCount += 1;
        const lab = raiseLabel(aggro);
        const to = h.to != null ? h.to : h.amount;
        let en;
        if (aggro <= 1) en = 'Bet';
        else if (aggro === 2) en = '3-Bet';
        else if (aggro === 3) en = '4-Bet';
        else if (aggro === 4) en = '5-Bet';
        else en = 'Raise'; // beyond 5-bet: just Raise
        if (isAllIn) en = 'All-in';
        setLast(bp, en, to, isAllIn ? '全下' : en);
        if (en === 'Bet') bp.opened = true;
        timeline.push({
          playerId: h.playerId,
          name: nm,
          label: to != null ? en + ' ' + to : en,
          detail: ''
        });
        continue;
      }
    }

    table.players.forEach((p, idx) => {
      const bp = byPlayer[p.id];
      if (!bp || bp.lastDisplay) return;
      if (p.bet > 0) {
        if (idx === table.bbIndex) setLast(bp, 'BB', p.bet, '大盲');
        else if (idx === table.sbIndex) setLast(bp, 'SB', p.bet, '小盲');
      }
    });

    return { byPlayer, timeline };
  }

  function primaryBadge(bp) {
    if (!bp) return null;
    if (bp.lastDisplay) return bp.lastDisplay;
    if (bp.lastActionEn) return bp.lastActionEn;
    const order = ['All-in', '5-Bet', '4-Bet', '3-Bet', 'Raise', 'Bet', 'Call', 'Fold'];
    for (const o of order) {
      if (bp.labels.includes(o)) return o;
    }
    return bp.lastLabel || null;
  }

  /** Caption for bet zone / seat: "Call 50", "3-Bet 200", "Check"… */
  function actionCaption(bp, streetBet) {
    if (bp && bp.lastDisplay) return bp.lastDisplay;
    if (bp && bp.lastActionEn) {
      return bp.lastAmount != null ? bp.lastActionEn + ' ' + bp.lastAmount : bp.lastActionEn;
    }
    if (streetBet > 0) return 'In ' + streetBet;
    return '';
  }

  global.PokerLineage = { analyze, primaryBadge, actionCaption };
})(typeof window !== 'undefined' ? window : globalThis);
