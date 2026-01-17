// tools/api-commandes.js (VERSION STABLE JSONP GET)
// -------------------------------------------------

const API_COMMANDES = "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

/**
 * Envoi de commande vers Google Sheet via JSONP (GET + callback)
 * => 100% compatible GitHub Pages (pas de CORS)
 * => tu reçois ok:true / ok:false
 *
 * @param {Object} data
 * @param {string} data.nom
 * @param {string} data.telephone
 * @param {string} data.adresse
 * @param {number} [data.livraison=0]
 * @param {Array}  [data.articles=[]]  // [{name, qty, price, category?}, ...]
 * @returns {Promise<Object>} réponse JSON {ok:true,...} ou {ok:false,error...}
 */
function envoyerCommande({ nom, telephone, adresse, livraison = 0, articles = [] }) {
  return new Promise((resolve) => {
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    // callback global
    window[cbName] = (res) => {
      try {
        delete window[cbName];
      } catch (_) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
      resolve(res || { ok: false, error: "Réponse vide" });
    };

    const url = new URL(API_COMMANDES);
    url.searchParams.set("callback", cbName);
    url.searchParams.set("action", "create");

    url.searchParams.set("nom", String(nom || "").trim());
    url.searchParams.set("telephone", String(telephone || "").trim());
    url.searchParams.set("adresse", String(adresse || "").trim());
    url.searchParams.set("livraison", String(livraison || 0));
    url.searchParams.set("articles", JSON.stringify(articles || []));

    const script = document.createElement("script");
    script.src = url.toString();

    // si erreur réseau / bloqueur
    script.onerror = () => {
      try {
        delete window[cbName];
      } catch (_) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
      resolve({ ok: false, error: "Erreur chargement JSONP (réseau / bloqueur)" });
    };

    document.body.appendChild(script);
  });
}

// (Optionnel) petit ping utile pour tester depuis le site
function pingCommandes() {
  return new Promise((resolve) => {
    const cbName = "cbping_" + Date.now();
    window[cbName] = (res) => {
      delete window[cbName];
      if (script && script.parentNode) script.parentNode.removeChild(script);
      resolve(res);
    };

    const url = new URL(API_COMMANDES);
    url.searchParams.set("callback", cbName);
    url.searchParams.set("action", "ping");

    const script = document.createElement("script");
    script.src = url.toString();
    script.onerror = () => resolve({ ok: false, error: "ping failed" });
    document.body.appendChild(script);
  });
}
