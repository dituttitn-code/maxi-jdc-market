/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 * ✅ CORRECTION FINALE: Envoi du message APRÈS confirmation Google Sheets
 * ✅ CORRECTION: Gestion correcte du total au format "1,500 dt"
 *********************************/

// ✅ URL OK
export const API_URL =
  "https://script.google.com/macros/s/AKfycbxwI535QU_-3XSxLZ5pqOuBPSnlmf_-7us3gemY3TpcPoZe6XMqEcSihtCsRSnl17sq/exec";

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  console.log("🚀 DÉBUT: Envoi de commande", dataCommande);
  
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // ✅ CORRECTION TÉLÉPHONE
  let telephone = "";
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

  for (const alias of telephoneAliases) {
    if (alias && typeof alias === "string" && alias.trim() !== "" && alias !== "#ERROR!") {
      telephone = alias.trim();
      break;
    }
  }

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

  if (!telephone || telephone === "" || telephone === "#ERROR!") {
    telephone = "Non fourni";
  }

  // ✅ Normaliser les articles
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

  // ✅ CORRECTION TOTAL - Gestion du format "1,500 dt"
  let total = 0;

  // Nettoyer et convertir le total s'il existe
  if (dataCommande.total) {
    if (typeof dataCommande.total === 'string') {
      // Nettoie la chaîne : "1,500 dt" → "1.5" → 1.5
      let totalPropre = dataCommande.total
        .replace(' dt', '')
        .replace('dt', '')
        .replace(',', '.')
        .replace(/\s+/g, '')
        .trim();
      
      total = parseFloat(totalPropre) || 0;
      console.log("💰 Total après nettoyage (string):", totalPropre, "→", total);
    } else {
      total = parseFloat(dataCommande.total) || 0;
      console.log("💰 Total après conversion (number):", total);
    }
  }

  // Si le total est toujours invalide ou nul, le recalculer depuis les articles
  if ((!total || isNaN(total) || total === 0) && articlesFormat.length) {
    total = articlesFormat.reduce((sum, it) => {
      const prixTotal = parseFloat(it.prix_total) || 
                       (parseFloat(it.quantite || 1) * parseFloat(it.prix_unitaire || 0));
      return sum + (isNaN(prixTotal) ? 0 : prixTotal);
    }, 0);
    console.log("💰 Total recalculé depuis articles:", total);
  }

  // Formater avec 3 décimales pour l'envoi (Google Sheets attend un nombre)
  const totalFormate = Number(total).toFixed(3);
  console.log("💰 Total final formaté (3 décimales):", totalFormate);

  // ✅ PAYLOAD - SANS numéro (Google Sheets le générera)
  const payload = {
    method: "saveOrder",
    nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || dataCommande.clientInfo?.nom || "Client",
    NOM_CLIENT: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || "Client",
    telephone: telephone,
    TÉLÉPHONE: telephone,
    TELEPHONE: telephone,
    tel: telephone,
    phone: telephone,
    adresse: dataCommande.adresse || dataCommande.Adresse || dataCommande.address || dataCommande.clientInfo?.adresse || "",
    ADRESSE: dataCommande.adresse || dataCommande.Adresse || "",
    articles: articlesText || "AUCUN ARTICLE",
    total: totalFormate, // Maintenant c'est "44.950" au lieu de "44,950 dt"
    _t: Date.now()
  };

  console.log("📤 ÉTAPE 1: Envoi à Google Sheets...", payload);

  try {
    // ✅ ÉTAPE 1: Envoyer à Google Sheets et ATTENDRE la réponse
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }
    
    // ✅ ÉTAPE 2: Récupérer la réponse (la commande est MAINTENANT dans Sheets)
    const data = await response.json();
    
    console.log("📦 ÉTAPE 2: Réponse reçue de Google Sheets:", data);

    // ✅ ÉTAPE 3: Extraire le numéro GÉNÉRÉ PAR GOOGLE SHEETS
    let numeroSheets = "";
    
    if (data && data.success) {
      numeroSheets = data.commande_id || data.numero_commande || data.orderId || data.id || data.numero || "";
      
      if (!numeroSheets || numeroSheets === "") {
        console.error("❌ ERREUR: Google Sheets n'a pas retourné de numéro!");
        throw new Error("Le numéro de commande n'a pas été généré par Google Sheets");
      }
      
      console.log("✅ ÉTAPE 3: Numéro GÉNÉRÉ PAR GOOGLE SHEETS:", numeroSheets);
      
      // ✅ ÉTAPE 4: Message client simplifié - supprimé "✅ Commande Enregistrée" en double
      data.client_message = `✅ Commande Enregistrée

Merci pour votre commande chez MAXI JDC MARKET.

📦 Votre commande, référencée sous le numéro ${numeroSheets}, a bien été enregistrée.

⏳ Elle est actuellement en cours de préparation.
📞 Nous vous contacterons prochainement pour la livraison.

Pour suivre votre commande, accédez à Panier > Espace Client > Suivi de commande, puis saisissez le numéro ${numeroSheets} et votre numéro de téléphone.

⚠️ CONSERVEZ CE NUMÉRO : ${numeroSheets}
📋 Copier
✅ OK`;
      
      data.message = data.client_message;
      data.commande_id = numeroSheets;
      data.numero_commande = numeroSheets;
      data.numero = numeroSheets;
      
      console.log("✅ ÉTAPE 4: Message client créé avec le numéro:", numeroSheets);
      
      return data;
    } else {
      console.error("❌ ÉCHEC: Google Sheets n'a pas confirmé l'enregistrement:", data);
      throw new Error(data.error || "Erreur lors de l'enregistrement dans Google Sheets");
    }
  } catch (error) {
    console.error("❌ ERREUR lors de l'envoi à Google Sheets:", error);
    throw error;
  }
}
