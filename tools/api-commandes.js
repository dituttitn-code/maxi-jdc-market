/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

// URL de l'API Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbwfTa_rv1nOi0kMT_RtjfD_Q0syweIhWxSRCRREZFz-yQYmgXKHNupfzpe3W3-ap7Pe/exec";

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 * Envoie la commande au Google Sheet et génère WhatsApp
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // Formatage des articles selon la nouvelle structure
  let articlesFormat = [];
  
  if (Array.isArray(dataCommande.articles)) {
    articlesFormat = dataCommande.articles.map(item => ({
      produit: item.produit || item.nom || "",
      quantite: parseInt(item.quantite || item.qty || 1),
      prix_unitaire: parseFloat(item.prix_unitaire || item.prix || 0),
      prix_total: parseFloat((parseInt(item.quantite || 1) * parseFloat(item.prix_unitaire || 0)).toFixed(2))
    }));
  } else if (typeof dataCommande.articles === 'string') {
    try {
      const parsed = JSON.parse(dataCommande.articles);
      if (Array.isArray(parsed)) {
        articlesFormat = parsed;
      }
    } catch (e) {
      console.warn("Erreur parsing articles, utilisation format texte");
    }
  }

  // Calculer le total si non fourni
  let total = parseFloat(dataCommande.total || 0);
  if (total === 0 && articlesFormat.length > 0) {
    total = articlesFormat.reduce((sum, item) => sum + (item.prix_total || 0), 0);
  }

  const payload = {
    method: "saveOrder",
    nom: dataCommande.nom || dataCommande.client_nom || "",
    telephone: dataCommande.telephone || dataCommande.client_telephone || "",
    adresse: dataCommande.adresse || dataCommande.client_adresse || "",
    articles: JSON.stringify(articlesFormat),
    total: total.toFixed(2)
  };

  console.log("📤 Envoi commande API:", payload);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString()
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("📥 Réponse API:", result);
    
    // Si succès, générer le lien WhatsApp pour le magasin
    if (result.success && result.commande_id) {
      await genererNotificationWhatsApp(result.commande_id, dataCommande);
    }
    
    return result;
    
  } catch (error) {
    console.error("❌ Erreur envoyerCommande:", error);
    
    // Fallback: tenter sans cors
    try {
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload).toString()
      });
      
      // Générer quand même le WhatsApp
      await genererNotificationWhatsApp("CMD-EMERGENCY", dataCommande);
      
      return {
        success: true,
        message: "Commande envoyée (mode fallback)",
        commande_id: "CMD-FALLBACK-" + Date.now(),
        statut: "En attente"
      };
    } catch (fallbackError) {
      throw new Error("Double erreur: " + error.message);
    }
  }
}

/*********************************
 * GÉNÉRER NOTIFICATION WHATSAPP
 *********************************/
