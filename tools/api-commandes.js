/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 * ✅ CORRECTION : Transmission du téléphone
 * ✅ Version stable - Ne touche pas aux commandes fonctionnelles
 *********************************/

// ✅ URL OK
export const API_URL =
  "https://script.google.com/macros/s/AKfycbzAaRtg24yHPqLQs5_q6XNdlKsgLWCe-lQPdHCalmUlrnrrVC9o1HDfnqdlQ_IpgzpV/exec";

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // ✅ CORRECTION TÉLÉPHONE : Extraction robuste
  let telephone = "";
  
  // Liste de tous les alias possibles
  const telephoneAliases = [
    dataCommande.telephone,
    dataCommande.Téléphone,
    dataCommande.Telephone,
    dataCommande.TELEPHONE,
    dataCommande.tel,
    dataCommande.Tel,
    dataCommande.TEL,
    dataCommande.phone,
    dataCommande.Phone,
    dataCommande.PHONE,
    dataCommande["📞 TÉLÉPHONE"],
    dataCommande.clientInfo?.telephone,
    dataCommande.clientInfo?.Téléphone,
    dataCommande.clientInfo?.phone,
    dataCommande.utilisateur?.telephone
  ];

  // Essayer chaque alias
  for (const alias of telephoneAliases) {
    if (alias && typeof alias === "string" && alias.trim() !== "" && alias !== "#ERROR!") {
      telephone = alias.trim();
      break;
    }
  }

  // Si toujours vide, chercher dans toutes les propriétés
  if (!telephone || telephone === "#ERROR!") {
    for (const key in dataCommande) {
      if (key.toLowerCase().includes("tel") || key.toLowerCase().includes("phone")) {
        const val = dataCommande[key];
        if (val && typeof val === "string" && val.trim() !== "" && val !== "#ERROR!") {
          telephone = val.trim();
          break;
        }
      }
    }
  }

  // ✅ Valeur par défaut si aucun téléphone trouvé
  if (!telephone || telephone === "" || telephone === "#ERROR!") {
    telephone = "Non fourni";
  }

  // ✅ Normaliser les articles (inchangé)
  let articlesFormat = [];
  let articlesText = dataCommande.articles || "";

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
    
    articlesText = articlesFormat.map(a => 
      `${a.quantite}x ${a.produit}`
    ).join("\n");
  } else if (typeof dataCommande.articles === "string") {
    try {
      const parsed = JSON.parse(dataCommande.articles);
      if (Array.isArray(parsed)) {
        articlesFormat = parsed;
        articlesText = parsed.map(a => 
          `${a.quantite || 1}x ${a.produit || a.nom || a.name || ""}`
        ).join("\n");
      }
    } catch (_) {}
  }

  // ✅ Total avec 3 décimales (inchangé)
  let total = parseFloat(dataCommande.total || 0);
  if ((!total || isNaN(total)) && articlesFormat.length) {
    total = articlesFormat.reduce(
      (sum, it) => sum + (Number(it.prix_total) || 0),
      0
    );
  }

  // ✅ PAYLOAD CORRIGÉ - Avec TOUS les champs nécessaires
  const payload = {
    method: "saveOrder",
    // Nom
    nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || dataCommande.clientInfo?.nom || "Client",
    NOM_CLIENT: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || "Client",
    
    // Téléphone - DOUBLÉ pour être sûr !
    telephone: telephone,
    TÉLÉPHONE: telephone,
    TELEPHONE: telephone,
    tel: telephone,
    phone: telephone,
    
    // Adresse
    adresse: dataCommande.adresse || dataCommande.Adresse || dataCommande.address || dataCommande.clientInfo?.adresse || "",
    ADRESSE: dataCommande.adresse || dataCommande.Adresse || "",
    
    // Articles et Total
    articles: articlesText || "AUCUN ARTICLE",
    total: total ? Number(total).toFixed(3) : "0.000",
    
    // Timestamp pour éviter cache
    _t: Date.now()
  };

  // ✅ Envoi
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });

  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();

  // ✅ NORMALISATION DU NUMÉRO DE COMMANDE (inchangé)
  if (data && data.success) {
    const cid = data.commande_id || data.commandeId || data.orderId || data.id || "";
    data.commande_id = cid;
    data.commandeId = cid;
    data.orderId = cid;
    data.id = cid;
    
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
