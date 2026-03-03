/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 * ✅ CORRECTION FINALE: Envoi du message APRÈS confirmation Google Sheets
 * ✅ AJOUT: Envoi vers 3 comptes WhatsApp avec adresse cliquable
 *********************************/

// ✅ URL OK
export const API_URL =
  "https://script.google.com/macros/s/AKfycbwT2liu35iSJkwGsWMI9kogMRocSAsWv3BABjJzps3i4WG8pMN5sU8AFsyeqmPZhbCF/exec";

// ✅ Configuration des numéros WhatsApp
export const WHATSAPP_CONFIG = {
  admin: "5145860453",      // Administrateur (Canada)
  vendeur: "21655482062",   // Vendeur magasin (Tunisie)
  livreur: "21625600978",   // Livreur (Tunisie)
  defaultCountryCode: "216" // Code pays par défaut
};

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

  // ✅ Extraire les coordonnées GPS de l'adresse si présentes
  let adresseComplete = dataCommande.adresse || dataCommande.Adresse || dataCommande.address || dataCommande.clientInfo?.adresse || "";
  let gpsCoords = null;
  
  // Chercher des coordonnées GPS dans l'adresse (format: "GPS: 36.858546, 10.301467")
  const gpsMatch = adresseComplete.match(/GPS:\s*([-+]?\d*\.\d+),\s*([-+]?\d*\.\d+)/i);
  if (gpsMatch) {
    gpsCoords = {
      lat: gpsMatch[1],
      lng: gpsMatch[2]
    };
  }

  // ✅ Total avec 3 décimales
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
    adresse: adresseComplete,
    ADRESSE: adresseComplete,
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
      
      // ✅ ÉTAPE 5: Envoyer les détails aux 3 comptes WhatsApp
      try {
        // Construire le message détaillé pour les destinataires internes
        const whatsappMessage = construireMessageWhatsApp(
          numeroSheets,
          payload.nom_client,
          telephone,
          adresseComplete,
          articlesFormat,
          articlesText,
          total,
          gpsCoords
        );
        
        // Envoyer aux 3 numéros (en parallèle)
        await Promise.all([
          envoyerMessageWhatsApp(WHATSAPP_CONFIG.admin, whatsappMessage),
          envoyerMessageWhatsApp(WHATSAPP_CONFIG.vendeur, whatsappMessage),
          envoyerMessageWhatsApp(WHATSAPP_CONFIG.livreur, whatsappMessage)
        ]);
        
        console.log("✅ ÉTAPE 5: Messages WhatsApp envoyés aux 3 destinataires");
        data.whatsapp_sent = true;
        data.whatsapp_result = {
          admin: true,
          vendeur: true,
          livreur: true
        };
      } catch (whatsappError) {
        console.error("❌ Erreur envoi WhatsApp:", whatsappError);
        data.whatsapp_sent = false;
        data.whatsapp_error = whatsappError.message;
      }
      
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

/*********************************
 * CONSTRUIRE LE MESSAGE WHATSAPP AVEC ADRESSE CLIQUABLE
 *********************************/
