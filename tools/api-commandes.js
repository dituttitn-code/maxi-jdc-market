/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

// URL de l'API Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbxx_3bZ50K7fr2mU2qCxzUnEU_L7cIKaUwBBr2_SiCnSXvFJsPoSdzwHJYXEcOaidHa/exec";

/*********************************
 * ANALYSER ET STRUCTURER LES DONNÉES COMMANDE
 *********************************/
function analyserDonneesCommande(dataRaw) {
  const result = {
    nom: "",
    telephone: "",
    adresse: "",
    articles: [],
    total: 0,
    numero_commande: "",
    date: new Date().toISOString(),
    statut: "En attente"
  };

  // Si dataRaw est une chaîne (message WhatsApp/textuel)
  if (typeof dataRaw === "string") {
    const lignes = dataRaw.split('\n').map(l => l.trim()).filter(l => l);
    
    let section = "header";
    let articlesText = "";
    let footerText = "";
    
    // Analyser chaque ligne
    lignes.forEach((ligne, index) => {
      // Identifier les sections
      if (ligne.includes("Détails de votre commande")) {
        section = "details";
        return;
      }
      if (ligne.includes("Articles commandés") || ligne.includes("ARTICLES")) {
        section = "articles";
        return;
      }
      if (ligne.includes("TOTAL") || ligne.includes("Total")) {
        section = "footer";
        return;
      }
      if (ligne.includes("MAXI-") || ligne.includes("Commande #")) {
        result.numero_commande = ligne.replace("Commande #", "").trim();
        return;
      }

      // Extraire selon la section
      switch(section) {
        case "details":
          // NOM
          if (ligne.startsWith("Nom:")) {
            result.nom = ligne.replace("Nom:", "").trim();
          }
          // TÉLÉPHONE
          else if (ligne.startsWith("Téléphone:") || ligne.includes("+216")) {
            result.telephone = ligne.replace("Téléphone:", "").trim();
          }
          // ADRESSE
          else if (ligne.startsWith("Adresse:") || ligne.startsWith("📍")) {
            result.adresse = ligne.replace("Adresse:", "").replace("📍", "").trim();
          }
          break;
          
        case "articles":
          articlesText += ligne + "\n";
          break;
          
        case "footer":
          footerText += ligne + "\n";
          
          // TOTAL
          if (ligne.includes("TOTAL") || ligne.includes("Total")) {
            const totalMatch = ligne.match(/(\d+\.?\d*)\s*(DT|dt|TND|tnd)/);
            if (totalMatch) {
              result.total = parseFloat(totalMatch[1]);
            }
          }
          break;
      }
    });

    // Parser les articles
    if (articlesText) {
      result.articles = parserArticlesDepuisTexte(articlesText);
      
      // Recalculer total si non trouvé
      if (result.total === 0 && result.articles.length > 0) {
        result.total = result.articles.reduce((sum, item) => sum + (item.prix_total || 0), 0);
      }
    }
  }
  // Si dataRaw est un objet
  else if (typeof dataRaw === "object") {
    Object.assign(result, dataRaw);
  }

  // Générer numéro commande si vide
  if (!result.numero_commande) {
    result.numero_commande = genererNumeroCommandeLocal();
  }

  return result;
}

/*********************************
 * PARSER ARTICLES DEPUIS TEXTE
 *********************************/
