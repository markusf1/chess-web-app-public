// Speichern: Einstellungen und laufende Partie im localStorage. Wirft nie.
const Speicher = (() => {
  const SCHLUESSEL = 'schach-v1';
  const STUFEN = ['leicht', 'mittel', 'schwer'];
  const FARBEN = ['w', 's'];

  function standard() {
    return {
      version: 1,
      einstellungen: { name: '', farbe: 'w', stufe: 'mittel', hinweise: false, geschlagene: false, toene: true, ruhig: false },
      partie: null,
    };
  }

  function standardSpeicher() {
    try { return globalThis.localStorage; } catch (e) { return undefined; }
  }

  function einstellungen(roh) {
    const e = standard().einstellungen;
    if (!roh || typeof roh !== 'object') return e;
    if (typeof roh.name === 'string') e.name = roh.name.trim().slice(0, 20);
    if (FARBEN.includes(roh.farbe)) e.farbe = roh.farbe;
    if (STUFEN.includes(roh.stufe)) e.stufe = roh.stufe;
    for (const k of ['hinweise', 'geschlagene', 'toene', 'ruhig']) if (typeof roh[k] === 'boolean') e[k] = roh[k];
    return e;
  }

  function partie(p) {
    if (!p || typeof p !== 'object') return null;
    if (typeof p.startFen !== 'string') return null;
    if (!Array.isArray(p.zuege) || !p.zuege.every(z => typeof z === 'string')) return null;
    if (!FARBEN.includes(p.spielerFarbe) || !STUFEN.includes(p.stufe) || typeof p.ende !== 'boolean') return null;
    return { startFen: p.startFen, zuege: p.zuege.slice(), spielerFarbe: p.spielerFarbe, stufe: p.stufe, ende: p.ende };
  }

  function lade(speicher = standardSpeicher()) {
    try {
      const text = speicher.getItem(SCHLUESSEL);
      if (typeof text !== 'string') return standard();
      const roh = JSON.parse(text);
      if (!roh || typeof roh !== 'object' || roh.version !== 1) return standard();
      return { version: 1, einstellungen: einstellungen(roh.einstellungen), partie: partie(roh.partie) };
    } catch (e) {
      return standard();
    }
  }

  function sichere(zustand, speicher = standardSpeicher()) {
    try {
      speicher.setItem(SCHLUESSEL, JSON.stringify(zustand));
      return true;
    } catch (e) {
      return false;
    }
  }

  return { SCHLUESSEL, standard, lade, sichere };
})();
