// Figuren im Stil A: runde Pastellfiguren mit Gesicht (Formen 1:1 aus dem Entwurf ablauf.html).
const Figuren = (() => {
  // Schluessel: deutsche Figurenbuchstaben (K D T L S B).
  const formen = {
    B: { d: ['M27 86 Q27 58 50 56 Q73 58 73 86Z'], c: [[50, 40, 21]], face: [50, 41, 1] },
    T: { d: ['M23 86 L23 40 Q23 32 31 32 L69 32 Q77 32 77 40 L77 86Z', 'M23 34 L23 20 Q23 17 26 17 L34 17 Q37 17 37 20 L37 26 L44 26 L44 20 Q44 17 47 17 L53 17 Q56 17 56 20 L56 26 L63 26 L63 20 Q63 17 66 17 L74 17 Q77 17 77 20 L77 34Z'], face: [50, 58, 1] },
    L: { d: ['M50 16 Q78 34 76 60 Q74 86 50 86 Q26 86 24 60 Q22 34 50 16Z'], c: [[50, 13, 6]], face: [50, 60, 1] },
    D: { d: ['M24 86 Q20 48 50 42 Q80 48 76 86Z', 'M30 46 L33 22 L42 34 L50 15 L58 34 L67 22 L70 46Z'], c: [[33, 20, 5], [50, 13, 5], [67, 20, 5]], face: [50, 64, .95] },
    K: { d: ['M24 86 Q20 48 50 42 Q80 48 76 86Z', 'M33 45 Q32 32 50 30 Q68 32 67 45Z', 'M45 4 Q45 2 47 2 L53 2 Q55 2 55 4 L55 10 L61 10 Q63 10 63 12 L63 17 Q63 19 61 19 L55 19 L55 31 L45 31 L45 19 L39 19 Q37 19 37 17 L37 12 Q37 10 39 10 L45 10Z'], face: [50, 64, .95] },
    S: { d: ['M28 86 Q26 66 34 60 Q18 60 18 48 Q18 38 28 32 Q38 18 52 16 L55 6 L64 15 Q80 24 79 50 Q78 70 72 86Z'], face: [47, 36, .75], nase: [25, 46] },
  };
  const farben = { w: { body: '#FFF6E6', stroke: '#D9B183' }, s: { body: '#B4497A', stroke: '#7E2C53' } };

  // Zufaellige Dauer und Phase je Figur: so wippen und blinzeln die Figuren nie im Gleichtakt,
  // und weil die Dauern verschieden sind, laufen sie auch spaeter nicht wieder zusammen.
  function zufallsTakt(min, max) {
    const dauer = min + Math.random() * (max - min);
    return `animation-duration:${dauer.toFixed(2)}s;animation-delay:-${(Math.random() * dauer).toFixed(2)}s`;
  }

  function gesicht(x, y, s, traurig) {
    const mund = traurig ? 'M-5 10 Q0 6 5 10' : 'M-5 7 Q0 12 5 7';
    return `<g transform="translate(${x} ${y}) scale(${s})">` +
      `<g class="augen" style="${zufallsTakt(25, 50)}">` +
      '<circle cx="-8" cy="-2" r="6" fill="#fff"/><circle cx="8" cy="-2" r="6" fill="#fff"/>' +
      '<circle cx="-7" cy="-1.5" r="3.8" fill="#2E2340"/><circle cx="9" cy="-1.5" r="3.8" fill="#2E2340"/>' +
      '<circle cx="-5.8" cy="-3" r="1.4" fill="#fff"/><circle cx="10.2" cy="-3" r="1.4" fill="#fff"/>' +
      '</g>' +
      '<circle cx="-15" cy="6" r="3.6" fill="#FF8FA3" opacity=".65"/><circle cx="15" cy="6" r="3.6" fill="#FF8FA3" opacity=".65"/>' +
      `<path d="${mund}" fill="none" stroke="#2E2340" stroke-width="2.2" stroke-linecap="round"/>` +
      '</g>';
  }

  // Der Wippen-Takt liegt nur auf der inneren Gruppe (.wippen), das Huepfen auf der aeusseren (.huepf).
  function svg(typ, farbe, { stimmung = 'froh' } = {}) {
    const f = formen[typ], c = farben[farbe];
    if (!f || !c) throw new Error('Unbekannte Figur: ' + typ + farbe);
    const a = `fill="${c.body}" stroke="${c.stroke}" stroke-width="2.5" stroke-linejoin="round"`;
    let inner = f.d.map(d => `<path d="${d}" ${a}/>`).join('');
    inner += (f.c || []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${a}/>`).join('');
    inner += gesicht(f.face[0], f.face[1], f.face[2], stimmung === 'traurig');
    if (f.nase) inner += `<circle cx="${f.nase[0]}" cy="${f.nase[1]}" r="2.2" fill="${c.stroke}"/>`;
    return `<svg viewBox="0 0 100 92" aria-hidden="true"><g class="huepf"><g class="wippen" style="${zufallsTakt(2.8, 3.6)}">${inner}</g></g></svg>`;
  }

  return { svg };
})();
