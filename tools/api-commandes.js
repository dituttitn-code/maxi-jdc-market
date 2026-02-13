/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 * ✅ CORRECTION : Génération du numéro au format CMD-MAXI-AAAAMMJJ-NNN
 * ✅ Version stable - Ne touche pas aux commandes fonctionnelles
 *********************************/

// ✅ URL OK
export const API_URL =
  "https://script.google.com/macros/s/AKfycbyuScJWHxNI3vDkYE4iFTiMLK5p4B7mkkQRZKZ81oUQkeLyvq3QnUrnImGtYwh7YPSW/exec";

/*********************************
 * FONCTION DE GÉNÉRATION DU NUMÉRO DE COMMANDE
 * Format: CMD-MAXI-AAAAMMJJ-NNN
 * Exemple: CMD-MAXI-20260213-011
 *********************************/
async function genererNumeroCommande() {
  // Récupérer la date actuelle
  const aujourdhui = new Date();
  const annee = aujourdhui.getFullYear();
  const mois = (aujourdhui.getMonth() + 1).toString().padStart(2, '0');
  const jour = aujourdhui.getDate().toString().padStart(2, '0');
  const dateStr = `${annee}${mois}${jour}`;
  
  // Clé pour localStorage (spécifique à la date pour éviter les conflits)
  const storageKey = `compteur_commande_${dateStr}`;
  
  // Récupérer le compteur actuel depuis le localStorage
  let compteur = localStorage.getItem(storageKey);
  
  if (!compteur) {
    // Si pas de compteur pour aujourd'hui, récupérer depuis le serveur
    try {
      // Appel à l'API pour obtenir le dernier numéro du jour
      const response = await fetch(`${API_URL}?method=getLastOrderNumber&date=${dateStr}&t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        compteur = data.lastNumber ? data.lastNumber + 1 : 1;
      } else {
        compteur = 1;
      }
    } catch (error) {
      console.warn("Impossible de récupérer le dernier numéro, départ à 1");
      compteur = 1;
    }
  } else {
    compteur = parseInt(compteur) + 1;
  }
  
  // Sauvegarder le nouveau compteur
  localStorage.setItem(storageKey, compteur.toString());
  
  // Formater le compteur sur 3 chiffres (001, 002, ...)
  const compteurFormatte = compteur.toString().padStart(3, '0');
  
  // Générer le numéro final
  const numeroCommande = `CMD-MAXI-${dateStr}-${compteurFormatte}`;
  
  console.log(`🔢 Numéro généré: ${numeroCommande} (compteur: ${compteur})`);
  
  return {
    numero: numeroCommande,
    date: dateStr,
    compteur: compteur
  };
}

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // ✅ ÉTAPE 1 : GÉNÉRER LE NUMÉRO DE COMMANDE
  const { numero: numeroCommande, date: dateStr, compteur } = await genererNumeroCommande();

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

  // ✅ PAYLOAD CORRIGÉ - Avec TOUS les champs nécessaires + NUMÉRO DE COMMANDE
  const payload = {
    method: "saveOrder",
    // ✅ AJOUT DU NUMÉRO DE COMMANDE GÉNÉRÉ
    commande_id: numeroCommande,
    numero_commande: numeroCommande,
    order_id: numeroCommande,
    
    // Nom
    nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || dataCommande.clientInfo?.nom || "Client",
    NOM_CLIENT: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || "Client",
    
    // Téléphone
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
    
    // Métadonnées pour le compteur
    date_commande: dateStr,
    compteur_journalier: compteur,
    
    // Timestamp pour éviter cache
    _t: Date.now()
  };

  console.log("📤 Envoi à Google Sheets avec numéro:", numeroCommande);

  // ✅ Envoi
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });

  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const data = await response.json();

  // ✅ TRAITEMENT DE LA RÉPONSE
  if (data && data.success) {
    // On utilise NOTRE numéro généré, pas celui du serveur
    const vraiNumeroCommande = numeroCommande;
    
    console.log("📦 Numéro de commande envoyé à Google Sheets:", vraiNumeroCommande);
    
    // Normalisation - garder le numéro EXACT sans modification
    data.commande_id = vraiNumeroCommande;
    data.commandeId = vraiNumeroCommande;
    data.orderId = vraiNumeroCommande;
    data.id = vraiNumeroCommande;
    
    // ✅ CRUCIAL: Ajouter le numéro à la racine de l'objet pour qu'il soit accessible
    data.numero_commande = vraiNumeroCommande;
    data.numero = vraiNumeroCommande;
    
    // Ajouter le message de confirmation
    if (!data.client_message) {
      data.client_message = `✅ Votre commande ${vraiNumeroCommande} a été enregistrée avec succès !`;
    }
    data.message = data.client_message;
    
    console.log("✅ Numéro transmis à la page:", vraiNumeroCommande);
  } else {
    console.error("❌ Réponse sans succès ou sans données:", data);
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
