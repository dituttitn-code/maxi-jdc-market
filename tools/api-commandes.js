/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

// ✅ URL WebApp Apps Script (depuis config.js)
const API_URL = window.APP_CONFIG?.googleScriptUrl || "";

// ✅ Token (optionnel côté serveur si TOKEN_OPTIONNEL=true)
const API_TOKEN = "CHANGE-ME-SECRET-123456";

/*********************************
 * ANTI DOUBLE-CLICK (client)
 *********************************/
let sendingOrder = false;

/*********************************
 * UTIL: générer/charger une session_id
 *********************************/
async function ensureSessionId(telephone = "") {
  // 1) Session déjà existante ?
  let sid = localStorage.getItem("maxi_jdc_session");
  if (sid) return sid;

  // 2) Sinon créer via Apps Script (action=generatesession)
  try {
    const url = `${API_URL}?action=generatesession&telephone=${encodeURIComponent(telephone || "")}`;
    const res = await fetch(url, { method: "GET" });
    const json = await res.json();

    if (json?.success && json?.session_id) {
      sid = json.session_id;
      localStorage.setItem("maxi_jdc_session", sid);
      localStorage.setItem("maxi_jdc_validated", "false");
      return sid;
    }
  } catch (e) {
    // ignore
  }

  // 3) Fallback local (si réseau down)
  sid = "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem("maxi_jdc_session", sid);
  localStorage.setItem("maxi_jdc_validated", "false");
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
      return { success: false, message: "URL API manquante (config.js)." };
    }

    // normaliser articles en array d'objets
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
      // si JSON string
      try {
        const parsed = JSON.parse(dataCommande.articles);
        if (Array.isArray(parsed)) articlesFormat = parsed;
      } catch (_) {
        // sinon texte brut
      }
    }

    // total
    let total = parseFloat(dataCommande.total || 0);
    if ((!total || total === 0) && articlesFormat.length) {
      total = articlesFormat.reduce((sum, it) => sum + (Number(it.prix_total) || 0), 0);
    }

    // ✅ session_id obligatoire (Code.gs v4)
    const telephone = dataCommande.telephone || dataCommande.Telephone || "";
    const session_id =
      dataCommande.session_id ||
      localStorage.getItem("maxi_jdc_session") ||
      (await ensureSessionId(telephone));

    if (!session_id) {
      return { success: false, requires_session: true, message: "Session manquante. Rechargez la page." };
    }

    // IMPORTANT: method=saveOrder + session_id + token
    const payload = {
      method: "saveOrder",
      token: API_TOKEN,
      session_id: session_id,

      nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || "",
      telephone: telephone,
      adresse: dataCommande.adresse || dataCommande.Adresse || "",

      articles: articlesFormat.length
        ? JSON.stringify(articlesFormat)
        : (dataCommande.articles || ""),

      total: total ? total.toFixed(2) : ""
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString()
    });

    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);

    const result = await response.json();

    // ✅ si succès, marquer validated pour bloquer double clic (optionnel côté UI)
    if (result?.success) {
      localStorage.setItem("maxi_jdc_validated", "true");
    }

    // ✅ Si serveur détecte doublon
    if (result && (result.duplicate || result.duplicated || result.is_duplicate)) {
      if (!result.message) result.message = "⛔ Doublon détecté — commande ignorée.";
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
 * TOP PRODUITS
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

/*********************************
 * STOCK API (inchangé)
 *********************************/
export async function getStock() {
  const response = await fetch(`${API_URL}?method=getStock&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur getStock");
  return data.items || [];
}

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
  return data;
}

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

export async function getLowStock() {
  const response = await fetch(`${API_URL}?method=getLowStock&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur getLowStock");
  return data;
}

/*********************************
 * VÉRIFICATION CONFIG.JS
 *********************************/
if (!window.APP_CONFIG) {
  console.warn('⚠️ config.js non chargé. Assurez-vous que <script src="config.js"></script> est présent.');
} else {
  console.log('✅ config.js chargé:', window.APP_CONFIG.googleScriptUrl ? 'URL configurée' : 'URL manquante');
}