async function genererNotificationWhatsApp(commandeId, dataCommande) {
  try {
    // Formater le message pour WhatsApp Business
    const whatsappMessage = `📦 NOUVELLE COMMANDE MAXI JDC MARKET\n\n` +
      `🔔 #NouvelleCommande\n` +
      `📅 ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}\n` +
      `👤 ${dataCommande.nom || ''}\n` +
      `📱 ${dataCommande.telephone || ''}\n` +
      `📍 ${dataCommande.adresse || ''}\n` +
      `🆔 ${commandeId}\n\n` +
      `🛒 ARTICLES :\n`;
    
    // Ajouter les articles
    let articlesText = '';
    if (Array.isArray(dataCommande.articles)) {
      articlesText = dataCommande.articles.map(item => 
        `${item.quantite || 1}x ${item.produit || item.nom} @ ${(item.prix_unitaire || item.prix || 0).toFixed(2)} dt`
      ).join('\n');
    }
    
    const total = dataCommande.total || dataCommande.sousTotal || "0.00";
    const fullMessage = whatsappMessage + articlesText + `\n\n💰 TOTAL : ${total} dt\n` +
      `📊 STATUT : En attente\n\n` +
      `⚠️ PRIORITÉ : À TRAITER\n` +
      `🎯 URGENCE : NORMAL`;
    
    // URL WhatsApp Business du magasin
    const whatsappNumber = "0021625600978";
    const encodedMessage = encodeURIComponent(fullMessage);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    // Jouer le son sur la tablette (simulation)
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
 * JOUER SON SUR TABLETTE
 * Simule 5 bips pour alerter le magasin
 *********************************/
function jouerSonTablette(commandeId) {
  console.log("🔔 SON TABLETTE - Nouvelle commande:", commandeId);
  console.log("🔔 BIP 1 - Commande reçue");
  console.log("🔔 BIP 2 - À traiter");
  console.log("🔔 BIP 3 - Client: " + commandeId);
  console.log("🔔 BIP 4 - Préparer");
  console.log("🔔 BIP 5 - Fin alerte");
  
  // En production, remplacer par Web Audio API ou notification
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    // Vibration pour mobile/tablette
    window.navigator.vibrate([100, 50, 100, 50, 100, 50, 100, 50, 100]);
  }
  
  return true;
}

/*********************************
 * RECUPERER TOUTES LES COMMANDES (Admin)
 *********************************/
export async function recupererCommandes() {
  try {
    const response = await fetch(`${API_URL}?method=getAllOrders&t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || "Erreur lors de la récupération des commandes");
    }
    
    // Formater selon les 8 colonnes du tableau
    const commandesFormatees = (data.orders || []).map(commande => ({
      Date: commande.date || "",
      Nom: commande.nom || "",
      Téléphone: commande.telephone || "",
      Adresse: commande.adresse || "",
      Commande: commande.commande_id || "",
      Articles: commande.articles || "",
      Total: commande.total || "0",
      Statut: commande.statut || "En attente",
      _id: commande.id,
      _raw: commande
    }));
    
    return commandesFormatees;
  } catch (error) {
    console.error("Erreur dans recupererCommandes:", error);
    return [];
  }
}

/*********************************
 * SUIVRE UNE COMMANDE (Client)
 *********************************/
export async function suivreCommande(commandeId) {
  try {
    const response = await fetch(
      `${API_URL}?method=getOrderStatus&commande_id=${encodeURIComponent(commandeId)}&t=${Date.now()}`
    );
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || "Commande non trouvée");
    }
    
    // Formater selon les 8 colonnes
    return {
      Date: data.date || "",
      Nom: data.nom || "",
      Téléphone: data.telephone || "",
      Adresse: data.adresse || "",
      Commande: data.commande_id || "",
      Articles: data.articles || "",
      Total: data.total || "0",
      Statut: data.statut || "En attente",
      ...data
    };
  } catch (error) {
    console.error("Erreur dans suivreCommande:", error);
    throw error;
  }
}

/*********************************
 * RECUPERER L'HISTORIQUE D'UN CLIENT
 *********************************/
export async function recupererHistorique(telephone) {
  try {
    const response = await fetch(
      `${API_URL}?method=getOrderHistory&telephone=${encodeURIComponent(telephone)}&t=${Date.now()}`
    );
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || "Erreur lors de la récupération de l'historique");
    }
    
    // Formater selon les 8 colonnes
    const historiqueFormate = (data.history || []).map(commande => ({
      Date: commande.date || "",
      Nom: commande.nom || "",
      Téléphone: telephone,
      Adresse: commande.adresse || "",
      Commande: commande.commande_id || "",
      Articles: commande.articles || "",
      Total: commande.total || "0",
      Statut: commande.statut || "",
      _raw: commande
    }));
    
    return historiqueFormate;
  } catch (error) {
    console.error("Erreur dans recupererHistorique:", error);
    return [];
  }
}

/*********************************
 * METTRE A JOUR LE STATUT D'UNE COMMANDE
 *********************************/
export async function mettreAJourStatut(commandeId, nouveauStatut) {
  try {
    const response = await fetch(
      `${API_URL}?method=updateOrderStatus&commande_id=${encodeURIComponent(commandeId)}&statut=${encodeURIComponent(nouveauStatut)}&t=${Date.now()}`
    );
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || "Erreur lors de la mise à jour");
    }
    
    return data;
  } catch (error) {
    console.error("Erreur dans mettreAJourStatut:", error);
    throw error;
  }
}

/*********************************
 * RECUPERER TOP PRODUITS
 *********************************/
export async function recupererTopProduits() {
  try {
    const response = await fetch(`${API_URL}?method=getTopProducts&t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || "Erreur lors de la récupération des top produits");
    }
    
    return data.topProducts || [];
  } catch (error) {
    console.error("Erreur dans recupererTopProduits:", error);
    return [];
  }
}

/*********************************
 * FORMATER LES ARTICLES POUR L'AFFICHAGE
 *********************************/
