// tools/api-commandes.js  (GitHub Pages friendly via JSONP)
// =======================================================

(() => {
  "use strict";

  // ✅ TON URL WebApp /exec (celle qui marche chez toi)
  const API_URL =
    "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

  // -----------------------------
  // JSONP helper (permet de lire la réponse)
  // -----------------------------
  function jsonp(params = {}, timeoutMs = 15000) {
    return new Promise((resolve) => {
      const cb = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
      const url = new URL(API_URL);
      url.searchParams.set("callback", cb);

      Object.keys(params).forEach((k) => {
        const v = params[k];
        if (v === undefined || v === null) return;
        url.searchParams.set(k, typeof v === "string" ? v : String(v));
      });

      let done = false;
      const script = document.createElement("script");

      const cleanup = () => {
        if (done) return;
        done = true;
        try {
          delete window[cb];
        } catch (_) {}
        if (script && script.parentNode) script.parentNode.removeChild(script);
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve({ ok: false, error: "Timeout API (JSONP)" });
      }, timeoutMs);

      window[cb] = (res) => {
        clearTimeout(timer);
        cleanup();
        resolve(res || { ok: false, error: "Réponse vide API" });
      };

      script.src = url.toString();
      script.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve({ ok: false, error: "Erreur réseau/JSONP (URL/AdBlock/offline)" });
      };

      document.body.appendChild(script);
    });
  }

  // -----------------------------
  // Normalisation articles (évite erreurs qty/price)
  // -----------------------------
  function normalizeArticles(articles) {
    const arr = Array.isArray(articles) ? articles : [];
    return arr
      .map((it) => {
        const name = String(it?.name ?? it?.nom ?? it?.libelle ?? "").trim();
        const qty = Number(it?.qty ?? it?.qte ?? it?.quantite ?? it?.quantity ?? 0) || 0;
        const price = Number(it?.price ?? it?.prix ?? it?.pu ?? it?.unitPrice ?? 0) || 0;
        const category = it?.category ?? it?.categorie ?? "";
        return { name, qty, price, category };
      })
      .filter((x) => x.name && x.qty > 0);
  }

  // -----------------------------
  // API publique
  // -----------------------------
  const CommandesAPI = {
    ping() {
      return jsonp({ action: "ping" });
    },

    create({ nom, telephone, adresse, livraison = 0, articles = [], statut = "Nouveau" }) {
      const cleanArticles = normalizeArticles(articles);

      return jsonp({
        action: "create",
        nom: String(nom || "").trim(),
        telephone: String(telephone || "").trim(),
        adresse: String(adresse || "").trim(),
        livraison: String(livraison || 0),
        statut: String(statut || "Nouveau").trim() || "Nouveau",
        articles: JSON.stringify(cleanArticles),
      });
    },

    list() {
      return jsonp({ action: "list" });
    },

    setStatus(rowIndex, statut) {
      return jsonp({
        action: "set_status",
        rowIndex: String(rowIndex),
        statut: String(statut || "").trim(),
      });
    },

    delete(rowIndex) {
      return jsonp({
        action: "delete",
        rowIndex: String(rowIndex),
      });
    },
  };

  // ✅ globals (pour que ton code actuel puisse l’utiliser)
  window.CommandesAPI = CommandesAPI;

  // Compat : si ton site appelle déjà envoyerCommande(...)
  window.envoyerCommande = (payload) => CommandesAPI.create(payload);

})();
