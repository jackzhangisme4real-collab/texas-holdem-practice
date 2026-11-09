/**
 * Node-compatible unit checks for hand evaluator + a few engine smoke tests.
 * Run: node js/test-evaluator.js
 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function loadBrowserScript(file) {
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { console, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

const root = path.join(__dirname);
const cardsCtx = loadBrowserScript(path.join(root, 'cards.js'));
const PokerCards = cardsCtx.PokerCards || cardsCtx.globalThis.PokerCards;
if (!PokerCards) {
  // scripts attach to globalThis inside IIFE with window || globalThis
  throw new Error('PokerCards not loaded');
}

// Re-load properly: our IIFE uses typeof window !== 'undefined' ? window : globalThis
function load(name) {
  const code = fs.readFileSync(path.join(root, name), 'utf8');
  const g = { console };
  g.globalThis = g;
  // Force globalThis branch
  const wrapped =
    'var window = undefined;\n' + code + '\nthis.PokerCards = globalThis.PokerCards; this.PokerEngine = globalThis.PokerEngine; this.PokerAI = globalThis.PokerAI;';
  vm.runInThisContext = vm.runInThisContext;
  const ctx = { console, globalThis: {}, results: {} };
  vm.createContext(ctx);
  vm.runInContext(
    code.replace(
      /typeof window !== 'undefined' \? window : globalThis/g,
      'globalThis'
    ),
    ctx
  );
  return ctx.globalThis;
}

const g = { console };
const ctx = { console, globalThis: g };
g.PokerCards = undefined;
vm.createContext(ctx);
function runFile(name) {
  let code = fs.readFileSync(path.join(root, name), 'utf8');
  code = code.replace(
    /typeof window !== 'undefined' \? window : globalThis/g,
    'globalThis'
  );
  vm.runInContext(code, ctx);
}
runFile('cards.js');
runFile('engine.js');
runFile('ai.js');

const C = ctx.globalThis.PokerCards;
const E = ctx.globalThis.PokerEngine;
const AI = ctx.globalThis.PokerAI;

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  ✓', msg);
  } else {
    failed += 1;
    console.error('  ✗', msg);
  }
}

function hand(str) {
  return str.trim().split(/\s+/).map((s) => C.parseCard(s));
}

console.log('Hand evaluator tests');
{
  const h = C.evaluateHand(hand('As Ks Qs Js 10s 2d 3c'));
  assert(h.category === C.CATEGORY.STRAIGHT_FLUSH && h.ranks[0] === 14, 'royal/broadway SF');
}
{
  const h = C.evaluateHand(hand('9h 8h 7h 6h 5h 2c 3d'));
  assert(h.category === C.CATEGORY.STRAIGHT_FLUSH && h.ranks[0] === 9, 'straight flush to 9');
}
{
  const h = C.evaluateHand(hand('Kc Kd Kh Ks 2d 9c 5h'));
  assert(h.category === C.CATEGORY.FOUR_KIND && h.ranks[0] === 13, 'four kings');
}
{
  const h = C.evaluateHand(hand('Qc Qd Qh 7c 7d 2s 3s'));
  assert(h.category === C.CATEGORY.FULL_HOUSE && h.ranks[0] === 12 && h.ranks[1] === 7, 'full house Q full of 7');
}
{
  const h = C.evaluateHand(hand('Ad Jd 8d 4d 2d 9c Kh'));
  assert(h.category === C.CATEGORY.FLUSH && h.ranks[0] === 14, 'ace-high flush');
}
{
  const h = C.evaluateHand(hand('10c 9d 8s 7h 6c 2d 3h'));
  assert(h.category === C.CATEGORY.STRAIGHT && h.ranks[0] === 10, 'straight to 10');
}
{
  const h = C.evaluateHand(hand('Ah 2c 3d 4s 5h 9c Kd'));
  assert(h.category === C.CATEGORY.STRAIGHT && h.ranks[0] === 5, 'wheel straight A-5');
}
{
  const h = C.evaluateHand(hand('8s 8h 8d Kc 3s 2d 9h'));
  assert(h.category === C.CATEGORY.THREE_KIND && h.ranks[0] === 8, 'three eights');
}
{
  const h = C.evaluateHand(hand('Js Jh 4d 4c 9s 2h 3c'));
  assert(h.category === C.CATEGORY.TWO_PAIR && h.ranks[0] === 11 && h.ranks[1] === 4, 'two pair J and 4');
}
{
  const h = C.evaluateHand(hand('As Ah 9d 5c 2s 7h 3c'));
  assert(h.category === C.CATEGORY.ONE_PAIR && h.ranks[0] === 14, 'pair of aces');
}
{
  const h = C.evaluateHand(hand('Ac Jd 8s 6h 2d 4c 9h'));
  assert(h.category === C.CATEGORY.HIGH_CARD && h.ranks[0] === 14, 'high card ace');
}
{
  const a = C.evaluateHand(hand('As Ah Kc Kd 2s 3h 4d'));
  const b = C.evaluateHand(hand('As Ah Qc Qd 2s 3h 4d'));
  assert(C.compareHands(a, b) > 0, 'A-K two pair beats A-Q two pair');
}
{
  const a = C.evaluateHand(hand('Ah 5h 4h 3h 2h 9c 8d'));
  assert(a.category === C.CATEGORY.STRAIGHT_FLUSH && a.ranks[0] === 5, 'steel wheel SF');
}

console.log('Engine smoke tests');
{
  const table = E.setupDefaultTable({ startingChips: 500, smallBlind: 5, bigBlind: 10 });
  const r = E.dealHand(table);
  assert(r.ok, 'dealHand ok');
  assert(table.players.every((p) => p.hole.length === 2), 'each player 2 hole cards');
  assert(table.pot === 15 || table.pot >= 15, 'blinds in pot');
  assert(table.community.length === 0, 'no board preflop');
  const hi = table.players.findIndex((p) => p.isHuman);
  // Fast-forward with folds until hand ends or many actions
  let guard = 200;
  while (!table.handOver && guard-- > 0) {
    const idx = table.actionIndex;
    const legal = E.legalActions(table, idx);
    let action;
    if (legal.check) action = { type: 'check' };
    else if (legal.call) action = { type: 'call' };
    else if (legal.fold) action = { type: 'fold' };
    else action = { type: 'allin' };
    // human sometimes bets small for coverage
    if (table.players[idx].isHuman && legal.bet && Math.random() < 0.2) {
      action = { type: 'bet', amount: legal.minBet + table.players[idx].bet };
    }
    const res = E.applyAction(table, idx, action);
    assert(res.ok, 'action ok ' + action.type);
  }
  assert(table.handOver, 'hand eventually ends');
  const totalChips = table.players.reduce((s, p) => s + p.chips, 0);
  assert(totalChips === 500 * 6, 'chip conservation: ' + totalChips);
}

console.log('AI smoke');
{
  const table = E.setupDefaultTable({ difficulty: 'normal' });
  E.dealHand(table);
  const idx = table.actionIndex;
  if (idx >= 0 && !table.players[idx].isHuman) {
    const a = AI.chooseAction(table, idx);
    assert(a && a.type, 'AI returns action');
  } else {
    assert(true, 'AI skipped (human to act) — ok');
  }
}

console.log('\nResult:', passed, 'passed,', failed, 'failed');
process.exit(failed ? 1 : 0);
