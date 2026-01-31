/*********************************
 * API COMMANDES - MAXI JDC MARKET
 * Fix définitif session_id
 *********************************/

// ✅ URL depuis config.js
const API_URL =
  (window.APP_CONFIG && typeof window.APP_CONFIG.getScriptUrl === "function")
    ? window.APP_CONFIG.getScriptUrl()
    : (window.APP_CONFIG?.googleScriptUrl || "");

// ✅ Token (optionnel selon serveur)
const API_TOKEN = "CHANGE-ME-SECRET-123456";

// Anti double-click client
let sendingOrder = false;

// session storage
const SESSION_KEY = "maxi_jdc_session_id";

/**
 * GET helper
 */
async function getJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`);
  return await resp.json();
}

/**
 * POST helper sans preflight CORS (urlencoded)
 */
async function postFormUrlEncoded(payloadObj) {
  if (!API_URL) throw new Error("API_URL manquante (config.js).");

  const body = new URLSearchParams();
  Object.entries(payloadObj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    body.append(k, String(v));
  });

  console.log("🚀 POST vers API_URL =", API_URL);
  console.log("📦 payload =", payloadObj);

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: body.toString()
  });

  if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`);
  const json = await resp.json();

  console.log("✅ réponse API =", json);
  return json;
}

/**
 * ✅ récupère/assure une session valide
 */
async function ensureSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing && existing.trim()) return existing.trim();

  // demander au serveur
  const j = await getJson(`${API_URL}?method=startSession&t=${Date.now()}`);
  const sid = String(j?.session_id || "").trim();

  if (j?.success && sid) {
    localStorage.setItem(SESSION_KEY, sid);
    return sid;
  }

  throw new Error("Impossible de créer une session (startSession).");
}

/*********************************
 * ENVOYER UNE COMMANDE
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  if (sendingOrder) {
    return { success: true, duplicated: true, message: "⏳ Envoi déjà en cours (double clic bloqué)." };
  }
  sendingOrder = true;

  try {
    // ✅ session obligatoire
    const sid = await ensureSessionId();

    // normaliser articles
    let articlesFormat = [];
    if (Array.isArray(dataCommande.articles)) {
      articlesFormat = dataCommande.articles.map((item) => {
        const q = parseInt(item.quantite || item.qty || item.quantity || 1, 10) || 1;
        const pu = parseFloat(item.prix_unitaire || item.prix || item.price || 0) || 0;
        return {
          produit: item.produit || item.nom || item.name || "",
          quantite: q,
          prix_unitaire: pu,
          prix_total: parseFloat((q * pu).toFixed(2))
        };
      });
    }

    // total
    let total = parseFloat(dataCommande.total || 0);
    if ((!total || total === 0) && articlesFormat.length) {
      total = articlesFormat.reduce((sum, it) => sum + (Number(it.prix_total) || 0), 0);
    }

    const payload = {
      action: "saveOrder",
      token: API_TOKEN,
      session_id: sid,

      nom_client: dataCommande.nom_client || dataCommande.nom || "",
      telephone: dataCommande.telephone || "",
      adresse: dataCommande.adresse || "",
      gps: dataCommande.gps || "",

      articles: articlesFormat.length ? JSON.stringify(articlesFormat) : "",
      total: total ? total.toFixed(2) : ""
    };

    const res = await postFormUrlEncoded(payload);

    // Si serveur dit session invalide => on purge et on retente 1 fois
    if (res?.requires_session) {
      localStorage.removeItem(SESSION_KEY);
      const sid2 = await ensureSessionId();
      payload.session_id = sid2;
      return await postFormUrlEncoded(payload);
    }

    return res;
  } finally {
    sendingOrder = false;
  }
}

/*********************************
 * TEST API
 *********************************/
export async function testerConnexionAPI() {
  const data = await getJson(`${API_URL}?method=test&t=${Date.now()}`);
  return { connecte: !!data.success, message: data.message, details: data.details, url: API_URL };
}

// Debug config
if (!window.APP_CONFIG) {
  console.warn("⚠️ config.js non chargé. Vérifie le chemin vers tools/config.js");
} else {
  console.log("✅ config.js chargé, API_URL =", API_URL);
  // init session au chargement
  ensureSessionId()
    .then((sid) => console.log("✅ session_id prêt =", sid))
    .catch((e) => console.warn("⚠️ session init échouée:", e));
}
