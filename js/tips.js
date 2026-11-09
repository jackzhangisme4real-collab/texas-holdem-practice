/**
 * Teaching tips in Chinese — short, practical, woven into play.
 */
(function (global) {
  'use strict';

  const HAND_RANK_CHART = [
    { name: '皇家同花顺', example: 'A♠ K♠ Q♠ J♠ 10♠', note: '同花顺里最大的一种' },
    { name: '同花顺', example: '9♥ 8♥ 7♥ 6♥ 5♥', note: '同花且连续' },
    { name: '四条', example: 'K♠ K♥ K♦ K♣ 2♠', note: '四张同点' },
    { name: '葫芦', example: 'Q♠ Q♥ Q♦ 7♣ 7♠', note: '三条 + 一对' },
    { name: '同花', example: 'A♦ J♦ 8♦ 4♦ 2♦', note: '五张同花色' },
    { name: '顺子', example: '10♣ 9♦ 8♠ 7♥ 6♣', note: '五张连续，花色不同也可' },
    { name: '三条', example: '8♠ 8♥ 8♦ K♣ 3♠', note: '三张同点' },
    { name: '两对', example: 'J♠ J♥ 4♦ 4♣ 9♠', note: '两个不同对子' },
    { name: '一对', example: 'A♠ A♥ 9♦ 5♣ 2♠', note: '两张同点' },
    { name: '高牌', example: 'A♣ J♦ 8♠ 6♥ 2♦', note: '以上都没有时比最大单张' }
  ];

  const GUIDED = [
    {
      title: '欢迎来到练手桌',
      body: '这是 6 人桌无限注德州扑克。你有起手两张底牌，公共牌最多五张。目标是用五张牌组成最强牌型，或让对手弃牌赢下彩池。'
    },
    {
      title: '位置很重要',
      body: '庄家按钮右侧是小盲、大盲。越晚行动（靠近庄家）信息越多，同种起手牌在后位更有价值。'
    },
    {
      title: '别每手都玩',
      body: '新手常见问题是跟注太多。起手牌偏弱、又在前位时，弃牌往往是正确的「进攻」。'
    },
    {
      title: '彩池赔率',
      body: '若跟注 10、池里已有 40，你大约要用 20% 的「胜率」才打得平。听牌时先估赔率，再决定跟不跟。'
    }
  ];

  function tipAfterHand(table, humanId) {
    const human = table.players.find((p) => p.id === humanId);
    if (!human) return null;
    const hist = table.history || [];
    const myActs = hist.filter((h) => h.playerId === humanId);
    const awards = (table.showdownResults && table.showdownResults.awards) || table.winners || [];
    const won = awards.some((a) => a.playerId === humanId);
    const foldWin = table.showdownResults && table.showdownResults.foldWin;

    if (foldWin) {
      const w = table.showdownResults.winnerName;
      if (w === human.name) {
        return {
          title: '本手提示 · 不战而胜',
          body: '对手都弃牌了，你不用亮牌也赢下彩池。诈唬或持续下注有时比「等成牌」更高效——但别每手都诈。'
        };
      }
      return {
        title: '本手提示 · 弃牌也是技术',
        body: '及时弃牌能省下筹码。德州是长期游戏：保住子弹，等更好的位置和起手牌。'
      };
    }

    // Position tip
    const n = table.players.length;
    const distFromDealer = (humanId - table.dealerIndex + n) % n;
    let pos = '中位';
    if (humanId === table.sbIndex) pos = '小盲（不利位置）';
    else if (humanId === table.bbIndex) pos = '大盲';
    else if (distFromDealer === 0) pos = '庄家位（有利）';
    else if (distFromDealer >= n - 2) pos = '后位（较有利）';
    else if (distFromDealer <= 2) pos = '前位（需更紧）';

    if (won) {
      return {
        title: '本手提示 · 你赢下了彩池',
        body:
          '本手你在「' +
          pos +
          '」。赢下的一手也值得复盘：是价值下注拿满了，还是对手太松？下一手继续关注位置与彩池赔率。'
      };
    }

    const folded = myActs.some((a) => a.type === 'fold');
    if (folded) {
      return {
        title: '本手提示 · 控制损失',
        body:
          '你在「' +
          pos +
          '」选择了弃牌。面对加注时，问问自己：跟注后的赔率够不够？没有听牌也没有强对时，弃牌通常不亏。'
      };
    }

    // Lost at showdown
    const myEval =
      table.showdownResults &&
      table.showdownResults.evaluations &&
      table.showdownResults.evaluations.find((e) => e.playerId === humanId);
    if (myEval) {
      return {
        title: '本手提示 · 摊牌复盘',
        body:
          '你的最终牌力是「' +
          myEval.desc +
          '」。摊牌输了不必懊恼：关注是否在弱势时仍投入过多。中等牌（如弱一对）适合控池，而不是大额硬跟。'
      };
    }

    return {
      title: '本手提示 · 练手节奏',
      body: '每手结束后花 5 秒想：我的位置？起手牌范围？有没有用到赔率？小复盘进步最快。'
    };
  }

  function tipForStreet(street) {
    const map = {
      preflop: {
        title: '翻前',
        body: '只看两张底牌。建议：大切对、AK/AQ、同花连张多玩；垃圾牌在前位果断弃。'
      },
      flop: {
        title: '翻牌',
        body: '三张公共牌落地。问自己：中没中？有没有同花/顺子听牌？谁先开火？'
      },
      turn: {
        title: '转牌',
        body: '第四张牌。听牌的赔率变差时要收手；强牌可以加大价值下注。'
      },
      river: {
        title: '河牌',
        body: '最后一张。诈唬要讲故事；弱牌被大额下注时，学会放手。'
      }
    };
    return map[street] || null;
  }

  function potOddsTip(toCall, pot) {
    if (toCall <= 0) return null;
    const pct = Math.round((toCall / (pot + toCall)) * 100);
    return {
      title: '彩池赔率',
      body:
        '跟注 ' +
        toCall +
        '，池子约 ' +
        pot +
        '，你需要大约 ' +
        pct +
        '% 的胜率才打得平。听牌时心里有数再跟。'
    };
  }

  global.PokerTips = {
    HAND_RANK_CHART,
    GUIDED,
    tipAfterHand,
    tipForStreet,
    potOddsTip
  };
})(typeof window !== 'undefined' ? window : globalThis);
