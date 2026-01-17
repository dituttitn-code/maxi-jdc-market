// tools/api-commandes.js
// =====================================================
// API Commandes - GitHub Pages friendly (JSONP)
// - Ajoute toujours sheet=COMMANDES
// - Retourne un vrai {ok:true} ou {ok:false,error:"..."}
// - Utilisation simple: await envoyerCommande({nom, telephone, adresse, livraison, articles})
// =====================================================

const API_COMMANDES =
  "https://script.google.com/macros/s/AKfycbyMa4TcmjykCb_O3VvjaakExOTfXk369B4FZ318WK4TC6jK50Qq9c7gaSuYUB-DS1yY/exec";

// ✅ Nom de l'onglet dans Google Sheet
const SHEET_COMMANDES = "COMMANDES";

// ---------------------------
// JSONP helper
// ---------------------------
function gsJsonp(params = {}) {
  return new Promise((resolve) => {
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    let script = null;

    const cleanup = () => {
      try {
        delete window[cbName];
      } catch (_) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
      script = null;
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ ok: false, error: "Timeout (Apps Script ne répond pas)" });
    }, 15000);

    window[cbName] = (res) => {
      clearTimeout(timeout);
      cleanup();
      if (!res) return resolve({ ok: false, error: "Réponse vide" });
      resolve(res);
    };

    const url = new URL(API_COMMANDES);
    url.searchParams.set("callback", cbName);

    // ✅ important : forcer le bon onglet côté Apps Script si ton Code.gs le supporte
    url.searchParams.set("sheet", SHEET_COMMANDES);

    // ajouter params
    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null) return;
      url.searchParams.set(k, typeof v === "string" ? v : String(v));
    });

    script = document.createElement("script");
    script.src = url.toString();
    script.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ ok: false, error: "Erreur réseau/JSONP (bloqueur, URL, offline)" });
    };

    document.body.appendChild(script);
  });
}

// ---------------------------
// API functions
// ---------------------------
async function pingCommandes() {
  const res = await gsJsonp({ action: "ping" });
  return normalizeRes(res);
}

async function envoyerCommande({ nom, telephone, adresse, livraison = 0, articles = [], statut = "Nouveau" }) {
  const payload = {
    action: "create",
    nom: String(nom || "").trim(),
    telephone: String(telephone || "").trim(),
    adresse: String(adresse || "").trim(),
    livraison: String(livraison || 0),
    statut: String(statut || "Nouveau").trim() || "Nouveau",
    articles: JSON.stringify(articles || []),
  };

  // validation minimale
  if (!payload.nom) return { ok: false, error: "Nom vide" };
  if (!payload.telephone) return { ok: false, error: "Téléphone vide" };
  if (!payload.adresse) return { ok: false, error: "Adresse vide" };

  const res = await gsJsonp(payload);
  return normalizeRes(res);
}

async function listerCommandes() {
  const res = await gsJsonp({ action: "list" });
  return normalizeRes(res);
}

async function setStatut(rowIndex, statut) {
  const res = await gsJsonp({
    action: "set_status",
    rowIndex: String(rowIndex),
    statut: String(statut || "").trim(),
  });
  return normalizeRes(res);
}

async function supprimerCommande(rowIndex) {
  const res = await gsJsonp({
    action: "delete",
    rowIndex: String(rowIndex),
  });
  return normalizeRes(res);
}

// ---------------------------
// normalize: force {ok:boolean, error?:string}
// ---------------------------
function normalizeRes(res) {
  // Certains scripts renvoient {status:"ok"} etc -> on standardise
  if (!res || typeof res !== "object") return { ok: false, error: "Réponse invalide" };

  // Si Apps Script renvoie ok:true -> parfait
  if (res.ok === true) return res;

  // Si ok absent mais action existe et pas d'erreur
  if (res.ok === undefined && res.error === undefined && res.action) {
    return { ok: true, ...res };
  }

  // Sinon erreur
  const err = res.error || res.message || "Erreur inconnue";
  return { ok: false, ...res, error: String(err) };
}

// ---------------------------
// Expose global API
// ---------------------------
window.CommandesAPI = {
  ping: pingCommandes,
  create: envoyerCommande,
  list: listerCommandes,
  setStatus: setStatut,
  delete: supprimerCommande,
};

// compat ancien nom (si ton code appelle encore envoyerCommande())
window.envoyerCommande = envoyerCommande;
