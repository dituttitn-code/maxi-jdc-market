/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 * ✅ CORRECTIONS :
 * 1. Prix avec 3 décimales
 * 2. Adresse avec lien Google Maps cliquable
 *********************************/

// ✅ URL OK
export const API_URL =
  "https://script.google.com/macros/s/AKfycbyHbk0Z_1ZCKGv6RGA4_VJrRHCtE9iGR9uLly8Hc5mLwcPFHDeLl2MzS6Cy3E2bl9bn/exec";

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
    articlesFormat = dataCommande.articles.map((item) => ({
      produit: item.produit || item.nom || item.name || "",
      quantite: parseInt(item.quantite || item.qty || item.quantity || 1, 10),
      prix_unitaire: parseFloat(item.prix_unitaire || item.prix || item.price || 0),
      prix_total: parseFloat(
        (
          parseInt(item.quantite || item.qty || 1, 10) *
          parseFloat(item.prix_unitaire || item.prix || 0)
        ).toFixed(3) // ← 3 DÉCIMALES
      ),
    }));
  } else if (typeof dataCommande.articles === "string") {
    try {
      const parsed = JSON.parse(dataCommande.articles);
      if (Array.isArray(parsed)) articlesFormat = parsed;
    } catch (_) {}
  }

  // total avec 3 décimales
  let total = parseFloat(dataCommande.total || 0);
  if (!total && articlesFormat.length) {
    total = articlesFormat.reduce((sum, it) => sum + (Number(it.prix_total) || 0), 0);
  }

  const payload = {
    method: "saveOrder",
    nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || "",
    telephone: dataCommande.telephone || dataCommande.Telephone || "",
    adresse: dataCommande.adresse || dataCommande.Adresse || "",
    articles: articlesFormat.length ? JSON.stringify(articlesFormat) : (dataCommande.articles || ""),
    total: total ? total.toFixed(3) : "", // ← 3 DÉCIMALES
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });

  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();

  if (data && data.success && !data.commande_id) {
    data.commande_id = data.commandeId || data.orderId || data.id || "";
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
  const orders = (data.orders || []).map(order => ({
    ...order,
    maps_link: order.maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.adresse || '')}`,
    total: order.total ? parseFloat(order.total).toFixed(3) : "0.000"
  }));
  
  return orders;
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
    Nom: data.nom || data.nom_client || "",
    Téléphone: data.telephone || "",
    Adresse: data.adresse || "",
    AdresseComplete: data.adresse_complete || "",
    MapsLink: data.maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.adresse || '')}`,
    Commande: data.commande_id || commandeId || "",
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
    `${API_URL}?method=getOrderHistory&telephone=${encodeURIComponent(telephone)}&t=${Date.now()}`
  );
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur historique");
  
  // Ajouter liens Maps à l'historique
  const history = (data.history || []).map(item => ({
    ...item,
    maps_link: item.maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.adresse || '')}`,
    total: item.total ? parseFloat(item.total).toFixed(3) : "0.000"
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
  if (!response.ok) return { 
    connecte: false, 
    erreur: `Erreur HTTP: ${response.status}`, 
    url: API_URL 
  };
  const data = await response.json();
  return { 
    connecte: !!data.success, 
    message: data.message, 
    version: data.version || "5.0",
    url: API_URL 
  };
}
