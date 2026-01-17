// tools/api-commandes.js  (100% GitHub Pages friendly)
// =====================================================

// ✅ Mets ici TON URL /exec (la bonne)
const API_COMMANDES =
  "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

/**
 * Appel JSONP générique vers Apps Script
 * @param {Object} params - paires clé/valeur (action, nom, telephone, ...)
 * @returns {Promise<Object>} réponse JSON {ok:true,...} ou {ok:false,error...}
 */
function gsJsonp(params = {}) {
  return new Promise((resolve) => {
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    const cleanup = (script) => {
      try { delete window[cbName]; } catch (_) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };

    window[cbName] = (res) => {
      cleanup(script);
      resolve(res || { ok: false, error: "Réponse vide" });
    };

    const url = new URL(API_COMMANDES);
    url.searchParams.set("callback", cbName);

    // ajoute tous les params en querystring
    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null) return;
      url.searchParams.set(k, typeof v === "string" ? v : String(v));
    });

    const script = document.createElement("script");
    script.src = url.toString();
    script.onerror = () => {
      cleanup(script);
      resolve({ ok: false, error: "Erreur réseau/JSONP (bloqueur, offline, URL)" });
    };

    document.body.appendChild(script);
  });
}

/**
 * ✅ Test connexion
 */
function pingCommandes() {
  return gsJsonp({ action: "ping" });
}

/**
 * ✅ Créer une commande (écriture dans Google Sheet)
 * @param {Object} data
 * @param {string} data.nom
 * @param {string} data.telephone
 * @param {string} data.adresse
 * @param {number} [data.livraison=0]
 * @param {Array}  data.articles  // [{name, qty, price, category?}, ...]
 * @param {string} [data.statut="Nouveau"]
 * @returns {Promise<Object>}
 */
function envoyerCommande({ nom, telephone, adresse, livraison = 0, articles = [], statut = "Nouveau" }) {
  return gsJsonp({
    action: "create",
    nom: String(nom || "").trim(),
    telephone: String(telephone || "").trim(),
    adresse: String(adresse || "").trim(),
    livraison: String(livraison || 0),
    statut: String(statut || "Nouveau").trim() || "Nouveau",
    articles: JSON.stringify(articles || []),
  });
}

/**
 * ✅ Lister toutes les commandes
 * @returns {Promise<{ok:boolean, headers?:any[], rows?:any[]}>}
 */
function listerCommandes() {
  return gsJsonp({ action: "list" });
}

/**
 * ✅ Mettre à jour le statut (rowIndex >= 2)
 * @param {number} rowIndex
 * @param {string} statut
 */
function setStatut(rowIndex, statut) {
  return gsJsonp({
    action: "set_status",
    rowIndex: String(rowIndex),
    statut: String(statut || "").trim(),
  });
}

/**
 * ✅ Supprimer une commande (rowIndex >= 2)
 * @param {number} rowIndex
 */
function supprimerCommande(rowIndex) {
  return gsJsonp({
    action: "delete",
    rowIndex: String(rowIndex),
  });
}
