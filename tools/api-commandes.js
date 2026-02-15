/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 * ✅ CORRECTION FINALE: Envoi du message APRÈS confirmation Google Sheets
 *********************************/

// ✅ URL OK
export const API_URL =
  "https://script.google.com/macros/s/AKfycbzS84SbAg80R2GcYortCdl5dgvxbneAqnsrs6kMxp30whjAN6tadiIWF7x6MK3jmizf/exec";

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

  // ✅ Total
  let total = parseFloat(dataCommande.total || 0);
  if ((!total || isNaN(total)) && articlesFormat.length) {
    total = articlesFormat.reduce(
      (sum, it) => sum + (Number(it.prix_total) || 0),
      0
    );
  }

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
    total: total ? Number(total).toFixed(3) : "0.000",
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
      
      // ✅ ÉTAPE 4: Maintenant que la commande est dans Sheets, on peut créer le message
      data.client_message = `✅ Commande Enregistrée

Merci pour votre commande chez MAXI JDC MARKET.

📦 Votre commande, référence ${numeroSheets}, a bien été enregistrée.
⏳ Elle est actuellement en cours de préparation.
📞 Nous vous contacterons prochainement pour la livraison.

🔗 Pour suivre l'état de votre commande, utilisez le numéro ${numeroSheets} dans la section « Suivi commande » de votre espace client.

📋 Copier le numéro: ${numeroSheets}`;
      
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

// ... (le reste des fonctions getAllOrders, suivreCommande, etc. reste identique)
