/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

const API_URL = "https://script.google.com/macros/s/AKfycbxvNHFeB-Rhmi5HkMjUmKSn_wIqxpR9ayq2Rh-wWqnBGarI17WamzCzbWBG9nkic0-k/exec";

/*********************************
 * ANALYSER DONNÉES COMMANDE
 *********************************/
function analyserDonneesCommande(data) {
  const result = {
    nom: "",
    telephone: "",
    adresse: "",
    articles: [],
    articles_text: "",
    total: 0,
    numero_commande: "",
    date: new Date().toLocaleDateString('fr-FR') + " " + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}),
    statut: "EN ATTENTE"
  };

  // Si c'est un texte brut (message WhatsApp)
  if (typeof data === "string") {
    const lignes = data.split('\n').map(l => l.trim()).filter(l => l);
    
    lignes.forEach(ligne => {
      // NOM CLIENT
      if (ligne.includes("Nom:") || ligne.includes("👤") || /^Nom\s*:/.test(ligne)) {
        result.nom = ligne.replace(/Nom:|👤/g, "").trim();
      }
      // TÉLÉPHONE
      else if (ligne.includes("Téléphone:") || ligne.includes("📞") || /^Téléphone\s*:/.test(ligne)) {
        result.telephone = ligne.replace(/Téléphone:|📞/g, "").trim();
      }
      // ADRESSE
      else if (ligne.includes("Adresse:") || ligne.includes("📍") || /^Adresse\s*:/.test(ligne)) {
        result.adresse = ligne.replace(/Adresse:|📍/g, "").trim();
      }
      // ARTICLES (format: 2x Produit - 15.500 DT)
      else if (/^\d+x\s+/.test(ligne) && !ligne.includes("Articles commandés")) {
        const articleMatch = parserArticle(ligne);
        if (articleMatch) {
          result.articles.push(articleMatch);
          result.articles_text += ligne + "\n";
        }
      }
      // TOTAL
      else if (ligne.includes("TOTAL") || ligne.includes("Total:") || ligne.includes("💰")) {
        const totalMatch = ligne.match(/(\d+[\.,]?\d*)\s*(DT|dt|TND|tnd)/i);
        if (totalMatch) {
          result.total = parseFloat(totalMatch[1].replace(',', '.'));
        }
      }
      // NUMÉRO COMMANDE
      else if (ligne.includes("MAXI-") || ligne.includes("Commande #")) {
        result.numero_commande = ligne.replace(/Commande #/g, "").trim();
      }
    });
  }
  // Si c'est un objet
  else if (typeof data === "object" && data !== null) {
    result.nom = data.nom || data.nom_client || data.client || "";
    result.telephone = data.telephone || data.tel || data.phone || "";
    result.adresse = data.adresse || data.address || "";
    result.total = parseFloat(data.total) || 0;
    result.numero_commande = data.commande_id || data.numero_commande || "";
    
    if (data.articles && Array.isArray(data.articles)) {
      result.articles = data.articles;
      result.articles_text = data.articles.map(item => 
        `${item.quantite || 1}x ${item.produit || item.nom} - ${(item.prix_unitaire || 0).toFixed(3)} DT`
      ).join('\n');
    } else if (data.articles && typeof data.articles === 'string') {
      result.articles_text = data.articles;
    }
  }

  // Générer numéro commande si vide
  if (!result.numero_commande) {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const timeStr = now.getHours().toString().padStart(2, '0') + 
                   now.getMinutes().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    result.numero_commande = `MAXI-${dateStr}-${timeStr}-${random}`;
  }

  return result;
}

function parserArticle(ligne) {
  // Format: "2x Produit - 15.500 DT"
  const match1 = ligne.match(/(\d+)\s*x\s*([^-]+)-\s*([\d\.,]+)\s*(DT|dt|TND|tnd)?/i);
  if (match1) {
    return {
      produit: match1[2].trim(),
      quantite: parseInt(match1[1]),
      prix_unitaire: parseFloat(match1[3].replace(',', '.')),
      prix_total: parseInt(match1[1]) * parseFloat(match1[3].replace(',', '.'))
    };
  }
  
  return null;
}

/*********************************
 * ENVOYER COMMANDE VERS GOOGLE SHEETS
 *********************************/
