/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 * ✅ Objectif :
 * - Garder la même interface
 * - Normaliser la réponse pour que l'app utilise TOUJOURS le bon commande_id
 *********************************/

// ✅ URL OK (ta nouvelle URL)
export const API_URL =
  "https://script.google.com/macros/s/AKfycbyPlPa-gUorOjsB01nWDiAgti7BW70xtqLN49oTMeeq8nvErGAxfOeqkzDCsKRfSvbM/exec";

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // normaliser articles avec prix à 3 décimales
  let articlesFormat = [];
  if (Array.isArray(dataCommande.articles)) {
    articlesFormat = dataCommande.articles.map((item) => {
      const q = parseInt(item.quantite || item.qty || item.quantity || 1, 10);
      const pu = parseFloat(item.prix_unitaire || item.prix || item.price || 0);

      const quantite = isNaN(q) ? 1 : q;
      const prix_unitaire = isNaN(pu) ? 0 : pu;

      return {
        produit: item.produit || item.nom || item.name || "",
        quantite,
        prix_unitaire,
        prix_total: parseFloat((quantite * prix_unitaire).toFixed(3)),
      };
    });
  } else if (typeof dataCommande.articles === "string") {
    try {
      const parsed = JSON.parse(dataCommande.articles);
      if (Array.isArray(parsed)) articlesFormat = parsed;
    } catch (_) {}
  }

  // total avec 3 décimales
  let total = parseFloat(dataCommande.total || 0);
  if ((!total || isNaN(total)) && articlesFormat.length) {
    total = articlesFormat.reduce(
      (sum, it) => sum + (Number(it.prix_total) || 0),
      0
    );
  }

  const payload = {
    method: "saveOrder",
    nom_client:
      dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || "",
    telephone: dataCommande.telephone || dataCommande.Telephone || "",
    adresse: dataCommande.adresse || dataCommande.Adresse || "",
    articles: articlesFormat.length
      ? JSON.stringify(articlesFormat)
      : (dataCommande.articles || ""),
    total: total ? Number(total).toFixed(3) : "",
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });

  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();

  // ✅ NORMALISATION FORCÉE : on garantit que commande_id est rempli
  if (data && data.success) {
    const cid =
      data.commande_id ||
      data.commandeId ||
      data.orderId ||
      data.order_id ||
      data.id ||
      "";

    // champ standard + alias
    data.commande_id = cid;
    data.commandeId = cid;
    data.orderId = cid;
    data.id = cid;

    // ✅ IMPORTANT: certaines interfaces affichent "message"
    // On force le "message" à être celui du serveur (avec le bon numéro)
    if (data.client_message) {
      data.message = data.client_message;
    }
  }

  return data;
}

/*********************************
 * LIRE TOUTES LES COMMANDES (ADMIN)
 *********************************/
export async function getAllOrders() {
  const response = await fetch(`${API_URL}?method=getorders&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur getorders");

  // Ajouter lien Maps à chaque commande
  const orders = (data.orders || []).map((order) => ({
    ...order,
    maps_link:
      order.maps_link ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        order.adresse || ""
      )}`,
    total: order.total ? parseFloat(order.total).toFixed(3) : "0.000",
  }));

  return orders;
}

/*********************************
 * SUIVRE UNE COMMANDE (Client)
 *********************************/
export async function suivreCommande(commandeId) {
  const response = await fetch(
    `${API_URL}?method=getOrderStatus&commande_id=${encodeURIComponent(
      commandeId
    )}&t=${Date.now()}`
  );
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Commande non trouvée");

  const cid = data.commande_id || data.commandeId || data.orderId || commandeId || "";

  return {
    Date: data.date || "",
    Nom: data.nom || data.nom_client || "",
    Téléphone: data.telephone || "",
    Adresse: data.adresse || "",
    AdresseComplete: data.adresse_complete || "",
    MapsLink:
      data.maps_link ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        data.adresse || ""
      )}`,
    Commande: cid,
    Articles: data.articles || "",
    Total: data.total ? parseFloat(data.total).toFixed(3) : "0.000",
    Statut: data.statut || "⏳ EN ATTENTE",
    history: data.history || [],
  };
}

/*********************************
 * HISTORIQUE PAR TELEPHONE
 *********************************/
export async function recupererHistorique(telephone) {
  const response = await fetch(
    `${API_URL}?method=getOrderHistory&telephone=${encodeURIComponent(
      telephone
    )}&t=${Date.now()}`
  );
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur historique");

  // Ajouter liens Maps à l'historique
  const history = (data.history || []).map((item) => ({
    ...item,
    maps_link:
      item.maps_link ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        item.adresse || ""
      )}`,
    total: item.total ? parseFloat(item.total).toFixed(3) : "0.000",
  }));

  return history;
}

/*********************************
 * METTRE A JOUR LE STATUT
 *********************************/
export async function mettreAJourStatut(commandeId, nouveauStatut) {
  const response = await fetch(
    `${API_URL}?method=updateOrderStatus&commande_id=${encodeURIComponent(
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
 * GÉNÉRER LIEN GOOGLE MAPS
 *********************************/
export function genererLienMaps(adresse) {
  if (!adresse) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
}

/*********************************
 * FORMATER PRIX (3 DÉCIMALES)
 *********************************/
export function formaterPrix(prix) {
  const valeur = parseFloat(prix || 0);
  return valeur.toFixed(3);
}

/*********************************
 * TEST API
 *********************************/
export async function testerConnexionAPI() {
  const response = await fetch(`${API_URL}?method=test&t=${Date.now()}`);
  if (!response.ok)
    return {
      connecte: false,
      erreur: `Erreur HTTP: ${response.status}`,
      url: API_URL,
    };
  const data = await response.json();
  return {
    connecte: !!data.success,
    message: data.message,
    version: data.version || "5.1",
    url: API_URL,
  };
}
