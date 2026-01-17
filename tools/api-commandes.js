// tools/api-commandes.js
// ======================

const API_COMMANDES =
  "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

/**
 * JSONP helper (compatible GitHub Pages)
 */
function gsJsonp(params = {}) {
  return new Promise((resolve) => {
    const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    window[cb] = (res) => {
      delete window[cb];
      script.remove();
      resolve(res);
    };

    const url = new URL(API_COMMANDES);
    url.searchParams.set("callback", cb);

    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
      }
    });

    const script = document.createElement("script");
    script.src = url.toString();
    script.onerror = () => resolve({ ok: false, error: "Erreur réseau" });

    document.body.appendChild(script);
  });
}

/**
 * Ping
 */
function pingCommandes() {
  return gsJsonp({ action: "ping" });
}

/**
 * Création commande
 */
function envoyerCommande({ nom, telephone, adresse, livraison = 0, articles = [] }) {
  return gsJsonp({
    action: "create",
    nom,
    telephone,
    adresse,
    livraison,
    articles
  });
}
