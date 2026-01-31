/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

// ✅ URL WebApp Apps Script (depuis config.js)
const API_URL = window.APP_CONFIG?.googleScriptUrl || window.APP_CONFIG?.getScriptUrl?.() || "";

// ✅ Token (doit être EXACTEMENT le même que dans Code.gs si tu l'utilises)
const API_TOKEN = "CHANGE-ME-SECRET-123456";

/*********************************
 * ANTI DOUBLE-CLICK (client)
 * - empêche 2 envois simultanés
 *********************************/
let sendingOrder = false;

/*********************************
 * SESSION ID (obligatoire pour Code.gs v4)
 *********************************/
const SESSION_KEY = "maxi_jdc_session";
const VALIDATED_KEY = "maxi_jdc_validated";

function getStoredSessionId() {
  return localStorage.getItem(SESSION_KEY) || "";
}

function storeSessionId(sessionId) {
  if (!sessionId) return;
  localStorage.setItem(SESSION_KEY, sessionId);
  localStorage.setItem(VALIDATED_KEY, "false");
}

/**
 * Crée une session côté serveur si possible, sinon fallback local.
 * Le serveur répond: {success:true, session_id:"..."}
 */
async function ensureSessionId(telephone = "") {
  let sid = getStoredSessionId();
  if (sid) return sid;

  // Essayer génération serveur
  try {
    if (API_URL) {
      const url = `${API_URL}?action=generatesession&telephone=${encodeURIComponent(String(telephone || "").trim())}`;
      const res = await fetch(url, { method: "GET" });
      const json = await res.json();
      if (json?.success && json?.session_id) {
        sid = String(json.session_id).trim();
        storeSessionId(sid);
        return sid;
      }
    }
  } catch (e) {
    // ignore et fallback
  }

  // Fallback local (si offline)
  sid = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  storeSessionId(sid);
  return sid;
}

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // ✅ anti double clic / double submit
  if (sendingOrder) {
    return {
      success: true,
      duplicated: true,
      message: "⏳ Envoi déjà en cours (double clic bloqué)."
    };
  }
  sendingOrder = true;

  try {
    if (!API_URL) {
      return { success: false, message: "❌ API_URL manquante. Vérifie config.js (googleScriptUrl)." };
    }

    // ---------------------------
    // 1) Normaliser les articles
    // ---------------------------
    let articlesFormat = [];

    if (Array.isArray(dataCommande.articles)) {
      articlesFormat = dataCommande.articles.map((item) => {
        const q = parseInt(item.quantite || item.qty || item.quantity || item.qte || 1, 10) || 1;
        const pu = parseFloat(item.prix_unitaire || item.prix || item.price || 0) || 0;

        return {
          produit: item.produit || item.nom || item.name || "",
          quantite: q,
          prix_unitaire: pu,
          prix_total: parseFloat((q * pu).toFixed(2))
        };
      });
    } else if (typeof dataCommande.articles === "string") {
      // si JSON string
      try {
        const parsed = JSON.parse(dataCommande.articles);
        if (Array.isArray(parsed)) articlesFormat = parsed;
      } catch (_) {
        // sinon texte brut
      }
    }

    // ---------------------------
    // 2) Calcul/normalisation total
    // ---------------------------
    let total = parseFloat(dataCommande.total || 0);
    if ((!total || total === 0) && articlesFormat.length) {
      total = articlesFormat.reduce((sum, it) => sum + (Number(it.prix_total) || 0), 0);
    }

    // Si total vide mais articles texte brut, on envoie quand même (ton serveur fera extractTotalFromText)
    const totalStr = total ? total.toFixed(2) : (String(dataCommande.total || "").trim() || "");

    // ---------------------------
    // 3) Session obligatoire (Code.gs v4)
    // ---------------------------
    const telephone = String(
      dataCommande.telephone || dataCommande.Telephone || dataCommande.tel || dataCommande.phone || ""
    ).trim();

    const session_id =
      String(dataCommande.session_id || "").trim() ||
      getStoredSessionId() ||
      (await ensureSessionId(telephone));

    if (!session_id) {
      return {
        success: false,
        requires_session: true,
        message: "❌ Session manquante. Rechargez la page."
      };
    }

    // ---------------------------
    // 4) Payload compatible Code.gs
    // ---------------------------
    const payload = {
      method: "saveOrder",
      token: API_TOKEN,

      // ✅ obligatoire
      session_id: session_id,

      nom_client: String(
        dataCommande.nom_client || dataCommande.nom || dataCommande.client || dataCommande.Nom_Client || "Client"
      ).trim(),

      telephone: telephone,
      adresse: String(dataCommande.adresse || dataCommande.Adresse || dataCommande.address || "").trim(),

      articles: articlesFormat.length
        ? JSON.stringify(articlesFormat)
        : (String(dataCommande.articles || "").trim()),

      total: totalStr
    };

    // ---------------------------
    // 5) POST form-urlencoded (comme ton code actuel)
    // ---------------------------
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString()
    });

    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);

    const result = await response.json();

    // ✅ Si serveur dit session validée, on mémorise
    if (result?.success) {
      localStorage.setItem(VALIDATED_KEY, "true");
    }

    // ✅ Compat : panier ignoré / total 0
    if (result && result.ignored) return result;

    // ✅ Compat : doublon détecté
    if (result && (result.duplicate || result.duplicated || result.is_duplicate)) {
      if (!result.message) {
        result.message = "⛔ Doublon détecté — commande ignorée.";
      }
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
  const response = await fetch(`${API_URL}?method=getorders&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur getorders");
  return data.orders || [];
}

/*********************************
 * SUIVRE UNE COMMANDE (Client)
 *********************************/
export async function suivreCommande(commandeId) {
  const response = await fetch(
    `${API_URL}?method=getOrderStatus&commande_id=${encodeURIComponent(commandeId)}&t=${Date.now()}`
  );
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
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
  const response = await fetch(
    `${API_URL}?method=getOrderHistory&telephone=${encodeURIComponent(telephone)}&t=${Date.now()}`
  );
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur historique");
  return data.history || [];
}

/*********************************
 * METTRE A JOUR LE STATUT (ADMIN)
 *********************************/
export async function mettreAJourStatut(commandeId, nouveauStatut) {
  const response = await fetch(
    `${API_URL}?method=updateOrderStatus&token=${encodeURIComponent(API_TOKEN)}&commande_id=${encodeURIComponent(
      commandeId
    )}&statut=${encodeURIComponent(nouveauStatut)}&t=${Date.now()}`
  );

  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur mise à jour statut");
  return data;
}

/*********************************
 * TOP PRODUITS (compat: topProducts OU top)
 *********************************/
export async function recupererTopProduits() {
  const response = await fetch(`${API_URL}?method=getTopProducts&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur top produits");
  return data.topProducts || data.top || [];
}

/*********************************
 * TEST API
 *********************************/
export async function testerConnexionAPI() {
  const response = await fetch(`${API_URL}?method=test&t=${Date.now()}`);
  if (!response.ok) return { connecte: false, erreur: `Erreur HTTP: ${response.status}`, url: API_URL };
  const data = await response.json();
  return { connecte: !!data.success, message: data.message, version: data.version, url: API_URL };
}

/* =========================================================
 * =====================  STOCK API  =======================
 * Ajouté sans toucher COMMANDES
 * ========================================================= */

/*********************************
 * LIRE STOCK (ADMIN)
 *********************************/
export async function getStock() {
  const response = await fetch(`${API_URL}?method=getStock&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur getStock");
  return data.items || [];
}

/*********************************
 * METTRE A JOUR UN STOCK
 *********************************/
export async function updateStock(code, stock) {
  const payload = {
    method: "updateStock",
    token: API_TOKEN,
    code: String(code || "").trim(),
    stock: String(stock ?? "").trim()
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString()
  });

  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || data.message || "Erreur updateStock");
  return data; // contient low_stock, threshold, message
}

/*********************************
 * BATCH UPDATE STOCK
 *********************************/
export async function batchUpdateStock(items = []) {
  const response = await fetch(`${API_URL}?method=batchUpdateStock&token=${encodeURIComponent(API_TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items)
  });

  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur batchUpdateStock");
  return data;
}

/*********************************
 * LISTER TOUS LES PRODUITS STOCK FAIBLE
 *********************************/
export async function getLowStock() {
  const response = await fetch(`${API_URL}?method=getLowStock&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur getLowStock");
  return data; // {threshold,count,items[]}
}

/*********************************
 * VÉRIFICATION CONFIG.JS
 *********************************/
if (!window.APP_CONFIG) {
  console.warn("⚠️ config.js non chargé. Assurez-vous que <script src='config.js'></script> est présent.");
} else {
  console.log("✅ config.js chargé:", window.APP_CONFIG.googleScriptUrl ? "URL configurée" : "URL manquante");
}
