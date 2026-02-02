/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

// ⚠️ Mets ICI la même URL que ta page suivi (celle qui marche chez toi)
const API_URL =
  "https://script.google.com/macros/s/AKfycbynsa5g1r3tmPohU61ArVm2kc4lg-IPMBhbnBPjwbSMTluTVleV1uucq5Ry3BDURV7V/exec";

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // normaliser articles en array d'objets
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
        ).toFixed(2)
      ),
    }));
  } else if (typeof dataCommande.articles === "string") {
    try {
      const parsed = JSON.parse(dataCommande.articles);
      if (Array.isArray(parsed)) articlesFormat = parsed;
    } catch (_) {
      // si c'est du texte, on le passera tel quel
    }
  }

  // total
  let total = parseFloat(dataCommande.total || 0);
  if (!total && articlesFormat.length) {
    total = articlesFormat.reduce((sum, it) => sum + (Number(it.prix_total) || 0), 0);
  }

  // IMPORTANT: method=saveOrder + champs simples
  const payload = {
    method: "saveOrder",
    nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || "",
    telephone: dataCommande.telephone || dataCommande.Telephone || "",
    adresse: dataCommande.adresse || dataCommande.Adresse || "",
    articles: articlesFormat.length ? JSON.stringify(articlesFormat) : (dataCommande.articles || ""),
    total: total ? total.toFixed(2) : "",
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });

  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  return await response.json();
}

/*********************************
 * LIRE TOUTES LES COMMANDES (ADMIN)
 *********************************/
export async function getAllOrders() {
  const response = await fetch(`${API_URL}?method=getorders&t=${Date.now()}`);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Erreur getorders");

  // retourne un tableau simple
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

  // format "8 colonnes"
  return {
    Date: data.date || "",
    Nom: data.nom || "",
    Téléphone: data.telephone || "",
    Adresse: data.adresse || "",
    Commande: data.commande_id || "",
    Articles: data.articles || "",
    Total: data.total || "0",
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

  return data.history || [];
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
 * TEST API
 *********************************/
export async function testerConnexionAPI() {
  const response = await fetch(`${API_URL}?method=test&t=${Date.now()}`);
  if (!response.ok) return { connecte: false, erreur: `Erreur HTTP: ${response.status}`, url: API_URL };
  const data = await response.json();
  return { connecte: !!data.success, message: data.message, version: data.version, url: API_URL };
}
