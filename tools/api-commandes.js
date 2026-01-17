// tools/api-commandes.js (SANS CONFLIT)
// ====================================

const API_COMMANDES_URL =
  "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

function gsJsonp(params = {}) {
  return new Promise((resolve) => {
    const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const url = new URL(API_COMMANDES_URL);

    let script;

    const cleanup = () => {
      try { delete window[cb]; } catch (_) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };

    window[cb] = (res) => {
      cleanup();
      resolve(res || { ok:false, error:"Réponse vide" });
    };

    url.searchParams.set("callback", cb);

    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      url.searchParams.set(k, String(v));
    });

    script = document.createElement("script");
    script.src = url.toString();
    script.async = true;
    script.onerror = () => {
      cleanup();
      resolve({ ok:false, error:"Erreur réseau/JSONP" });
    };

    document.body.appendChild(script);
  });
}

// ✅ On expose un objet global unique (pas de conflit)
window.CommandesAPI = {
  ping() {
    return gsJsonp({ action: "ping" });
  },

  create({ nom, telephone, adresse, livraison = 0, articles = [], statut = "Nouveau" }) {
    return gsJsonp({
      action: "create",
      nom: String(nom || "").trim(),
      telephone: String(telephone || "").trim(),
      adresse: String(adresse || "").trim(),
      livraison: String(livraison || 0),
      statut: String(statut || "Nouveau").trim() || "Nouveau",
      articles: JSON.stringify(Array.isArray(articles) ? articles : []),
    });
  },

  list() {
    return gsJsonp({ action: "list" });
  },

  setStatus(rowIndex, statut) {
    return gsJsonp({
      action: "set_status",
      rowIndex: String(rowIndex),
      statut: String(statut || "").trim(),
    });
  },

  delete(rowIndex) {
    return gsJsonp({
      action: "delete",
      rowIndex: String(rowIndex),
    });
  }
};
