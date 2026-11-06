// App: verbindet Startbildschirm, Brett, Partie, Computer und Speichern zu einem Spielablauf.
const App = (() => {
  const $ = id => document.getElementById(id);
  const STUFEN_TEXT = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };
  const GRUND_TEXT = {
    matt: 'Schachmatt',
    patt: 'Patt: Wer am Zug ist, kann nicht ziehen, steht aber nicht im Schach',
    wiederholung: 'Dreimal dieselbe Stellung',
    fuenfzig: '50 Züge ohne Schlagen und ohne Bauernzug',
    material: 'Zu wenig Figuren, um noch Schachmatt zu setzen',
  };

  let zustand = Speicher.lade();     // { version, einstellungen, partie }
  let P = null;                      // laufende Partie
  let spielerFarbe = 'w';
  let stufe = 'mittel';
  let phase = 'start';               // 'start' | 'spieler' | 'computer' | 'animation' | 'ende'
  let lauf = 0;                      // erhoeht sich bei Zurueck/Neu: veraltete Ablaeufe brechen ab
  let brett = null;
  let vorgebaut = false;             // Brett mit Startstellung schon im Leerlauf aufgebaut (nur Weiss-Sicht)
  let haengt = false;                // Computer hat nach allen Versuchen keinen Zug geliefert

  const amZug = () => (P.stellung.amZug ? 's' : 'w');
  const name = () => zustand.einstellungen.name;

  function sichere() {
    zustand.partie = P && phase !== 'start'
      ? Object.assign(Partie.serialisieren(P), { spielerFarbe, stufe, ende: phase === 'ende' })
      : null;
    Speicher.sichere(zustand);
  }

  // ---------- Anzeige ----------
  function zeichneBrett() {
    const schonDa = vorgebaut && spielerFarbe === 'w' && P.zuege.length === 0 && P.startFen === Regeln.START_FEN;
    vorgebaut = false;
    if (!schonDa) brett.zeige(Regeln.figurenListe(P.stellung), spielerFarbe);
    const letzte = P.infos[P.infos.length - 1];
    brett.markiereLetztenZug(letzte ? letzte.von : null, letzte ? letzte.nach : null);
    markiereSchach();
  }

  function markiereSchach() {
    const st = P.stellung;
    brett.markiereSchach(Regeln.imSchach(st, st.amZug) ? Regeln.feldName(st.koenig[st.amZug]) : null);
  }

  function kannZurueck() {
    return !!P && phase !== 'start' && phase !== 'animation' && P.infos.some(i => i.farbe === spielerFarbe);
  }

  function aktualisiereAnzeige() {
    zeigeHinweisbox(true);
    $('denkt').hidden = phase !== 'computer' || haengt;
    $('knopf-zurueck').disabled = !kannZurueck();
    $('zeile-spieler').classList.toggle('amzug', phase === 'spieler');
    $('zeile-computer').classList.toggle('amzug', phase === 'computer');
    if (phase === 'spieler') {
      const st = P.stellung;
      $('status-zeile').textContent = Regeln.imSchach(st, st.amZug)
        ? `Schach! Bring deinen König in Sicherheit, ${name()}.`
        : `Du bist am Zug, ${name()}.`;
    } else if (phase === 'computer' || (phase === 'animation' && amZug() !== spielerFarbe)) {
      $('status-zeile').textContent = 'Der Computer ist am Zug.';
    }
  }

  function setzeSchalter(id, an) { $(id).setAttribute('aria-pressed', String(!!an)); }

  // ---------- Hinweise, Zielfelder, geschlagene Figuren ----------
  let ausgewaehlt = null;            // vom Brett gemeldete Auswahl

  const hinweiseAn = () => !!zustand.einstellungen.hinweise;

  // Klammern im Namen wuerden sonst als Glossar-Markierung [[...]] gelesen.
  const sichererName = () => String(name()).replace(/\[/g, '(').replace(/\]/g, ')');

  function zeigeHinweisbox(sichtbar) {
    const box = $('hinweisbox');
    box.hidden = !(sichtbar && hinweiseAn() && P && phase === 'spieler');
  }

  function aktualisiereHinweise() {
    const box = $('hinweisbox');
    if (!hinweiseAn() || !P || phase !== 'spieler') { box.hidden = true; return; }
    const liste = Hinweise.erzeuge(P, spielerFarbe, sichererName());
    box.replaceChildren();
    if (!liste.length) { box.hidden = true; return; }
    const kopf = document.createElement('h3');
    kopf.textContent = `💡 Tipp für dich, ${name()}`;
    box.appendChild(kopf);
    for (const h of liste) {
      const p = document.createElement('p');
      p.innerHTML = Hinweise.alsHtml(h.text);
      box.appendChild(p);
    }
    box.hidden = false;
  }

  function aktualisiereZielfelder() {
    const ok = hinweiseAn() && ausgewaehlt && P && phase === 'spieler';
    brett.markiereZiele(ok ? Partie.zielfelder(P, ausgewaehlt) : []);
  }

  function beiAuswahl(feld) {
    ausgewaehlt = feld;
    aktualisiereZielfelder();
  }

  function aktualisiereGeschlagene() {
    const box = $('geschlagene');
    box.hidden = !zustand.einstellungen.geschlagene || !P;
    if (box.hidden) return;
    const g = Partie.geschlagene(P);
    const gegner = spielerFarbe === 'w' ? 's' : 'w';
    const reihe = (klasse, titel, typen, farbe) => {
      const div = document.createElement('div');
      div.className = 'reihe-titel';
      div.textContent = titel;
      const r = document.createElement('div');
      r.className = 'reihe ' + klasse;
      r.innerHTML = typen.map(t => Figuren.svg(t, farbe)).join('');
      return [div, r];
    };
    box.replaceChildren();
    const kopf = document.createElement('h3');
    kopf.textContent = 'Geschlagene Figuren';
    box.append(kopf,
      ...reihe('von-dir', 'Von dir geschlagen:', g[gegner], gegner),
      ...reihe('vom-computer', 'Vom Computer geschlagen:', g[spielerFarbe], spielerFarbe));
  }

  // Tooltip im Sichtbereich halten: nach unten klappen bzw. seitlich verschieben.
  function positioniereTooltip(begriff) {
    const tip = begriff.querySelector('.tooltip');
    if (!tip) return;
    begriff.classList.remove('unten');
    tip.style.setProperty('--versatz', '0px');
    const r = tip.getBoundingClientRect();
    if (r.top < 8) begriff.classList.add('unten');
    const breite = document.documentElement.clientWidth;
    let versatz = 0;
    if (r.left < 8) versatz = 8 - r.left;
    else if (r.right > breite - 8) versatz = breite - 8 - r.right;
    tip.style.setProperty('--versatz', versatz + 'px');
  }

  function verdrahteTooltips() {
    const boxen = [$('hinweisbox'), $('ende-text')];
    const begriffVon = ev => (ev.target.closest ? ev.target.closest('.begriff') : null);
    for (const box of boxen) {
      box.addEventListener('mouseover', ev => { const b = begriffVon(ev); if (b) positioniereTooltip(b); });
      box.addEventListener('focusin', ev => { const b = begriffVon(ev); if (b) positioniereTooltip(b); });
    }
    // Touch: Antippen oeffnet, Antippen ausserhalb schliesst.
    document.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse') return;
      const b = begriffVon(ev);
      for (const offen of document.querySelectorAll('.begriff.offen')) if (offen !== b) offen.classList.remove('offen');
      if (b && boxen.some(box => box.contains(b))) {
        if (ev.target.closest('.tooltip')) return; // Antippen im offenen Tooltip laesst ihn offen
        b.classList.toggle('offen');
        if (b.classList.contains('offen')) positioniereTooltip(b);
      }
    });
  }

  // Statuszeile und Ende-Overlay (der Ton wird nur hier gespielt, und nur bei frisch beendeter Partie).
  // Beim Wiederaufnehmen einer beendeten Partie erscheint das Overlay ohne Ton.
  function zeigeEndeFallsNoetig(status, frisch) {
    let text, ergebnis;
    if (status.ergebnis === 'remis') {
      text = `Unentschieden! ${GRUND_TEXT[status.grund] || ''}.`;
      ergebnis = 'remis';
    } else if (status.ergebnis === spielerFarbe) {
      text = `Glückwunsch, ${name()}! Du hast gewonnen: ${GRUND_TEXT[status.grund]}!`;
      ergebnis = 'sieg';
    } else {
      text = `Schade, ${name()}! Diesmal hat der Computer gewonnen. Beim nächsten Mal klappt es bestimmt!`;
      ergebnis = 'niederlage';
    }
    $('status-zeile').textContent = text;
    if (frisch) Toene.spiele(ergebnis);
    const meineStufe = stufe, meineFarbe = spielerFarbe;
    Bildschirme.zeigeEnde(
      { ergebnis, grund: status.grund, name: name(), stufe: STUFEN_TEXT[stufe] },
      {
        beiNochmal: () => starteAusEinstellungen(Object.assign({}, zustand.einstellungen, { farbe: meineFarbe, stufe: meineStufe })),
        beiStufe: neuePartie,
        beiSchliessen: () => {},
      });
  }

  // Schliesst Overlay und Umwandlungsdialog (offene Auswahl wird abgebrochen).
  function raeumeDialogeAuf() {
    Bildschirme.schliesseEnde();
    Bildschirme.brecheUmwandlungAb();
  }

  // ---------- Ablauf ----------
  // Prueft nach einem Zug (oder beim Start) das Spielende und gibt an Spieler oder Computer weiter.
  function weiter(frisch) {
    aktualisiereGeschlagene();
    const status = Partie.status(P);
    if (status.ende) {
      phase = 'ende';
      brett.setzeEingabe(false);
      sichere();
      aktualisiereAnzeige();
      aktualisiereGeschlagene();
      zeigeEndeFallsNoetig(status, frisch);
      return;
    }
    if (amZug() === spielerFarbe) {
      phase = 'spieler';
      brett.setzeEingabe(true);
      aktualisiereAnzeige();
      aktualisiereHinweise();
    } else {
      computerZug();
    }
  }

  function fuehreAus(info) {
    const meinLauf = lauf;
    phase = 'animation';
    brett.setzeEingabe(false);
    brett.markiereSchach(null);
    aktualisiereAnzeige();
    sichere();
    return brett.animiereZug(info).then(() => {
      if (meinLauf !== lauf) return;
      Toene.spiele(info.geschlagen ? 'schlagen' : 'zug');
      if (info.schach) Toene.spiele('schach');
      brett.markiereLetztenZug(info.von, info.nach);
      markiereSchach();
      weiter(true);
    });
  }

  async function beiZug(von, nach) {
    if (phase !== 'spieler') { zeichneBrett(); return; }
    const meinLauf = lauf;
    let umwandlung;
    if (Partie.brauchtUmwandlung(P, von, nach)) {
      brett.setzeEingabe(false);
      umwandlung = await Bildschirme.waehleUmwandlung(spielerFarbe);
      if (meinLauf !== lauf || phase !== 'spieler') return;
      if (!umwandlung) { // Escape: Zug abgebrochen, der Bauer bleibt stehen
        zeichneBrett();
        brett.setzeEingabe(true);
        return;
      }
    }
    const info = Partie.ziehe(P, von, nach, umwandlung);
    if (!info) {
      brett.schuettle(von);
      Toene.spiele('ungueltig');
      return;
    }
    await fuehreAus(info);
  }

  const MAX_WIEDERHOLUNGEN = 2; // nach einem Fehler hoechstens zwei neue Versuche

  // Der Computer kommt nicht weiter: freundlich melden, Zurueck/Neu bleiben bedienbar.
  function computerHaengt(meinLauf, versuch, grund) {
    if (versuch < MAX_WIEDERHOLUNGEN) {
      console.warn('Computerzug fehlgeschlagen, neuer Versuch', grund);
      setTimeout(() => { if (meinLauf === lauf && phase === 'computer') computerZug(versuch + 1); }, 500);
      return;
    }
    console.warn('Computerzug endgueltig fehlgeschlagen', grund);
    haengt = true;
    aktualisiereAnzeige();
    $('status-zeile').textContent = kannZurueck()
      ? 'Der Computer kommt gerade nicht weiter – tippe auf „Zug zurück“.'
      : 'Der Computer kommt gerade nicht weiter – starte mit „Neue Partie“ neu.';
  }

  async function computerZug(versuch = 0) {
    const meinLauf = lauf;
    phase = 'computer';
    haengt = false;
    brett.setzeEingabe(false);
    aktualisiereAnzeige();
    let erg = null;
    try {
      erg = await Ki.berechne(Regeln.zuFen(P.stellung), stufe, P.hashes.slice());
    } catch (e) {
      if (meinLauf === lauf) computerHaengt(meinLauf, versuch, e);
      return;
    }
    if (meinLauf !== lauf || !erg) return;
    const info = typeof erg.uci === 'string' ? Partie.zieheUci(P, erg.uci) : null;
    if (!info) { computerHaengt(meinLauf, versuch, 'ungueltiger Zug: ' + erg.uci); return; }
    await fuehreAus(info);
  }


  function zurueck() {
    if (!kannZurueck()) return;
    lauf++;
    raeumeDialogeAuf();
    Ki.abbrechen();
    // kannZurueck() schliesst die Phase 'animation' aus: Das Brett ist also in Ruhe.
    let spielerzugEntfernt = false;
    while (P.infos.length && (!spielerzugEntfernt || amZug() !== spielerFarbe)) {
      if (Partie.zurueck(P).farbe === spielerFarbe) spielerzugEntfernt = true;
    }
    phase = 'animation'; // Zwischenzustand, bis weiter() die Phase setzt
    zeichneBrett();
    weiter(false);
    sichere();
  }

  function neuePartie() {
    if (phase !== 'start' && phase !== 'ende' &&
        !confirm('Möchtest du die laufende Partie wirklich beenden?')) return;
    lauf++;
    raeumeDialogeAuf();
    Ki.abbrechen();
    phase = 'start';
    if (brett) brett.setzeEingabe(false);
    sichere();
    Bildschirme.zeigeStart(zustand.einstellungen, starteAusEinstellungen);
  }

  function schalte(schluessel, id) {
    const an = !zustand.einstellungen[schluessel];
    zustand.einstellungen[schluessel] = an;
    setzeSchalter(id, an);
    if (schluessel === 'toene') { Toene.setzeAn(an); if (an) Toene.vorbereiten(); }
    if (schluessel === 'hinweise') { aktualisiereHinweise(); aktualisiereZielfelder(); }
    if (schluessel === 'geschlagene') aktualisiereGeschlagene();
    if (schluessel === 'ruhig') Brett.setzeRuhig(an);
    Speicher.sichere(zustand);
  }

  function verdrahtePartie() {
    if (brett) return;
    brett = Brett.erstelle($('brett'), { beiZug, beiAuswahl });
    verdrahteTooltips();
    $('knopf-zurueck').addEventListener('click', zurueck);
    $('knopf-neu').addEventListener('click', neuePartie);
    $('schalter-hinweise').addEventListener('click', () => schalte('hinweise', 'schalter-hinweise'));
    $('schalter-geschlagene').addEventListener('click', () => schalte('geschlagene', 'schalter-geschlagene'));
    $('schalter-toene').addEventListener('click', () => schalte('toene', 'schalter-toene'));
    $('schalter-ruhig').addEventListener('click', () => schalte('ruhig', 'schalter-ruhig'));
  }

  // Zeigt eine Partie (neu, geladen oder Test) und laesst den Richtigen ziehen.
  function beginne(partie, farbe, neueStufe) {
    verdrahtePartie();
    lauf++;
    raeumeDialogeAuf();
    Ki.abbrechen();
    P = partie;
    spielerFarbe = farbe === 's' ? 's' : 'w';
    stufe = STUFEN_TEXT[neueStufe] ? neueStufe : 'mittel';
    const e = zustand.einstellungen;
    $('name-spieler').textContent = e.name;
    $('stufe-computer').textContent = STUFEN_TEXT[stufe];
    setzeSchalter('schalter-hinweise', e.hinweise);
    setzeSchalter('schalter-geschlagene', e.geschlagene);
    setzeSchalter('schalter-toene', e.toene);
    setzeSchalter('schalter-ruhig', e.ruhig);
    Brett.setzeRuhig(e.ruhig);
    $('status-zeile').textContent = '';
    $('start').hidden = true;
    $('partie').classList.remove('vorbau');
    $('partie').hidden = false;
    brett.setzeSpielerFarbe(spielerFarbe);
    phase = 'animation';
    zeichneBrett();
    Brett.pruefeLeistung().then(schwach => { if (schwach) Brett.setzeSparmodus(true); });
    sichere();
    weiter(false);
  }

  function starteAusEinstellungen(einst) {
    Toene.vorbereiten(); // spaetestens beim Absenden: AudioContext vor der ersten Animation
    zustand.einstellungen = Object.assign({}, zustand.einstellungen, einst);
    beginne(Partie.neu(), einst.farbe, einst.stufe);
  }

  // Brett im Leerlauf aufbauen, solange der Startbildschirm untaetig ist (vermeidet einen Long Task beim Start).
  function baueBrettVor() {
    if (brett || P || phase !== 'start') return;
    verdrahtePartie();
    brett.zeige(Regeln.figurenListe(Regeln.ausFen(Regeln.START_FEN)), 'w');
    vorgebaut = true;
    $('partie').classList.add('vorbau');
    $('partie').hidden = false;
    void $('partie').offsetHeight; // Layout jetzt im Leerlauf berechnen
  }

  function init() {
    Ki.vorwaermen();
    Toene.setzeAn(zustand.einstellungen.toene);
    // Erste Interaktion (Startbildschirm oder Brett einer fortgesetzten Partie): AudioContext vorab erzeugen.
    const ersteInteraktion = () => {
      document.removeEventListener('pointerdown', ersteInteraktion, true);
      document.removeEventListener('keydown', ersteInteraktion, true);
      Toene.vorbereiten();
    };
    document.addEventListener('pointerdown', ersteInteraktion, true);
    document.addEventListener('keydown', ersteInteraktion, true);
    const gespeichert = zustand.partie;
    const geladen = gespeichert ? Partie.laden(gespeichert) : null;
    if (geladen) {
      beginne(geladen, gespeichert.spielerFarbe, gespeichert.stufe);
    } else {
      zustand.partie = null;
      Bildschirme.zeigeStart(zustand.einstellungen, starteAusEinstellungen);
      if (globalThis.requestIdleCallback) requestIdleCallback(baueBrettVor, { timeout: 1500 });
      else setTimeout(baueBrettVor, 300);
    }
  }

  const schnittstelle = {
    zustand() {
      return {
        phase,
        amZug: P ? amZug() : null,
        fen: P ? Regeln.zuFen(P.stellung) : null,
        halbzuege: P ? P.zuege.length : 0,
        spielerFarbe,
        stufe,
      };
    },
    zurueck,
    neuePartie,
    testmodus({ mindestdenkzeit = 1 } = {}) { Ki.setzeMindestdenkzeit(mindestdenkzeit); },
    starteTestPartie({ fen, farbe = 'w', stufe: s = 'mittel', name: n = 'Test' } = {}) {
      const partie = Partie.neu(fen || Regeln.START_FEN);
      zustand.einstellungen = Object.assign({}, zustand.einstellungen,
        { name: String(n).trim().slice(0, 20), farbe: farbe === 's' ? 's' : 'w', stufe: s });
      beginne(partie, farbe, s);
    },
  };

  return { init, schnittstelle };
})();

window.SchachApp = App.schnittstelle;
App.init();
