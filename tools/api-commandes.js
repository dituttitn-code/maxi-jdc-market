/*********************************
 * CONFIGURATION API
 *********************************/

// URL de l'API Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzJBRgQiA214iLEyoDFWTq2dnfRFTL8S9fGwNd0SCGWKmUihISIMeyle_SF0X7vkEk/exec";

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
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
      quantite: item.quantite || item.qty || 1,
      prix_unitaire: item.prix_unitaire || item.prix || 0,
      prix_total: item.prix_total || ((item.quantite || 1) * (item.prix_unitaire || 0))
    }));
  } else if (typeof dataCommande.articles === 'string') {
    try {
      articlesFormat = JSON.parse(dataCommande.articles);
    } catch (e) {
      articlesFormat = [];
    }
  }

  const payload = {
    method: "saveOrder",
    nom: dataCommande.nom || dataCommande.client_nom || "",
    telephone: dataCommande.telephone || dataCommande.client_telephone || "",
    adresse: dataCommande.adresse || dataCommande.client_adresse || "",
    articles: JSON.stringify(articlesFormat),
    total: String(dataCommande.total || dataCommande.sousTotal || 0)
  };

  console.log("Envoi de la commande:", payload);

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
    console.log("Réponse API:", result);
    
    return result;
  } catch (error) {
    console.error("Erreur dans envoyerCommande:", error);
    
    // Fallback pour no-cors
    return fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString()
    });
  }
}

/*********************************
 * RECUPERER TOUTES LES COMMANDES (Admin)
 * Retourne le tableau avec les 8 colonnes
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
      // Les 8 colonnes exactes
      Date: commande.date || "",
      Nom: commande.nom || "",
      Téléphone: commande.telephone || "",
      Adresse: commande.adresse || "",
      Commande: commande.commande_id || "",
      Articles: commande.articles || "",
      Total: commande.total || "0",
      Statut: commande.statut || "En attente",
      // Données supplémentaires pour le traitement interne
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
 * Pour la fonctionnalité de suivi
 *********************************/
export async function suivreCommande(commandeId, telephone) {
  try {
    const response = await fetch(
      `${API_URL}?method=getOrderStatus&commande_id=${encodeURIComponent(commandeId)}&telephone=${encodeURIComponent(telephone)}&t=${Date.now()}`
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
      // Les 8 colonnes exactes
      Date: data.date || "",
      Nom: data.nom || "",
      Téléphone: data.telephone || "",
      Adresse: data.adresse || "",
      Commande: data.commande_id || "",
      Articles: data.articles || "",
      Total: data.total || "0",
      Statut: data.statut || "En attente",
      // Données complètes
      ...data
    };
  } catch (error) {
    console.error("Erreur dans suivreCommande:", error);
    throw error;
  }
}

/*********************************
 * RECUPERER L'HISTORIQUE D'UN CLIENT
 * Pour la fonctionnalité historique
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
      // Les 8 colonnes exactes
      Date: commande.date || "",
      Nom: "", // Le nom n'est pas dans l'historique, mais on garde la structure
      Téléphone: telephone,
      Adresse: "", // L'adresse n'est pas dans l'historique
      Commande: commande.commande_id || "",
      Articles: commande.articles || "",
      Total: commande.total || "0",
      Statut: commande.statut || "",
      // Données originales
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
 * Pour le tableau de bord admin
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
 * FORMATER LES ARTICLES POUR L'AFFICHAGE
 * Convertit JSON en format "quantité x produit"
 *********************************/
export function formaterArticles(articles) {
  if (!articles) return "";
  
  try {
    // Si articles est déjà formaté "3x Produit\n5x Autre"
    if (typeof articles === "string" && articles.includes("x ")) {
      return articles;
    }
    
    let articlesArray = [];
    
    // Si c'est une chaîne JSON
    if (typeof articles === "string") {
      try {
        articlesArray = JSON.parse(articles);
      } catch (e) {
        return articles; // Retourne la chaîne telle quelle
      }
    }
    // Si c'est déjà un tableau
    else if (Array.isArray(articles)) {
      articlesArray = articles;
    }
    
    // Formater chaque article
    return articlesArray.map(item => {
      const quantite = item.quantite || item.qty || 1;
      const produit = item.produit || item.nom || "Produit";
      return `${quantite}x ${produit}`;
    }).join("\n");
    
  } catch (error) {
    console.error("Erreur lors du formatage des articles:", error);
    return String(articles || "");
  }
}

/*********************************
 * PARSER LES ARTICLES DEPUIS LE TEXTE
 * Convertit "3x Produit" en JSON
 *********************************/
export function parserArticles(texteArticles) {
  if (!texteArticles) return [];
  
  const lignes = texteArticles.split('\n');
  const articles = [];
  
  for (const ligne of lignes) {
    const match = ligne.trim().match(/^(\d+)x\s+(.+)$/);
    if (match) {
      articles.push({
        produit: match[2].trim(),
        quantite: parseInt(match[1]),
        prix_unitaire: 0,
        prix_total: 0
      });
    }
  }
  
  return articles;
}

/*********************************
 * GENERER UN TABLEAU HTML POUR L'AFFICHAGE
 * Affiche les 8 colonnes exactes
 *********************************/
