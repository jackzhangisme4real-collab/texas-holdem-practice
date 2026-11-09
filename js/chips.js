/**
 * Televised-style chip denominations, stacks, and pot piles.
 * Colors roughly match common casino / broadcast chips.
 */
(function (global) {
  'use strict';

  // High → low for greedy breakdown
  const DENOMS = [
    { value: 1000, color: 'orange', label: '1K' },
    { value: 500, color: 'purple', label: '500' },
    { value: 100, color: 'black', label: '100' },
    { value: 25, color: 'green', label: '25' },
    { value: 10, color: 'blue', label: '10' },
    { value: 5, color: 'red', label: '5' },
    { value: 1, color: 'white', label: '1' }
  ];

  function breakdown(amount) {
    let left = Math.max(0, Math.floor(amount || 0));
    const stacks = [];
    for (const d of DENOMS) {
      if (left < d.value && d.value > 1) continue;
      const count = Math.floor(left / d.value);
      if (count > 0) {
        stacks.push({ value: d.value, color: d.color, label: d.label, count });
        left -= count * d.value;
      }
    }
    if (!stacks.length && amount > 0) {
      stacks.push({ value: 1, color: 'white', label: '1', count: 1 });
    }
    return stacks;
  }

  /** Cap visible chips per column for aesthetics */
  function visibleCount(count, maxShow) {
    const max = maxShow || 12;
    return Math.min(count, max);
  }

  function renderStackColumns(amount, opts) {
    opts = opts || {};
    const maxCols = opts.maxCols || 4;
    const maxH = opts.maxH || 10;
    const compact = !!opts.compact;
    const stacks = breakdown(amount);
    // Prefer showing highest denoms; merge overflow into fewer columns
    const cols = stacks.slice(0, maxCols);
    if (!cols.length) {
      return '<div class="chip-stack empty" title="0"></div>';
    }
    let html = '<div class="chip-stack' + (compact ? ' compact' : '') + '" title="' + amount + '">';
    for (const s of cols) {
      const n = visibleCount(s.count, maxH);
      html += '<div class="chip-col" data-den="' + s.value + '">';
      for (let i = 0; i < n; i++) {
        html +=
          '<div class="chip chip-' +
          s.color +
          '" style="--i:' +
          i +
          '"><span class="chip-edge"></span><span class="chip-face">' +
          (i === n - 1 ? s.label : '') +
          '</span></div>';
      }
      if (s.count > n) {
        html += '<div class="chip-more">+' + (s.count - n) + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderPotPile(amount) {
    const stacks = breakdown(amount);
    let totalChips = 0;
    stacks.forEach((s) => { totalChips += s.count; });
    // Scatter a tasteful pile (max ~18 visible discs)
    const discs = [];
    for (const s of stacks) {
      const take = Math.min(s.count, 6);
      for (let i = 0; i < take; i++) discs.push(s);
    }
    discs.sort((a, b) => a.value - b.value);
    while (discs.length > 18) discs.shift();
    let html = '<div class="pot-pile" aria-hidden="true">';
    discs.forEach((s, i) => {
      const ang = (i * 47) % 360;
      const r = 4 + (i % 5) * 3;
      const x = Math.cos((ang * Math.PI) / 180) * r;
      const y = Math.sin((ang * Math.PI) / 180) * r * 0.55 - (i % 4) * 1.2;
      html +=
        '<div class="chip chip-' +
        s.color +
        ' pot-chip-disc" style="--x:' +
        x +
        'px;--y:' +
        y +
        'px;--z:' +
        i +
        '"><span class="chip-edge"></span><span class="chip-face"></span></div>';
    });
    html += '</div>';
    return html;
  }

  /**
   * Spawn flying chips from seat element toward pot element.
   */
  function flyChips(fromEl, toEl, color, count, onDone) {
    if (!fromEl || !toEl || !global.document) {
      if (onDone) onDone();
      return;
    }
    const layer = global.document.getElementById('chip-fly-layer') || global.document.body;
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const n = Math.max(1, Math.min(count || 3, 6));
    let left = n;
    for (let i = 0; i < n; i++) {
      const chip = global.document.createElement('div');
      chip.className = 'chip chip-' + (color || 'red') + ' fly-chip';
      chip.innerHTML = '<span class="chip-edge"></span><span class="chip-face"></span>';
      const x0 = a.left + a.width / 2 + (Math.random() * 16 - 8);
      const y0 = a.top + a.height / 2;
      const x1 = b.left + b.width / 2 + (Math.random() * 20 - 10);
      const y1 = b.top + b.height / 2 + (Math.random() * 10 - 5);
      chip.style.left = x0 + 'px';
      chip.style.top = y0 + 'px';
      layer.appendChild(chip);
      // force reflow
      void chip.offsetWidth;
      chip.style.transform = 'translate(' + (x1 - x0) + 'px,' + (y1 - y0) + 'px) scale(0.9)';
      chip.style.opacity = '0.2';
      setTimeout(() => {
        chip.remove();
        left -= 1;
        if (left <= 0 && onDone) onDone();
      }, 1050 + i * 90);
    }
  }

  function colorForAmount(amount) {
    const stacks = breakdown(amount);
    return stacks.length ? stacks[0].color : 'red';
  }

  global.PokerChips = {
    DENOMS,
    breakdown,
    renderStackColumns,
    renderPotPile,
    flyChips,
    colorForAmount
  };
})(typeof window !== 'undefined' ? window : globalThis);