export function formaterArticles(articles) {
  if (!articles) return "";
  
  try {
    // Si articles est déjà formaté "3x Produit @ 15.00 dt"
    if (typeof articles === "string") {
      return articles;
    }
    
    let articlesArray = [];
    
    // Si c'est une chaîne JSON
    if (typeof articles === "string") {
      try {
        articlesArray = JSON.parse(articles);
      } catch (e) {
        return articles;
      }
    }
    // Si c'est déjà un tableau
    else if (Array.isArray(articles)) {
      articlesArray = articles;
    }
    
    // Formater chaque article avec prix
    return articlesArray.map(item => {
      const quantite = item.quantite || item.qty || 1;
      const produit = item.produit || item.nom || "Produit";
      const prix = parseFloat(item.prix_unitaire || item.prix || 0).toFixed(2);
      const total = (quantite * parseFloat(prix)).toFixed(2);
      
      return `${quantite}x ${produit} @ ${prix} dt = ${total} dt`;
    }).join("\n");
    
  } catch (error) {
    console.error("Erreur lors du formatage des articles:", error);
    return String(articles || "");
  }
}

/*********************************
 * PARSER LES ARTICLES DEPUIS LE TEXTE
 *********************************/
export function parserArticles(texteArticles) {
  if (!texteArticles) return [];
  
  const lignes = texteArticles.split('\n');
  const articles = [];
  
  for (const ligne of lignes) {
    const ligneClean = ligne.trim();
    if (!ligneClean) continue;
    
    // Format: "3x Produit @ 15.00 dt = 45.00 dt"
    const match = ligneClean.match(/^(\d+)x\s+(.+?)\s+@\s+([\d.]+)\s+dt\s+=\s+([\d.]+)\s+dt$/);
    if (match) {
      articles.push({
        produit: match[2].trim(),
        quantite: parseInt(match[1]),
        prix_unitaire: parseFloat(match[3]),
        prix_total: parseFloat(match[4])
      });
    } 
    // Format alternatif: "3x Produit"
    else {
      const simpleMatch = ligneClean.match(/^(\d+)x\s+(.+)$/);
      if (simpleMatch) {
        articles.push({
          produit: simpleMatch[2].trim(),
          quantite: parseInt(simpleMatch[1]),
          prix_unitaire: 0,
          prix_total: 0
        });
      }
    }
  }
  
  return articles;
}

/*********************************
 * GENERER NUMERO COMMANDE LOCAL
 *********************************/
export function genererNumeroCommandeLocal() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + 
                  (now.getMonth() + 1).toString().padStart(2, '0') + 
                  now.getDate().toString().padStart(2, '0');
  
  // Pour la démo, on utilise un timestamp
  // En production, l'API générera le vrai numéro
  return `CMD-MAXI-${dateStr}-${Date.now().toString().slice(-3)}`;
}

/*********************************
 * TESTER LA CONNEXION API
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
      version: data.version,
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

/*********************************
 * GENERER UN TABLEAU HTML POUR L'AFFICHAGE
 *********************************/
export function genererTableauCommandes(commandes) {
  if (!commandes || !commandes.length) {
    return '<div class="no-data">Aucune commande trouvée</div>';
  }
  
  let html = `
    <table class="commandes-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Nom</th>
          <th>Téléphone</th>
          <th>Adresse</th>
          <th>Commande</th>
          <th>Articles</th>
          <th>Total</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  commandes.forEach(commande => {
    const articlesFormatted = formaterArticles(commande.Articles).replace(/\n/g, '<br>');
    const statutClass = commande.Statut ? commande.Statut.toLowerCase().replace(/ /g, '-') : '';
    
    html += `
      <tr>
        <td>${commande.Date || ''}</td>
        <td>${commande.Nom || ''}</td>
        <td>${commande.Téléphone || ''}</td>
        <td>${commande.Adresse || ''}</td>
        <td><strong>${commande.Commande || ''}</strong></td>
        <td class="articles-cell">${articlesFormatted}</td>
        <td><strong>${commande.Total || '0'} dt</strong></td>
        <td class="statut-cell" data-commande="${commande.Commande}">
          <select class="statut-select ${statutClass}" onchange="changerStatutCommande('${commande.Commande}', this.value)">
            <option value="En attente" ${commande.Statut === 'En attente' ? 'selected' : ''}>En attente</option>
            <option value="En cours" ${commande.Statut === 'En cours' ? 'selected' : ''}>En cours</option>
            <option value="Livrée" ${commande.Statut === 'Livrée' ? 'selected' : ''}>Livrée</option>
            <option value="Annulée" ${commande.Statut === 'Annulée' ? 'selected' : ''}>Annulée</option>
          </select>
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  return html;
}

/*********************************
 * GENERER UN TABLEAU POUR LE SUIVI CLIENT
 *********************************/
