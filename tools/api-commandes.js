// tools/api-commandes.js (COMPLET + STABLE JSONP)
// ===============================================

// ✅ URL WEB APP (Deploy > Web App > /exec)
const API_COMMANDES =
  "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

/**
 * Appel JSONP générique (GET + callback)
 * @param {Object} params
 * @returns {Promise<Object>} {ok:true,...} ou {ok:false,error,...}
 */
function gsJsonp(params = {}) {
  return new Promise((resolve) => {
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const url = new URL(API_COMMANDES);

    let script = null;

    const cleanup = () => {
      try { delete window[cbName]; } catch (_) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
      script = null;
    };

    window[cbName] = (res) => {
      cleanup();
      resolve(res || { ok: false, error: "Réponse vide" });
    };

    url.searchParams.set("callback", cbName);

    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null) return;
      url.searchParams.set(k, typeof v === "string" ? v : String(v));
    });

    script = document.createElement("script");
    script.src = url.toString();
    script.async = true;

    script.onerror = () => {
      cleanup();
      resolve({ ok: false, error: "Erreur réseau/JSONP (bloqueur, offline, URL)" });
    };

    document.body.appendChild(script);
  });
}

/* =========================
   API: Ping
========================= */
function pingCommandes() {
  return gsJsonp({ action: "ping" });
}

/* =========================
   API: Create (enregistrer commande)
   articles = [{name, qty, price, category?}, ...]
========================= */
function envoyerCommande({ nom, telephone, adresse, livraison = 0, articles = [], statut = "Nouveau" }) {
  return gsJsonp({
    action: "create",
    nom: String(nom || "").trim(),
    telephone: String(telephone || "").trim(),
    adresse: String(adresse || "").trim(),
    livraison: String(livraison || 0),
    statut: String(statut || "Nouveau").trim() || "Nouveau",
    articles: JSON.stringify(Array.isArray(articles) ? articles : []),
  });
}

/* =========================
   API: List (lister commandes)
========================= */
function listerCommandes() {
  return gsJsonp({ action: "list" });
}

/* =========================
   API: Set Status (rowIndex >= 2)
========================= */
function setStatut(rowIndex, statut) {
  return gsJsonp({
    action: "set_status",
    rowIndex: String(rowIndex),
    statut: String(statut || "").trim(),
  });
}

/* =========================
   API: Delete (rowIndex >= 2)
========================= */
function supprimerCommande(rowIndex) {
  return gsJsonp({
    action: "delete",
    rowIndex: String(rowIndex),
  });
}

/* =========================
   Helpers (optionnel)
========================= */
function parseArticlesSafe(txt) {
  try {
    const v = JSON.parse(txt);
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}
