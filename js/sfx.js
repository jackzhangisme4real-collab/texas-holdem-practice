/**
 * Audible SFX via HTMLAudio WAV + WebAudio fallback.
 */
(function (global) {
  'use strict';

  let ctx = null;
  let enabled = true;
  const cache = {};
  const BASE = 'assets/sfx/';

  function ac() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function load(name) {
    if (cache[name]) return cache[name];
    try {
      const a = new Audio(BASE + name + '.wav');
      a.preload = 'auto';
      a.volume = 0.85;
      cache[name] = a;
      return a;
    } catch (e) {
      return null;
    }
  }

  function playWav(name, vol) {
    if (!enabled) return false;
    try {
      const base = load(name);
      if (!base) return false;
      const a = base.cloneNode();
      a.volume = vol == null ? 0.85 : vol;
      const p = a.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, type, gain, when) {
    const c = ac();
    if (!c || !enabled) return;
    const t0 = (when || 0) + c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    const v = gain == null ? 0.18 : gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, v), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noiseBurst(dur, gain) {
    const c = ac();
    if (!c || !enabled) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1600;
    src.buffer = buf;
    g.gain.value = gain || 0.12;
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start();
  }

  function play(name, webaudioFn) {
    if (!enabled) return;
    ac();
    if (!playWav(name)) {
      if (webaudioFn) webaudioFn();
    }
  }


  let bgmWanted = true;
  let bgmNodes = null;
  let bgmTimer = null;

  function stopBgmInternal() {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (bgmNodes) {
      try {
        bgmNodes.forEach(function (n) {
          try { n.stop(); } catch (e1) {}
          try { n.disconnect(); } catch (e2) {}
        });
      } catch (e) {}
      bgmNodes = null;
    }
  }

  function startBgmInternal() {
    if (!enabled || !bgmWanted) return;
    const c = ac();
    if (!c) return;
    stopBgmInternal();
    // Soft felt-room pad: two detuned sines through slow filter, very quiet
    const master = c.createGain();
    master.gain.value = 0.028;
    master.connect(c.destination);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.7;
    filter.connect(master);
    const nodes = [master, filter];
    function voice(freq, type, gain) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(filter);
      o.start();
      nodes.push(o, g);
      return o;
    }
    voice(110, 'sine', 0.55);
    voice(164.5, 'sine', 0.32);
    voice(220.5, 'triangle', 0.12);
    // gentle filter breathe
    const now = c.currentTime;
    filter.frequency.setValueAtTime(380, now);
    try {
      filter.frequency.linearRampToValueAtTime(520, now + 4);
      filter.frequency.linearRampToValueAtTime(380, now + 8);
    } catch (e) {}
    bgmTimer = setInterval(function () {
      if (!ctx || !bgmNodes) return;
      const t = ctx.currentTime;
      try {
        filter.frequency.cancelScheduledValues(t);
        filter.frequency.setValueAtTime(filter.frequency.value, t);
        filter.frequency.linearRampToValueAtTime(500 + Math.random() * 40, t + 4);
        filter.frequency.linearRampToValueAtTime(360 + Math.random() * 40, t + 8);
      } catch (e) {}
    }, 8000);
    bgmNodes = nodes;
  }

  const SFX = {
    setEnabled(v) {
      enabled = !!v;
      try {
        localStorage.setItem('th_practice_sfx_on', enabled ? '1' : '0');
      } catch (e) {}
      if (!enabled) SFX.stopBgm();
      else if (bgmWanted) SFX.startBgm();
    },
    isEnabled() { return enabled; },
    setBgmEnabled(v) {
      bgmWanted = !!v;
      try {
        localStorage.setItem('th_practice_bgm_on', bgmWanted ? '1' : '0');
      } catch (e) {}
      if (bgmWanted && enabled) SFX.startBgm();
      else SFX.stopBgm();
    },
    isBgmEnabled() { return bgmWanted; },
    unlock() {
      ac();
      // warm decode
      ['deal', 'flip', 'chip', 'fold', 'win', 'check'].forEach(function (n) {
        load(n);
      });
    },
    deal() {
      play('deal', function () {
        noiseBurst(0.05, 0.14);
        tone(440, 0.06, 'triangle', 0.16);
      });
    },
    flip() {
      play('flip', function () {
        tone(260, 0.04, 'square', 0.12);
        tone(780, 0.07, 'triangle', 0.18, 0.03);
      });
    },
    chip() {
      play('chip', function () {
        tone(980, 0.04, 'square', 0.14);
        tone(1300, 0.05, 'triangle', 0.12, 0.02);
      });
    },
    chipClack(n) {
      const c = Math.max(1, Math.min(n || 1, 5));
      for (let i = 0; i < c; i++) {
        setTimeout(function () { SFX.chip(); }, i * 45);
      }
    },
    chipsToPot() {
      SFX.chipClack(3);
    },
    fold() {
      play('fold', function () {
        tone(210, 0.14, 'sine', 0.16);
        tone(150, 0.16, 'triangle', 0.12, 0.05);
      });
    },
    check() {
      play('check', function () {
        // table-knock: low thud + short click
        noiseBurst(0.045, 0.16);
        tone(180, 0.07, 'triangle', 0.22);
        tone(420, 0.04, 'sine', 0.1, 0.035);
      });
    },
    knock() {
      SFX.check();
    },
    bet() {
      SFX.chipsToPot();
    },
    win() {
      play('win', function () {
        tone(523, 0.12, 'sine', 0.18);
        tone(659, 0.12, 'sine', 0.16, 0.1);
        tone(784, 0.2, 'sine', 0.16, 0.2);
      });
    },
    click() {
      tone(740, 0.03, 'square', 0.08);
    },
    startBgm() { startBgmInternal(); },
    stopBgm() { stopBgmInternal(); }
  };

  try {
    const saved = localStorage.getItem('th_practice_sfx_on');
    if (saved === '0') enabled = false;
    if (saved === '1') enabled = true;
    const bg = localStorage.getItem('th_practice_bgm_on');
    if (bg === '0') bgmWanted = false;
    if (bg === '1') bgmWanted = true;
  } catch (e) {}

  global.PokerSFX = SFX;
})(typeof window !== 'undefined' ? window : globalThis);