function parserArticlesDepuisTexte(texte) {
  const articles = [];
  const lignes = texte.split('\n').filter(l => l.trim());
  
  lignes.forEach(ligne => {
    ligne = ligne.trim();
    
    // Format: "2x Produit - 15.500 DT"
    const matchFormat1 = ligne.match(/(\d+)\s*x\s*([^-]+)-\s*(\d+\.?\d*)\s*(DT|dt|TND|tnd)?/i);
    if (matchFormat1) {
      articles.push({
        produit: matchFormat1[2].trim(),
        quantite: parseInt(matchFormat1[1]),
        prix_unitaire: parseFloat(matchFormat1[3]),
        prix_total: parseInt(matchFormat1[1]) * parseFloat(matchFormat1[3])
      });
      return;
    }
    
    // Format: "Produit: 15.500 DT x2"
    const matchFormat2 = ligne.match(/(.+):\s*(\d+\.?\d*)\s*(DT|dt|TND|tnd)?\s*x\s*(\d+)/i);
    if (matchFormat2) {
      articles.push({
        produit: matchFormat2[1].trim(),
        quantite: parseInt(matchFormat2[4]),
        prix_unitaire: parseFloat(matchFormat2[2]),
        prix_total: parseInt(matchFormat2[4]) * parseFloat(matchFormat2[2])
      });
      return;
    }
    
    // Format simple: "2x Produit"
    const matchSimple = ligne.match(/(\d+)\s*x\s*(.+)/i);
    if (matchSimple) {
      articles.push({
        produit: matchSimple[2].trim(),
        quantite: parseInt(matchSimple[1]),
        prix_unitaire: 0,
        prix_total: 0
      });
    }
  });
  
  return articles;
}

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  try {
    // Analyser et structurer les données
    const donneesStructurees = analyserDonneesCommande(dataCommande);
    
    console.log("📦 Données structurées:", donneesStructurees);

    const payload = {
      method: "saveOrder",
      nom: donneesStructurees.nom,
      telephone: donneesStructurees.telephone,
      adresse: donneesStructurees.adresse,
      articles: JSON.stringify(donneesStructurees.articles),
      total: donneesStructurees.total.toFixed(3),
      commande_id: donneesStructurees.numero_commande
    };

    console.log("📤 Envoi payload:", payload);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString()
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Générer notification WhatsApp
    if (result.success && result.commande_id) {
      await genererNotificationWhatsApp(result.commande_id, donneesStructurees);
    }
    
    return result;
    
  } catch (error) {
    console.error("❌ Erreur envoyerCommande:", error);
    
    // Fallback: générer notification quand même
    await genererNotificationWhatsApp("CMD-ERROR-" + Date.now(), dataCommande);
    
    return {
      success: false,
      message: "Erreur d'envoi: " + error.message,
      commande_id: "CMD-FALLBACK-" + Date.now()
    };
  }
}

/*********************************
 * GÉNÉRER NOTIFICATION WHATSAPP CORRIGÉE
 *********************************/
async function genererNotificationWhatsApp(commandeId, dataCommande) {
  try {
    // Formater le message avec les bonnes sections
    const whatsappMessage = `🛒 NOUVELLE COMMANDE MAXI JDC MARKET\n\n` +
      `📋 **Détails de votre commande**\n` +
      `┌──────────────────────────────┐\n` +
      `│ 👤 Nom: ${dataCommande.nom || ''}\n` +
      `│ 📞 Téléphone: ${dataCommande.telephone || ''}\n` +
      `│ 📍 Adresse: ${dataCommande.adresse || ''}\n` +
      `└──────────────────────────────┘\n\n` +
      `📦 **Articles commandés**\n` +
      `┌──────────────────────────────┐\n`;
    
    // Ajouter les articles
    let articlesText = '';
    if (Array.isArray(dataCommande.articles) && dataCommande.articles.length > 0) {
      dataCommande.articles.forEach((item, index) => {
        const qty = item.quantite || 1;
        const produit = item.produit || "Produit";
        const prix = parseFloat(item.prix_unitaire || 0).toFixed(3);
        const total = (qty * parseFloat(prix)).toFixed(3);
        
        articlesText += `│ ${qty}x ${produit} - ${prix} DT\n`;
      });
    } else {
      articlesText += "│ Aucun article détaillé\n";
    }
    
    // Footer avec total et numéro commande
    const footerMessage = `└──────────────────────────────┘\n\n` +
      `💰 **Récapitulatif**\n` +
      `┌──────────────────────────────┐\n` +
      `│ 🆔 N° Commande: ${commandeId}\n` +
      `│ 📅 Date: ${new Date().toLocaleDateString('fr-FR')}\n` +
      `│ 🕒 Heure: ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}\n` +
      `│ 💵 Total: ${dataCommande.total ? dataCommande.total.toFixed(3) + ' DT' : '0.000 DT'}\n` +
      `│ 📊 Statut: ⏳ En attente\n` +
      `└──────────────────────────────┘\n\n` +
      `📱 Contact: +216 25 600 978\n` +
      `⚠️ PRIORITÉ: À TRAITER DÈS QUE POSSIBLE`;
    
    const fullMessage = whatsappMessage + articlesText + footerMessage;
    
    // URL WhatsApp
    const whatsappNumber = "0021625600978";
    const encodedMessage = encodeURIComponent(fullMessage);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    // Jouer le son
    jouerSonTablette(commandeId);
    
    console.log("✅ WhatsApp prêt:", whatsappUrl);
    
    return {
      whatsapp_url: whatsappUrl,
      message: fullMessage,
      son_joue: true
    };
    
  } catch (error) {
    console.error("Erreur génération WhatsApp:", error);
    return null;
  }
}

/*********************************
 * AUTRES FONCTIONS (inchangées)
 *********************************/
// [Le reste du code reste identique jusqu'à la fin du fichier]
// Seules les fonctions ci-dessus sont modifiées
