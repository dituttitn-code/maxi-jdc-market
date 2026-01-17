// tools/api-commandes.js (GitHub Pages friendly - JSONP)
// ======================================================

// ✅ TON URL WEB APP /exec (celle qui marche en ping)
const API_COMMANDES = "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

/**
 * JSONP helper (évite CORS sur GitHub Pages)
 */
function gsJsonp(params = {}, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ ok: false, error: "Timeout JSONP (Apps Script ne répond pas)" });
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch (_) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = (res) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(res || { ok: false, error: "Réponse vide" });
    };

    const url = new URL(API_COMMANDES);
    url.searchParams.set("callback", cbName);

    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null) return;
      url.searchParams.set(k, String(v));
    });

    const script = document.createElement("script");
    script.src = url.toString();
    script.onerror = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ ok: false, error: "Erreur réseau JSONP (URL, internet, bloqueur, etc.)" });
    };

    document.body.appendChild(script);
  });
}

// --------- API PUBLIC ---------
window.CommandesAPI = {
  // ✅ Test
  ping: () => gsJsonp({ action: "ping" }),

  // ✅ Create / appendRow
  create: ({ nom, telephone, adresse, livraison = 0, articles = [], statut = "Nouveau" } = {}) => {
    // validations simples côté client
    nom = String(nom || "").trim();
    telephone = String(telephone || "").trim();
    adresse = String(adresse || "").trim();

    if (!nom) return Promise.resolve({ ok: false, error: "Champ 'nom' obligatoire (client)." });
    if (!telephone) return Promise.resolve({ ok: false, error: "Champ 'telephone' obligatoire (client)." });
    if (!adresse) return Promise.resolve({ ok: false, error: "Champ 'adresse' obligatoire (client)." });

    if (!Array.isArray(articles)) {
      return Promise.resolve({ ok: false, error: "Champ 'articles' doit être un tableau." });
    }
    if (!articles.length) {
      return Promise.resolve({ ok: false, error: "Champ 'articles' obligatoire (au moins 1 article)." });
    }

    // IMPORTANT : envoyer qty/price (ton Code.gs calcule sousTotal)
    const payload = {
      action: "create",
      nom,
      telephone,
      adresse,
      livraison: Number(livraison) || 0,
      statut: String(statut || "Nouveau").trim() || "Nouveau",
      articles: JSON.stringify(articles),
    };

    return gsJsonp(payload);
  },

  // ✅ List (si tu veux page suivi / tableau)
  list: () => gsJsonp({ action: "list" }),

  // ✅ Update status (rowIndex >=2)
  setStatus: (rowIndex, statut) =>
    gsJsonp({ action: "set_status", rowIndex: Number(rowIndex), statut: String(statut || "").trim() }),

  // ✅ Delete (rowIndex >=2)
  delete: (rowIndex) =>
    gsJsonp({ action: "delete", rowIndex: Number(rowIndex) }),
};
