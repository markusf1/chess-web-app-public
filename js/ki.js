// KI-Brücke: rechnet die Engine in einem Blob-Worker, damit Animationen flüssig bleiben.
const Ki = (function () {
  const MINDEST = { leicht: 700, mittel: 1000, schwer: 1000 };
  let faktor = 1;
  let worker = null;
  let naechsteId = 0;
  let offen = null; // { id, resolve, reject }

  const ki = {
    modus: 'worker',
    setzeMindestdenkzeit(f) { faktor = f; },
    berechne(fen, stufe, verlauf) {
      ki.abbrechen();
      const id = ++naechsteId;
      const start = performance.now();
      return new Promise((resolve, reject) => {
        const warte = (wert, istFehler) => {
          const rest = Math.max(0, (MINDEST[stufe] || 0) * faktor - (performance.now() - start));
          setTimeout(() => {
            if (!offen || offen.id !== id) return; // zwischenzeitlich abgebrochen
            offen = null;
            istFehler ? reject(wert) : resolve(wert);
          }, rest);
        };
        offen = { id, resolve, reject };
        if (ki.modus === 'hauptthread') {
          setTimeout(() => {
            if (!offen || offen.id !== id) return;
            try {
              // Notfall-Fallback (praktisch nicht erreichbar: der Blob-Worker laeuft in allen Zielbrowsern).
              // Die Suche darf den Hauptthread auf jeder Stufe hoechstens 1000 ms blockieren.
              const st = Regeln.ausFen(fen);
              const erg = Engine.sucheZug(st, { stufe, verlauf, zeitMs: 1000 });
              warte({ uci: Regeln.zugZuUci(erg.zug) }, false);
            } catch (e) { warte(e, true); }
          }, 0);
          return;
        }
        let w;
        try { w = erzeugeWorker(); } catch (e) {
          ki.modus = 'hauptthread';
          offen = null;
          resolve(ki.berechne(fen, stufe, verlauf));
          return;
        }
        w.onmessage = e => {
          if (e.data.id !== id) return; // veraltet
          warte({ uci: e.data.uci }, false);
        };
        w.postMessage({ id, fen, stufe, verlauf });
      });
    },
    // Erzeugt den Worker vorab (ohne Suche), damit der erste Zug nicht ruckelt.
    vorwaermen() {
      if (ki.modus !== 'worker' || worker) return;
      try { erzeugeWorker(); } catch (e) { ki.modus = 'hauptthread'; }
    },
    abbrechen() {
      // Nur eine laufende Anfrage erzwingt das Beenden; ein untaetiger Worker wird wiederverwendet.
      if (offen) {
        const o = offen; offen = null; o.resolve(null);
        if (worker) { worker.terminate(); worker = null; }
      }
    },
  };

  function erzeugeWorker() {
    if (worker) return worker;
    const quelle = `${RegelnModul}\nconst Regeln = RegelnModul();\n${EngineModul}\nconst Engine = EngineModul(Regeln);\n` +
      `onmessage = e => { const { id, fen, stufe, verlauf } = e.data;\n` +
      `  const erg = Engine.sucheZug(Regeln.ausFen(fen), { stufe, verlauf });\n` +
      `  postMessage({ id, uci: Regeln.zugZuUci(erg.zug) }); };`;
    const url = URL.createObjectURL(new Blob([quelle], { type: 'text/javascript' }));
    let w;
    try { w = new Worker(url); } finally { URL.revokeObjectURL(url); }
    // Dauerhafter Fehlerhandler: faengt auch Ladefehler im untaetigen (vorgewaermten) Worker ab.
    w.onerror = e => {
      if (worker === w) { w.terminate(); worker = null; }
      if (offen) { const o = offen; offen = null; o.reject(new Error('KI-Worker-Fehler: ' + ((e && e.message) || ''))); }
    };
    worker = w;
    return worker;
  }

  return ki;
})();