export function genererTableauCommandes(commandes) {
  if (!commandes || !commandes.length) {
    return '<p class="no-data">Aucune commande trouvée</p>';
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
    html += `
      <tr>
        <td>${commande.Date || ''}</td>
        <td>${commande.Nom || ''}</td>
        <td>${commande.Téléphone || ''}</td>
        <td>${commande.Adresse || ''}</td>
        <td><strong>${commande.Commande || ''}</strong></td>
        <td class="articles-cell">${formaterArticles(commande.Articles).replace(/\n/g, '<br>')}</td>
        <td><strong>${commande.Total || '0'} dt</strong></td>
        <td class="statut-cell" data-commande="${commande.Commande}">
          <select class="statut-select" onchange="changerStatut('${commande.Commande}', this.value)">
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
    return '<p class="no-data">Commande non trouvée</p>';
  }
  
  return `
    <div class="suivi-commande">
      <div class="suivi-header">
        <h3>Commande: ${commande.Commande || ''}</h3>
        <span class="statut-badge ${commande.Statut?.toLowerCase().replace(' ', '-') || ''}">
          ${commande.Statut || 'En attente'}
        </span>
      </div>
      
      <div class="suivi-details">
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${commande.Date || ''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Client:</span>
          <span class="detail-value">${commande.Nom || ''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Téléphone:</span>
          <span class="detail-value">${commande.Téléphone || ''}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Adresse:</span>
          <span class="detail-value">${commande.Adresse || ''}</span>
        </div>
      </div>
      
      <div class="suivi-articles">
        <h4>Articles commandés:</h4>
        <div class="articles-list">
          ${formaterArticles(commande.Articles).split('\n').map(article => `
            <div class="article-item">${article}</div>
          `).join('')}
        </div>
      </div>
      
      <div class="suivi-total">
        <h4>Total à payer:</h4>
        <div class="total-amount">${commande.Total || '0'} dt</div>
      </div>
    </div>
  `;
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
    }
    
    .commandes-table th {
      background: #4CAF50;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #ddd;
    }
    
    .commandes-table td {
      padding: 10px;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    
    .commandes-table tr:nth-child(even) {
      background: #f9f9f9;
    }
    
    .commandes-table tr:hover {
      background: #f5f5f5;
    }
    
    .articles-cell {
      max-width: 250px;
      white-space: pre-line;
      font-size: 14px;
    }
    
    .statut-select {
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
    }
    
    .statut-select:focus {
      outline: none;
      border-color: #4CAF50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }
    
    .suivi-commande {
      background: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin: 20px 0;
    }
    
    .suivi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #f0f0f0;
    }
    
    .statut-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 14px;
    }
    
    .statut-badge.en-attente {
      background: #FFF3CD;
      color: #856404;
    }
    
    .statut-badge.en-cours {
      background: #CCE5FF;
      color: #004085;
    }
    
    .statut-badge.livrée {
      background: #D4EDDA;
      color: #155724;
    }
    
    .statut-badge.annulée {
      background: #F8D7DA;
      color: #721C24;
    }
    
    .suivi-details {
      margin-bottom: 20px;
    }
    
    .detail-row {
      display: flex;
      margin-bottom: 8px;
      padding: 5px 0;
    }
    
    .detail-label {
      flex: 0 0 120px;
      font-weight: bold;
      color: #666;
    }
    
    .detail-value {
      flex: 1;
      color: #333;
    }
    
    .suivi-articles h4 {
      margin-bottom: 10px;
      color: #333;
    }
    
    .articles-list {
      background: #f9f9f9;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 20px;
    }
    
    .article-item {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    
    .article-item:last-child {
      border-bottom: none;
    }
    
    .suivi-total {
      text-align: right;
      padding-top: 15px;
      border-top: 2px solid #f0f0f0;
    }
    
    .total-amount {
      font-size: 24px;
      font-weight: bold;
      color: #4CAF50;
      margin-top: 5px;
    }
    
    .no-data {
      text-align: center;
      padding: 40px;
      color: #666;
      font-style: italic;
    }
  </style>
`;

/*********************************
 * FONCTION GLOBALE POUR CHANGER LE STATUT
 *********************************/
export function initGestionStatut() {
  window.changerStatut = async function(commandeId, nouveauStatut) {
    try {
      console.log(`Changement statut: ${commandeId} -> ${nouveauStatut}`);
      await mettreAJourStatut(commandeId, nouveauStatut);
      
      // Mettre à jour l'affichage
      const cellule = document.querySelector(`[data-commande="${commandeId}"]`);
      if (cellule) {
        cellule.innerHTML = `
          <select class="statut-select" onchange="changerStatut('${commandeId}', this.value)">
            <option value="En attente" ${nouveauStatut === 'En attente' ? 'selected' : ''}>En attente</option>
            <option value="En cours" ${nouveauStatut === 'En cours' ? 'selected' : ''}>En cours</option>
            <option value="Livrée" ${nouveauStatut === 'Livrée' ? 'selected' : ''}>Livrée</option>
            <option value="Annulée" ${nouveauStatut === 'Annulée' ? 'selected' : ''}>Annulée</option>
          </select>
        `;
        
        // Afficher un message de succès
        alert(`Statut de la commande ${commandeId} mis à jour: ${nouveauStatut}`);
      }
    } catch (error) {
      console.error("Erreur lors du changement de statut:", error);
      alert(`Erreur: ${error.message}`);
    }
  };
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
  formaterArticles,
  parserArticles,
  genererTableauCommandes,
  genererTableauSuivi,
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
    formaterArticles
  };
}
