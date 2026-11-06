// Schachregeln: 0x88-Brett, Zuggenerator, Zobrist-Hash.
// RegelnModul ist vollstaendig selbstgenuegsam (wird per toString() in den Worker kopiert).
function RegelnModul() {
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const TYP_BUCHSTABE = ['', 'B', 'S', 'L', 'T', 'D', 'K'];
  const FEN_BUCHSTABE = ' pnbrqk';
  const UCI_UMW = '  nbrq'; // Index = Typ (2..5)

  const SPRUNG = [31, 33, 14, 18, -31, -33, -14, -18];
  const KOENIG = [1, -1, 16, -16, 15, 17, -15, -17];
  const LAEUFER = [15, 17, -15, -17];
  const TURM = [1, -1, 16, -16];

  // Rochaderechte, die beim Beruehren eines Feldes verloren gehen
  const ROCHADE_MASKE = new Int8Array(128).fill(15);
  ROCHADE_MASKE[0] = ~2 & 15; ROCHADE_MASKE[7] = ~1 & 15; ROCHADE_MASKE[4] = ~3 & 15;
  ROCHADE_MASKE[112] = ~8 & 15; ROCHADE_MASKE[119] = ~4 & 15; ROCHADE_MASKE[116] = ~12 & 15;

  // Zobrist-Zahlen aus xorshift32
  let zufall = 0x9E3779B9 | 0;
  function naechste() {
    zufall ^= zufall << 13; zufall ^= zufall >>> 17; zufall ^= zufall << 5;
    return zufall | 0;
  }
  const ZF_LO = new Int32Array(16 * 128), ZF_HI = new Int32Array(16 * 128);
  for (let i = 0; i < ZF_LO.length; i++) { ZF_LO[i] = naechste(); ZF_HI[i] = naechste(); }
  const ZS_LO = naechste(), ZS_HI = naechste();
  const ZR_LO = new Int32Array(16), ZR_HI = new Int32Array(16);
  for (let i = 0; i < 16; i++) { ZR_LO[i] = naechste(); ZR_HI[i] = naechste(); }
  const ZE_LO = new Int32Array(8), ZE_HI = new Int32Array(8);
  for (let i = 0; i < 8; i++) { ZE_LO[i] = naechste(); ZE_HI[i] = naechste(); }

  function feldName(i) { return String.fromCharCode(97 + (i & 7)) + String.fromCharCode(49 + (i >> 4)); }
  function feldIndex(n) { return (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97); }

  function zugVon(z) { return z & 127; }
  function zugNach(z) { return (z >> 7) & 127; }
  function zugUmwandlung(z) { return (z >> 14) & 7; }
  function zugFlags(z) { return (z >> 17) & 15; }
  function packe(von, nach, umw, flags) { return von | (nach << 7) | (umw << 14) | (flags << 17); }

  function berechneHash(st) {
    let lo = 0, hi = 0;
    const b = st.brett;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (p) { lo ^= ZF_LO[p * 128 + s]; hi ^= ZF_HI[p * 128 + s]; }
    }
    if (st.amZug === 1) { lo ^= ZS_LO; hi ^= ZS_HI; }
    lo ^= ZR_LO[st.rochade]; hi ^= ZR_HI[st.rochade];
    if (st.epFeld >= 0) { lo ^= ZE_LO[st.epFeld & 7]; hi ^= ZE_HI[st.epFeld & 7]; }
    st.hashLo = lo | 0; st.hashHi = hi | 0;
  }

  function ausFen(fen) {
    const teile = fen.trim().split(/\s+/);
    const st = {
      brett: new Int8Array(128), amZug: 0, rochade: 0, epFeld: -1,
      halbzuege: 0, zugnummer: 1, hashLo: 0, hashHi: 0, stapel: [], koenig: [-1, -1],
    };
    let rang = 7, linie = 0;
    for (const c of teile[0]) {
      if (c === '/') { rang--; linie = 0; }
      else if (c >= '1' && c <= '8') linie += +c;
      else {
        const l = c.toLowerCase(), farbe = c === l ? 1 : 0;
        const typ = FEN_BUCHSTABE.indexOf(l);
        const s = rang * 16 + linie++;
        st.brett[s] = typ | (farbe << 3);
        if (typ === 6) st.koenig[farbe] = s;
      }
    }
    st.amZug = teile[1] === 'b' ? 1 : 0;
    const r = teile[2] || '-';
    if (r.indexOf('K') >= 0) st.rochade |= 1;
    if (r.indexOf('Q') >= 0) st.rochade |= 2;
    if (r.indexOf('k') >= 0) st.rochade |= 4;
    if (r.indexOf('q') >= 0) st.rochade |= 8;
    st.epFeld = teile[3] && teile[3] !== '-' ? feldIndex(teile[3]) : -1;
    st.halbzuege = teile[4] ? +teile[4] : 0;
    st.zugnummer = teile[5] ? +teile[5] : 1;
    berechneHash(st);
    return st;
  }

  function zuFen(st) {
    let s = '';
    for (let rang = 7; rang >= 0; rang--) {
      let leer = 0;
      for (let linie = 0; linie < 8; linie++) {
        const p = st.brett[rang * 16 + linie];
        if (!p) { leer++; continue; }
        if (leer) { s += leer; leer = 0; }
        const c = FEN_BUCHSTABE[p & 7];
        s += (p >> 3) ? c : c.toUpperCase();
      }
      if (leer) s += leer;
      if (rang) s += '/';
    }
    const r = st.rochade;
    const rs = (r & 1 ? 'K' : '') + (r & 2 ? 'Q' : '') + (r & 4 ? 'k' : '') + (r & 8 ? 'q' : '');
    return s + ' ' + (st.amZug ? 'b' : 'w') + ' ' + (rs || '-') + ' ' +
      (st.epFeld >= 0 ? feldName(st.epFeld) : '-') + ' ' + st.halbzuege + ' ' + st.zugnummer;
  }

  function hashText(st) { return st.hashLo + ':' + st.hashHi; }

  // Wird das Feld von der Farbe vonFarbe angegriffen? (liste: optional, sammelt Felder)
  function angriffe(st, feld, vonFarbe, liste) {
    const b = st.brett, f = vonFarbe << 3;
    let n = false, s, p, i, d;
    // Bauern
    const bauer = 1 | f;
    const r1 = vonFarbe ? feld + 15 : feld - 15, r2 = vonFarbe ? feld + 17 : feld - 17;
    if (!(r1 & 0x88) && b[r1] === bauer) { if (!liste) return true; liste.push(r1); n = true; }
    if (!(r2 & 0x88) && b[r2] === bauer) { if (!liste) return true; liste.push(r2); n = true; }
    const springer = 2 | f, koenig = 6 | f;
    for (i = 0; i < 8; i++) {
      s = feld + SPRUNG[i];
      if (!(s & 0x88) && b[s] === springer) { if (!liste) return true; liste.push(s); n = true; }
      s = feld + KOENIG[i];
      if (!(s & 0x88) && b[s] === koenig) { if (!liste) return true; liste.push(s); n = true; }
    }
    const laeufer = 3 | f, turm = 4 | f, dame = 5 | f;
    for (i = 0; i < 4; i++) {
      d = LAEUFER[i]; s = feld + d;
      while (!(s & 0x88)) {
        p = b[s];
        if (p) { if (p === laeufer || p === dame) { if (!liste) return true; liste.push(s); n = true; } break; }
        s += d;
      }
      d = TURM[i]; s = feld + d;
      while (!(s & 0x88)) {
        p = b[s];
        if (p) { if (p === turm || p === dame) { if (!liste) return true; liste.push(s); n = true; } break; }
        s += d;
      }
    }
    return n;
  }
  function angegriffen(st, feld, vonFarbe) { return angriffe(st, feld, vonFarbe, null); }
  function angreifer(st, feld, vonFarbe) { const l = []; angriffe(st, feld, vonFarbe, l); return l; }
  function imSchach(st, farbe) { return angriffe(st, st.koenig[farbe], farbe ^ 1, null); }

  // Pseudolegale Zuege. Enpassant-Schlag hat die Flags 1|2.
  function pseudoZuege(st, nurSchlaege) {
    const b = st.brett, zuege = [], farbe = st.amZug, f = farbe << 3, gegner = f ^ 8;
    const hochRang = farbe ? 1 : 6, startRang = farbe ? 6 : 1, vor = farbe ? -16 : 16;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (!p || (p & 8) !== f) continue;
      const typ = p & 7;
      let i, z, q;
      if (typ === 1) {
        const rang = s >> 4;
        for (i = -1; i <= 1; i += 2) {
          z = s + vor + i;
          if (z & 0x88) continue;
          q = b[z];
          if (q && (q & 8) === gegner) {
            if (rang === hochRang) { zuege.push(packe(s, z, 5, 1), packe(s, z, 4, 1), packe(s, z, 3, 1), packe(s, z, 2, 1)); }
            else zuege.push(packe(s, z, 0, 1));
          } else if (!q && z === st.epFeld) zuege.push(packe(s, z, 0, 3));
        }
        if (nurSchlaege) continue;
        z = s + vor;
        if (!b[z]) {
          if (rang === hochRang) { zuege.push(packe(s, z, 5, 0), packe(s, z, 4, 0), packe(s, z, 3, 0), packe(s, z, 2, 0)); }
          else {
            zuege.push(packe(s, z, 0, 0));
            if (rang === startRang && !b[z + vor]) zuege.push(packe(s, z + vor, 0, 8));
          }
        }
      } else if (typ === 2 || typ === 6) {
        const R = typ === 2 ? SPRUNG : KOENIG;
        for (i = 0; i < 8; i++) {
          z = s + R[i];
          if (z & 0x88) continue;
          q = b[z];
          if (!q) { if (!nurSchlaege) zuege.push(packe(s, z, 0, 0)); }
          else if ((q & 8) === gegner) zuege.push(packe(s, z, 0, 1));
        }
        if (typ === 6 && !nurSchlaege) {
          const recht = farbe ? st.rochade >> 2 : st.rochade;
          if (recht & 3) {
            const g = farbe ^ 1, k = s;
            if ((recht & 1) && b[k + 1] === 0 && b[k + 2] === 0 && b[k + 3] === (4 | f) &&
                !angegriffen(st, k, g) && !angegriffen(st, k + 1, g) && !angegriffen(st, k + 2, g))
              zuege.push(packe(k, k + 2, 0, 4));
            if ((recht & 2) && b[k - 1] === 0 && b[k - 2] === 0 && b[k - 3] === 0 && b[k - 4] === (4 | f) &&
                !angegriffen(st, k, g) && !angegriffen(st, k - 1, g) && !angegriffen(st, k - 2, g))
              zuege.push(packe(k, k - 2, 0, 4));
          }
        }
      } else {
        const R = typ === 3 ? LAEUFER : typ === 4 ? TURM : null;
        const n = R ? 4 : 8;
        for (i = 0; i < n; i++) {
          const d = R ? R[i] : KOENIG[i];
          z = s + d;
          while (!(z & 0x88)) {
            q = b[z];
            if (!q) { if (!nurSchlaege) zuege.push(packe(s, z, 0, 0)); }
            else { if ((q & 8) === gegner) zuege.push(packe(s, z, 0, 1)); break; }
            z += d;
          }
        }
      }
    }
    return zuege;
  }

  function legaleZuege(st) {
    const farbe = st.amZug, pz = pseudoZuege(st, false), res = [];
    for (let i = 0; i < pz.length; i++) {
      machZug(st, pz[i]);
      if (!imSchach(st, farbe)) res.push(pz[i]);
      nimmZurueck(st);
    }
    return res;
  }

  function machZug(st, zug) {
    const b = st.brett, von = zug & 127, nach = (zug >> 7) & 127, umw = (zug >> 14) & 7, fl = (zug >> 17) & 15;
    const farbe = st.amZug, f = farbe << 3, p = b[von];
    let lo = st.hashLo, hi = st.hashHi, geschlagen = b[nach], schlagFeld = nach;
    st.stapel.push({
      zug, geschlagen: 0, rochade: st.rochade, epFeld: st.epFeld, halbzuege: st.halbzuege,
      zugnummer: st.zugnummer, hashLo: lo, hashHi: hi,
    });
    const e = st.stapel[st.stapel.length - 1];
    if (fl & 2) { schlagFeld = farbe ? nach + 16 : nach - 16; geschlagen = b[schlagFeld]; b[schlagFeld] = 0; }
    e.geschlagen = geschlagen;
    if (geschlagen) { lo ^= ZF_LO[geschlagen * 128 + schlagFeld]; hi ^= ZF_HI[geschlagen * 128 + schlagFeld]; }
    const neu = umw ? (umw | f) : p;
    b[von] = 0; b[nach] = neu;
    lo ^= ZF_LO[p * 128 + von] ^ ZF_LO[neu * 128 + nach];
    hi ^= ZF_HI[p * 128 + von] ^ ZF_HI[neu * 128 + nach];
    if ((p & 7) === 6) st.koenig[farbe] = nach;
    if (fl & 4) {
      const rv = nach > von ? von + 3 : von - 4, rn = nach > von ? von + 1 : von - 1, t = b[rv];
      b[rv] = 0; b[rn] = t;
      lo ^= ZF_LO[t * 128 + rv] ^ ZF_LO[t * 128 + rn];
      hi ^= ZF_HI[t * 128 + rv] ^ ZF_HI[t * 128 + rn];
    }
    const altR = st.rochade, neuR = altR & ROCHADE_MASKE[von] & ROCHADE_MASKE[nach];
    if (neuR !== altR) {
      lo ^= ZR_LO[altR] ^ ZR_LO[neuR]; hi ^= ZR_HI[altR] ^ ZR_HI[neuR];
      st.rochade = neuR;
    }
    if (st.epFeld >= 0) { lo ^= ZE_LO[st.epFeld & 7]; hi ^= ZE_HI[st.epFeld & 7]; st.epFeld = -1; }
    if (fl & 8) {
      // epFeld nur, wenn ein gegnerischer Bauer daneben steht (Wiederholungsregel)
      const gb = 1 | ((farbe ^ 1) << 3), l = nach - 1, r = nach + 1;
      if ((!(l & 0x88) && b[l] === gb) || (!(r & 0x88) && b[r] === gb)) {
        st.epFeld = (von + nach) >> 1;
        lo ^= ZE_LO[st.epFeld & 7]; hi ^= ZE_HI[st.epFeld & 7];
      }
    }
    st.halbzuege = ((p & 7) === 1 || geschlagen) ? 0 : st.halbzuege + 1;
    if (farbe) st.zugnummer++;
    st.amZug = farbe ^ 1;
    lo ^= ZS_LO; hi ^= ZS_HI;
    st.hashLo = lo | 0; st.hashHi = hi | 0;
  }

  function nimmZurueck(st) {
    const e = st.stapel.pop(), zug = e.zug, b = st.brett;
    const von = zug & 127, nach = (zug >> 7) & 127, umw = (zug >> 14) & 7, fl = (zug >> 17) & 15;
    const farbe = st.amZug ^ 1;
    const p = umw ? (1 | (farbe << 3)) : b[nach];
    b[von] = p; b[nach] = 0;
    if ((p & 7) === 6) st.koenig[farbe] = von;
    if (fl & 2) b[farbe ? nach + 16 : nach - 16] = e.geschlagen;
    else b[nach] = e.geschlagen;
    if (fl & 4) {
      const rv = nach > von ? von + 3 : von - 4, rn = nach > von ? von + 1 : von - 1;
      b[rv] = b[rn]; b[rn] = 0;
    }
    st.amZug = farbe; st.rochade = e.rochade; st.epFeld = e.epFeld; st.halbzuege = e.halbzuege;
    st.zugnummer = e.zugnummer; st.hashLo = e.hashLo; st.hashHi = e.hashHi;
  }

  function zugZuUci(z) {
    const u = (z >> 14) & 7;
    return feldName(z & 127) + feldName((z >> 7) & 127) + (u ? UCI_UMW[u] : '');
  }

  function uciZuZug(st, uci) {
    if (typeof uci !== 'string' || uci.length < 4) return 0;
    const von = feldIndex(uci.slice(0, 2)), nach = feldIndex(uci.slice(2, 4));
    const umw = uci.length > 4 ? UCI_UMW.indexOf(uci[4].toLowerCase()) : 0;
    if (uci.length > 4 && umw < 2) return 0;
    const zuege = legaleZuege(st);
    for (let i = 0; i < zuege.length; i++) {
      const z = zuege[i];
      if ((z & 127) === von && ((z >> 7) & 127) === nach && ((z >> 14) & 7) === umw) return z;
    }
    return 0;
  }

  function figurAuf(st, name) {
    const p = st.brett[feldIndex(name)];
    return p ? { typ: TYP_BUCHSTABE[p & 7], farbe: (p >> 3) ? 's' : 'w' } : null;
  }

  function figurenListe(st) {
    const res = [];
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = st.brett[s];
      if (p) res.push({ feld: s, typ: TYP_BUCHSTABE[p & 7], farbe: (p >> 3) ? 's' : 'w' });
    }
    return res;
  }

  return {
    START_FEN, TYP_BUCHSTABE, ausFen, zuFen, pseudoZuege, legaleZuege, machZug, nimmZurueck,
    angegriffen, imSchach, angreifer, zugVon, zugNach, zugUmwandlung, zugFlags,
    zugZuUci, uciZuZug, feldName, feldIndex, figurAuf, figurenListe, hashText,
  };
}
const Regeln = RegelnModul();
