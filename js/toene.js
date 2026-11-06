// Freundliche Klänge per Web Audio (keine Audiodateien).
const Toene = (() => {
  let an = true, ctx = null, versucht = false;
  const MAX = 0.25;

  // Töne: [Frequenz, Start (s), Dauer (s), Wellenform, Lautstärke, Ziel-Frequenz (optional)]
  const KLAENGE = {
    zug: [[330, 0, 0.08, 'sine', 0.2, 180]],
    schlagen: [[660, 0, 0.18, 'triangle', 0.18], [990, 0.07, 0.25, 'sine', 0.15]],
    schach: [[520, 0, 0.16, 'sine', 0.16], [520, 0.2, 0.22, 'triangle', 0.16]],
    sieg: [[392, 0, 0.22, 'triangle', 0.18], [494, 0.2, 0.22, 'triangle', 0.18],
           [587, 0.4, 0.22, 'triangle', 0.18], [784, 0.6, 0.4, 'sine', 0.2]],
    niederlage: [[392, 0, 0.3, 'sine', 0.16], [294, 0.28, 0.45, 'sine', 0.16]],
    remis: [[440, 0, 0.28, 'triangle', 0.14], [370, 0.26, 0.4, 'triangle', 0.14]],
    ungueltig: [[110, 0, 0.15, 'sine', 0.2, 80]],
  };

  function holeKontext() {
    if (ctx || versucht) return ctx;
    versucht = true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AC) ctx = new AC();
    return ctx;
  }

  function ton(c, t0, [f, start, dauer, form, vol, ziel]) {
    const o = c.createOscillator(), g = c.createGain();
    const a = t0 + start, e = a + dauer;
    o.type = form;
    o.frequency.setValueAtTime(f, a);
    if (ziel) o.frequency.exponentialRampToValueAtTime(ziel, e);
    g.gain.setValueAtTime(Math.min(vol, MAX), a);
    g.gain.exponentialRampToValueAtTime(0.0001, e);
    o.connect(g); g.connect(c.destination);
    o.start(a); o.stop(e + 0.02);
  }

  return {
    // Erzeugt den AudioContext vorab (bei einer Nutzerinteraktion), damit der erste Ton nicht stockt.
    vorbereiten() {
      try {
        if (!an) return;
        const c = holeKontext();
        if (c && c.state === 'suspended') { const p = c.resume(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) { /* Töne dürfen nie stören */ }
    },
    setzeAn(wert) { an = !!wert; },
    istAn() { return an; },
    spiele(name) {
      try {
        const def = KLAENGE[name];
        if (!an || !def) return;
        const c = holeKontext();
        if (!c) return;
        if (c.state === 'suspended') { try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
        const t0 = c.currentTime;
        for (const t of def) ton(c, t0, t);
      } catch (e) { /* Töne dürfen nie stören */ }
    },
  };
})();