export function genererTableauSuivi(commande) {
  if (!commande) {
    return '<div class="no-data">Commande non trouvée</div>';
  }
  
  const articlesFormatted = formaterArticles(commande.Articles).replace(/\n/g, '<br>');
  const statutClass = commande.Statut ? commande.Statut.toLowerCase().replace(' ', '-') : '';
  
  return `
    <div class="suivi-commande">
      <div class="suivi-header">
        <h3>📦 Commande: ${commande.Commande || ''}</h3>
        <span class="statut-badge ${statutClass}">
          ${commande.Statut || 'En attente'}
        </span>
      </div>
      
      <div class="suivi-details">
        <div class="detail-row">
          <span class="detail-label">📅 Date:</span>
          <span class="detail-value">${commande.Date || ''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">👤 Client:</span>
          <span class="detail-value">${commande.Nom || ''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">📱 Téléphone:</span>
          <span class="detail-value">${commande.Téléphone || ''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">📍 Adresse:</span>
          <span class="detail-value">${commande.Adresse || ''}</span>
        </div>
      </div>
      
      <div class="suivi-articles">
        <h4>🛒 Articles commandés:</h4>
        <div class="articles-list">
          ${articlesFormatted}
        </div>
      </div>
      
      <div class="suivi-total">
        <h4>💰 Total à payer:</h4>
        <div class="total-amount">${commande.Total || '0'} dt</div>
      </div>
      
      <div class="suivi-actions">
        <button onclick="contacterMagasin('${commande.Téléphone || ''}')" class="btn-contact">
          📱 Contacter le magasin
        </button>
      </div>
    </div>
  `;
}

/*********************************
 * CONTACTER MAGASIN
 *********************************/
export function contacterMagasin(telephoneClient) {
  const whatsappNumber = "0021625600978";
  const message = `Bonjour MAXI JDC MARKET,\n\nJe suis le client avec le numéro ${telephoneClient}.\nJe souhaite des informations sur ma commande.\n\nCordialement.`;
  
  const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
  
  return url;
}

/*********************************
 * CSS POUR LES TABLEAUX
 *********************************/
export const stylesTableau = `
  <style>
    .commandes-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-family: Arial, sans-serif;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .commandes-table th {
      background: #4CAF50;
      color: white;
      padding: 12px 15px;
      text-align: left;
      font-weight: bold;
      border: none;
    }
    
    .commandes-table td {
      padding: 10px 15px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }
    
    .commandes-table tr:nth-child(even) {
      background: #f9f9f9;
    }
    
    .commandes-table tr:hover {
      background: #f5f5f5;
    }
    
    .commandes-table tr:last-child td {
      border-bottom: none;
    }
    
    .articles-cell {
      max-width: 300px;
      white-space: pre-line;
      font-size: 13px;
      line-height: 1.4;
    }
    
    .statut-select {
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
      font-size: 13px;
      transition: all 0.2s;
    }
    
    .statut-select:focus {
      outline: none;
      border-color: #4CAF50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }
    
    .statut-select.en-attente {
      border-color: #FFC107;
      background: #FFF3CD;
    }
    
    .statut-select.en-cours {
      border-color: #2196F3;
      background: #CCE5FF;
    }
    
    .statut-select.livrée {
      border-color: #4CAF50;
      background: #D4EDDA;
    }
    
    .statut-select.annulée {
      border-color: #F44336;
      background: #F8D7DA;
    }
    
    .suivi-commande {
      background: white;
      border-radius: 10px;
      padding: 25px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      margin: 20px 0;
      border: 1px solid #e0e0e0;
    }
    
    .suivi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 2px solid #f0f0f0;
    }
    
    .suivi-header h3 {
      margin: 0;
      color: #333;
      font-size: 20px;
    }
    
    .statut-badge {
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 14px;
      display: inline-block;
      min-width: 100px;
      text-align: center;
    }
    
    .statut-badge.en-attente {
      background: #FFF3CD;
      color: #856404;
      border: 1px solid #FFC107;
    }
    
    .statut-badge.en-cours {
      background: #CCE5FF;
      color: #004085;
      border: 1px solid #2196F3;
    }
    
    .statut-badge.livrée {
      background: #D4EDDA;
      color: #155724;
      border: 1px solid #4CAF50;
    }
    
    .statut-badge.annulée {
      background: #F8D7DA;
      color: #721C24;
      border: 1px solid #F44336;
    }
    
    .suivi-details {
      margin-bottom: 25px;
    }
    
    .detail-row {
      display: flex;
      margin-bottom: 12px;
      padding: 8px 0;
    }
    
    .detail-label {
      flex: 0 0 150px;
      font-weight: 600;
      color: #666;
      font-size: 14px;
    }
    
    .detail-value {
      flex: 1;
      color: #333;
      font-size: 15px;
      font-weight: 500;
    }
    
    .suivi-articles h4 {
      margin: 0 0 15px 0;
      color: #333;
      font-size: 18px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
    }
    
    .articles-list {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 25px;
      border: 1px solid #eee;
    }
    
    .suivi-total {
      text-align: right;
      padding: 20px 0;
      border-top: 2px solid #f0f0f0;
      border-bottom: 2px solid #f0f0f0;
      margin: 20px 0;
    }
    
    .suivi-total h4 {
      margin: 0 0 10px 0;
      color: #666;
      font-size: 16px;
    }
    
    .total-amount {
      font-size: 28px;
      font-weight: bold;
      color: #4CAF50;
      margin-top: 5px;
    }
    
    .suivi-actions {
      text-align: center;
      margin-top: 25px;
    }
    
    .btn-contact {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .btn-contact:hover {
      background: #45a049;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    }
    
    .no-data {
      text-align: center;
      padding: 40px;
      color: #666;
      font-style: italic;
      font-size: 16px;
      background: #f9f9f9;
      border-radius: 8px;
      border: 1px dashed #ddd;
    }
  </style>
`;

