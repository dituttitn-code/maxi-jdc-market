/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

// ⚠️ URL WebApp Apps Script (la même que chez toi)
const API_URL =
  " https://script.google.com/macros/s/AKfycbzORdOs8AD8-dNmGqfLe-pjjHgyReun2kT3eJOXOESoMUzr5gJPauxe5v9yDVPyG6Vs/exec";

// ✅ Token (doit être EXACTEMENT le même que dans Code.gs)
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
      token: API_TOKEN, // ✅ obligatoire (sinon "Accès refusé")
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

    // ✅ Si serveur bloque panier vide / total 0 -> on remonte message clair
    if (result && result.ignored) {
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
  // ✅ token obligatoire
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
  return data.topProducts || [];
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
