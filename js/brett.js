// Animiertes Schachbrett: Raster, Figuren, Eingabe per Klick und Ziehen, Zug-Animationen.
// Animationen nur ueber transform und opacity (WAAPI), damit nichts ruckelt.
const Brett = (() => {
  const LINIEN = 'abcdefgh';
  const ZIEH_SCHWELLE = 6; // px
  const HUEPF_KEYFRAMES = [
    { transform: 'translateY(0)' },
    { transform: 'scale(1.08,.9)', offset: 0.2 },
    { transform: 'translateY(-22%) scale(.95,1.06)', offset: 0.5 },
    { transform: 'scale(1.06,.94)', offset: 0.8 },
    { transform: 'translateY(0)' },
  ];

  // Feldname aus Name ('e4') oder 0x88-Index (wie Regeln.figurenListe ihn liefert).
  function feldName(f) {
    if (typeof f === 'number') return LINIEN[f & 7] + ((f >> 4) + 1);
    return String(f);
  }

  function fertig(animation) {
    return animation.finished.then(() => {}, () => {});
  }

  function erstelle(container, { beiZug = () => {}, beiAuswahl = () => {} } = {}) {
    const wurzel = document.createElement('div');
    wurzel.className = 'brett';
    const felderEbene = document.createElement('div');
    felderEbene.className = 'felder';
    const figurenEbene = document.createElement('div');
    figurenEbene.className = 'figuren';
    wurzel.append(felderEbene, figurenEbene);
    container.appendChild(wurzel);

    let orientierung = null;
    let spielerFarbe = 'w';
    let eingabe = true;
    let auswahl = null;
    let ziele = [];
    let letzter = null;
    let schach = null;
    let zug = null; // laufende Zeiger-Interaktion

    // Spalte/Zeile (0..7, oben links = 0/0) eines Feldes in der aktuellen Orientierung.
    function koordinaten(feld) {
      const f = LINIEN.indexOf(feld[0]), r = +feld[1] - 1;
      return orientierung === 's' ? { x: 7 - f, y: r } : { x: f, y: 7 - r };
    }
    function feldAus(x, y) {
      if (x < 0 || x > 7 || y < 0 || y > 7) return null;
      return orientierung === 's' ? LINIEN[7 - x] + (y + 1) : LINIEN[x] + (8 - y);
    }

    function feldEl(feld) { return feld ? felderEbene.querySelector(`.feld[data-feld="${feld}"]`) : null; }
    function figurEl(feld) { return figurenEbene.querySelector(`.figur-el[data-feld="${feld}"]`); }

    // Position einer Figur in Feldeinheiten; translate in % bezieht sich auf die eigene Groesse (1 Feld).
    function transformFuer(x, y) { return `translate(${(x * 100).toFixed(3)}%, ${(y * 100).toFixed(3)}%)`; }
    function setzePos(el, x, y) {
      el._pos = { x, y };
      el.style.transform = transformFuer(x, y);
    }

    function baueFelder() {
      let html = '';
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const feld = feldAus(x, y);
          const f = LINIEN.indexOf(feld[0]), r = +feld[1] - 1;
          const farbe = (f + r) % 2 === 0 ? 'dunkel' : 'hell';
          let inhalt = '';
          if (x === 0) inhalt += `<span class="koord r">${feld[1]}</span>`;
          if (y === 7) inhalt += `<span class="koord f">${feld[0]}</span>`;
          html += `<div class="feld ${farbe}" data-feld="${feld}" aria-label="${feld}">${inhalt}</div>`;
        }
      }
      felderEbene.innerHTML = html;
      aktualisiereMarken();
    }

    function aktualisiereMarken() {
      for (const el of felderEbene.children) {
        const feld = el.dataset.feld;
        const istZiel = ziele.includes(feld);
        el.classList.toggle('ziel', istZiel);
        el.classList.toggle('schlag', istZiel && !!figurEl(feld));
        el.classList.toggle('auswahl', feld === auswahl);
        el.classList.toggle('letzter', !!letzter && (feld === letzter[0] || feld === letzter[1]));
        el.classList.toggle('schach', feld === schach);
      }
    }

    function neueFigur(feld, typ, farbe) {
      const el = document.createElement('div');
      el.className = 'figur-el';
      el.dataset.feld = feld;
      el.dataset.typ = typ;
      el.dataset.farbe = farbe;
      const bogen = document.createElement('div');
      bogen.className = 'bogen';
      bogen.innerHTML = Figuren.svg(typ, farbe);
      el.appendChild(bogen);
      const k = koordinaten(feld);
      setzePos(el, k.x, k.y);
      return el;
    }

    function zeige(figuren, neueOrientierung = 'w') {
      abbrechenZiehen();
      const hatteAuswahl = auswahl !== null;
      auswahl = null;
      if (neueOrientierung !== orientierung) {
        orientierung = neueOrientierung === 's' ? 's' : 'w';
        wurzel.dataset.orientierung = orientierung;
        baueFelder();
      }
      figurenEbene.replaceChildren(...figuren.map(f => neueFigur(feldName(f.feld), f.typ, f.farbe)));
      aktualisiereMarken();
      if (hatteAuswahl) beiAuswahl(null);
    }

    function huepfe(el) {
      const h = el && el.querySelector('.huepf');
      if (h) h.animate(HUEPF_KEYFRAMES, { duration: 550, easing: 'ease-out' });
    }

    // Bewegt eine Figur von ihrer aktuellen (sichtbaren) Position im Bogen auf ein Feld.
    function hopse(el, zielFeld) {
      const von = el._pos, nach = koordinaten(zielFeld);
      const dx = nach.x - von.x, dy = nach.y - von.y;
      const distanz = Math.hypot(dx, dy);
      setzePos(el, nach.x, nach.y);
      const bogen = el.querySelector('.bogen');
      if (distanz < 0.05) {
        // Schon da (z. B. nach dem Ablegen per Ziehen): nur kurz landen.
        return fertig(bogen.animate([
          { transform: 'scale(1,1)' }, { transform: 'scale(1.07,.93)' }, { transform: 'scale(1,1)' },
        ], { duration: 160, easing: 'ease-out' }));
      }
      const dauer = Math.min(520, 220 + 40 * distanz);
      const hoehe = Math.min(0.8, 0.2 * distanz) * 100;
      el.classList.add('zieht');
      const a1 = el.animate([
        { transform: transformFuer(von.x, von.y) }, { transform: transformFuer(nach.x, nach.y) },
      ], { duration: dauer, easing: 'cubic-bezier(.45,.05,.35,1)' });
      const a2 = bogen.animate([
        { transform: 'translateY(0) scale(1,1)', easing: 'cubic-bezier(.2,.6,.4,1)' },
        { transform: `translateY(-${hoehe.toFixed(1)}%) scale(.96,1.04)`, offset: 0.48, easing: 'cubic-bezier(.6,0,.8,.4)' },
        { transform: 'translateY(0) scale(1.07,.93)', offset: 0.86, easing: 'ease-out' },
        { transform: 'translateY(0) scale(1,1)' },
      ], { duration: dauer });
      return Promise.all([fertig(a1), fertig(a2)]).then(() => {
        if (!el.getAnimations().length) el.classList.remove('zieht');
      });
    }

    // Kurzes Gleiten (ohne Bogen) an eine Feld-Position, z. B. nach dem Loslassen.
    function gleite(el, x, y, dauer) {
      const von = el._pos;
      setzePos(el, x, y);
      return fertig(el.animate([{ transform: transformFuer(von.x, von.y) }, { transform: transformFuer(x, y) }],
        { duration: dauer, easing: 'ease-out' }));
    }

    // Bei ruhigen Figuren wippt und blinzelt nur die gerade gezogene Figur einmal.
    function einmalLebendig(el) {
      const b = document.body.classList;
      if (!el || !el.isConnected || !b.contains('ruhig') || b.contains('sparsam') ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const wippen = el.querySelector('.wippen');
      if (wippen) wippen.animate([
        { transform: 'scale(1, 1)' }, { transform: 'scale(1.03, .97)' }, { transform: 'scale(1, 1)' },
      ], { duration: 1100, easing: 'ease-in-out' });
      el.querySelectorAll('.augen').forEach(a => a.animate([
        { transform: 'scaleY(1)' }, { transform: 'scaleY(.1)' }, { transform: 'scaleY(1)' },
      ], { duration: 260, delay: 350, easing: 'ease-in-out' }));
    }

    function animiereZug(info) {
      if (!info) return Promise.resolve();
      abbrechenZiehen();
      const warte = [];
      const el = figurEl(info.von);
      // Geschlagene Figur zuerst merken, bevor eine andere Figur ihr Feld bekommt.
      const opfer = info.geschlagen ? figurEl(info.geschlagen.feld) : null;
      const turm = info.rochadeTurm ? figurEl(info.rochadeTurm.von) : null;
      if (opfer && opfer !== el) {
        opfer.removeAttribute('data-feld');
        opfer.classList.add('weg');
      }
      let dauer = 0;
      if (el) {
        dauer = Math.min(520, 220 + 40 * Math.hypot(koordinaten(info.nach).x - el._pos.x, koordinaten(info.nach).y - el._pos.y));
        el.dataset.feld = info.nach;
        const bewegung = hopse(el, info.nach);
        if (info.umwandlung) {
          warte.push(bewegung.then(() => {
            el.dataset.typ = info.umwandlung;
            const bogen = el.querySelector('.bogen');
            bogen.innerHTML = Figuren.svg(info.umwandlung, el.dataset.farbe);
            return fertig(bogen.animate([
              { transform: 'scale(.5)' }, { transform: 'scale(1.2)', offset: 0.6 }, { transform: 'scale(1)' },
            ], { duration: 260, easing: 'ease-out' }));
          }));
        } else {
          warte.push(bewegung);
        }
      }
      if (turm) {
        turm.dataset.feld = info.rochadeTurm.nach;
        warte.push(hopse(turm, info.rochadeTurm.nach));
      }
      if (opfer && opfer !== el) {
        const a = opfer.querySelector('.bogen').animate([
          { transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.3)', opacity: 0 },
        ], { duration: 200, delay: Math.max(0, dauer * 0.65), easing: 'ease-in', fill: 'forwards' });
        warte.push(fertig(a).then(() => opfer.remove()));
      }
      return Promise.all(warte).then(() => {
        if (letzter || ziele.length) aktualisiereMarken();
        einmalLebendig(el);
      });
    }

    function schuettle(feld) {
      const el = figurEl(feld);
      if (!el) return Promise.resolve();
      const bogen = el.querySelector('.bogen');
      const a = bogen.animate([
        { transform: 'rotate(0deg)' }, { transform: 'rotate(-10deg)', offset: 0.17 },
        { transform: 'rotate(10deg)', offset: 0.5 }, { transform: 'rotate(-10deg)', offset: 0.83 },
        { transform: 'rotate(0deg)' },
      ], { duration: 400, easing: 'ease-in-out' });
      return fertig(a).then(() => {
        const k = koordinaten(el.dataset.feld || feld);
        if (el.isConnected && (Math.abs(el._pos.x - k.x) > 0.01 || Math.abs(el._pos.y - k.y) > 0.01)) {
          return gleite(el, k.x, k.y, 160);
        }
      });
    }

    function markiereZiele(felder) { ziele = (felder || []).slice(); aktualisiereMarken(); }
    function markiereAuswahl(feld) {
      const neu = feld || null;
      const geaendert = neu !== auswahl;
      auswahl = neu;
      aktualisiereMarken();
      if (geaendert) beiAuswahl(auswahl);
    }
    function markiereLetztenZug(von, nach) { letzter = von && nach ? [von, nach] : null; aktualisiereMarken(); }
    function markiereSchach(feld) { schach = feld || null; aktualisiereMarken(); }
    function setzeSpielerFarbe(farbe) { spielerFarbe = farbe === 's' ? 's' : 'w'; }
    function setzeEingabe(aktiv) {
      eingabe = !!aktiv;
      wurzel.classList.toggle('gesperrt', !eingabe);
      if (!eingabe) {
        abbrechenZiehen();
        if (auswahl) markiereAuswahl(null);
      }
    }

    // ---- Eingabe ----
    function rasterPunkt(ev) {
      const r = wurzel.getBoundingClientRect();
      const g = r.width / 8;
      return { x: (ev.clientX - r.left) / g, y: (ev.clientY - r.top) / g };
    }
    function feldBei(ev) {
      const p = rasterPunkt(ev);
      return feldAus(Math.floor(p.x), Math.floor(p.y));
    }
    function istEigen(feld) {
      const el = feld && figurEl(feld);
      return !!el && el.dataset.farbe === spielerFarbe;
    }

    function waehleAus(feld) {
      markiereAuswahl(feld);
      huepfe(figurEl(feld));
    }

    function klick(feld) {
      if (!feld) return;
      if (auswahl) {
        if (feld === auswahl) { markiereAuswahl(null); return; }
        if (istEigen(feld)) { waehleAus(feld); return; }
        const von = auswahl;
        markiereAuswahl(null);
        beiZug(von, feld);
        return;
      }
      if (istEigen(feld)) waehleAus(feld);
    }

    function abbrechenZiehen() {
      if (!zug) return;
      const z = zug;
      zug = null;
      if (z.el && z.gezogen) {
        z.el.classList.remove('gezogen');
        const k = koordinaten(z.von);
        if (z.el.isConnected) gleite(z.el, k.x, k.y, 160);
      }
    }

    wurzel.addEventListener('pointerdown', ev => {
      if (!eingabe || zug || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      const feld = feldBei(ev);
      if (!feld) return;
      ev.preventDefault();
      zug = { id: ev.pointerId, von: feld, x0: ev.clientX, y0: ev.clientY, el: istEigen(feld) ? figurEl(feld) : null, gezogen: false };
      try { wurzel.setPointerCapture(ev.pointerId); } catch (e) { /* Zeiger schon weg */ }
    });

    wurzel.addEventListener('pointermove', ev => {
      if (!zug || ev.pointerId !== zug.id || !zug.el) return;
      if (!zug.gezogen) {
        if (Math.hypot(ev.clientX - zug.x0, ev.clientY - zug.y0) <= ZIEH_SCHWELLE) return;
        zug.gezogen = true;
        zug.el.getAnimations().forEach(a => a.cancel());
        zug.el.classList.add('gezogen');
        if (auswahl !== zug.von) markiereAuswahl(zug.von);
      }
      const p = rasterPunkt(ev);
      setzePos(zug.el, p.x - 0.5, p.y - 0.5);
    });

    wurzel.addEventListener('pointerup', ev => {
      if (!zug || ev.pointerId !== zug.id) return;
      const z = zug;
      zug = null;
      if (!z.gezogen) { klick(z.von); return; }
      z.el.classList.remove('gezogen');
      const ziel = feldBei(ev);
      markiereAuswahl(null);
      if (!ziel || ziel === z.von) {
        const k = koordinaten(z.von);
        gleite(z.el, k.x, k.y, 180);
        return;
      }
      const k = koordinaten(ziel);
      gleite(z.el, k.x, k.y, 90);
      beiZug(z.von, ziel);
    });

    wurzel.addEventListener('pointercancel', ev => {
      if (zug && ev.pointerId === zug.id) abbrechenZiehen();
    });
    wurzel.addEventListener('lostpointercapture', ev => {
      if (zug && ev.pointerId === zug.id) abbrechenZiehen();
    });

    return {
      element: wurzel,
      zeige, animiereZug, schuettle, markiereZiele, markiereAuswahl, markiereLetztenZug, markiereSchach,
      setzeEingabe, setzeSpielerFarbe,
    };
  }

  // Misst die ersten 60 Frame-Abstaende; true, wenn der Median ueber 24 ms liegt (schwaches Geraet).
  function pruefeLeistung() {
    return new Promise(resolve => {
      const abstaende = [];
      let letzte = null;
      function tick(t) {
        if (letzte !== null) abstaende.push(t - letzte);
        letzte = t;
        if (abstaende.length < 60) { requestAnimationFrame(tick); return; }
        abstaende.sort((a, b) => a - b);
        const median = (abstaende[29] + abstaende[30]) / 2;
        resolve(median > 24);
      }
      requestAnimationFrame(tick);
    });
  }

  function setzeSparmodus(an) {
    document.body.classList.toggle('sparsam', !!an);
  }

  function setzeRuhig(an) {
    document.body.classList.toggle('ruhig', !!an);
  }

  return { erstelle, pruefeLeistung, setzeSparmodus, setzeRuhig };
})();
