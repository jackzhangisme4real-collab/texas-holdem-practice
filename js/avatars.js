/**
 * Distinctive table cast — readable silhouettes, less generic-moe.
 * Index matches default seats: 你 / 稳妥哥 / 浪哥 / 火力全开 / 均衡酱 / 石头人
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Pro: circular busts with strong color IDs */
  function svgPro(player, index) {
    const C = [
      { ring: '#c9a227', cloth: '#8a6b12', hair: '#4e342e', skin: '#e8b890' },
      { ring: '#42a5f5', cloth: '#1565c0', hair: '#263238', skin: '#d7a882' },
      { ring: '#26a69a', cloth: '#00695c', hair: '#ad1457', skin: '#efc4a0' },
      { ring: '#ef5350', cloth: '#212121', hair: '#bf360c', skin: '#d9a078' },
      { ring: '#7e57c2', cloth: '#455a64', hair: '#4527a0', skin: '#ebc8a8' },
      { ring: '#90a4ae', cloth: '#5d4037', hair: '#616161', skin: '#c9966c' }
    ][index % 6];
    const initial = player && player.name ? player.name.charAt(0) : '?';
    const uid = 'p' + index;
    return (
      '<svg class="avatar-svg" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><radialGradient id="' + uid + 'g" cx="30%" cy="25%" r="75%">' +
      '<stop offset="0%" stop-color="#3a342c"/><stop offset="100%" stop-color="#0a0806"/></radialGradient></defs>' +
      '<circle cx="36" cy="36" r="34" fill="url(#' + uid + 'g)" stroke="' + C.ring + '" stroke-width="3"/>' +
      '<ellipse cx="36" cy="58" rx="17" ry="11" fill="' + C.cloth + '"/>' +
      '<circle cx="36" cy="30" r="14" fill="' + C.skin + '"/>' +
      '<path d="M22 30 Q26 14 36 12 Q46 14 50 30 Q44 20 36 19 Q28 20 22 30" fill="' + C.hair + '"/>' +
      (index === 1 ? '<rect x="27" y="27" width="18" height="7" rx="1" fill="none" stroke="#90caf9" stroke-width="1.4"/>' : '') +
      (index === 3 ? '<path d="M28 34 L34 36" stroke="#8d3a2a" stroke-width="1.2"/>' : '') +
      '<ellipse cx="30" cy="30" rx="2" ry="2.6" fill="#111"/><ellipse cx="42" cy="30" rx="2" ry="2.6" fill="#111"/>' +
      '<text x="36" y="67" text-anchor="middle" font-size="9" fill="' + C.ring + '" font-weight="700" font-family="sans-serif">' +
      esc(initial) + '</text></svg>'
    );
  }

  /**
   * Q cast — each has unique hair silhouette + outfit prop.
   * 0 你: gold hoodie + short tidy hair
   * 1 稳妥哥: glasses + side part + blue knit
   * 2 浪哥: messy long hair + earring + open jacket
   * 3 火力全开: tall spike hair + leather + scar
   * 4 均衡酱: asymmetric bob + scarf
   * 5 石头人: buzzcut blocky + thick brow + gray hoodie
   */
  function svgChibi(player, index) {
    index = index % 6;
    const uid = 'cast' + index;
    if (index === 0) return chibiYou(uid);
    if (index === 1) return chibiSteady(uid);
    if (index === 2) return chibiWave(uid);
    if (index === 3) return chibiFire(uid);
    if (index === 4) return chibiBalance(uid);
    return chibiRock(uid);
  }

  function seatBase(uid, cushion) {
    return (
      '<ellipse cx="60" cy="132" rx="38" ry="6" fill="#000" opacity="0.3"/>' +
      '<ellipse cx="60" cy="122" rx="40" ry="9" fill="' + cushion + '"/>' +
      '<ellipse cx="60" cy="118" rx="36" ry="7" fill="#2a2118" stroke="#c9a227" stroke-width="1" stroke-opacity="0.35"/>'
    );
  }

  function chibiYou(uid) {
    return (
      '<svg class="chibi-svg" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">' +
      seatBase(uid, '#3e3428') +
      // gold hoodie body
      '<path d="M34 78 Q60 68 86 78 L82 112 Q60 122 38 112 Z" fill="#c9a227"/>' +
      '<path d="M48 78 L60 95 L72 78" fill="#8a6b12"/>' +
      '<ellipse cx="32" cy="100" rx="10" ry="7" fill="#e8b890"/><ellipse cx="88" cy="100" rx="10" ry="7" fill="#e8b890"/>' +
      // head short hair
      '<circle cx="60" cy="50" r="27" fill="#f0c4a0"/>' +
      '<path d="M34 48 Q38 18 60 16 Q82 18 86 48 Q76 28 60 26 Q44 28 34 48" fill="#4e342e"/>' +
      '<rect x="52" y="16" width="16" height="6" rx="2" fill="#4e342e"/>' + // flat top bang bar
      '<ellipse cx="49" cy="52" rx="4.2" ry="5.5" fill="#1a1a1a"/><ellipse cx="71" cy="52" rx="4.2" ry="5.5" fill="#1a1a1a"/>' +
      '<circle cx="50.3" cy="50.5" r="1.2" fill="#fff"/><circle cx="72.3" cy="50.5" r="1.2" fill="#fff"/>' +
      '<path d="M54 66 Q60 70 66 66" stroke="#8d4a3a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="60" cy="84" r="5" fill="#ffd54f" stroke="#fff8" stroke-width="1"/>' +
      '</svg>'
    );
  }

  function chibiSteady(uid) {
    return (
      '<svg class="chibi-svg" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">' +
      seatBase(uid, '#1a237e') +
      '<path d="M36 80 Q60 72 84 80 L80 112 Q60 120 40 112 Z" fill="#1565c0"/>' +
      '<rect x="44" y="86" width="32" height="8" rx="2" fill="#0d47a1"/>' + // knit stripe
      '<ellipse cx="33" cy="100" rx="9" ry="6.5" fill="#d7a882"/><ellipse cx="87" cy="100" rx="9" ry="6.5" fill="#d7a882"/>' +
      '<circle cx="60" cy="50" r="26" fill="#e2b48a"/>' +
      // neat side-part
      '<path d="M35 46 Q40 16 58 14 Q78 16 85 42 Q70 22 55 22 Q42 26 35 46" fill="#263238"/>' +
      '<path d="M50 18 L68 20" stroke="#546e7a" stroke-width="2"/>' +
      // glasses
      '<rect x="40" y="46" width="16" height="12" rx="2" fill="none" stroke="#90caf9" stroke-width="2"/>' +
      '<rect x="64" y="46" width="16" height="12" rx="2" fill="none" stroke="#90caf9" stroke-width="2"/>' +
      '<line x1="56" y1="52" x2="64" y2="52" stroke="#90caf9" stroke-width="2"/>' +
      '<ellipse cx="48" cy="52" rx="3" ry="3.5" fill="#1a1a1a"/><ellipse cx="72" cy="52" rx="3" ry="3.5" fill="#1a1a1a"/>' +
      '<path d="M55 66 L65 66" stroke="#6d4c41" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  function chibiWave(uid) {
    return (
      '<svg class="chibi-svg" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">' +
      seatBase(uid, '#004d40') +
      // open jacket
      '<path d="M34 78 Q60 70 86 78 L90 114 Q60 124 30 114 Z" fill="#00695c"/>' +
      '<path d="M50 80 L60 110 L70 80" fill="#1de9b6" opacity="0.35"/>' +
      '<ellipse cx="30" cy="98" rx="11" ry="7" fill="#efc4a0"/><ellipse cx="90" cy="98" rx="11" ry="7" fill="#efc4a0"/>' +
      '<circle cx="60" cy="48" r="27" fill="#f3c9a8"/>' +
      // wild long hair with streak
      '<path d="M28 55 Q24 10 60 8 Q96 10 94 52 Q100 70 88 88 Q80 40 60 28 Q40 40 32 78 Q30 60 28 55" fill="#4a148c"/>' +
      '<path d="M70 12 Q86 20 90 48 Q84 30 72 22 Z" fill="#f48fb1"/>' +
      '<circle cx="88" cy="70" r="3" fill="#ffd54f"/>' + // earring
      '<ellipse class="eye-open" cx="48" cy="50" rx="4.5" ry="6" fill="#311b92"/>' +
      '<ellipse class="eye-open" cx="70" cy="50" rx="4.5" ry="6" fill="#311b92"/>' +
      '<path d="M52 64 Q62 74 72 62" stroke="#c2185b" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  function chibiFire(uid) {
    return (
      '<svg class="chibi-svg" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">' +
      seatBase(uid, '#b71c1c') +
      '<path d="M36 82 Q60 70 84 82 L86 114 Q60 124 34 114 Z" fill="#212121"/>' +
      '<path d="M44 88 L76 88 L70 108 L50 108 Z" fill="#424242"/>' +
      '<ellipse cx="32" cy="100" rx="10" ry="7" fill="#d9a078"/><ellipse cx="88" cy="100" rx="10" ry="7" fill="#d9a078"/>' +
      '<circle cx="60" cy="52" r="26" fill="#e0a888"/>' +
      // tall spikes
      '<path d="M34 48 L38 6 L48 40 L60 2 L72 40 L82 8 L86 48 Q74 22 60 24 Q46 22 34 48" fill="#bf360c"/>' +
      '<path d="M50 10 L60 0 L66 18 Z" fill="#ff6e40"/>' +
      // scar + fierce eyes
      '<path d="M40 44 L50 50" stroke="#8d3a2a" stroke-width="1.6"/>' +
      '<ellipse cx="48" cy="54" rx="5" ry="4" fill="#111"/><ellipse cx="72" cy="54" rx="5" ry="4" fill="#111"/>' +
      '<path d="M42 48 L54 50" stroke="#111" stroke-width="2"/><path d="M66 50 L78 48" stroke="#111" stroke-width="2"/>' +
      '<path d="M54 68 L66 68" stroke="#5d4037" stroke-width="2.5" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  function chibiBalance(uid) {
    return (
      '<svg class="chibi-svg" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">' +
      seatBase(uid, '#311b92') +
      '<path d="M38 80 Q60 74 82 80 L78 112 Q60 118 42 112 Z" fill="#455a64"/>' +
      // scarf
      '<path d="M42 78 Q60 88 78 78 Q70 96 60 100 Q50 96 42 78" fill="#26c6da"/>' +
      '<rect x="56" y="96" width="8" height="18" rx="2" fill="#00acc1"/>' +
      '<ellipse cx="33" cy="100" rx="9" ry="6" fill="#ebc8a8"/><ellipse cx="87" cy="100" rx="9" ry="6" fill="#ebc8a8"/>' +
      '<circle cx="60" cy="48" r="26" fill="#efc9a8"/>' +
      // asymmetric bob — longer left
      '<path d="M32 40 Q36 12 62 12 Q86 14 88 42 Q84 28 64 24 Q48 26 40 36 L28 78 Q30 50 32 40" fill="#4527a0"/>' +
      '<path d="M70 14 Q86 20 90 40 Q82 26 70 22 Z" fill="#7e57c2"/>' +
      '<ellipse class="eye-open" cx="49" cy="50" rx="4" ry="5.5" fill="#1a237e"/>' +
      '<ellipse class="eye-open" cx="69" cy="50" rx="4" ry="5.5" fill="#1a237e"/>' +
      '<path d="M54 64 Q60 69 66 64" stroke="#6a1b9a" stroke-width="1.8" fill="none"/>' +
      '</svg>'
    );
  }

  function chibiRock(uid) {
    return (
      '<svg class="chibi-svg" viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg">' +
      seatBase(uid, '#424242') +
      // blocky hoodie
      '<rect x="34" y="78" width="52" height="36" rx="10" fill="#5d4037"/>' +
      '<rect x="48" y="78" width="24" height="14" fill="#3e2723"/>' +
      '<ellipse cx="34" cy="102" rx="10" ry="8" fill="#c9966c"/><ellipse cx="86" cy="102" rx="10" ry="8" fill="#c9966c"/>' +
      // wide head + buzz
      '<ellipse cx="60" cy="52" rx="30" ry="28" fill="#d2a074"/>' +
      '<ellipse cx="60" cy="30" rx="28" ry="12" fill="#616161"/>' +
      '<rect x="34" y="28" width="52" height="10" fill="#757575"/>' +
      // thick brows
      '<rect x="38" y="44" width="18" height="4" rx="1" fill="#212121"/>' +
      '<rect x="64" y="44" width="18" height="4" rx="1" fill="#212121"/>' +
      '<ellipse cx="48" cy="54" rx="4" ry="4" fill="#111"/><ellipse cx="72" cy="54" rx="4" ry="4" fill="#111"/>' +
      '<rect x="52" y="66" width="16" height="3" rx="1" fill="#5d4037"/>' +
      '</svg>'
    );
  }

  function styleIndex(player, index) {
    const map = { human: 0, tight: 1, loose: 2, aggressive: 3, balanced: 4, nit: 5 };
    if (player && player.style && map[player.style] != null) return map[player.style];
    if (player && player.isHuman) return 0;
    const nameMap = { '你': 0, '稳妥哥': 1, '浪哥': 2, '火力全开': 3, '均衡酱': 4, '石头人': 5 };
    if (player && player.name && nameMap[player.name] != null) return nameMap[player.name];
    return index % 6;
  }

  function svgFor(player, index, theme) {
    const i = styleIndex(player, index);
    if (theme === 'q') return svgChibi(player, i);
    return svgPro(player, i);
  }

  function dealerSvg() {
    return (
      '<svg class="dealer-svg" viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">' +
      '<ellipse cx="70" cy="150" rx="34" ry="7" fill="#000" opacity="0.28"/>' +
      '<ellipse cx="70" cy="120" rx="32" ry="26" fill="#3e2723"/>' +
      '<rect x="54" y="94" width="32" height="40" rx="6" fill="#eceff1"/>' +
      '<path d="M56 100 L70 108 L84 100 L70 114 Z" fill="#c9a227"/>' +
      '<circle cx="70" cy="56" r="28" fill="#e8b890"/>' +
      '<path d="M42 54 Q50 20 70 18 Q90 20 98 54 Q88 34 70 32 Q52 34 42 54" fill="#1b1b1b"/>' +
      '<rect x="48" y="40" width="44" height="8" fill="#212121"/>' + // visor band
      '<ellipse class="eye-open" cx="58" cy="58" rx="4.5" ry="5.5" fill="#111"/>' +
      '<ellipse class="eye-open" cx="82" cy="58" rx="4.5" ry="5.5" fill="#111"/>' +
      '<path d="M62 72 Q70 78 78 72" stroke="#6d4c41" stroke-width="2" fill="none"/>' +
      '<g class="dealer-arm">' +
      '<ellipse cx="112" cy="112" rx="12" ry="8" fill="#e8b890"/>' +
      '<rect x="102" y="96" width="16" height="20" rx="2" fill="#fff" stroke="#c9a227" stroke-width="1.6"/>' +
      '</g>' +
      '<text x="70" y="158" text-anchor="middle" font-size="11" fill="#c9a227" font-weight="700" font-family="sans-serif">荷官</text>' +
      '</svg>'
    );
  }

  global.PokerAvatars = { svgFor, svgPro, svgChibi, dealerSvg };
})(typeof window !== 'undefined' ? window : globalThis);
