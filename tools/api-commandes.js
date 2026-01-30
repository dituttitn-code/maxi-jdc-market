/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

// ✅ URL WebApp Apps Script (⚠️ sans espace au début)
const API_URL =
  "https://script.google.com/macros/s/AKfycbzDmdNfwX4xlmM70vqm3qP41mIkJva_JZPlKP27JXewJ2gybikWlcvUH8J3B8ewqeUu/exec";

// ✅ Token (doit être EXACTEMENT le même que dans Code.gs)
// (Si côté serveur TOKEN_OPTIONNEL=true, il ne bloque pas même si token faux/vide)
const API_TOKEN = "CHANGE-ME-SECRET-123456";

/*********************************
 * ANTI DOUBLE-CLICK (client)
 * - empêche 2 envois simultanés
 *********************************/
let sendingOrder = false;

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

    // IMPORTANT: method=saveOrder + token
    const payload = {
      method: "saveOrder",
      token: API_TOKEN, // (optionnel si TOKEN_OPTIONNEL=true côté serveur)
      nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || "",
      telephone: dataCommande.telephone || dataCommande.Telephone || "",
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

    // ✅ Si serveur bloque panier vide / total 0 -> message clair
    if (result && result.ignored) return result;

    // ✅ Si serveur détecte doublon (commande_id / signature 90s)
    if (result && (result.duplicate || result.duplicated)) {
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
 * (inchangé : si ton code.gs supporte telephone)
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
 * - Alerte PRO via low_stock renvoyé par Code.gs
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
 * → renvoie low_stock=true si stock <= seuil (ex: 3)
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
 * items = [{code:"1017", stock:5}, ...]
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
  return data; // contient low_stock_count + low_stock_items
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