function construireMessageWhatsApp(numeroCommande, clientNom, clientTel, adresse, articlesFormat, articlesText, total, gpsCoords) {
  // Créer le lien Google Maps
  let mapsLink = "";
  if (gpsCoords && gpsCoords.lat && gpsCoords.lng) {
    mapsLink = `https://www.google.com/maps/search/?api=1&query=${gpsCoords.lat},${gpsCoords.lng}`;
  } else {
    mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
  }
  
  // Formater les articles de façon détaillée
  let articlesDetail = "";
  if (articlesFormat && articlesFormat.length > 0) {
    articlesDetail = articlesFormat.map(item => 
      `${item.quantite}x ${item.produit}`
    ).join("\n");
  } else {
    articlesDetail = articlesText;
  }
  
  // Calculer le sous-total et les frais de livraison
  let sousTotal = 0;
  if (articlesFormat && articlesFormat.length > 0) {
    sousTotal = articlesFormat.reduce((sum, item) => sum + (Number(item.prix_total) || 0), 0);
  } else {
    // Essayer d'extraire le sous-total du texte
    const subTotalMatch = articlesText.match(/Sous-total:\s*(\d+[.,]\d+)/i);
    if (subTotalMatch) {
      sousTotal = parseFloat(subTotalMatch[1].replace(',', '.'));
    } else {
      sousTotal = total - 3; // Approximation si frais de livraison inclus
    }
  }
  
  const fraisLivraison = (sousTotal < 100) ? 3 : 0;
  const totalFinal = total; // Le total inclut déjà les frais si présents
  
  // Construire le message complet
  const message = `📦 *NOUVELLE COMMANDE* - MAXI JDC MARKET
─────────────────────
🆔 *N° Commande:* ${numeroCommande}
📅 *Date:* ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}

👤 *CLIENT*
Nom: ${clientNom}
📞 Téléphone: ${clientTel}
📍 *Adresse:* ${adresse}

🗺️ *Localisation (cliquable)*
${mapsLink}

🛒 *ARTICLES COMMANDÉS*
${articlesDetail}

💰 *RÉCAPITULATIF*
Sous-total: ${sousTotal.toFixed(3).replace('.', ',')} dt
🚚 Livraison: ${fraisLivraison.toFixed(3).replace('.', ',')} dt
──────────────
💳 *TOTAL: ${totalFinal.toFixed(3).replace('.', ',')} dt*

🕒 Heures de livraison: 7h - 1h
📱 Support: +216 25 600 978

⚠️ *Préparez cette commande pour livraison*`;

  return message;
}

/*********************************
 * ENVOYER UN MESSAGE WHATSAPP
 *********************************/
export async function envoyerMessageWhatsApp(numero, message) {
  try {
    // Nettoyer le numéro (enlever les espaces, tirets, etc.)
    let numeroPropre = numero.replace(/[\s\-\(\)\+]/g, '');
    
    // S'assurer que le numéro a l'indicatif international
    if (!numeroPropre.startsWith('216') && !numeroPropre.startsWith('514')) {
      if (numeroPropre.length === 8) {
        // Numéro tunisien sans indicatif
        numeroPropre = `216${numeroPropre}`;
      }
    }
    
    console.log(`📤 Envoi WhatsApp vers ${numeroPropre}...`);
    
    // Créer l'URL WhatsApp
    const whatsappUrl = `https://wa.me/${numeroPropre}?text=${encodeURIComponent(message)}`;
    
    // Ouvrir dans un nouvel onglet (version web)
    // Pour une utilisation en arrière-plan, on pourrait utiliser une API mais WhatsApp ne fournit pas d'API publique
    // Cette approche ouvre WhatsApp Web dans un nouvel onglet
    window.open(whatsappUrl, '_blank');
    
    // Note: Pour une intégration plus poussée, il faudrait utiliser WhatsApp Business API
    // Mais cela nécessite un compte approuvé par Meta
    
    return { success: true, numero: numeroPropre };
  } catch (error) {
    console.error("❌ Erreur envoi WhatsApp:", error);
    throw error;
  }
}

/*********************************
 * ENVOYER LE RÉCAPITULATIF À TOUS LES DESTINATAIRES
 *********************************/
export async function envoyerRecapitulatifWhatsApp(detailsCommande) {
  const {
    numeroCommande,
    clientNom,
    clientTel,
    adresse,
    articles,
    total,
    gpsCoords
  } = detailsCommande;
  
  const message = construireMessageWhatsApp(
    numeroCommande,
    clientNom,
    clientTel,
    adresse,
    articles,
    "",
    total,
    gpsCoords
  );
  
  const resultats = await Promise.allSettled([
    envoyerMessageWhatsApp(WHATSAPP_CONFIG.admin, message),
    envoyerMessageWhatsApp(WHATSAPP_CONFIG.vendeur, message),
    envoyerMessageWhatsApp(WHATSAPP_CONFIG.livreur, message)
  ]);
  
  return {
    admin: resultats[0].status === 'fulfilled',
    vendeur: resultats[1].status === 'fulfilled',
    livreur: resultats[2].status === 'fulfilled'
  };
}
