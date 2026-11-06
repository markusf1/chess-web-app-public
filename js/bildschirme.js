// Bildschirme: Startbildschirm, Umwandlungsdialog und Ende-Overlay mit Feier.
const Bildschirme = (() => {
  const $ = id => document.getElementById(id);
  let startVerdrahtet = false;
  let beiLosAktuell = null;
  let auswahl = { farbe: 'w', stufe: 'mittel' };
  let basis = null; // Einstellungen, die der Startbildschirm unveraendert weiterreicht

  function setzeGedrueckt(knoepfe, attr, wert) {
    for (const k of knoepfe) k.setAttribute('aria-pressed', String(k.dataset[attr] === wert));
  }

  function nameAusEingabe() { return $('name-eingabe').value.trim().slice(0, 20); }
  function pruefeLos() { $('los').disabled = nameAusEingabe() === ''; }

  function verdrahteStart() {
    if (startVerdrahtet) return;
    startVerdrahtet = true;
    const start = $('start');
    $('start-figuren').innerHTML = [['S', 'w'], ['K', 's'], ['B', 'w']]
      .map(([t, f], i) => `<span class="start-figur">${Figuren.svg(t, f)}</span>`).join('');
    for (const el of start.querySelectorAll('.wahl-figur[data-figur]')) {
      const [t, f] = el.dataset.figur.split('');
      el.innerHTML = Figuren.svg(t, f);
    }
    const farbKnoepfe = start.querySelectorAll('button[data-farbe]');
    const stufenKnoepfe = start.querySelectorAll('button[data-stufe]');
    farbKnoepfe.forEach(k => k.addEventListener('click', () => {
      auswahl.farbe = k.dataset.farbe;
      setzeGedrueckt(farbKnoepfe, 'farbe', auswahl.farbe);
    }));
    stufenKnoepfe.forEach(k => k.addEventListener('click', () => {
      auswahl.stufe = k.dataset.stufe;
      setzeGedrueckt(stufenKnoepfe, 'stufe', auswahl.stufe);
    }));
    $('name-eingabe').addEventListener('input', pruefeLos);
    $('start-formular').addEventListener('submit', ev => {
      ev.preventDefault();
      const name = nameAusEingabe();
      if (!name || !beiLosAktuell) return;
      const fertig = beiLosAktuell;
      beiLosAktuell = null; // Doppelklick startet nicht zwei Partien
      fertig(Object.assign({}, basis, { name, farbe: auswahl.farbe, stufe: auswahl.stufe }));
    });
  }

  function zeigeStart(einstellungen, beiLos) {
    verdrahteStart();
    basis = Object.assign({}, einstellungen);
    auswahl = { farbe: einstellungen.farbe === 's' ? 's' : 'w', stufe: einstellungen.stufe || 'mittel' };
    const start = $('start');
    setzeGedrueckt(start.querySelectorAll('button[data-farbe]'), 'farbe', auswahl.farbe);
    setzeGedrueckt(start.querySelectorAll('button[data-stufe]'), 'stufe', auswahl.stufe);
    $('name-eingabe').value = einstellungen.name || '';
    pruefeLos();
    beiLosAktuell = beiLos;
    $('partie').hidden = true;
    start.hidden = false;
    if (!$('name-eingabe').value) $('name-eingabe').focus({ preventScroll: true });
  }

  // ---------- Umwandlungsdialog ----------
  let umwandlungOffen = null; // { resolve, beiTaste }

  // Schliesst den Dialog; die offene Auswahl loest mit der Wahl bzw. null (abgebrochen) auf.
  function schliesseUmwandlung(wahl) {
    const offen = umwandlungOffen;
    if (!offen) return;
    umwandlungOffen = null;
    const dialog = $('umwandlung');
    dialog.removeEventListener('click', offen.beiKlick);
    document.removeEventListener('keydown', offen.beiTaste, true);
    dialog.hidden = true;
    $('partie').inert = false;
    offen.resolve(wahl);
  }

  // Zeigt den Auswahldialog; loest mit dem gewaehlten Figurenbuchstaben auf (null bei Abbruch).
  // Waehrend er offen ist, ist die Partie dahinter fuer die Tastatur gesperrt.
  function waehleUmwandlung(farbe) {
    schliesseUmwandlung(null);
    const dialog = $('umwandlung');
    const knoepfe = dialog.querySelectorAll('button[data-typ]');
    knoepfe.forEach((k, i) => {
      k.querySelector('.wahl-figur').innerHTML = Figuren.svg(k.dataset.typ, farbe);
    });
    $('partie').inert = true;
    dialog.hidden = false;
    knoepfe[0].focus({ preventScroll: true });
    return new Promise(resolve => {
      const beiKlick = ev => {
        const k = ev.target.closest('button[data-typ]');
        if (k) schliesseUmwandlung(k.dataset.typ);
      };
      const beiTaste = ev => {
        if (ev.key === 'Escape') { ev.stopPropagation(); schliesseUmwandlung(null); }
      };
      umwandlungOffen = { resolve, beiKlick, beiTaste };
      dialog.addEventListener('click', beiKlick);
      document.addEventListener('keydown', beiTaste, true);
    });
  }

  function brecheUmwandlungAb() { schliesseUmwandlung(null); }

  // ---------- Ende-Overlay ----------
  const BUNT = ['#FF8FA3', '#FFC857', '#9ED2B4', '#3F72B8', '#6EC6FF', '#FF9F43'];
  const KONFETTI_ANZAHL = 80;
  const KONFETTI_DAUER_MS = 6000;
  const REMIS_TEXT = {
    patt: '[[patt|Patt]]: Wer am Zug ist, kann nicht mehr ziehen, steht aber nicht im Schach.',
    wiederholung: 'Dieselbe Stellung ist dreimal vorgekommen ([[dreifache-wiederholung|dreifache Stellungswiederholung]]).',
    fuenfzig: '50 Züge lang wurde weder ein Bauer gezogen noch eine Figur geschlagen ([[fuenfzig-zuege-regel|50-Züge-Regel]]).',
    material: 'Keiner von euch hat genug Figuren übrig, um mattzusetzen ([[zu-wenig-material|zu wenig Material]]).',
  };
  let endeOffen = null; // { timer, beiTaste, vorher }
  // Schaltet der Sparmodus erst nach dem Zeigen ein (asynchrone Leistungspruefung), faellt das Konfetti weg.
  const sparmodusBeobachter = typeof MutationObserver === 'function'
    ? new MutationObserver(() => {
      if (document.body.classList.contains('sparsam')) $('ende-konfetti').replaceChildren();
    })
    : null;
  if (sparmodusBeobachter) sparmodusBeobachter.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function figurenHtml(liste, stimmung) {
    return liste.map(([t, f], i) =>
      `<div class="figur">${Figuren.svg(t, f, { stimmung })}</div>`).join('');
  }

  function erzeugeKonfetti(huelle) {
    const hoehe = Math.max(200, huelle.clientHeight || 400);
    huelle.style.setProperty('--fall', (hoehe + 40) + 'px');
    const teile = document.createDocumentFragment();
    for (let i = 0; i < KONFETTI_ANZAHL; i++) {
      const k = document.createElement('div');
      k.className = 'konfetti';
      k.style.left = Math.random() * 100 + '%';
      k.style.background = BUNT[i % BUNT.length];
      k.style.animationDuration = (2.5 + Math.random() * 3) + 's';
      k.style.animationDelay = (-Math.random() * 5) + 's';
      if (i % 3 === 0) k.style.borderRadius = '50%';
      teile.appendChild(k);
    }
    huelle.replaceChildren(teile);
  }

  function schliesseEnde() {
    const o = $('ende-overlay');
    if (endeOffen) {
      clearTimeout(endeOffen.timer);
      document.removeEventListener('keydown', endeOffen.beiTaste);
      const vorher = endeOffen.vorher;
      endeOffen = null;
      if (vorher && vorher.isConnected && !vorher.disabled && o.contains(document.activeElement)) {
        vorher.focus({ preventScroll: true });
      }
    }
    $('ende-konfetti').replaceChildren();
    o.hidden = true;
  }

  // info: { ergebnis: 'sieg'|'niederlage'|'remis', grund, name, stufe }
  function zeigeEnde(info, { beiNochmal, beiStufe, beiSchliessen } = {}) {
    schliesseEnde();
    const o = $('ende-overlay');
    const { ergebnis, grund, name, stufe } = info;
    const sparsam = document.body.classList.contains('sparsam') ||
      (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    o.dataset.ergebnis = ergebnis;
    const titel = $('ende-titel'), text = $('ende-text');
    if (ergebnis === 'sieg') {
      titel.textContent = `🎉 Glückwunsch, ${name}! 🎉`;
      text.textContent = `Du hast den Schachcomputer (${stufe}) schachmatt gesetzt!`;
      $('ende-figuren').innerHTML = figurenHtml([['B', 'w'], ['K', 'w'], ['S', 'w']], 'froh');
      $('ende-nochmal').textContent = 'Noch eine Partie';
    } else if (ergebnis === 'niederlage') {
      titel.textContent = `Schade, ${name}!`;
      text.textContent = 'Diesmal hat der Computer gewonnen. Aber jede Partie macht dich stärker. Beim nächsten Mal klappt es bestimmt!';
      $('ende-figuren').innerHTML = figurenHtml([['B', 'w'], ['K', 'w'], ['D', 's']], 'traurig');
      $('ende-nochmal').textContent = 'Revanche!';
    } else {
      titel.textContent = 'Remis!';
      text.innerHTML = Hinweise.alsHtml(REMIS_TEXT[grund] || REMIS_TEXT.material);
      $('ende-figuren').innerHTML = figurenHtml([['K', 'w'], ['K', 's']], 'froh');
      $('ende-nochmal').textContent = 'Noch eine Partie';
    }
    const wimpel = $('ende-wimpel');
    wimpel.innerHTML = ergebnis === 'sieg'
      ? Array.from({ length: 14 }, (_, i) =>
        `<span style="background:${BUNT[i % BUNT.length]};animation-delay:-${(i * 0.2).toFixed(1)}s"></span>`).join('')
      : '';
    const konfettiHuelle = $('ende-konfetti');
    konfettiHuelle.replaceChildren();
    const vorher = document.activeElement;
    o.hidden = false;
    if (ergebnis === 'sieg' && !sparsam) {
      erzeugeKonfetti(konfettiHuelle);
    }
    const schliessen = () => { schliesseEnde(); if (beiSchliessen) beiSchliessen(); };
    $('ende-nochmal').onclick = () => { schliesseEnde(); if (beiNochmal) beiNochmal(); };
    $('ende-stufe').onclick = () => { schliesseEnde(); if (beiStufe) beiStufe(); };
    $('ende-schliessen').onclick = schliessen;
    const beiTaste = ev => { if (ev.key === 'Escape' && !ev.defaultPrevented) schliessen(); };
    document.addEventListener('keydown', beiTaste);
    const timer = setTimeout(() => $('ende-konfetti').replaceChildren(), KONFETTI_DAUER_MS);
    endeOffen = { timer, beiTaste, vorher };
    $('ende-nochmal').focus({ preventScroll: true });
  }

  return { zeigeStart, waehleUmwandlung, brecheUmwandlungAb, zeigeEnde, schliesseEnde };
})();
