// Partieverwaltung: Verlauf, Zurueck, Spielende, Serialisierung.
const Partie = (() => {
  const R = Regeln;
  const UMW_UCI = { D: 'q', T: 'r', L: 'b', S: 'n' };

  function fenGueltig(fen) {
    if (typeof fen !== 'string') return false;
    const t = fen.trim().split(/\s+/);
    if (t.length < 2 || !/^[wb]$/.test(t[1])) return false;
    const reihen = t[0].split('/');
    if (reihen.length !== 8) return false;
    let koenige = [0, 0];
    for (let i = 0; i < 8; i++) {
      const r = reihen[i];
      let n = 0;
      for (const c of r) {
        if (c >= '1' && c <= '8') n += +c;
        else if ((c === 'p' || c === 'P') && (i === 0 || i === 7)) return false; // Bauern nie auf Reihe 1/8
        else if ('pnbrqkPNBRQK'.indexOf(c) >= 0) { n++; if (c === 'k') koenige[1]++; if (c === 'K') koenige[0]++; }
        else return false;
      }
      if (n !== 8) return false;
    }
    if (koenige[0] !== 1 || koenige[1] !== 1) return false;
    if (t[2] !== undefined && !/^(-|[KQkq]+)$/.test(t[2])) return false;
    if (t[3] !== undefined && !/^(-|[a-h][1-8])$/.test(t[3])) return false;
    if (t[4] !== undefined && !/^\d+$/.test(t[4])) return false;
    if (t[5] !== undefined && !/^\d+$/.test(t[5])) return false;
    return true;
  }

  function neu(startFen = R.START_FEN) {
    if (!fenGueltig(startFen)) throw new Error('Ungueltige FEN: ' + startFen);
    const stellung = R.ausFen(startFen);
    return { startFen, stellung, zuege: [], hashes: [R.hashText(stellung)], infos: [] };
  }

  function zieheUci(P, uci) {
    const st = P.stellung;
    const z = R.uciZuZug(st, uci);
    if (!z) return null;
    const von = R.zugVon(z), nach = R.zugNach(z), fl = R.zugFlags(z), umw = R.zugUmwandlung(z);
    const p = st.brett[von], farbe = (p >> 3) ? 's' : 'w';
    let geschlagen = null;
    const schlagFeld = (fl & 2) ? (p >> 3 ? nach + 16 : nach - 16) : nach;
    const q = st.brett[schlagFeld];
    if (q) geschlagen = { typ: R.TYP_BUCHSTABE[q & 7], farbe: (q >> 3) ? 's' : 'w', feld: R.feldName(schlagFeld) };
    let rochadeTurm = null;
    if (fl & 4) {
      rochadeTurm = nach > von
        ? { von: R.feldName(von + 3), nach: R.feldName(von + 1) }
        : { von: R.feldName(von - 4), nach: R.feldName(von - 1) };
    }
    R.machZug(st, z);
    const info = {
      von: R.feldName(von), nach: R.feldName(nach), typ: R.TYP_BUCHSTABE[p & 7], farbe,
      geschlagen, rochadeTurm, umwandlung: umw ? R.TYP_BUCHSTABE[umw] : null,
      schach: R.imSchach(st, st.amZug),
    };
    P.zuege.push(R.zugZuUci(z));
    P.hashes.push(R.hashText(st));
    P.infos.push(info);
    return info;
  }

  function ziehe(P, von, nach, umwandlung) {
    let uci = von + nach;
    if (umwandlung) {
      if (!UMW_UCI[umwandlung]) return null;
      uci += UMW_UCI[umwandlung];
    }
    return zieheUci(P, uci);
  }

  function brauchtUmwandlung(P, von, nach) {
    const f = R.feldIndex(von), n = R.feldIndex(nach);
    return R.legaleZuege(P.stellung).some(z => R.zugVon(z) === f && R.zugNach(z) === n && R.zugUmwandlung(z) > 0);
  }

  function zielfelder(P, von) {
    const f = R.feldIndex(von), res = [];
    for (const z of R.legaleZuege(P.stellung)) {
      if (R.zugVon(z) !== f) continue;
      const n = R.feldName(R.zugNach(z));
      if (res.indexOf(n) < 0) res.push(n);
    }
    return res;
  }

  function zurueck(P) {
    if (!P.infos.length) return null;
    R.nimmZurueck(P.stellung);
    P.zuege.pop();
    P.hashes.pop();
    return P.infos.pop();
  }

  function zuWenigMaterial(st) {
    const leichte = [];
    for (const f of R.figurenListe(st)) {
      if (f.typ === 'K') continue;
      if (f.typ !== 'L' && f.typ !== 'S') return false;
      leichte.push(f);
    }
    if (leichte.length === 0) return true;
    if (leichte.length === 1) return true;
    if (leichte.length === 2 && leichte.every(f => f.typ === 'L') && leichte[0].farbe !== leichte[1].farbe) {
      const farbeFeld = f => ((f.feld >> 4) + (f.feld & 7)) & 1;
      return farbeFeld(leichte[0]) === farbeFeld(leichte[1]);
    }
    return false;
  }

  function status(P) {
    const st = P.stellung;
    if (R.legaleZuege(st).length === 0) {
      if (R.imSchach(st, st.amZug)) return { ende: true, ergebnis: st.amZug ? 'w' : 's', grund: 'matt' };
      return { ende: true, ergebnis: 'remis', grund: 'patt' };
    }
    if (st.halbzuege >= 100) return { ende: true, ergebnis: 'remis', grund: 'fuenfzig' };
    const zaehler = {};
    for (const h of P.hashes) {
      zaehler[h] = (zaehler[h] || 0) + 1;
      if (zaehler[h] >= 3) return { ende: true, ergebnis: 'remis', grund: 'wiederholung' };
    }
    if (zuWenigMaterial(st)) return { ende: true, ergebnis: 'remis', grund: 'material' };
    return { ende: false };
  }

  function geschlagene(P) {
    const res = { w: [], s: [] };
    for (const i of P.infos) if (i.geschlagen) res[i.geschlagen.farbe].push(i.geschlagen.typ);
    return res;
  }

  function serialisieren(P) { return { startFen: P.startFen, zuege: P.zuege.slice() }; }

  function laden(obj) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.zuege)) return null;
    let P;
    try { P = neu(obj.startFen === undefined ? R.START_FEN : obj.startFen); } catch (e) { return null; }
    for (const u of obj.zuege) if (typeof u !== 'string' || !zieheUci(P, u)) return null;
    return P;
  }

  return { neu, ziehe, zieheUci, brauchtUmwandlung, zielfelder, zurueck, status, geschlagene, serialisieren, laden };
})();