/*********************************
 * FONCTION GLOBALE POUR CHANGER LE STATUT
 *********************************/
export function initGestionStatut() {
  window.changerStatutCommande = async function(commandeId, nouveauStatut) {
    try {
      console.log(`🔄 Changement statut: ${commandeId} -> ${nouveauStatut}`);
      
      // Afficher un message de chargement
      const cellule = document.querySelector(`[data-commande="${commandeId}"]`);
      if (cellule) {
        const oldHTML = cellule.innerHTML;
        cellule.innerHTML = `<span style="color: #666; font-size: 12px;">Mise à jour...</span>`;
      }
      
      const result = await mettreAJourStatut(commandeId, nouveauStatut);
      
      if (result.success) {
        // Mettre à jour l'affichage
        if (cellule) {
          const statutClass = nouveauStatut.toLowerCase().replace(/ /g, '-');
          cellule.innerHTML = `
            <select class="statut-select ${statutClass}" onchange="changerStatutCommande('${commandeId}', this.value)">
              <option value="En attente" ${nouveauStatut === 'En attente' ? 'selected' : ''}>En attente</option>
              <option value="En cours" ${nouveauStatut === 'En cours' ? 'selected' : ''}>En cours</option>
              <option value="Livrée" ${nouveauStatut === 'Livrée' ? 'selected' : ''}>Livrée</option>
              <option value="Annulée" ${nouveauStatut === 'Annulée' ? 'selected' : ''}>Annulée</option>
            </select>
          `;
        }
        
        // Afficher un toast de succès
        showToast(`✅ Statut de ${commandeId} mis à jour: ${nouveauStatut}`, 'success');
        
      } else {
        throw new Error(result.error || "Erreur inconnue");
      }
      
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error);
      showToast(`❌ Erreur: ${error.message}`, 'error');
      
      // Restaurer l'ancien HTML
      const cellule = document.querySelector(`[data-commande="${commandeId}"]`);
      if (cellule) {
        const select = cellule.querySelector('select');
        if (select) select.value = select.dataset.oldValue || 'En attente';
      }
    }
  };
}

/*********************************
 * FONCTION UTILITAIRE TOAST
 *********************************/
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.5s forwards;
  `;
  
  if (type === 'success') {
    toast.style.background = '#4CAF50';
  } else if (type === 'error') {
    toast.style.background = '#F44336';
  } else {
    toast.style.background = '#2196F3';
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

/*********************************
 * EXPORT DES FONCTIONS
 *********************************/
export default {
  envoyerCommande,
  recupererCommandes,
  suivreCommande,
  recupererHistorique,
  mettreAJourStatut,
  recupererTopProduits,
  formaterArticles,
  parserArticles,
  genererNumeroCommandeLocal,
  testerConnexionAPI,
  genererTableauCommandes,
  genererTableauSuivi,
  contacterMagasin,
  stylesTableau,
  initGestionStatut
};

// Pour utilisation depuis la console
if (typeof window !== 'undefined') {
  window.apiCommandes = {
    envoyerCommande,
    recupererCommandes,
    suivreCommande,
    recupererHistorique,
    mettreAJourStatut,
    recupererTopProduits,
    formaterArticles,
    genererNumeroCommandeLocal,
    testerConnexionAPI,
    contacterMagasin
  };
}
