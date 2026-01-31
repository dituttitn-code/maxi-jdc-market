/*********************************
 * API COMMANDES - MAXI JDC MARKET
 * Version "safe CORS" (GitHub Pages)
 *********************************/

// ✅ URL depuis config.js
const API_URL =
  (window.APP_CONFIG && typeof window.APP_CONFIG.getScriptUrl === "function")
    ? window.APP_CONFIG.getScriptUrl()
    : (window.APP_CONFIG?.googleScriptUrl || "");

// ✅ Token (si TOKEN_OPTIONNEL=true côté serveur, il n'est pas bloquant)
const API_TOKEN = "CHANGE-ME-SECRET-123456";

// Anti double-click client
let sendingOrder = false;

/**
 * Petit helper : POST "simple request" (pas de preflight CORS)
 * => Content-Type: application/x-www-form-urlencoded
 */
async function postFormUrlEncoded(payloadObj) {
  if (!API_URL) throw new Error("API_URL manquante (config.js).");

  const body = new URLSearchParams();
  Object.entries(payloadObj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    body.append(k, String(v));
  });

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: body.toString()
  });

  if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`);
  return await resp.json();
}

/**
 * GET helper
 */
async function getJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`);
  return await resp.json();
}

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // anti double submit
  if (sendingOrder) {
    return {
      success: true,
      duplicated: true,
      message: "⏳ Envoi déjà en cours (double clic bloqué)."
    };
  }
  sendingOrder = true;

  try {
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
    } else if (typeof dataCommande.articles === "string") {
      try {
        const parsed = JSON.parse(dataCommande.articles);
        if (Array.isArray(parsed)) articlesFormat = parsed;
      } catch (_) {}
    }

    // total
    let total = parseFloat(dataCommande.total || 0);
    if ((!total || total === 0) && articlesFormat.length) {
      total = articlesFormat.reduce((sum, it) => sum + (Number(it.prix_total) || 0), 0);
    }

    // IMPORTANT : ton Code.gs accepte action=saveOrder OU method=saveOrder
    // + session_id obligatoire (sinon rejected)
    const payload = {
      action: "saveOrder",            // ✅ important (ou method)
      token: API_TOKEN,               // ✅ optionnel si serveur TOKEN_OPTIONNEL=true
      session_id: dataCommande.session_id || "",

      nom_client: dataCommande.nom_client || dataCommande.nom || "",
      telephone: dataCommande.telephone || "",
      adresse: dataCommande.adresse || "",
      gps: dataCommande.gps || "",

      articles: articlesFormat.length
        ? JSON.stringify(articlesFormat)
        : (dataCommande.articles || ""),

      total: total ? total.toFixed(2) : ""
    };

    const result = await postFormUrlEncoded(payload);

    // serveurs: ignore / duplicate / already_validated
    if (result && (result.ignored || result.is_duplicate || result.already_validated)) {
      return result;
    }

    return result;

  } finally {
    sendingOrder = false;
  }
}

/*********************************
 * LIRE TOUTES LES COMMANDES (ADMIN)
 *********************************/
export async function getAllOrders() {
  const data = await getJson(`${API_URL}?method=getorders&t=${Date.now()}`);
  if (!data.success) throw new Error(data.error || "Erreur getorders");
  return data.orders || [];
}

/*********************************
 * SUIVRE UNE COMMANDE (Client)
 *********************************/
export async function suivreCommande(commandeId) {
  const data = await getJson(
    `${API_URL}?method=getOrderStatus&commande_id=${encodeURIComponent(commandeId)}&t=${Date.now()}`
  );

  if (!data.success) throw new Error(data.error || "Commande non trouvée");

  return {
    Date: data.date || "",
    Nom: data.nom || "",
    Téléphone: data.telephone || "",
    Adresse: data.adresse || "",
    Commande: data.commande_id || "",
    Articles: data.articles || "",
    Total: data.total || "0",
    Statut: data.statut || "⏳ EN ATTENTE",
    history: data.history || []
  };
}

/*********************************
 * HISTORIQUE PAR TELEPHONE
 *********************************/
export async function recupererHistorique(telephone) {
  const data = await getJson(
    `${API_URL}?method=getOrderHistory&telephone=${encodeURIComponent(telephone)}&t=${Date.now()}`
  );
  if (!data.success) throw new Error(data.error || "Erreur historique");
  return data.history || [];
}

/*********************************
 * METTRE A JOUR LE STATUT (ADMIN)
 *********************************/
export async function mettreAJourStatut(commandeId, nouveauStatut) {
  const data = await getJson(
    `${API_URL}?method=updateOrderStatus&token=${encodeURIComponent(API_TOKEN)}&commande_id=${encodeURIComponent(
      commandeId
    )}&statut=${encodeURIComponent(nouveauStatut)}&t=${Date.now()}`
  );
  if (!data.success) throw new Error(data.error || "Erreur mise à jour statut");
  return data;
}

/*********************************
 * TOP PRODUITS
 *********************************/
export async function recupererTopProduits() {
  const data = await getJson(`${API_URL}?method=getTopProducts&t=${Date.now()}`);
  if (!data.success) throw new Error(data.error || "Erreur top produits");
  return data.topProducts || data.top || [];
}

/*********************************
 * TEST API
 *********************************/
export async function testerConnexionAPI() {
  const data = await getJson(`${API_URL}?method=test&t=${Date.now()}`);
  return { connecte: !!data.success, message: data.message, details: data.details, url: API_URL };
}

/*********************************
 * STOCK API (inchangé)
 *********************************/
export async function getStock() {
  const data = await getJson(`${API_URL}?method=getStock&t=${Date.now()}`);
  if (!data.success) throw new Error(data.error || "Erreur getStock");
  return data.items || [];
}

export async function updateStock(code, stock) {
  const payload = {
    action: "updateStock",
    token: API_TOKEN,
    code: String(code || "").trim(),
    stock: String(stock ?? "").trim()
  };

  const data = await postFormUrlEncoded(payload);
  if (!data.success) throw new Error(data.error || data.message || "Erreur updateStock");
  return data;
}

export async function batchUpdateStock(items = []) {
  // ⚠️ JSON ici peut déclencher preflight — si ça bloque, on peut le convertir en urlencoded aussi.
  // Pour l'instant on le laisse, mais si tu veux 100% safe GitHub Pages, dis-moi et je te le convertis.
  const resp = await fetch(`${API_URL}?method=batchUpdateStock&token=${encodeURIComponent(API_TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items)
  });
  if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`);
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || "Erreur batchUpdateStock");
  return data;
}

export async function getLowStock() {
  const data = await getJson(`${API_URL}?method=getLowStock&t=${Date.now()}`);
  if (!data.success) throw new Error(data.error || "Erreur getLowStock");
  return data;
}

// Debug config
if (!window.APP_CONFIG) {
  console.warn("⚠️ config.js non chargé. Assurez-vous que <script src='tools/config.js'></script> est correct.");
} else {
  console.log("✅ config.js chargé, API_URL =", API_URL);
}
