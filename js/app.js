/**
 * UI controller — premium broadcast-style practice table.
 */
(function () {
  'use strict';

  const Engine = PokerEngine;
  const AI = PokerAI;
  const Tips = PokerTips;
  const Cards = PokerCards;
  const SFX = PokerSFX;
  const Ranges = PokerRanges;
  const Chips = PokerChips;
  const Lineage = PokerLineage;
  const Banter = PokerBanter;
  const Avatars = PokerAvatars;
  const Persist = PokerPersist;
  const Coach = PokerCoach;

  const state = {
    table: null,
    guidedStep: -1,
    showGuided: false,
    tipPanel: null,
    busy: false,
    prevStreet: null,
    prevPot: 0,
    prevBets: {},
    startStack: 1000,
    settings: {
      startingChips: 1000,
      smallBlind: 5,
      bigBlind: 10,
      difficulty: 'normal',
      sfx: true,
      bgm: true,
      showRange: true,
      theme: 'q',
      tableId: 'micro'
    },
    progressReady: false,
    coachTab: 'pos',
    dealing: false,
    receivingSeat: -1,
    dealReveal: {},
    holePeeked: {},
    boardRevealed: 0,
    boardDealt: 0,
    boardFlipping: false,
    lastFlipped: -1,
    stats: {
      hands: 0,
      won: 0,
      folded: 0,
      startChips: 1000,
      ledger: []
    }
  };

  const el = (id) => document.getElementById(id);

  function loadStats() {
    /* legacy key merged inside loadProgress */
  }
  function saveStats() {
    saveProgress();
  }

  function loadProgress() {
    const prog = Persist.load();
    // migrate v1 stats if present and progress fresh
    try {
      const raw = localStorage.getItem('th_practice_stats_v1');
      if (raw && (!prog.hands || prog.hands === 0)) {
        const legacy = JSON.parse(raw);
        if (legacy && typeof legacy === 'object') {
          prog.hands = legacy.hands || 0;
          prog.won = legacy.won || 0;
          prog.folded = legacy.folded || 0;
          prog.ledger = legacy.ledger || [];
          prog.startChips = legacy.startChips || prog.startChips;
        }
      }
      const th = localStorage.getItem('th_practice_theme_v1');
      if (th === 'pro' || th === 'q') prog.theme = th;
    } catch (e) {}

    const table = Persist.tableById(prog.tableId);
    state.settings.tableId = table.id;
    state.settings.smallBlind = table.smallBlind;
    state.settings.bigBlind = table.bigBlind;
    state.settings.startingChips = table.startStack;
    state.settings.difficulty = prog.difficulty || 'normal';
    state.settings.theme = prog.theme === 'pro' ? 'pro' : 'q';
    state.settings.sfx = prog.sfx !== false;
    state.settings.bgm = prog.bgm !== false;
    state.settings.showRange = prog.showRange !== false;
    if (SFX.setBgmEnabled) SFX.setBgmEnabled(state.settings.bgm);
    state.stats.hands = prog.hands || 0;
    state.stats.won = prog.won || 0;
    state.stats.folded = prog.folded || 0;
    state.stats.startChips = prog.startChips || prog.stack || 1000;
    state.stats.ledger = Array.isArray(prog.ledger) ? prog.ledger : [];
    state._savedStack = Math.max(0, Math.floor(Number(prog.stack) || 0));
    state.progressReady = true;
    return prog;
  }

  function saveProgress() {
    if (!state.progressReady) return;
    const stack = state.table ? humanChips() : (state._savedStack || 0);
    state._savedStack = Math.max(0, stack);
    Persist.save({
      tableId: state.settings.tableId || 'micro',
      stack: state._savedStack,
      difficulty: state.settings.difficulty,
      theme: state.settings.theme,
      sfx: state.settings.sfx,
      bgm: state.settings.bgm !== false,
      showRange: state.settings.showRange,
      hands: state.stats.hands,
      won: state.stats.won,
      folded: state.stats.folded,
      startChips: state.stats.startChips,
      ledger: state.stats.ledger
    });
    const br = el('bankroll-label');
    if (br) br.textContent = String(state._savedStack);
  }

  function applyTableConfig(tableId, opts) {
    opts = opts || {};
    const table = Persist.tableById(tableId);
    state.settings.tableId = table.id;
    state.settings.smallBlind = table.smallBlind;
    state.settings.bigBlind = table.bigBlind;
    state.settings.startingChips = table.startStack;
    const tl = el('table-label');
    if (tl) tl.textContent = table.name;
    if (opts.resetStack) {
      state._savedStack = table.startStack;
      state.stats.startChips = table.startStack;
    }
  }

  function isHumanBroke() {
    return humanChips() <= 0;
  }

  function showBrokeModal() {
    toggleModal('modal-broke', true);
    const next = el('btn-next-hand');
    if (next) next.hidden = true;
  }

  function fillTableGrid() {
    const grid = el('table-grid');
    const stackEl = el('table-modal-stack');
    const stack = state.table ? humanChips() : (state._savedStack || 0);
    if (stackEl) stackEl.textContent = String(stack);
    if (!grid) return;
    grid.innerHTML = Persist.TABLES.map((tb) => {
      const ok = Persist.canSit(tb.id, stack) || stack <= 0 && tb.id === 'micro';
      const active = state.settings.tableId === tb.id;
      const locked = !ok && stack > 0;
      return (
        '<button type="button" class="table-card' +
        (active ? ' active' : '') +
        (locked ? ' locked' : '') +
        '" data-table="' + tb.id + '"' +
        (locked ? ' disabled' : '') +
        '>' +
        '<div class="tc-name">' + tb.name + (active ? ' · 当前' : '') + '</div>' +
        '<div class="tc-blinds">盲注 ' + tb.smallBlind + ' / ' + tb.bigBlind + '</div>' +
        '<div class="tc-blurb">' + tb.blurb + '</div>' +
        (locked
          ? '<div class="tc-lock">需要筹码 ≥ ' + tb.minStack + '</div>'
          : '<div class="tc-go">坐下开练</div>') +
        '</button>'
      );
    }).join('');
    grid.querySelectorAll('[data-table]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-table');
        if (stack <= 0) {
          sitTable(id, { resetStack: true, allowZeroRestart: true, force: true, resetStatsAnchor: true });
        } else {
          sitTable(id);
        }
      };
    });
  }

  function sitTable(tableId, opts) {
    opts = opts || {};
    const table = Persist.tableById(tableId);
    let stack = state.table ? humanChips() : (state._savedStack || 0);
    if (opts.forceStack != null) stack = opts.forceStack;
    if (stack <= 0 && !opts.allowZeroRestart) {
      showBrokeModal();
      return;
    }
    if (stack > 0 && !Persist.canSit(tableId, stack) && !opts.force) {
      flashStatus('筹码不足，无法进入「' + table.name + '」');
      return;
    }
    applyTableConfig(tableId, { resetStack: !!opts.resetStack });
    if (opts.resetStack) stack = table.startStack;
    state._savedStack = stack;
    toggleModal('modal-tables', false);
    toggleModal('modal-broke', false);
    openTableWithStack(stack, !!opts.resetStatsAnchor);
  }

  function openTableWithStack(humanStack, resetStatsAnchor) {
    const table = Persist.tableById(state.settings.tableId);
    SFX.setEnabled(state.settings.sfx);
    state.table = Engine.setupDefaultTable({
      startingChips: table.aiBuyIn,
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
      difficulty: state.settings.difficulty
    });
    // Human keeps persisted bankroll; AI get table buy-in
    const hi = state.table.players.findIndex((p) => p.isHuman);
    if (hi >= 0) {
      state.table.players[hi].chips = Math.max(0, Math.floor(humanStack));
      state.table.players[hi].satOut = state.table.players[hi].chips <= 0;
    }
    state.startStack = state.table.players[hi].chips;
    if (resetStatsAnchor) {
      state.stats.startChips = state.startStack;
    } else if (!state.stats.startChips) {
      state.stats.startChips = state.startStack;
    }
    state.tipPanel = {
      title: '开桌 · ' + table.name,
      body: '盲注 ' + table.smallBlind + '/' + table.bigBlind + ' · 你的练习筹码 ' + state.startStack + ' · 难度「' + diffLabel(state.settings.difficulty) + '」。进度自动保存在本机。'
    };
    saveProgress();
    if (state.startStack <= 0) {
      render();
      showBrokeModal();
      return;
    }
    Engine.dealHand(state.table);
    state.prevStreet = state.table.street;
    state.prevPot = state.table.pot;
    syncPrevBets();
    resetBoardReveal();
    state.tipPanel = Tips.tipForStreet('preflop') || state.tipPanel;
    runDealAnimation(() => kickAI());
  }

  function init() {
    loadProgress();
    applyTheme(state.settings.theme || 'q');
    bindUI();
    const seen = localStorage.getItem('th_practice_guided_v1');
    if (!seen) {
      state.showGuided = true;
      state.guidedStep = 0;
      localStorage.setItem('th_practice_guided_v1', '1');
    }
    const table = Persist.tableById(state.settings.tableId);
    const tl = el('table-label');
    if (tl) tl.textContent = table.name;
    const br = el('bankroll-label');
    if (br) br.textContent = String(state._savedStack || 0);
    if ((state._savedStack || 0) <= 0) {
      state.table = Engine.setupDefaultTable({
        startingChips: table.aiBuyIn,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        difficulty: state.settings.difficulty
      });
      state.table.players.forEach((p) => {
        if (p.isHuman) { p.chips = 0; p.satOut = true; }
      });
      render();
      showBrokeModal();
    } else {
      openTableWithStack(state._savedStack, false);
    }
    render();
    if (state.showGuided) showGuided();
    if (window.matchMedia) {
      const mq = window.matchMedia('(max-width: 720px)');
      const onMq = () => { if (state.table) render(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
  }


  function setAskDockOpen(open) {
    const dock = el('ask-dock');
    if (!dock) return;
    dock.classList.toggle('open', !!open);
    dock.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      const input = el('ask-input');
      if (input) setTimeout(() => input.focus(), 30);
    }
  }

  function appendAskMessage(role, text) {
    const log = el('ask-dock-log');
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'ask-msg ask-msg-' + role;
    const label = document.createElement('div');
    label.className = 'ask-msg-role';
    label.textContent = role === 'user' ? '你' : '助手';
    const body = document.createElement('div');
    body.className = 'ask-msg-body';
    body.textContent = text;
    row.appendChild(label);
    row.appendChild(body);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function runAsk(question) {
    const q = String(question || '').trim();
    if (!q) return;
    appendAskMessage('user', q);
    let reply;
    try {
      if (!Coach || !Coach.answerQuestion) {
        reply = { answer: '问答模块未加载。' };
      } else {
        const t = state.table;
        const hi = t ? humanIndex() : -1;
        reply = Coach.answerQuestion(q, t, hi, {
          cardsVisible: heroCardsVisible(),
          boardRevealed: state.boardRevealed
        });
      }
    } catch (err) {
      reply = { answer: '暂时无法回答，请稍后再试。' };
    }
    appendAskMessage('bot', (reply && reply.answer) || '没有合适的答复。');
  }

  function bindAskDock() {
    const openBtn = el('btn-ask-open');
    const closeBtn = el('btn-ask-close');
    const form = el('ask-dock-form');
    const chips = el('ask-dock-chips');
    if (openBtn) {
      openBtn.onclick = () => {
        SFX.unlock();
        SFX.click();
        const dock = el('ask-dock');
        const opening = !(dock && dock.classList.contains('open'));
        setAskDockOpen(opening);
      };
    }
    if (closeBtn) closeBtn.onclick = () => setAskDockOpen(false);
    if (form) {
      form.onsubmit = (ev) => {
        ev.preventDefault();
        const input = el('ask-input');
        const q = input ? input.value : '';
        if (input) input.value = '';
        SFX.click();
        runAsk(q);
      };
    }
    if (chips) {
      chips.querySelectorAll('[data-ask]').forEach((btn) => {
        btn.onclick = () => {
          SFX.click();
          runAsk(btn.getAttribute('data-ask'));
        };
      });
    }
  }

  function bindUI() {
    function syncMuteBtn() {
      const b = el('btn-mute');
      if (!b) return;
      b.textContent = SFX.isEnabled() ? '🔊 音效' : '🔇 静音';
    }
    let bgmBooted = false;
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
      document.body.addEventListener(ev, () => {
        SFX.unlock();
        if (!bgmBooted && state.settings.sfx !== false && state.settings.bgm !== false && SFX.startBgm) {
          bgmBooted = true;
          SFX.startBgm();
        }
      }, { once: false, passive: true });
    });
    const muteBtn = el('btn-mute');
    if (muteBtn) {
      muteBtn.onclick = () => {
        SFX.unlock();
        SFX.setEnabled(!SFX.isEnabled());
        state.settings.sfx = SFX.isEnabled();
        syncMuteBtn();
        if (el('set-sfx')) el('set-sfx').checked = SFX.isEnabled();
        if (SFX.isEnabled()) {
          SFX.click();
          if (state.settings.bgm !== false && SFX.startBgm) SFX.startBgm();
        }
      };
    }
    syncMuteBtn();
    const tp = el('btn-theme-pro');
    const tq = el('btn-theme-q');
    if (tp) tp.onclick = () => setTheme('pro');
    if (tq) tq.onclick = () => setTheme('q');

    el('btn-fold').onclick = () => { SFX.unlock(); SFX.click(); humanAct({ type: 'fold' }); };
    el('btn-check').onclick = () => { SFX.click(); humanAct({ type: 'check' }); };
    el('btn-call').onclick = () => { SFX.click(); humanAct({ type: 'call' }); };
    el('btn-bet').onclick = () => {
      SFX.click();
      const amt = Number(el('bet-input').value);
      const legal = Engine.legalActions(state.table, humanIndex());
      humanAct({ type: legal.bet ? 'bet' : 'raise', amount: amt });
    };
    el('btn-allin').onclick = () => { SFX.click(); humanAct({ type: 'allin' }); };

    el('bet-range').oninput = () => {
      el('bet-input').value = el('bet-range').value;
    };
    el('bet-input').onchange = () => syncBetFromInput();
    el('bet-input').oninput = () => syncBetFromInput();

    document.querySelectorAll('#size-row [data-size]').forEach((btn) => {
      btn.onclick = () => applySizeShortcut(btn.getAttribute('data-size'));
    });

    document.querySelectorAll('.coach-tab').forEach((btn) => {
      btn.onclick = () => {
        state.coachTab = btn.getAttribute('data-ctab') || 'pos';
        renderCoach();
      };
    });
    el('btn-next-hand').onclick = () => startNextHand();
    el('btn-restart').onclick = () => {
      if (confirm('重开当前牌桌？将按该桌起始筹码重置你的练习筹码（统计可保留）。')) {
        sitTable(state.settings.tableId || 'micro', {
          resetStack: true,
          resetStatsAnchor: true,
          force: true,
          allowZeroRestart: true
        });
      }
    };
    const btnCoachMob = el('btn-coach-mobile');
    if (btnCoachMob) {
      btnCoachMob.onclick = () => {
        document.body.classList.toggle('show-coach-mobile');
      };
    }
    bindAskDock();
    const btnTables = el('btn-tables');
    if (btnTables) {
      btnTables.onclick = () => {
        fillTableGrid();
        toggleModal('modal-tables', true);
      };
    }
    const brokeRestart = el('btn-broke-restart');
    if (brokeRestart) {
      brokeRestart.onclick = () => {
        sitTable('micro', {
          resetStack: true,
          resetStatsAnchor: true,
          force: true,
          allowZeroRestart: true,
          forceStack: 1000
        });
      };
    }
    const brokeRebuy = el('btn-broke-rebuy');
    if (brokeRebuy) {
      brokeRebuy.onclick = () => {
        const cur = state.settings.tableId || 'micro';
        sitTable(cur, { forceStack: 1000, force: true, allowZeroRestart: true });
      };
    }
    const brokeTables = el('btn-broke-tables');
    if (brokeTables) {
      brokeTables.onclick = () => {
        toggleModal('modal-broke', false);
        fillTableGrid();
        toggleModal('modal-tables', true);
      };
    }
    el('btn-ranks').onclick = () => toggleModal('modal-ranks', true);
    el('btn-range-chart').onclick = () => {
      fillRangeChart();
      toggleModal('modal-range', true);
    };
    el('btn-stats').onclick = () => {
      fillLedger();
      toggleModal('modal-stats', true);
    };
    el('btn-reset-stats').onclick = () => {
      if (!confirm('清空本场统计？')) return;
      state.stats = { hands: 0, won: 0, folded: 0, startChips: humanChips(), ledger: [] };
      saveStats();
      fillLedger();
      renderStats();
    };
    el('btn-help').onclick = () => {
      state.showGuided = true;
      state.guidedStep = 0;
      showGuided();
    };
    el('btn-settings').onclick = () => {
      el('set-chips').value = state.settings.startingChips;
      el('set-sb').value = state.settings.smallBlind;
      el('set-bb').value = state.settings.bigBlind;
      el('set-diff').value = state.settings.difficulty;
      el('set-sfx').checked = state.settings.sfx;
      if (el('set-bgm')) el('set-bgm').checked = state.settings.bgm !== false;
      el('set-range').checked = state.settings.showRange;
      toggleModal('modal-settings', true);
    };
    el('btn-save-settings').onclick = () => {
      const chips = clampInt(el('set-chips').value, 200, 50000, 1000);
      state.settings.startingChips = chips;
      state.settings.smallBlind = clampInt(el('set-sb').value, 1, 500, 5);
      state.settings.bigBlind = clampInt(el('set-bb').value, 2, 1000, 10);
      if (state.settings.bigBlind < state.settings.smallBlind * 2) {
        state.settings.bigBlind = state.settings.smallBlind * 2;
      }
      state.settings.difficulty = el('set-diff').value;
      state.settings.sfx = el('set-sfx').checked;
      state.settings.bgm = el('set-bgm') ? el('set-bgm').checked : true;
      state.settings.showRange = el('set-range').checked;
      SFX.setEnabled(state.settings.sfx);
      if (SFX.setBgmEnabled) SFX.setBgmEnabled(state.settings.bgm);
      if (typeof syncMuteBtn === 'function') syncMuteBtn();
      else {
        const b = el('btn-mute');
        if (b) b.textContent = state.settings.sfx ? '🔊 音效' : '🔇 静音';
      }
      state._savedStack = chips;
      state.stats.startChips = chips;
      toggleModal('modal-settings', false);
      openTableWithStack(chips, true);
    };
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.onclick = () => toggleModal(btn.getAttribute('data-close'), false);
    });
    el('btn-guided-next').onclick = () => {
      state.guidedStep += 1;
      if (state.guidedStep >= Tips.GUIDED.length) {
        toggleModal('modal-guided', false);
        state.showGuided = false;
      } else showGuided();
    };
    el('btn-guided-skip').onclick = () => {
      toggleModal('modal-guided', false);
      state.showGuided = false;
    };
  }

  function syncBetFromInput() {
    const v = clampInt(el('bet-input').value, Number(el('bet-range').min), Number(el('bet-range').max), Number(el('bet-range').value));
    el('bet-input').value = v;
    el('bet-range').value = v;
  }

  function applySizeShortcut(kind) {
    const t = state.table;
    const hi = humanIndex();
    const legal = Engine.legalActions(t, hi);
    if (!legal || !(legal.bet || legal.raise || legal.allIn)) return;
    SFX.click();
    const p = t.players[hi];
    const pot = t.pot;
    const min = legal.bet ? legal.minBet + p.bet : legal.minRaiseTo;
    const max = legal.maxBet;
    let to;
    if (kind === 'allin') {
      to = max;
    } else {
      const mult = Number(kind);
      if (legal.bet || t.currentBet === 0) {
        // bet size relative to pot
        to = p.bet + Math.floor(pot * mult);
      } else {
        // raise-to ≈ call + pot*mult (common broadcast shortcut feel)
        const toCall = Math.max(0, t.currentBet - p.bet);
        to = p.bet + toCall + Math.floor(pot * mult);
      }
      to = Math.max(min, Math.min(max, to));
    }
    el('bet-range').value = to;
    el('bet-input').value = to;
  }

  function clampInt(v, min, max, d) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return d;
    return Math.max(min, Math.min(max, n));
  }

  function humanIndex() {
    return state.table.players.findIndex((p) => p.isHuman);
  }

  /** How many hero hole cards have "landed" for UI reveal */
  function heroHoleLandedCount() {
    const t = state.table;
    if (!t) return 0;
    const hi = humanIndex();
    if (hi < 0) return 0;
    const human = t.players[hi];
    if (!human || !human.hole) return 0;
    const landed = state.dealReveal[human.id] || 0;
    if (state.dealing) return Math.min(landed, human.hole.length);
    // Deal finished: always treat as fully landed even if late onLand lagged
    return human.hole.length;
  }

  /** True once hero hole cards are face-up / readable in the UI (no spoilers before this) */
  function heroCardsVisible() {
    const t = state.table;
    if (!t) return false;
    const hi = humanIndex();
    if (hi < 0) return false;
    const human = t.players[hi];
    if (!human || !human.hole || human.hole.length < 2) return false;
    if (state.dealing) return false;
    return heroHoleLandedCount() >= 2;
  }

  function setTheme(theme) {
    state.settings.theme = theme === 'pro' ? 'pro' : 'q';
    try { localStorage.setItem('th_practice_theme_v1', state.settings.theme); } catch (e) {}
    applyTheme(state.settings.theme);
    saveProgress();
    render();
  }

  function applyTheme(theme) {
    document.body.classList.remove('theme-q', 'theme-pro');
    document.body.classList.add(theme === 'pro' ? 'theme-pro' : 'theme-q');
    const tp = el('btn-theme-pro');
    const tq = el('btn-theme-q');
    if (tp) tp.classList.toggle('active', theme === 'pro');
    if (tq) tq.classList.toggle('active', theme === 'q');
    const title = el('brand-title');
    const sub = el('brand-sub');
    if (theme === 'q') {
      if (title) title.textContent = 'Q萌德州练手桌';
      if (sub) sub.textContent = '直叶长桌 · 荷官发牌 · 练习筹码（非真钱）';
    } else {
      if (title) title.textContent = "Hold'em Practice";
      if (sub) sub.textContent = '单机练手 · 练习筹码 · 非真钱娱乐';
    }
    const dealer = el('dealer-station');
    if (dealer) {
      if (theme === 'q') {
        dealer.innerHTML = Avatars.dealerSvg();
        dealer.classList.add('dealer-opposite');
        dealer.classList.remove('pro-shoe');
      } else {
        dealer.innerHTML =
          '<div class="deal-shoe" aria-hidden="true">' +
          '<div class="shoe-body"></div><div class="shoe-lip"></div>' +
          '<div class="shoe-card"></div></div>' +
          '<div class="deal-hand-label">DEALER</div>';
        dealer.classList.remove('dealer-opposite');
        dealer.classList.add('pro-shoe');
      }
      dealer.style.display = '';
    }
  }

  function isMobilePortrait() {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
  }

  /** HSP-style oval: hero bottom, dealer top-center empty, 5 others around */
  function seatPositions(n) {
    const mobile = isMobilePortrait();
    // Hero kept above action dock; side seats clustered near rail
    const spots = mobile
      ? [
          { left: '50%', top: '82%', side: 'bottom' },
          { left: '10%', top: '68%', side: 'left' },
          { left: '8%', top: '40%', side: 'left' },
          { left: '24%', top: '20%', side: 'top' },
          { left: '76%', top: '20%', side: 'top' },
          { left: '90%', top: '68%', side: 'right' }
        ]
      : [
          { left: '50%', top: '80%', side: 'bottom' },
          { left: '11%', top: '72%', side: 'left' },
          { left: '7%', top: '42%', side: 'left' },
          { left: '22%', top: '17%', side: 'top' },
          { left: '78%', top: '17%', side: 'top' },
          { left: '89%', top: '72%', side: 'right' }
        ];
    return spots.slice(0, n);
  }

  function betZonePositions(n) {
    const q = [
      { left: '50%', top: '78%' },
      { left: '22%', top: '70%' },
      { left: '14%', top: '48%' },
      { left: '28%', top: '22%' },
      { left: '72%', top: '22%' },
      { left: '78%', top: '70%' }
    ];
    return q.slice(0, n);
  }

  function renderBetZones(t, hi, lineage) {
    const box = el('bet-zones');
    if (!box) return;
    if (state.settings.theme !== 'q') {
      box.innerHTML = '';
      return;
    }
    const pos = betZonePositions(t.players.length);
    let html = '';
    for (let vi = 0; vi < t.players.length; vi++) {
      const pi = (hi + vi) % t.players.length;
      const p = t.players[pi];
      const streetAmt = p.bet || 0;
      const isActor = !t.handOver && t.actionIndex === pi;
      const chips =
        streetAmt > 0
          ? Chips.renderStackColumns(streetAmt, { maxCols: 3, maxH: 5, compact: true })
          : '';
      const bp = (lineage && lineage.byPlayer && lineage.byPlayer[p.id]) || null;
      const cap = Lineage.actionCaption
        ? Lineage.actionCaption(bp, streetAmt)
        : streetAmt > 0
          ? 'In ' + streetAmt
          : '';
      html +=
        '<div class="bet-zone' +
        (!cap ? ' empty' : '') +
        (isActor ? ' active' : '') +
        (p.folded ? ' folded' : '') +
        '" data-seat="' +
        pi +
        '" style="left:' +
        pos[vi].left +
        ';top:' +
        pos[vi].top +
        '">' +
        '<div class="bz-name">' +
        escapeHtml(p.name) + '</div>' +
        chips +
        '<div class="bz-amt">' +
        escapeHtml(cap || '—') +
        '</div></div>';
    }
    box.innerHTML = html;
  }


  function resetBoardReveal() {
    state.boardRevealed = 0;
    state.boardDealt = 0;
    state.boardFlipping = false;
    state.lastFlipped = -1;
  }

  function streetMeta(street) {
    const map = {
      preflop: { zh: '翻前', en: 'Preflop' },
      flop: { zh: '翻牌', en: 'Flop' },
      turn: { zh: '转牌', en: 'Turn' },
      river: { zh: '河牌', en: 'River' },
      showdown: { zh: '摊牌', en: 'Showdown' }
    };
    return map[street] || { zh: street || '—', en: '' };
  }

  function updateStreetProgress(street) {
    const rail = el('street-progress');
    if (!rail) return;
    const order = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    let idx = order.indexOf(street);
    if (idx < 0) idx = 0;
    rail.querySelectorAll('.street-step').forEach((node) => {
      const s = node.getAttribute('data-s');
      const si = order.indexOf(s);
      node.classList.toggle('active', s === street);
      node.classList.toggle('done', si >= 0 && si < idx);
    });
    const meta = streetMeta(street);
    const sl = el('street-label');
    const se = el('street-en');
    const st = el('street-tag');
    const bst = el('board-street-tag');
    if (sl) sl.textContent = meta.zh;
    if (se) se.textContent = meta.en;
    if (st) st.textContent = (meta.en || meta.zh).toUpperCase();
    if (bst) bst.textContent = meta.zh + (meta.en ? ' / ' + meta.en : '');
  }

  /** Community: deal face-down then flip one-by-one up to table.community.length */
  function runBoardFlip(done) {
    const t = state.table;
    const target = t && t.community ? t.community.length : 0;
    if (target <= state.boardRevealed) {
      if (done) done();
      return;
    }
    state.boardFlipping = true;
    state.busy = true;
    state.boardDealt = target;
    // show remaining as backs first
    render();
    function flipOne() {
      if (!state.table) return;
      if (state.boardRevealed >= state.boardDealt) {
        state.boardFlipping = false;
        state.busy = false;
        state.lastFlipped = -1;
        render();
        if (done) done();
        return;
      }
      state.boardRevealed += 1;
      state.lastFlipped = state.boardRevealed - 1;
      if (SFX.flip) SFX.flip();
      else SFX.deal();
      render();
      setTimeout(flipOne, 780);
    }
    // short pause so backs are visible
    setTimeout(flipOne, 600);
  }

  /** Card-by-card deal: fly from dealer hands → land face-down; peek later */
  function runDealAnimation(thenKick) {
    SFX.unlock();
    const t = state.table;
    if (!t) return;
    state.dealing = true;
    state.busy = true;
    state.dealReveal = {};
    state.holePeeked = {};
    t.players.forEach((p) => { state.dealReveal[p.id] = 0; });
    render();

    const order = [];
    const n = t.players.length;
    let idx = t.dealerIndex;
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < n; i++) {
        idx = (idx + 1) % n;
        const p = t.players[idx];
        if (p.hole && p.hole.length) order.push(idx);
      }
    }

    const dealerEl = el('dealer-station');
    if (dealerEl) dealerEl.classList.add('dealing');

    let step = 0;
    function next() {
      if (step >= order.length) {
        state.receivingSeat = -1;
        if (dealerEl) dealerEl.classList.remove('dealing');
        // Ensure every seat shows both hole cards even if a late onLand lagged
        t.players.forEach((p) => {
          if (p.hole && p.hole.length) state.dealReveal[p.id] = p.hole.length;
        });
        state.dealing = false;
        // Hero dock is private: reveal hero faces immediately (seat peek still theatrical)
        const hi = humanIndex();
        if (hi >= 0) state.holePeeked[t.players[hi].id] = true;
        render();
        setTimeout(() => {
          state.busy = false;
          maybePeekActor(() => {
            if (thenKick) thenKick();
          });
        }, 420);
        return;
      }
      const pi = order[step];
      const p = t.players[pi];
      // fly first; only after landing bump dealReveal so seat shows face-down
      flyDealCard(pi, () => {
        state.dealReveal[p.id] = (state.dealReveal[p.id] || 0) + 1;
        state.receivingSeat = pi;
        render();
        setTimeout(() => { if (state.receivingSeat === pi) state.receivingSeat = -1; }, 500);
      });
      SFX.deal();
      step += 1;
      const gap = state.settings.theme === 'q' ? 780 : 620;
      setTimeout(next, gap);
    }
    setTimeout(next, state.settings.theme === 'q' ? 480 : 360);
  }

  function dealOriginRect() {
    const arm = document.querySelector('#dealer-station .dealer-arm, #dealer-station .deal-shoe');
    const station = el('dealer-station');
    const felt = el('felt');
    const node = arm || station || felt;
    const r = node.getBoundingClientRect();
    // prefer right-hand / shoe tip
    if (arm) {
      return { x: r.left + r.width * 0.55, y: r.top + r.height * 0.35, w: r.width, h: r.height };
    }
    if (station && getComputedStyle(station).display !== 'none') {
      return { x: r.left + r.width * 0.72, y: r.top + r.height * 0.45, w: r.width, h: r.height };
    }
    // pro fallback: top-center of felt (shoe zone)
    const f = felt.getBoundingClientRect();
    return { x: f.left + f.width * 0.5, y: f.top + f.height * 0.12, w: 40, h: 40 };
  }

  function flyDealCard(seatIndex, onLand) {
    const toSeat = document.querySelector('.seat[data-seat="' + seatIndex + '"]');
    let to = null;
    const t = state.table;
    const p = t && t.players[seatIndex];
    // Mobile hides .seat-cards; fly hero cards into the visible hero dock instead
    if (p && p.isHuman && isMobilePortrait()) {
      const dockCards = el('hero-hole-cards');
      if (dockCards && getComputedStyle(dockCards).display !== 'none') {
        to = dockCards;
      }
    }
    if (!to) {
      const toCards = toSeat ? toSeat.querySelector('.seat-cards') : null;
      // Prefer seat if seat-cards is display:none (zero rect breaks aim)
      if (toCards) {
        const r = toCards.getBoundingClientRect();
        to = (r.width > 2 && r.height > 2) ? toCards : (toSeat || toCards);
      } else {
        to = toSeat;
      }
    }
    if (!to) {
      if (onLand) onLand();
      return;
    }
    const o = dealOriginRect();
    const b = to.getBoundingClientRect();
    const layer = el('chip-fly-layer') || document.body;
    const card = document.createElement('div');
    card.className = 'deal-fly deal-fly-3d';
    const x0 = o.x - 18;
    const y0 = o.y - 12;
    const x1 = b.left + b.width / 2 - 18;
    const y1 = b.top + b.height / 2 - 24;
    card.style.left = x0 + 'px';
    card.style.top = y0 + 'px';
    card.style.setProperty('--dx', (x1 - x0) + 'px');
    card.style.setProperty('--dy', (y1 - y0) + 'px');
    // slight arc lift proportional to distance
    const dist = Math.hypot(x1 - x0, y1 - y0);
    card.style.setProperty('--arc', Math.min(90, 28 + dist * 0.06) + 'px');
    layer.appendChild(card);
    void card.offsetWidth;
    card.classList.add('flying');
    const flight = state.settings.theme === 'q' ? 980 : 820;
    setTimeout(() => {
      card.classList.add('landed');
      if (onLand) onLand();
      setTimeout(() => card.remove(), 280);
    }, flight);
  }

  /** Face-down until actor peeks (human) or showdown reveal */
  function maybePeekActor(done) {
    const t = state.table;
    if (!t || t.handOver) {
      if (done) done();
      return;
    }
    const ai = t.actionIndex;
    if (ai < 0) {
      if (done) done();
      return;
    }
    const p = t.players[ai];
    if (!p || state.holePeeked[p.id]) {
      if (done) done();
      return;
    }
    // AI: subtle lift only; Human: flip to face
    state.busy = true;
    const seat = document.querySelector('.seat[data-seat="' + ai + '"]');
    if (seat) seat.classList.add('peeking');
    if (SFX.flip) SFX.flip();
    setTimeout(() => {
      state.holePeeked[p.id] = true;
      if (seat) seat.classList.remove('peeking');
      state.busy = false;
      render();
      if (done) done();
    }, p.isHuman ? 720 : 380);
  }

  function humanChips() {
    const t = state.table;
    if (!t) return state._savedStack != null ? state._savedStack : state.settings.startingChips;
    const hi = humanIndex();
    if (hi < 0) return state._savedStack || 0;
    return t.players[hi].chips;
  }

  function newTable(resetStatsAnchor) {
    if (resetStatsAnchor) {
      applyTableConfig(state.settings.tableId || 'micro', { resetStack: true });
      openTableWithStack(Persist.tableById(state.settings.tableId).startStack, true);
      return;
    }
    openTableWithStack(state._savedStack != null ? state._savedStack : state.settings.startingChips, false);
  }

  function diffLabel(d) {
    return { easy: '轻松', normal: '标准', hard: '较难' }[d] || d;
  }

  function startNextHand() {
    if (!state.table || !state.table.handOver) return;
    saveProgress();
    if (isHumanBroke()) {
      showBrokeModal();
      flashStatus('筹码归零：请重开或补充练习筹码');
      return;
    }
    const table = Persist.tableById(state.settings.tableId);
    for (const p of state.table.players) {
      if (!p.isHuman && p.chips <= 0) {
        p.chips = table.aiBuyIn;
        p.satOut = false;
      }
      if (p.isHuman && p.chips <= 0) p.satOut = true;
    }
    if (isHumanBroke()) {
      showBrokeModal();
      return;
    }
    state.startStack = state.table.players[humanIndex()].chips;
    Engine.dealHand(state.table);
    state.prevStreet = state.table.street;
    state.prevPot = state.table.pot;
    syncPrevBets();
    resetBoardReveal();
    state.tipPanel = Tips.tipForStreet(state.table.street);
    runDealAnimation(() => kickAI());
  }

  function humanAct(action) {
    if (state.busy || state.dealing || state.boardFlipping || !state.table || state.table.handOver) return;
    const hi = humanIndex();
    if (state.table.actionIndex !== hi) return;
    const res = Engine.applyAction(state.table, hi, action);
    if (!res.ok) {
      flashStatus('操作无效：' + (res.reason || ''));
      return;
    }
    playActionSfx(action.type);
    onActionResolved(res, hi);
  }

  function playActionSfx(type) {
    if (type === 'fold') SFX.fold();
    else if (type === 'check') {
      if (SFX.knock) SFX.knock();
      else SFX.check();
    } else if (type === 'call' || type === 'bet' || type === 'raise' || type === 'allin') SFX.bet();
  }

  const ACTION_BURST_LABEL = {
    fold: 'FOLD',
    check: 'CHECK',
    call: 'CALL',
    bet: 'BET',
    raise: 'RAISE',
    allin: 'ALL-IN'
  };

  function showActionBurst(type, seatIndex) {
    const label = ACTION_BURST_LABEL[type];
    if (!label) return;
    const layer = el('chip-fly-layer') || document.body;
    const seatEl = seatIndex >= 0 ? document.querySelector('.seat[data-seat="' + seatIndex + '"]') : null;
    const burst = document.createElement('div');
    burst.className = 'action-burst action-burst-' + type;
    burst.textContent = label;
    if (seatEl) {
      const r = seatEl.getBoundingClientRect();
      burst.style.left = (r.left + r.width / 2) + 'px';
      burst.style.top = (r.top + r.height * 0.15) + 'px';
    } else {
      burst.style.left = '50%';
      burst.style.top = '42%';
    }
    layer.appendChild(burst);
    void burst.offsetWidth;
    burst.classList.add('show');
    if (type === 'check' && seatEl) {
      seatEl.classList.add('check-knock');
      setTimeout(() => seatEl.classList.remove('check-knock'), 420);
    }
    setTimeout(() => burst.remove(), 980);
  }

  function onActionResolved(res, actorIndex) {
    const hist = state.table && state.table.history ? state.table.history : [];
    const last = hist[hist.length - 1];
    const actType = last && last.type !== 'blind' ? last.type : null;
    if (actType) showActionBurst(actType, actorIndex);
    maybeAnimateChips(actorIndex);
    state.prevPot = state.table.pot;
    syncPrevBets();
    const pendingBanter = {
      actorIndex: actorIndex,
      type: actType
    };
    const streetChanged = res.streetAdvanced || state.table.street !== state.prevStreet;
    if (streetChanged) {
      state.prevStreet = state.table.street;
      const tip = Tips.tipForStreet(state.table.street);
      if (tip) state.tipPanel = tip;
    }

    function afterBoard() {
      render();
      const lin = Lineage.analyze(state.table);
      if (pendingBanter.type != null && pendingBanter.actorIndex >= 0) {
        maybeBanter(pendingBanter.type, pendingBanter.actorIndex, lin);
      }
      if (res.handOver) {
        // Reveal all live hands
        state.table.players.forEach((pl) => {
          if (!pl.folded && pl.hole && pl.hole.length) state.holePeeked[pl.id] = true;
        });
        const won = (state.table.winners || []).some((w) => w.playerId === humanIndex());
        if (won) SFX.win();
        (state.table.winners || []).forEach((w) => {
          const idx = state.table.players.findIndex((p) => p.id === w.playerId);
          const wl = Banter.lineFor('win');
          if (idx >= 0 && wl) setTimeout(() => showBanter(idx, wl), 120);
        });
        saveProgress();
        render();
        if (isHumanBroke()) showBrokeModal();
        return;
      }
      kickAI();
    }

    if (res.handOver) {
      recordHandResult();
      state.tipPanel = Tips.tipAfterHand(state.table, humanIndex());
      runBoardFlip(afterBoard);
      return;
    }
    if ((state.table.community || []).length > state.boardRevealed) {
      runBoardFlip(afterBoard);
      return;
    }
    afterBoard();
  }

  function recordHandResult() {
    const t = state.table;
    const hi = humanIndex();
    const human = t.players[hi];
    const endStack = human.chips;
    // Approximate: after hand, before rebuy — profit this hand vs startStack
    const delta = endStack - state.startStack;
    const won = (t.winners || []).some((w) => w.playerId === hi);
    const folded = (t.history || []).some((h) => h.playerId === hi && h.type === 'fold');
    state.stats.hands += 1;
    if (won) state.stats.won += 1;
    if (folded && !won) state.stats.folded += 1;
    state.stats.ledger.unshift({
      n: t.handNumber,
      delta,
      won,
      folded,
      note: won ? '赢下' : folded ? '弃牌' : '摊牌'
    });
    if (state.stats.ledger.length > 80) state.stats.ledger.length = 80;
    saveStats();
  }

  function kickAI() {
    if (!state.table || state.table.handOver || state.dealing || state.boardFlipping) return;
    if (state.busy) return;
    const idx = state.table.actionIndex;
    if (idx < 0) return;
    const p = state.table.players[idx];
    if (!state.holePeeked[p.id]) {
      maybePeekActor(() => { kickAI(); });
      return;
    }
    if (p.isHuman) {
      const legal = Engine.legalActions(state.table, idx);
      if (legal.toCall > 0) {
        const tip = Tips.potOddsTip(legal.toCall, state.table.pot);
        if (tip) state.tipPanel = tip;
      }
      render();
      return;
    }
    state.busy = true;
    render();
    setTimeout(() => {
      if (!state.table || state.table.handOver) {
        state.busy = false;
        render();
        return;
      }
      if (state.table.actionIndex !== idx) {
        state.busy = false;
        kickAI();
        return;
      }
      const action = AI.chooseAction(state.table, idx);
      const res = Engine.applyAction(state.table, idx, action);
      state.busy = false;
      if (!res.ok) {
        const legal = Engine.legalActions(state.table, idx);
        const fb = legal.check ? { type: 'check' } : legal.fold ? { type: 'fold' } : { type: 'call' };
        const res2 = Engine.applyAction(state.table, idx, fb);
        playActionSfx(fb.type);
        onActionResolved(res2, idx);
        return;
      }
      playActionSfx(action.type);
      onActionResolved(res, idx);
    }, 420 + Math.random() * 380);
  }

  function toggleModal(id, show) {
    const m = el(id);
    if (!m) return;
    m.classList.toggle('open', !!show);
    m.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function showGuided() {
    const g = Tips.GUIDED[state.guidedStep];
    if (!g) return;
    el('guided-title').textContent = g.title;
    el('guided-body').textContent = g.body;
    el('guided-progress').textContent = state.guidedStep + 1 + ' / ' + Tips.GUIDED.length;
    el('btn-guided-next').textContent =
      state.guidedStep >= Tips.GUIDED.length - 1 ? '开始打牌' : '下一条';
    toggleModal('modal-guided', true);
  }

  function flashStatus(msg) {
    const s = el('status-line');
    s.textContent = msg;
    s.classList.add('flash');
    setTimeout(() => s.classList.remove('flash'), 800);
  }


  function syncPrevBets() {
    const t = state.table;
    if (!t) return;
    const m = {};
    t.players.forEach((p) => { m[p.id] = p.bet; });
    state.prevBets = m;
  }

  function maybeAnimateChips(actorIndex) {
    if (actorIndex == null || actorIndex < 0) return;
    const t = state.table;
    const p = t.players[actorIndex];
    if (!p) return;
    const prev = state.prevBets[p.id] || 0;
    const delta = (p.bet || 0) - prev;
    if (delta <= 0 && t.pot <= state.prevPot) return;
    const seatEl = document.querySelector('.seat[data-seat="' + actorIndex + '"]');
    // Prefer pot as flight target so chip-push reads as seat → pot (not sideways into a zone)
    const potEl = el('pot-display');
    const potChip = potEl ? potEl.querySelector('.pot-chip') : null;
    const target = potChip || potEl;
    const color = Chips.colorForAmount(delta > 0 ? delta : 10);
    const n = Math.min(6, Math.max(2, Math.ceil((delta || 10) / Math.max(t.bigBlind, 1))));
    const allIn = !!p.allIn || delta >= (p.chips + delta);
    SFX.unlock();
    SFX.chipsToPot();
    if (seatEl) {
      seatEl.classList.add('stack-drain');
      setTimeout(() => seatEl.classList.remove('stack-drain'), 500);
    }
    // Animate an inner pot chip, not #pot-display itself (avoids transform fight / viewport jolt)
    if (potChip) {
      potChip.classList.add('pot-chip-pop');
      setTimeout(() => potChip.classList.remove('pot-chip-pop'), 480);
    }
    playPushHands(seatEl, target, color, delta > 0 ? delta : t.bigBlind, allIn);
    Chips.flyChips(seatEl, target, color, allIn ? Math.max(n, 5) : n);
  }

  function chipFill(color) {
    return color === 'black' ? '#222' : color === 'blue' ? '#1e5a9a' : color === 'green' ? '#0d7a3c' : color === 'purple' ? '#6a1a9a' : color === 'orange' ? '#d97706' : color === 'white' ? '#eee' : '#b01020';
  }

  function playPushHands(fromEl, toEl, color, amount, twoHands) {
    if (!fromEl || !toEl) return;
    const layer = el('chip-fly-layer') || document.body;
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const fill = chipFill(color);
    const hands = twoHands ? 2 : 1;
    for (let h = 0; h < hands; h++) {
      const wrap = document.createElement('div');
      wrap.className = 'push-hands' + (twoHands ? ' dual' : '');
      wrap.innerHTML =
        '<svg viewBox="0 0 90 52" xmlns="http://www.w3.org/2000/svg">' +
        (twoHands
          ? '<ellipse cx="24" cy="32" rx="13" ry="9" fill="#e8c4a0"/><ellipse cx="66" cy="32" rx="13" ry="9" fill="#d4a888"/>'
          : '<ellipse cx="45" cy="34" rx="16" ry="11" fill="#e8c4a0"/>') +
        '<rect x="28" y="16" width="34" height="12" rx="4" fill="#c9a227"/>' +
        '<circle cx="45" cy="20" r="8" fill="' + fill + '" stroke="#f0d78c" stroke-width="1.2"/>' +
        '</svg>';
      const x0 = a.left + a.width / 2 - 36 + (h === 1 ? 14 : twoHands ? -10 : 0);
      const y0 = a.top + 10;
      const x1 = b.left + b.width / 2 - 36 + (h === 1 ? 8 : 0);
      const y1 = b.top + b.height / 2 - 18;
      wrap.style.left = x0 + 'px';
      wrap.style.top = y0 + 'px';
      layer.appendChild(wrap);
      void wrap.offsetWidth;
      wrap.classList.add('show');
      wrap.style.transform = 'translate(' + (x1 - x0) + 'px,' + (y1 - y0) + 'px) scale(1.05)';
      setTimeout(() => {
        wrap.style.opacity = '0';
        setTimeout(() => wrap.remove(), 320);
      }, 1100 + h * 100);
    }
  }

  function showBanter(seatIndex, text) {
    if (!text) return;
    const seatEl = document.querySelector('.seat[data-seat="' + seatIndex + '"]');
    if (!seatEl) return;
    const old = seatEl.querySelector('.banter-bubble');
    if (old) old.remove();
    const b = document.createElement('div');
    b.className = 'banter-bubble';
    b.textContent = text;
    seatEl.appendChild(b);
    setTimeout(() => b.remove(), 2800);
  }

  function lineageBadgeClass(lab) {
    const s = String(lab || '');
    const head = s.split(' ')[0];
    if (head === '开枪' || head === 'Bet' || head === 'Open') return 'open';
    if (head === '3-Bet') return 'bet3';
    if (head === '4-Bet') return 'bet4';
    if (head === '5-Bet' || /\d-Bet/.test(head)) return 'bet5';
    if (head === 'Raise') return 'bet3';
    if (head === '平跟' || head === 'Call') return 'call';
    if (head === '弃牌' || head === 'Fold') return 'fold';
    if (head === 'All-in') return 'bet5';
    if (head === 'Check') return 'call';
    return '';
  }

  function renderActionLog(lineage) {
    const box = el('action-log');
    if (!box) return;
    const rows = (lineage.timeline || []).slice(-14);
    if (!rows.length) {
      box.innerHTML = '<div class="action-log-row"><span class="det">本手尚无自愿行动</span></div>';
      return;
    }
    box.innerHTML = rows
      .map(
        (r) =>
          '<div class="action-log-row"><span class="lab">' +
          escapeHtml(r.label) +
          '</span><span class="who">' +
          escapeHtml(r.name) +
          '</span><span class="det">' +
          escapeHtml(r.detail || '') +
          '</span></div>'
      )
      .join('');
    try {
      box.scrollTop = box.scrollHeight;
    } catch (e) {}
  }

  function maybeBanter(actionType, actorIndex, lineage) {
    const t = state.table;
    if (!t) return;
    const bp = lineage && lineage.byPlayer ? lineage.byPlayer[t.players[actorIndex].id] : null;
    let level = 0;
    if (bp && bp.lastLabel) {
      if (bp.lastLabel === '3-Bet') level = 2;
      else if (bp.lastLabel === '4-Bet') level = 3;
      else if (bp.lastLabel === '5-Bet' || /Bet/.test(bp.lastLabel)) level = 4;
      else if (bp.lastLabel === '开枪') level = 1;
    }
    const pot = t.pot;
    const big = pot > t.bigBlind * 12;
    const line = Banter.lineFor(actionType, { level, big });
    if (line) showBanter(actorIndex, line);
  }

  function fillChipLegend() {
    const box = el('chip-legend');
    if (!box) return;
    box.innerHTML = Chips.DENOMS.map((d) =>
      '<span class="chip-legend-item"><span class="chip chip-' + d.color + '"><span class="chip-edge"></span></span>' + d.label + '</span>'
    ).join('');
  }

  function renderCard(card, faceDown, opts) {
    opts = opts || {};
    const extra = (opts.board ? ' board-card' : '') + (opts.reveal ? ' reveal flip-in' : '') + (opts.win ? ' win-glow' : '') + (opts.down ? ' hole-down' : '');
    if (faceDown || !card) {
      return '<div class="card back' + extra + '" aria-hidden="true"></div>';
    }
    const color = card.color === 'red' ? 'red' : 'black';
    return (
      '<div class="card ' + color + extra + '" title="' + card.label + card.symbol + '">' +
      '<div class="corner"><span class="r">' + card.label + '</span><span class="s">' + card.symbol + '</span></div>' +
      '<div class="pip">' + card.symbol + '</div>' +
      '<div class="corner bl"><span class="r">' + card.label + '</span><span class="s">' + card.symbol + '</span></div>' +
      '</div>'
    );
  }


  function renderStats() {
    el('stat-hands').textContent = state.stats.hands;
    el('stat-won').textContent = state.stats.won;
    el('stat-fold').textContent = state.stats.folded;
    const profit = humanChips() - (state.stats.startChips || state.settings.startingChips);
    el('stat-profit').textContent = (profit >= 0 ? '+' : '') + profit;
    const wr = state.stats.hands ? Math.round((state.stats.won / state.stats.hands) * 100) + '%' : '—';
    el('session-wr').textContent = wr;
  }

  function renderCoach() {
    const box = el('coach-assist');
    if (!box || !Coach) return;
    const tab = state.coachTab || 'pos';
    document.querySelectorAll('.coach-tab').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-ctab') === tab);
    });
    const t = state.table;
    if (!t) {
      box.innerHTML = '<p class="coach-muted">等待开桌…</p>';
      return;
    }
    const hi = humanIndex();
    const human = t.players[hi];
    if (!human || !human.hole || human.hole.length < 2) {
      box.innerHTML = '<p class="coach-muted">发牌后显示简要建议。</p>';
      return;
    }
    if (!heroCardsVisible()) {
      box.innerHTML = '<p class="coach-muted">发牌完成、看清手牌后显示针对本手的建议。</p>';
      return;
    }
    if (human.folded) {
      box.innerHTML = '<p class="coach-muted">已弃牌 · 下一手刷新。</p>';
      return;
    }
    try {
      const report = Coach.analyze(t, hi, {
        boardRevealed: state.boardRevealed,
        compact: isMobilePortrait(),
        tab: tab,
        dense: !isMobilePortrait()
      });
      box.innerHTML = report.html || '';
    } catch (err) {
      box.innerHTML = '<p class="coach-muted">助手暂时无法计算。</p>';
    }
  }

  function renderHeroDock() {
    const cardsEl = el('hero-hole-cards');
    const metaEl = el('hero-hole-meta');
    const dock = el('hero-hole-dock');
    if (!cardsEl || !dock) return;
    const t = state.table;
    if (!t) {
      cardsEl.innerHTML = '';
      cardsEl.classList.remove('folded-review');
      dock.classList.remove('is-folded-review');
      if (metaEl) metaEl.textContent = '';
      return;
    }
    const hi = humanIndex();
    const human = t.players[hi];
    if (!human || !human.hole || human.hole.length < 2) {
      cardsEl.innerHTML = '<div class="card slot board-card"></div><div class="card slot board-card"></div>';
      cardsEl.classList.remove('folded-review');
      dock.classList.remove('is-folded-review');
      if (metaEl) metaEl.textContent = '等待发牌';
      return;
    }
    const landed = state.dealReveal[human.id] || 0;
    const revealed = state.dealing ? landed : human.hole.length;
    let html = '';
    if (!state.dealing) {
      // Private hero dock: always face-up once the deal is over (fold-review stays face-up too)
      html =
        renderCard(human.hole[0], false, { reveal: false, win: false }) +
        renderCard(human.hole[1], false, { reveal: false, win: false });
    } else {
      // During deal: never empty dashed slots — show backs, flip to face as each lands
      html += revealed >= 1
        ? renderCard(human.hole[0], false, { reveal: false, win: false })
        : '<div class="card back hole-down" aria-hidden="true"></div>';
      html += revealed >= 2
        ? renderCard(human.hole[1], false, { reveal: false, win: false })
        : '<div class="card back hole-down" aria-hidden="true"></div>';
    }
    cardsEl.innerHTML = html;
    cardsEl.classList.toggle('folded-review', !!human.folded);
    dock.classList.toggle('is-folded-review', !!human.folded);
    if (metaEl) {
      if (human.folded) {
        const key = heroCardsVisible() && Ranges.holeKey ? Ranges.holeKey(human.hole) : '';
        metaEl.textContent = '已弃 · 复盘' + (key ? (' · ' + key) : '') + ' · STACK ' + human.chips;
      } else if (!heroCardsVisible()) {
        metaEl.textContent = (state.dealing ? '发牌中' : '…') + ' · STACK ' + human.chips;
      } else {
        const key = Ranges.holeKey ? Ranges.holeKey(human.hole) : '';
        metaEl.textContent = (key || '手牌') + ' · STACK ' + human.chips;
      }
    }
  }

  function renderRange() {
    const box = el('range-box');
    if (!state.settings.showRange) {
      box.style.opacity = '0.35';
      el('range-key').textContent = '已隐藏';
      el('range-label').textContent = '可在设置中开启';
      const rtX = el('range-tip');
      if (rtX) rtX.textContent = '';
      return;
    }
    box.style.opacity = '1';
    const t = state.table;
    const human = t.players[humanIndex()];
    if (!human.hole || human.hole.length < 2 || human.folded) {
      el('range-key').className = 'range-key muted';
      el('range-key').textContent = human.folded ? 'Fold' : '—';
      el('range-label').textContent = human.folded ? '本手已弃' : '等待发牌';
      const rt0 = el('range-tip');
      if (rt0) rt0.textContent = '';
      return;
    }
    if (!heroCardsVisible()) {
      el('range-key').className = 'range-key muted';
      el('range-key').textContent = '—';
      el('range-label').textContent = state.dealing ? '发牌中…' : '看牌后显示';
      const rt0 = el('range-tip');
      if (rt0) rt0.textContent = '';
      return;
    }
    // Only meaningful preflop as "starting hand" tip; still show key later as reference
    const info = Ranges.classify(human.hole);
    el('range-key').className = 'range-key ' + info.color;
    el('range-key').textContent = info.key;
    el('range-label').textContent = info.label + (t.street === 'preflop' ? '' : '（翻前）');
    const rt = el('range-tip');
    if (rt) rt.textContent = info.tip;
  }

  function render() {
    const t = state.table;
    if (!t) return;

    el('pot-amount').textContent = t.pot;
    const br = el('bankroll-label');
    if (br) br.textContent = String(humanChips());
    const tl = el('table-label');
    if (tl) tl.textContent = Persist.tableById(state.settings.tableId).name;

    const pile = el('pot-pile-wrap');
    if (pile) pile.innerHTML = t.pot > 0 ? Chips.renderPotPile(t.pot) : '';
        el('blind-label').textContent = t.smallBlind + ' / ' + t.bigBlind;
    el('hand-num').textContent = String(t.handNumber);
    el('diff-label').textContent = diffLabel(t.difficulty);

    updateStreetProgress(t.street);
    const board = el('board');
    let boardHtml = '';
    for (let i = 0; i < 5; i++) {
      if (t.community[i]) {
        const faceDown = i >= state.boardRevealed;
        const justFlipped = !faceDown && state.lastFlipped === i;
        boardHtml += renderCard(t.community[i], faceDown, {
          board: true,
          reveal: justFlipped,
          win: false
        });
      } else {
        boardHtml += '<div class="card slot board-card"></div>';
      }
    }
    board.innerHTML = boardHtml;
    const boardArea = el('board-area');
    if (boardArea) {
      const sm = streetMeta(t.street);
      boardArea.setAttribute('data-street', t.street || '');
      const tag = el('board-street-tag');
      if (tag) tag.textContent = sm.zh + (sm.en ? ' · ' + sm.en : '');
    }

    const hi = humanIndex();
    const winIds = new Set();
    if (t.handOver && t.winners) t.winners.forEach((w) => winIds.add(w.playerId));

    const lineage = Lineage.analyze(t);
    renderActionLog(lineage);
    renderBetZones(t, hi, lineage);

    const seats = el('seats');
    const pos = seatPositions(t.players.length);
    let html = '';
    for (let vi = 0; vi < t.players.length; vi++) {
      const pi = (hi + vi) % t.players.length;
      const p = t.players[pi];
      const isActor = !t.handOver && t.actionIndex === pi;
      const isDealer = t.dealerIndex === pi;
      const isSB = t.sbIndex === pi;
      const isBB = t.bbIndex === pi;
      const isOut = p.satOut || p.chips <= 0;
      const showdownFace =
        t.handOver && t.showdownResults && !t.showdownResults.foldWin && !p.folded;
      const peeked = !!state.holePeeked[p.id];
      // Face-up only after peek (human) or showdown reveal; else face-down backs
      const showCards = (p.isHuman && peeked) || showdownFace;
      const justPeek = p.isHuman && peeked && isActor && !showdownFace;
      let cardsHtml = '';
      const landed = state.dealReveal[p.id] || 0;
      const revealed = state.dealing ? landed : (landed || (p.hole ? p.hole.length : 0));
      if (p.folded && !(p.isHuman && p.hole && p.hole.length)) {
        // Opponents: keep FOLD tag after muck
        cardsHtml = '<div class="folded-tag">FOLD</div>';
      } else if (p.hole && p.hole.length) {
        if (revealed <= 0) {
          cardsHtml = '';
        } else {
          // Hero after fold: keep face-up cards for review (dimmed by .is-folded CSS)
          const faceUp = (p.isHuman && p.folded) || showCards;
          const c0 = revealed >= 1;
          const c1 = revealed >= 2;
          cardsHtml = '';
          if (c0) {
            cardsHtml += renderCard(p.hole[0], !faceUp, {
              reveal: (faceUp && !p.folded && (showdownFace || justPeek)),
              win: winIds.has(p.id),
              down: !faceUp
            });
          }
          if (c1) {
            cardsHtml += renderCard(p.hole[1], !faceUp, {
              reveal: (faceUp && !p.folded && (showdownFace || justPeek)),
              win: winIds.has(p.id),
              down: !faceUp
            });
          }
          if (p.isHuman && p.folded) {
            cardsHtml =
              '<div class="fold-review-wrap">' +
              cardsHtml +
              '<span class="fold-review-badge" aria-hidden="true">FOLD</span></div>';
          }
        }
      }
      const badges = [];
      const posMarks = [];
      if (isDealer) posMarks.push('<span class="badge dealer pos-btn" title="Dealer / 庄位">D</span>');
      if (isSB) posMarks.push('<span class="badge sb pos-btn" title="Small Blind / 小盲">SB</span>');
      if (isBB) posMarks.push('<span class="badge bb pos-btn" title="Big Blind / 大盲">BB</span>');
      if (p.allIn && !p.folded) badges.push('<span class="badge allin">ALL-IN</span>');
      const posHtml = posMarks.length ? '<div class="pos-markers">' + posMarks.join('') + '</div>' : '';
      const posFloat = posMarks.length ? '<div class="pos-float">' + posMarks.join('') + '</div>' : '';

      const bp = lineage.byPlayer[p.id] || { putCount: 0, labels: [], lastLabel: null };
      const prim = Lineage.primaryBadge(bp);
      let lineageHtml = '';
      const badgeText = prim && !/^弃牌|Fold$/.test(String(prim).split(' ')[0]) ? prim : null;
      if (badgeText) {
        lineageHtml = '<span class="lineage-badge ' + lineageBadgeClass(badgeText) + '">' + escapeHtml(badgeText) + '</span>';
      }

      const streetAmt = p.bet || 0;
      const seatCap = Lineage.actionCaption
        ? Lineage.actionCaption(bp, streetAmt)
        : streetAmt > 0
          ? 'In ' + streetAmt
          : '';

      const exitTag = p.folded || isOut ? '<div class="exit-tag">' + (isOut && !p.folded ? '出局' : '退场') + '</div>' : '';
      const putTag =
        bp.putCount > 0
          ? '<div class="bet-count-tag">本手 ×' + bp.putCount + '</div>'
          : '';

      const stackBadge =
        '<div class="stack-badge" title="剩余筹码">' +
        '<span class="sb-cap">剩余</span><span class="sb-amt">' + p.chips + '</span></div>';

      // Compact street bet float toward felt (not between avatar and info)
      const betFloat =
        streetAmt > 0
          ? '<div class="seat-bet-float" title="本街投入">' +
            Chips.renderStackColumns(streetAmt, { maxCols: 3, maxH: 5, compact: true }) +
            '<span class="sbf-amt">' + escapeHtml(seatCap || String(streetAmt)) + '</span></div>'
          : '';

      html +=
        '<div class="seat' +
        (p.isHuman ? ' human' : '') +
        (isActor ? ' actor' : '') +
        (p.folded ? ' is-folded' : '') +
        (isOut ? ' is-out' : '') +
        (state.receivingSeat === pi ? ' receiving' : '') +
        (winIds.has(p.id) ? ' is-winner' : '') +
        ' side-' + (pos[vi].side || 'in') +
        '" data-seat="' + pi + '" style="left:' + pos[vi].left + ';top:' + pos[vi].top + '">' +
        exitTag +
        '<div class="seat-cluster">' +
        '<div class="avatar-wrap">' + Avatars.svgFor(p, pi, state.settings.theme) + posFloat + stackBadge + '</div>' +
        '<div class="seat-info">' +
        '<div class="seat-name">' + escapeHtml(p.name) + badges.join('') + lineageHtml + '</div>' +
        '<div class="stack-label"><span class="stack-caption">STACK</span><span class="stack-amt">' + p.chips + '</span></div>' +
        putTag +
        '</div></div>' +
        betFloat +
        '<div class="seat-cards">' + cardsHtml + '</div>' +
        '</div>';
    }
    seats.innerHTML = html;

    let status = '';
    if (t.handOver) {
      if (t.showdownResults && t.showdownResults.foldWin) {
        status = t.showdownResults.winnerName + ' 未摊牌赢得彩池';
      } else if (t.winners && t.winners.length) {
        status = t.winners
          .map((w) => {
            const name = t.players.find((p) => p.id === w.playerId).name;
            return name + ' +' + w.amount + (w.desc ? '（' + w.desc + '）' : '');
          })
          .join('　');
      } else status = '本手结束';
    } else if (t.actionIndex >= 0) {
      const actor = t.players[t.actionIndex];
      status = '行动权：' + actor.name + (state.busy && !actor.isHuman ? '（思考中…）' : '');
    }
    el('status-line').textContent = status;

    const sd = el('showdown-box');
    if (t.handOver && t.showdownResults && t.showdownResults.evaluations && t.showdownResults.evaluations.length) {
      sd.hidden = false;
      sd.innerHTML =
        '<div class="sd-title">SHOWDOWN</div>' +
        t.showdownResults.evaluations
          .map((e) => {
            const cards = e.hole.map((c) => c.label + c.symbol).join(' ') + ' → ' + e.desc;
            return '<div class="sd-row"><strong>' + escapeHtml(e.name) + '</strong> ' + cards + '</div>';
          })
          .join('');
    } else {
      sd.hidden = true;
      sd.innerHTML = '';
    }

    if (state.tipPanel) {
      el('tip-title').textContent = state.tipPanel.title;
      el('tip-body').textContent = state.tipPanel.body;
    } else {
      el('tip-title').textContent = 'GTO 练手助手';
    }

    renderCoach();
    renderHeroDock();
    renderRange();
    renderStats();

    const nextBtn = el('btn-next-hand');
    nextBtn.hidden = !t.handOver;
    const actionBar = el('action-bar');
    const hi2 = humanIndex();
    const myTurn = !t.handOver && t.actionIndex === hi2 && !state.busy;
    actionBar.classList.toggle('disabled', !myTurn);

    const legal = myTurn ? Engine.legalActions(t, hi2) : null;
    const facing = !!(legal && legal.toCall > 0);

    el('btn-fold').disabled = !myTurn || !facing;
    el('btn-check').disabled = !myTurn || !(legal && legal.check);
    el('btn-check').style.display = legal && legal.check ? '' : 'none';
    el('btn-call').disabled = !myTurn || !(legal && legal.call);
    el('btn-call').style.display = legal && legal.call ? '' : myTurn && legal && legal.check ? 'none' : '';
    el('btn-call').textContent = legal && legal.call ? 'CALL 跟注 ' + legal.callAmount : 'CALL 跟注';
    el('btn-allin').disabled = !myTurn || !(legal && legal.allIn);

    const canBetOrRaise = myTurn && legal && (legal.bet || legal.raise);
    el('btn-bet').disabled = !canBetOrRaise;
    el('btn-bet').textContent = legal && legal.bet ? 'BET 下注' : 'RAISE 加注至';

    const range = el('bet-range');
    const input = el('bet-input');
    const wrap = el('bet-wrap');
    const sizeRow = el('size-row');
    if (canBetOrRaise) {
      const min = legal.bet ? legal.minBet + t.players[hi2].bet : legal.minRaiseTo;
      const max = legal.maxBet;
      range.min = min;
      range.max = Math.max(min, max);
      range.step = 1;
      input.min = min;
      input.max = Math.max(min, max);
      let cur = Number(input.value);
      if (Number.isNaN(cur) || cur < min || cur > max) cur = Math.min(max, Math.max(min, Math.floor((min + max) / 2)));
      range.value = cur;
      input.value = cur;
      range.disabled = false;
      input.disabled = false;
      wrap.classList.remove('disabled');
      sizeRow.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      el('bet-hint').textContent = 'min ' + min + ' · max ' + max;
    } else {
      range.disabled = true;
      input.disabled = true;
      wrap.classList.add('disabled');
      sizeRow.querySelectorAll('button').forEach((b) => {
        b.disabled = !(myTurn && legal && legal.allIn && b.getAttribute('data-size') === 'allin');
      });
      el('bet-hint').textContent = '';
    }
  }

  function streetZh(s) {
    return ({ preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌', showdown: '摊牌' }[s] || s);
  }
  function styleZh(s) {
    return ({ tight: '偏紧', loose: '偏松', aggressive: '激进', balanced: '均衡', nit: '极紧' }[s] || s);
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fillRanks() {
    el('ranks-list').innerHTML = Tips.HAND_RANK_CHART.map(
      (r) =>
        '<div class="rank-row"><div class="rank-name">' + r.name +
        '</div><div class="rank-ex">' + r.example +
        '</div><div class="rank-note">' + r.note + '</div></div>'
    ).join('');
  }

  function fillRangeChart() {
    el('range-chart-list').innerHTML = Ranges.chartRows()
      .map(
        (r) =>
          '<div class="chart-row"><div class="t">' + r.title +
          '</div><div class="c">' + r.cards +
          '</div><div class="n">' + r.note + '</div></div>'
      )
      .join('');
  }

  function fillLedger() {
    const list = el('ledger-list');
    if (!state.stats.ledger.length) {
      list.innerHTML = '<p class="tip-body" style="color:#9a958a;">暂无记录。打完几手再来看。</p>';
      return;
    }
    list.innerHTML = state.stats.ledger
      .map((row) => {
        const sign = row.delta >= 0 ? '+' : '';
        const col = row.delta >= 0 ? '#2ecc71' : '#e57373';
        return (
          '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">' +
          '<span>#' + row.n + ' ' + row.note + '</span>' +
          '<span style="color:' + col + ';font-weight:700;">' + sign + row.delta + '</span></div>'
        );
      })
      .join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    fillRanks();
    init();
  });
})();