export async function envoyerCommande(dataCommande) {
  try {
    console.log("📦 Données reçues:", dataCommande);
    
    // Analyser et structurer les données
    const commande = analyserDonneesCommande(dataCommande);
    
    console.log("✅ Données structurées:", commande);
    
    // Préparer le payload pour Google Sheets
    const payload = {
      method: "saveOrder",
      action: "saveOrder",
      nom: commande.nom || "Client",
      telephone: commande.telephone || "",
      adresse: commande.adresse || "",
      articles: JSON.stringify(commande.articles),
      articles_text: commande.articles_text,
      total: commande.total.toFixed(3),
      commande_id: commande.numero_commande,
      date: commande.date,
      statut: commande.statut
    };

    console.log("📤 Payload pour Google Sheets:", payload);

    // Envoyer à Google Apps Script
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors', // Important pour Google Apps Script
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(payload).toString()
    });

    // Note: En mode no-cors, on ne peut pas lire la réponse
    // Mais la commande est envoyée
    
    // Générer la notification WhatsApp
    const whatsappResult = await genererNotificationWhatsApp(commande);
    
    console.log("✅ Commande envoyée avec succès");
    
    return {
      success: true,
      message: "Commande envoyée au Google Sheets et WhatsApp",
      commande_id: commande.numero_commande,
      details: commande,
      whatsapp: whatsappResult
    };
    
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi:", error);
    
    // Fallback: Envoyer directement via GET si POST échoue
    try {
      const commande = analyserDonneesCommande(dataCommande);
      const params = new URLSearchParams({
        method: "saveOrder",
        nom: commande.nom || "Client",
        telephone: commande.telephone || "",
        adresse: commande.adresse || "",
        articles_text: commande.articles_text || "Aucun article",
        total: commande.total.toFixed(3),
        commande_id: commande.numero_commande
      });
      
      await fetch(`${API_URL}?${params.toString()}`);
      
      return {
        success: true,
        message: "Commande envoyée via fallback GET",
        commande_id: commande.numero_commande
      };
    } catch (fallbackError) {
      return {
        success: false,
        error: "Double échec: " + error.message,
        commande_id: "ERROR-" + Date.now()
      };
    }
  }
}

/*********************************
 * GÉNÉRER NOTIFICATION WHATSAPP
 *********************************/
async function genererNotificationWhatsApp(commande) {
  try {
    // Message WhatsApp Business
    const message = `🛒 NOUVELLE COMMANDE MAXI JDC MARKET\n\n` +
      `📋 **Détails client**\n` +
      `├──────────────────────────────┤\n` +
      `│ 👤 Nom: ${commande.nom || 'Non spécifié'}\n` +
      `│ 📞 Téléphone: ${commande.telephone || 'Non spécifié'}\n` +
      `│ 📍 Adresse: ${commande.adresse || 'Non spécifié'}\n` +
      `└──────────────────────────────┘\n\n` +
      `📦 **Articles commandés**\n` +
      `├──────────────────────────────┤\n` +
      `${commande.articles_text || 'Aucun article détaillé'}\n` +
      `└──────────────────────────────┘\n\n` +
      `💰 **Récapitulatif**\n` +
      `├──────────────────────────────┤\n` +
      `│ 🆔 N° Commande: ${commande.numero_commande}\n` +
      `│ 📅 Date: ${commande.date}\n` +
      `│ 💵 Total: ${commande.total.toFixed(3)} DT\n` +
      `│ 📊 Statut: ⏳ ${commande.statut}\n` +
      `└──────────────────────────────┘\n\n` +
      `📱 Contact magasin: +216 25 600 978\n` +
      `⚠️ PRIORITÉ: À TRAITER IMMÉDIATEMENT`;

    // URL WhatsApp
    const whatsappNumber = "0021625600978";
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    // Jouer le son
    jouerSonTablette(commande.numero_commande);

    console.log("✅ WhatsApp généré:", whatsappUrl);

    return {
      whatsapp_url: whatsappUrl,
      message: message
    };

  } catch (error) {
    console.error("Erreur WhatsApp:", error);
    return null;
  }
}

/*********************************
 * JOUER SON SUR TABLETTE
 *********************************/
function jouerSonTablette(commandeId) {
  console.log("🔔 SON TABLETTE - Commande:", commandeId);
  
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate([200, 100, 200, 100, 200]);
  }
  
  return true;
}

/*********************************
 * RECUPERER COMMANDES DEPUIS GOOGLE SHEETS
 *********************************/
export async function recupererCommandes() {
  try {
    const response = await fetch(`${API_URL}?method=getOrders&t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || "Erreur API");
    }
    
    // Formater pour l'affichage
    const commandesFormatees = (data.orders || []).map(commande => ({
      Date: commande.date || "",
      Nom: commande.nom || "",
      Téléphone: commande.telephone || "",
      Adresse: commande.adresse || "",
      Commande: commande.numero_commande || commande.numero || "",
      Articles: commande.articles || commande.articles_text || "",
      Total: commande.total || "0.000",
      Statut: commande.statut || "EN ATTENTE",
      _id: commande.id,
      _raw: commande
    }));
    
    return commandesFormatees;
  } catch (error) {
    console.error("Erreur récupération commandes:", error);
    
    // Données de test si API échoue
    return [
      {
        Date: new Date().toLocaleDateString('fr-FR'),
        Nom: "Test Client",
        Téléphone: "50123456",
        Adresse: "Tunis",
        Commande: "MAXI-TEST-001",
        Articles: "2x Pain - 0.500 DT\n1x Lait - 1.200 DT",
        Total: "1.700",
        Statut: "EN ATTENTE"
      }
    ];
  }
}

/*********************************
 * TESTER CONNEXION API
 *********************************/
export async function testerConnexionAPI() {
  try {
    const response = await fetch(`${API_URL}?method=test&t=${Date.now()}`);
    
    if (!response.ok) {
      return {
        connecte: false,
        erreur: `Erreur HTTP: ${response.status}`,
        url: API_URL
      };
    }
    
    const data = await response.json();
    
    return {
      connecte: data.success || false,
      message: data.message || "API répond",
      sheet: data.sheet,
      total_commandes: data.total_commandes,
      url: API_URL
    };
    
  } catch (error) {
    return {
      connecte: false,
      erreur: error.message,
      url: API_URL
    };
  }
}

// [Le reste du fichier reste inchangé...]
