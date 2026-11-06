// Situationsbezogene Hinweise: freundliche Tipps, die nie den besten Zug verraten.
const Hinweise = (() => {
  const R = Regeln;
  const WERT = [0, 1, 3, 3, 5, 9, 100]; // Index = Typ, Koenig zaehlt als unbezahlbar
  const FIGUR = { 1: 'Bauer', 2: 'Springer', 3: 'Läufer', 4: 'Turm' };
  const VOM = { 1: 'vom Bauern', 2: 'vom Springer', 3: 'vom Läufer', 4: 'vom Turm', 5: 'von der Dame', 6: 'vom König' };

  function grundtext(art, text) { return { art, text }; }

  // Wertvollste Figur von farbe (kein Koenig), die hängt: angegriffen und
  // ungedeckt oder von einer billigeren Figur angegriffen.
  function haengende(st, farbe) {
    const gegner = farbe ^ 1;
    let best = null;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = st.brett[s];
      if (!p || (p >> 3) !== farbe || (p & 7) === 6) continue;
      const typ = p & 7;
      const ang = R.angreifer(st, s, gegner);
      if (!ang.length) continue;
      let billig = 7, billigWert = 1000;
      for (const a of ang) {
        const t = st.brett[a] & 7;
        if (WERT[t] < billigWert) { billigWert = WERT[t]; billig = t; }
      }
      if (R.angegriffen(st, s, farbe) && !(billigWert < WERT[typ])) continue;
      if (!best || WERT[typ] > WERT[best.typ]) best = { feld: s, typ, angreifer: billig };
    }
    return best;
  }

  function mattInEins(st) {
    const zuege = R.legaleZuege(st);
    const gegner = st.amZug ^ 1;
    for (const z of zuege) {
      R.machZug(st, z);
      const matt = R.imSchach(st, gegner) && R.legaleZuege(st).length === 0;
      R.nimmZurueck(st);
      if (matt) return true;
    }
    return false;
  }

  function material(st) {
    const m = [0, 0], dame = [0, 0];
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = st.brett[s];
      if (!p) continue;
      const t = p & 7, f = p >> 3;
      if (t === 5) dame[f]++;
      if (t >= 2 && t <= 5) m[f] += WERT[t];
    }
    return { m, dame };
  }

  function phase(st) {
    if (st.zugnummer <= 10) return 'eroeffnung';
    const { m, dame } = material(st);
    if ((dame[0] + dame[1] === 0) || (m[0] <= 13 && m[1] <= 13)) return 'endspiel';
    return 'mittelspiel';
  }

  function leichtfigurenAufStart(st, farbe) {
    const rang = farbe ? 7 : 0;
    let n = 0;
    for (const [linie, typ] of [[1, 2], [6, 2], [2, 3], [5, 3]])
      if (st.brett[rang * 16 + linie] === (typ | farbe << 3)) n++;
    return n;
  }

  function koenigKannRochieren(st, farbe) {
    const start = farbe ? 116 : 4;
    const recht = farbe ? 12 : 3;
    return st.brett[start] === (6 | farbe << 3) && (st.rochade & recht) !== 0;
  }

  function offeneLinieOhneTurm(st, farbe) {
    const bauern = new Array(8).fill(0), turm = new Array(8).fill(false);
    let hatTurm = false;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = st.brett[s];
      if ((p & 7) === 1) bauern[s & 7]++;
      if (p && (p & 7) === 4 && (p >> 3) === farbe) { turm[s & 7] = true; hatTurm = true; }
    }
    if (!hatTurm) return false;
    for (let l = 0; l < 8; l++) if (bauern[l] === 0 && !turm[l]) return true;
    return false;
  }

  function hatFreibauer(st, farbe) {
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      if (st.brett[s] !== (1 | farbe << 3)) continue;
      const linie = s & 7, rang = s >> 4;
      let frei = true;
      for (let r = 0; r < 8 && frei; r++) {
        if (farbe === 0 ? r <= rang : r >= rang) continue;
        for (let l = linie - 1; l <= linie + 1; l++)
          if (l >= 0 && l < 8 && st.brett[r * 16 + l] === (1 | (farbe ^ 1) << 3)) { frei = false; break; }
      }
      if (frei) return true;
    }
    return false;
  }

  function strategie(st, farbe) {
    const ph = phase(st);
    if (ph === 'eroeffnung') {
      if (leichtfigurenAufStart(st, farbe) >= 2)
        return 'Bring zuerst deine [[leichtfiguren|Springer und Läufer]] ins Spiel! Diese [[entwicklung|Entwicklung]] ist in der [[eroeffnung|Eröffnung]] das Wichtigste.';
      if (koenigKannRochieren(st, farbe))
        return 'Deine Figuren sind gut entwickelt! Jetzt wäre ein guter Moment, deinen König mit einer [[rochade|Rochade]] in Sicherheit zu bringen.';
      return 'Kämpfe um das [[zentrum|Zentrum]]: Die Felder in der Brettmitte geben deinen Figuren viel Bewegungsfreiheit.';
    }
    if (ph === 'endspiel') {
      if (hatFreibauer(st, farbe))
        return 'Im [[endspiel|Endspiel]] ist dein [[freibauer|Freibauer]] eine große Chance. Bring ihn Schritt für Schritt voran, am besten mit Unterstützung deines Königs.';
      return 'Im [[endspiel|Endspiel]] ist dein König stark. Hol ihn aus der Ecke und mach ihn zu einer aktiven Figur!';
    }
    if (offeneLinieOhneTurm(st, farbe))
      return 'Im [[mittelspiel|Mittelspiel]] fühlen sich Türme auf einer [[offene-linie|offenen Linie]] wohl. Gibt es eine Linie ohne Bauern, auf der dein Turm noch fehlt?';
    return 'Prüfe vor jedem Zug: Welche Figuren greift dein Gegner gerade an?';
  }

  function erzeuge(P, spielerFarbe, name) {
    const st = P.stellung;
    const f = spielerFarbe === 'w' ? 0 : 1;
    if (st.amZug !== f) return [];
    const res = [];
    if (R.imSchach(st, f)) {
      res.push(grundtext('warnung', 'Achtung, ' + name + ', dein König steht im [[schach|Schach]]! Du musst ihn jetzt schützen.'));
    }
    const eigene = haengende(st, f);
    if (eigene) {
      const dame = eigene.typ === 5;
      const figur = dame ? 'deine Dame' : 'dein ' + FIGUR[eigene.typ];
      res.push(grundtext('warnung', 'Achtung, ' + figur + ' auf ' + R.feldName(eigene.feld) + ' wird ' + VOM[eigene.angreifer] +
        ' angegriffen. Vielleicht möchtest du ' + (dame ? 'sie' : 'ihn') + ' in Sicherheit bringen?'));
    }
    const imSchach = R.imSchach(st, f); // im Schach zaehlt nur die Warnung
    if (res.length < 2 && !imSchach && mattInEins(st))
      res.push(grundtext('chance', 'Schau ganz genau hin, ' + name + ' – du hast gerade einen sehr starken Zug!'));
    if (res.length < 2 && !imSchach && haengende(st, f ^ 1))
      res.push(grundtext('chance', 'Schau mal, ob eine gegnerische Figur [[gedeckt|ungedeckt]] ist.'));
    if (res.length < 2 && !imSchach) res.push(grundtext('strategie', strategie(st, f)));
    return res.slice(0, 2);
  }

  function maskiere(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function alsHtml(text) {
    return maskiere(text).replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (alles, schluessel, anzeige) => {
      const eintrag = Object.prototype.hasOwnProperty.call(GLOSSAR, schluessel) ? GLOSSAR[schluessel] : null;
      const sicht = anzeige !== undefined ? anzeige : (eintrag ? eintrag.begriff : schluessel);
      if (!eintrag) return sicht;
      return '<span class="begriff" tabindex="0">' + sicht + '<span class="tooltip"><b>' + maskiere(eintrag.begriff) +
        '</b><br>' + maskiere(eintrag.erklaerung) + '</span></span>';
    });
  }

  return { erzeuge, alsHtml };
})();
