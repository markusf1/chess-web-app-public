// Schach-Engine: Negamax mit Alpha-Beta, iterativer Vertiefung, Ruhesuche,
// Transpositionstabelle, Zugsortierung, Null-Zug-Pruning und LMR; Bewertung PeSTO.
// EngineModul ist vollstaendig selbstgenuegsam (wird per toString() in den Worker kopiert)
// und greift nur auf seinen Parameter Regeln zu.
function EngineModul(Regeln) {
  const MATT = 30000, UNENDLICH = 32000, MATT_GRENZE = MATT - 1000;
  const MAX_PLY = 96;

  const STUFEN = {
    leicht: { tiefe: 1, ruhesuche: false, zeitMs: 300, rauschen: 120, zufallsAnteil: 0.2, stark: false },
    mittel: { tiefe: 3, ruhesuche: true, zeitMs: 1500, rauschen: 40, zufallsAnteil: 0, stark: false },
    schwer: { tiefe: 64, ruhesuche: true, zeitMs: 4500, rauschen: 0, zufallsAnteil: 0, stark: true },
  };

  const jetzt = typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
    ? () => performance.now() : () => Date.now();

  // ---------- PeSTO (Rofchade), Tabellen von Weiss aus gesehen, Index 0 = a8 ----------
  const MG_WERT = [0, 82, 337, 365, 477, 1025, 0];
  const EG_WERT = [0, 94, 281, 297, 512, 936, 0];
  const PHASE = [0, 0, 1, 1, 2, 4, 0];
  const MG_TAB = [null, [
    0, 0, 0, 0, 0, 0, 0, 0,
    98, 134, 61, 95, 68, 126, 34, -11,
    -6, 7, 26, 31, 65, 56, 25, -20,
    -14, 13, 6, 21, 23, 12, 17, -23,
    -27, -2, -5, 12, 17, 6, 10, -25,
    -26, -4, -4, -10, 3, 3, 33, -12,
    -35, -1, -20, -23, -15, 24, 38, -22,
    0, 0, 0, 0, 0, 0, 0, 0,
  ], [
    -167, -89, -34, -49, 61, -97, -15, -107,
    -73, -41, 72, 36, 23, 62, 7, -17,
    -47, 60, 37, 65, 84, 129, 73, 44,
    -9, 17, 19, 53, 37, 69, 18, 22,
    -13, 4, 16, 13, 28, 19, 21, -8,
    -23, -9, 12, 10, 19, 17, 25, -16,
    -29, -53, -12, -3, -1, 18, -14, -19,
    -105, -21, -58, -33, -17, -28, -19, -23,
  ], [
    -29, 4, -82, -37, -25, -42, 7, -8,
    -26, 16, -18, -13, 30, 59, 18, -47,
    -16, 37, 43, 40, 35, 50, 37, -2,
    -4, 5, 19, 50, 37, 37, 7, -2,
    -6, 13, 13, 26, 34, 12, 10, 4,
    0, 15, 15, 15, 14, 27, 18, 10,
    4, 15, 16, 0, 7, 21, 33, 1,
    -33, -3, -14, -21, -13, -12, -39, -21,
  ], [
    32, 42, 32, 51, 63, 9, 31, 43,
    27, 32, 58, 62, 80, 67, 26, 44,
    -5, 19, 26, 36, 17, 45, 61, 16,
    -24, -11, 7, 26, 24, 35, -8, -20,
    -36, -26, -12, -1, 9, -7, 6, -23,
    -45, -25, -16, -17, 3, 0, -5, -33,
    -44, -16, -20, -9, -1, 11, -6, -71,
    -19, -13, 1, 17, 16, 7, -37, -26,
  ], [
    -28, 0, 29, 12, 59, 44, 43, 45,
    -24, -39, -5, 1, -16, 57, 28, 54,
    -13, -17, 7, 8, 29, 56, 47, 57,
    -27, -27, -16, -16, -1, 17, -2, 1,
    -9, -26, -9, -10, -2, -4, 3, -3,
    -14, 2, -11, -2, -5, 2, 14, 5,
    -35, -8, 11, 2, 8, 15, -3, 1,
    -1, -18, -9, 10, -15, -25, -31, -50,
  ], [
    -65, 23, 16, -15, -56, -34, 2, 13,
    29, -1, -20, -7, -8, -4, -38, -29,
    -9, 24, 2, -16, -20, 6, 22, -22,
    -17, -20, -12, -27, -30, -25, -14, -36,
    -49, -1, -27, -39, -46, -44, -33, -51,
    -14, -14, -22, -46, -44, -30, -15, -27,
    1, 7, -8, -64, -43, -16, 9, 8,
    -15, 36, 12, -54, 8, -28, 24, 14,
  ]];
  const EG_TAB = [null, [
    0, 0, 0, 0, 0, 0, 0, 0,
    178, 173, 158, 134, 147, 132, 165, 187,
    94, 100, 85, 67, 56, 53, 82, 84,
    32, 24, 13, 5, -2, 4, 17, 17,
    13, 9, -3, -7, -7, -8, 3, -1,
    4, 7, -6, 1, 0, -5, -1, -8,
    13, 8, 8, 10, 13, 0, 2, -7,
    0, 0, 0, 0, 0, 0, 0, 0,
  ], [
    -58, -38, -13, -28, -31, -27, -63, -99,
    -25, -8, -25, -2, -9, -25, -24, -52,
    -24, -20, 10, 9, -1, -9, -19, -41,
    -17, 3, 22, 22, 22, 11, 8, -18,
    -18, -6, 16, 25, 16, 17, 4, -18,
    -23, -3, -1, 15, 10, -3, -20, -22,
    -42, -20, -10, -5, -2, -20, -23, -44,
    -29, -51, -23, -15, -22, -18, -50, -64,
  ], [
    -14, -21, -11, -8, -7, -9, -17, -24,
    -8, -4, 7, -12, -3, -13, -4, -14,
    2, -8, 0, -1, -2, 6, 0, 4,
    -3, 9, 12, 9, 14, 10, 3, 2,
    -6, 3, 13, 19, 7, 10, -3, -9,
    -12, -3, 8, 10, 13, 3, -7, -15,
    -14, -18, -7, -1, 4, -9, -15, -27,
    -23, -9, -23, -5, -9, -16, -5, -17,
  ], [
    13, 10, 18, 15, 12, 12, 8, 5,
    11, 13, 13, 11, -3, 3, 8, 3,
    7, 7, 7, 5, 4, -3, -5, -3,
    4, 3, 13, 1, 2, 1, -1, 2,
    3, 5, 8, 4, -5, -6, -8, -11,
    -4, 0, -5, -1, -7, -12, -8, -16,
    -6, -6, 0, 2, -9, -9, -11, -3,
    -9, 2, 3, -1, -5, -13, 4, -20,
  ], [
    -9, 22, 22, 27, 27, 19, 10, 20,
    -17, 20, 32, 41, 58, 25, 30, 0,
    -20, 6, 9, 49, 47, 35, 19, 9,
    3, 22, 24, 45, 57, 40, 57, 36,
    -18, 28, 19, 47, 31, 34, 39, 23,
    -16, -27, 15, 6, 9, 17, 10, 5,
    -22, -23, -30, -16, -16, -23, -36, -32,
    -33, -28, -22, -43, -5, -32, -20, -41,
  ], [
    -74, -35, -18, -18, -11, 15, 4, -17,
    -12, 17, 14, 17, 17, 38, 23, 11,
    10, 17, 23, 15, 20, 45, 44, 13,
    -8, 22, 24, 27, 26, 33, 26, 3,
    -18, -4, 21, 24, 27, 23, 9, -11,
    -19, -3, 11, 21, 23, 16, 7, -9,
    -27, -11, 4, 13, 14, 4, -5, -17,
    -53, -34, -21, -11, -28, -14, -24, -43,
  ]];

  // Je Figur (typ | farbe<<3) und 0x88-Feld: Wert inkl. Material aus Sicht des Besitzers
  const MG = new Int16Array(16 * 128), EG = new Int16Array(16 * 128);
  for (let typ = 1; typ <= 6; typ++) {
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const rang = s >> 4, linie = s & 7;
      const iw = (7 - rang) * 8 + linie, is = rang * 8 + linie; // Schwarz: vertikal gespiegelt
      MG[typ * 128 + s] = MG_WERT[typ] + MG_TAB[typ][iw];
      EG[typ * 128 + s] = EG_WERT[typ] + EG_TAB[typ][iw];
      MG[(typ | 8) * 128 + s] = MG_WERT[typ] + MG_TAB[typ][is];
      EG[(typ | 8) * 128 + s] = EG_WERT[typ] + EG_TAB[typ][is];
    }
  }

  // Bewertung in Centipawns aus Sicht der Seite am Zug
  function bewerte(st) {
    const b = st.brett;
    let mgW = 0, mgS = 0, egW = 0, egS = 0, phase = 0, leichteW = 0, leichteS = 0, schwereOderBauer = 0;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (!p) continue;
      const i = p * 128 + s, typ = p & 7;
      if (p & 8) { mgS += MG[i]; egS += EG[i]; if (typ === 2 || typ === 3) leichteS++; }
      else { mgW += MG[i]; egW += EG[i]; if (typ === 2 || typ === 3) leichteW++; }
      phase += PHASE[typ];
      if (typ === 1 || typ === 4 || typ === 5) schwereOderBauer++;
    }
    // Ungenuegendes Material: K gegen K, K+Leichtfigur gegen K
    if (!schwereOderBauer && leichteW + leichteS <= 1) return 0;
    if (phase > 24) phase = 24;
    const w = ((mgW - mgS) * phase + (egW - egS) * (24 - phase)) / 24 | 0;
    return st.amZug ? -w : w;
  }

  // ---------- Null-Zug: Zobrist-Schluessel aus Regeln ableiten ----------
  const ZS = (() => {
    const a = Regeln.ausFen('k7/8/8/8/8/8/8/7K w - - 0 1'), b = Regeln.ausFen('k7/8/8/8/8/8/8/7K b - - 0 1');
    return [a.hashLo ^ b.hashLo, a.hashHi ^ b.hashHi];
  })();
  const ZE_LO = new Int32Array(8), ZE_HI = new Int32Array(8);
  for (let l = 0; l < 8; l++) {
    const a = Regeln.ausFen('k7/8/8/8/8/8/8/7K w - - 0 1');
    const b = Regeln.ausFen('k7/8/8/8/8/8/8/7K w - ' + String.fromCharCode(97 + l) + '6 0 1');
    ZE_LO[l] = a.hashLo ^ b.hashLo; ZE_HI[l] = a.hashHi ^ b.hashHi;
  }

  // ---------- Transpositionstabelle ----------
  const TT_BITS = 20, TT_GROESSE = 1 << TT_BITS, TT_MASKE = TT_GROESSE - 1;
  const EXAKT = 1, UNTEN = 2, OBEN = 3; // UNTEN: Wert >= beta (fail high), OBEN: Wert <= alpha
  let ttHi = null, ttZug, ttWert, ttTiefe, ttFlag;
  function ttAnlegen() {
    if (!ttHi) {
      ttHi = new Int32Array(TT_GROESSE); ttZug = new Int32Array(TT_GROESSE);
      ttWert = new Int16Array(TT_GROESSE); ttTiefe = new Int8Array(TT_GROESSE); ttFlag = new Uint8Array(TT_GROESSE);
    } else { ttFlag.fill(0); }
  }
  function ttSpeichern(st, tiefe, wert, flag, zug, ply) {
    const i = st.hashLo & TT_MASKE;
    if (ttFlag[i] && ttHi[i] === st.hashHi && ttTiefe[i] > tiefe && flag !== EXAKT) return;
    if (wert > MATT_GRENZE) wert += ply; else if (wert < -MATT_GRENZE) wert -= ply;
    ttHi[i] = st.hashHi; ttZug[i] = zug; ttWert[i] = wert; ttTiefe[i] = tiefe < 0 ? 0 : tiefe; ttFlag[i] = flag;
  }

  // ---------- Suchzustand (vorab angelegt) ----------
  const ZUEGE_PRO_PLY = 256;
  const sortWert = new Int32Array(MAX_PLY * ZUEGE_PRO_PLY);
  const killer1 = new Int32Array(MAX_PLY), killer2 = new Int32Array(MAX_PLY);
  const historie = new Int32Array(16 * 128);
  const pfadLo = new Int32Array(MAX_PLY + 1), pfadHi = new Int32Array(MAX_PLY + 1);
  const LMR = [];
  for (let d = 0; d < 64; d++) {
    LMR.push(new Int8Array(64));
    for (let n = 1; n < 64; n++) LMR[d][n] = d ? Math.floor(0.75 + Math.log(d) * Math.log(n) / 2.25) : 0;
  }
  const SCHLAG_WERT = [0, 100, 320, 330, 500, 900, 2000];

  let st = null, stufe = null, knoten = 0, abbruch = false, endeZeit = 0;
  let verlaufLo = null; // Map hashLo -> Array hashHi

  function zeitPruefen() {
    if (jetzt() >= endeZeit) abbruch = true;
  }

  function wiederholung(ply) {
    const lo = st.hashLo, hi = st.hashHi, hz = st.halbzuege;
    for (let i = ply - 2; i >= 0 && i >= ply - hz; i -= 2)
      if (pfadLo[i] === lo && pfadHi[i] === hi) return true;
    if (verlaufLo && hz >= ply) {
      const l = verlaufLo.get(lo);
      if (l) for (let i = 0; i < l.length; i++) if (l[i] === hi) return true;
    }
    return false;
  }

  function hatFiguren(farbe) {
    const b = st.brett, f = farbe << 3;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (p && (p & 8) === f) { const t = p & 7; if (t >= 2 && t <= 5) return true; }
    }
    return false;
  }

  // Sortierwerte vergeben
  function bewerteZuege(zuege, basis, ttZ, ply) {
    const b = st.brett, k1 = killer1[ply], k2 = killer2[ply];
    for (let i = 0; i < zuege.length; i++) {
      const z = zuege[i];
      let w;
      if (z === ttZ) w = 10000000;
      else {
        const fl = (z >> 17) & 15, umw = (z >> 14) & 7, von = z & 127, nach = (z >> 7) & 127;
        if (fl & 1) {
          const opfer = (fl & 2) ? 1 : (b[nach] & 7);
          w = 1000000 + SCHLAG_WERT[opfer] * 16 - (b[von] & 7) + (umw === 5 ? 50000 : 0);
        } else if (umw === 5) w = 950000;
        else if (umw) w = -100000; // Unterverwandlung zuletzt
        else if (z === k1) w = 900000;
        else if (z === k2) w = 890000;
        else w = historie[b[von] * 128 + nach];
      }
      sortWert[basis + i] = w;
    }
  }
  function waehle(zuege, basis, i) {
    let best = i, bw = sortWert[basis + i];
    for (let j = i + 1; j < zuege.length; j++) if (sortWert[basis + j] > bw) { bw = sortWert[basis + j]; best = j; }
    if (best !== i) {
      const t = zuege[i]; zuege[i] = zuege[best]; zuege[best] = t;
      sortWert[basis + best] = sortWert[basis + i]; sortWert[basis + i] = bw;
    }
    return zuege[i];
  }

  // Schlaege plus stille Damenumwandlungen
  function ruheZuege() {
    const zuege = Regeln.pseudoZuege(st, true);
    const b = st.brett, farbe = st.amZug, bauer = 1 | (farbe << 3);
    const rang = farbe ? 1 : 6, vor = farbe ? -16 : 16;
    for (let l = 0; l < 8; l++) {
      const s = rang * 16 + l;
      if (b[s] === bauer && !b[s + vor]) zuege.push(s | ((s + vor) << 7) | (5 << 14));
    }
    return zuege;
  }

  function ruhesuche(alpha, beta, ply) {
    if ((++knoten & 1023) === 0) zeitPruefen();
    if (abbruch) return 0;
    const farbe = st.amZug;
    const imS = Regeln.imSchach(st, farbe);
    if (ply >= MAX_PLY - 1) return imS ? 0 : bewerte(st);
    let stehen = -UNENDLICH;
    if (!imS) {
      stehen = bewerte(st);
      if (stehen >= beta) return stehen;
      if (stehen > alpha) alpha = stehen;
    }
    const zuege = imS ? Regeln.pseudoZuege(st, false) : ruheZuege();
    const basis = ply * ZUEGE_PRO_PLY;
    bewerteZuege(zuege, basis, 0, ply);
    const b = st.brett;
    let beste = stehen, legal = 0;
    for (let i = 0; i < zuege.length; i++) {
      const z = waehle(zuege, basis, i);
      if (!imS) {
        // Delta-Pruning: selbst der Gewinn des Opfers reicht nicht
        const fl = (z >> 17) & 15, umw = (z >> 14) & 7;
        if (!umw) {
          const opfer = (fl & 2) ? 1 : (b[(z >> 7) & 127] & 7);
          if (stehen + SCHLAG_WERT[opfer] + 200 <= alpha) continue;
        }
      }
      Regeln.machZug(st, z);
      if (Regeln.imSchach(st, farbe)) { Regeln.nimmZurueck(st); continue; }
      legal++;
      const w = -ruhesuche(-beta, -alpha, ply + 1);
      Regeln.nimmZurueck(st);
      if (abbruch) return 0;
      if (w > beste) {
        beste = w;
        if (w > alpha) { alpha = w; if (w >= beta) break; }
      }
    }
    if (imS && !legal) return -MATT + ply;
    return beste;
  }

  function suche(tiefe, alpha, beta, ply, nullErlaubt) {
    if ((++knoten & 1023) === 0) zeitPruefen();
    if (abbruch) return 0;
    const pv = beta - alpha > 1;
    const farbe = st.amZug;
    pfadLo[ply] = st.hashLo; pfadHi[ply] = st.hashHi;
    if (ply > 0) {
      if (st.halbzuege >= 100 || wiederholung(ply)) return 0;
      // Matt-Distanz-Pruning
      const ma = -MATT + ply, mb = MATT - ply - 1;
      if (ma > alpha) { alpha = ma; if (alpha >= beta) return alpha; }
      if (mb < beta) { beta = mb; if (alpha >= beta) return beta; }
    }
    if (ply >= MAX_PLY - 1) return bewerte(st);
    const imS = Regeln.imSchach(st, farbe);
    if (imS && stufe !== STUFEN.leicht) tiefe++;
    if (tiefe <= 0) return stufe.ruhesuche ? ruhesuche(alpha, beta, ply) : bewerte(st);

    // Transpositionstabelle
    const ti = st.hashLo & TT_MASKE;
    let ttZ = 0;
    if (ttFlag[ti] && ttHi[ti] === st.hashHi) {
      ttZ = ttZug[ti];
      if (!pv && ttTiefe[ti] >= tiefe) {
        let w = ttWert[ti];
        if (w > MATT_GRENZE) w -= ply; else if (w < -MATT_GRENZE) w += ply;
        const f = ttFlag[ti];
        if (f === EXAKT || (f === UNTEN && w >= beta) || (f === OBEN && w <= alpha)) return w;
      }
    }

    const stark = stufe.stark;
    let statisch = 0;
    if (stark && !imS) {
      statisch = bewerte(st);
      if (!pv && Math.abs(beta) < MATT_GRENZE) {
        // Reverse Futility Pruning
        if (tiefe <= 6 && statisch - 90 * tiefe >= beta) return statisch;
        // Null-Zug-Pruning
        if (nullErlaubt && tiefe >= 3 && statisch >= beta && hatFiguren(farbe)) {
          const r = 3 + (tiefe >> 2);
          const altEp = st.epFeld, altHz = st.halbzuege, altLo = st.hashLo, altHi = st.hashHi;
          let lo = altLo ^ ZS[0], hi = altHi ^ ZS[1];
          if (altEp >= 0) { lo ^= ZE_LO[altEp & 7]; hi ^= ZE_HI[altEp & 7]; }
          st.epFeld = -1; st.halbzuege = 0; st.amZug = farbe ^ 1; st.hashLo = lo; st.hashHi = hi;
          const w = -suche(tiefe - 1 - r, -beta, -beta + 1, ply + 1, false);
          st.epFeld = altEp; st.halbzuege = altHz; st.amZug = farbe; st.hashLo = altLo; st.hashHi = altHi;
          if (abbruch) return 0;
          if (w >= beta) return w >= MATT_GRENZE ? beta : w;
        }
      }
    }

    const zuege = Regeln.pseudoZuege(st, false);
    const basis = ply * ZUEGE_PRO_PLY;
    bewerteZuege(zuege, basis, ttZ, ply);
    const b = st.brett;
    const altAlpha = alpha;
    let beste = -UNENDLICH, besterZug = 0, legal = 0, stille = 0;
    const futil = stark && !pv && !imS && tiefe <= 3 && Math.abs(alpha) < MATT_GRENZE &&
      statisch + 100 + 120 * tiefe <= alpha;
    const lmpGrenze = 4 + 3 * tiefe * tiefe;
    for (let i = 0; i < zuege.length; i++) {
      const z = waehle(zuege, basis, i);
      const fl = (z >> 17) & 15, umw = (z >> 14) & 7;
      const ruhig = !(fl & 1) && !umw;
      const figur = b[z & 127];
      Regeln.machZug(st, z);
      if (Regeln.imSchach(st, farbe)) { Regeln.nimmZurueck(st); continue; }
      legal++;
      const gibtSchach = Regeln.imSchach(st, farbe ^ 1);
      if (ruhig) stille++;
      // Futility Pruning und Late Move Pruning fuer stille Zuege
      if (stark && ruhig && !gibtSchach && legal > 1 && !imS && !pv && beste > -MATT_GRENZE) {
        if (futil || (tiefe <= 3 && stille > lmpGrenze)) { Regeln.nimmZurueck(st); continue; }
      }
      let w;
      if (legal === 1) w = -suche(tiefe - 1, -beta, -alpha, ply + 1, true);
      else {
        let red = 0;
        if (stark && tiefe >= 3 && ruhig && !imS && !gibtSchach && legal > 3 &&
            z !== killer1[ply] && z !== killer2[ply]) {
          red = LMR[tiefe < 64 ? tiefe : 63][legal < 64 ? legal : 63];
          if (pv) red--;
          if (historie[figur * 128 + ((z >> 7) & 127)] > 4000) red--;
          if (red < 0) red = 0;
          if (red > tiefe - 2) red = tiefe - 2;
        }
        w = -suche(tiefe - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (red && w > alpha && !abbruch) w = -suche(tiefe - 1, -alpha - 1, -alpha, ply + 1, true);
        if (w > alpha && w < beta && !abbruch) w = -suche(tiefe - 1, -beta, -alpha, ply + 1, true);
      }
      Regeln.nimmZurueck(st);
      if (abbruch) return 0;
      if (w > beste) {
        beste = w; besterZug = z;
        if (w > alpha) {
          alpha = w;
          if (w >= beta) {
            if (ruhig) {
              if (killer1[ply] !== z) { killer2[ply] = killer1[ply]; killer1[ply] = z; }
              const hi = figur * 128 + ((z >> 7) & 127);
              historie[hi] += tiefe * tiefe;
              if (historie[hi] > 800000) for (let k = 0; k < historie.length; k++) historie[k] >>= 1;
            }
            break;
          }
        }
      }
    }
    if (!legal) return imS ? -MATT + ply : 0;
    ttSpeichern(st, tiefe, beste, beste >= beta ? UNTEN : beste > altAlpha ? EXAKT : OBEN, besterZug, ply);
    return beste;
  }

  // Wurzelsuche einer Iteration. Bei Rauschstufen wird jeder Zug mit vollem Fenster
  // bewertet (exakte Werte), sonst PVS mit Fenster [alpha, beta].
  function wurzel(zuege, werte, tiefe, alpha, beta, exakt) {
    let beste = -UNENDLICH;
    for (let i = 0; i < zuege.length; i++) {
      const z = zuege[i];
      Regeln.machZug(st, z);
      let w;
      if (exakt) w = -suche(tiefe - 1, -UNENDLICH, UNENDLICH, 1, true);
      else if (i === 0) w = -suche(tiefe - 1, -beta, -alpha, 1, true);
      else {
        w = -suche(tiefe - 1, -alpha - 1, -alpha, 1, true);
        if (w > alpha && w < beta && !abbruch) w = -suche(tiefe - 1, -beta, -alpha, 1, true);
      }
      Regeln.nimmZurueck(st);
      if (abbruch) return beste;
      werte[i] = w;
      if (w > beste) beste = w;
      if (!exakt) {
        if (w > alpha) {
          alpha = w;
          // besten Zug nach vorn
          for (let j = i; j > 0; j--) { const t = zuege[j]; zuege[j] = zuege[j - 1]; zuege[j - 1] = t; const u = werte[j]; werte[j] = werte[j - 1]; werte[j - 1] = u; }
          if (w >= beta) return w;
        }
      }
    }
    return beste;
  }

  function sucheZug(stellung, optionen) {
    optionen = optionen || {};
    const s = STUFEN[optionen.stufe] || STUFEN.mittel;
    const zufall = typeof optionen.zufall === 'function' ? optionen.zufall : Math.random;
    const budget = optionen.zeitMs != null ? Math.min(s.zeitMs, optionen.zeitMs) : s.zeitMs; // zeitMs ist eine Obergrenze fuer alle Stufen
    const start = jetzt();
    // Sicherheitsabstand: Zeitpruefung alle 1024 Knoten plus Abwickeln des Suchstapels,
    // damit die Suche das Budget nie ueberschreitet.
    st = stellung; stufe = s; knoten = 0; abbruch = false; endeZeit = start + budget - Math.min(40, budget * 0.02);
    const stapelLaenge = st.stapel.length;

    verlaufLo = null;
    if (optionen.verlauf && optionen.verlauf.length) {
      verlaufLo = new Map();
      const wurzelText = Regeln.hashText(st);
      let wurzelGesehen = false;
      for (let i = optionen.verlauf.length - 1; i >= 0; i--) {
        const t = optionen.verlauf[i];
        if (t === wurzelText && !wurzelGesehen) { wurzelGesehen = true; continue; } // die Wurzel selbst
        const k = t.indexOf(':');
        const lo = +t.slice(0, k) | 0, hi = +t.slice(k + 1) | 0;
        let l = verlaufLo.get(lo);
        if (!l) verlaufLo.set(lo, l = []);
        l.push(hi);
      }
    }

    const zuege = Regeln.legaleZuege(st);
    if (!zuege.length) {
      return { zug: 0, bewertung: Regeln.imSchach(st, st.amZug) ? -MATT : 0, tiefe: 0 };
    }

    ttAnlegen();
    pfadLo[0] = st.hashLo; pfadHi[0] = st.hashHi;
    killer1.fill(0); killer2.fill(0); historie.fill(0);

    // Startsortierung: Schlaege nach MVV-LVA zuerst
    bewerteZuege(zuege, 0, 0, 0);
    const sortiert = [];
    for (let i = 0; i < zuege.length; i++) sortiert.push(waehle(zuege, 0, i));
    const werte = new Array(sortiert.length).fill(-UNENDLICH);

    const exakt = s.rauschen > 0;
    let besterZug = sortiert[0], besterWert = 0, fertigeTiefe = 0, fertigeWerte = null, fertigeZuege = null;
    const maxTiefe = (s === STUFEN.schwer && sortiert.length === 1) ? 1 : s.tiefe;
    let vorher = 0;
    for (let tiefe = 1; tiefe <= maxTiefe; tiefe++) {
      let w;
      if (!exakt && tiefe >= 4 && Math.abs(vorher) < MATT_GRENZE) {
        // Aspirationsfenster
        let delta = 35, a = vorher - delta, bb = vorher + delta;
        for (;;) {
          w = wurzel(sortiert, werte, tiefe, a, bb, false);
          if (abbruch) break;
          if (w <= a) { a = Math.max(-UNENDLICH, a - delta * 3); delta *= 3; }
          else if (w >= bb) { bb = Math.min(UNENDLICH, bb + delta * 3); delta *= 3; }
          else break;
          if (delta > 1500) { a = -UNENDLICH; bb = UNENDLICH; }
        }
      } else w = wurzel(sortiert, werte, tiefe, -UNENDLICH, UNENDLICH, exakt);
      if (abbruch) {
        // Iteration unvollstaendig: Ergebnis der letzten abgeschlossenen Iteration gilt.
        if (!fertigeTiefe && werte[0] > -UNENDLICH) { besterZug = sortiert[0]; besterWert = werte[0]; }
        break;
      }
      fertigeTiefe = tiefe; vorher = w;
      if (exakt) { fertigeWerte = werte.slice(); fertigeZuege = sortiert.slice(); }
      else { besterZug = sortiert[0]; besterWert = w; }
      if (exakt) {
        // fuer die naechste Iteration nach Wert sortieren (stabil)
        const idx = sortiert.map((z, i) => i).sort((x, y) => werte[y] - werte[x]);
        const z2 = idx.map(i => sortiert[i]), w2 = idx.map(i => werte[i]);
        for (let i = 0; i < idx.length; i++) { sortiert[i] = z2[i]; werte[i] = w2[i]; }
      }
      if (Math.abs(w) >= MATT - tiefe) break; // kuerzestes Matt gefunden
      // Neue Iteration nur beginnen, wenn sie voraussichtlich fertig wird
      if (s === STUFEN.schwer && jetzt() - start > budget * 0.55) break;
    }

    if (exakt) {
      let zL = fertigeZuege, wL = fertigeWerte;
      if (!zL) { zL = sortiert; wL = werte.map(x => (x === -UNENDLICH ? 0 : x)); }
      const zufallsZug = s.zufallsAnteil > 0 && zufall() < s.zufallsAnteil;
      if (zufallsZug) {
        let k = Math.floor(zufall() * zL.length);
        if (!(k >= 0 && k < zL.length)) k = 0;
        besterZug = zL[k]; besterWert = wL[k];
      } else {
        let bestR = -Infinity;
        for (let i = 0; i < zL.length; i++) {
          const r = wL[i] + (zufall() * 2 - 1) * s.rauschen;
          if (r > bestR) { bestR = r; besterZug = zL[i]; besterWert = wL[i]; }
        }
      }
    }

    // Sicherheit: Stellung muss unveraendert sein
    while (st.stapel.length > stapelLaenge) Regeln.nimmZurueck(st);
    const erg = { zug: besterZug, bewertung: besterWert | 0, tiefe: fertigeTiefe, knoten };
    st = null; verlaufLo = null;
    return erg;
  }

  return { MATT, STUFEN, sucheZug, bewerte };
}
const Engine = EngineModul(Regeln);
