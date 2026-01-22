// api-commandes.js - Backend Google Apps Script pour MAXI JDC MARKET

// Configuration
const CONFIG = {
  spreadsheetId: '1A2B3C4D5E6F7G8H9I0J', // À REMPLACER AVEC VOTRE ID DE SPREADSHEET
  sheets: {
    commandes: 'Commandes',
    produits: 'Produits',
    clients: 'Clients',
    stats: 'Statistiques'
  },
  password: 'MAXI_JDC_2026'
};

// Fonction principale pour traiter les requêtes
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const method = e.parameter.method || e.parameter.action || 'getDashboardData';
    const token = e.parameter.token || e.parameter.password;
    
    // Vérifier le token
    if (token !== CONFIG.password) {
      return createResponse(false, 'Accès non autorisé', null, 401);
    }
    
    let result;
    
    switch(method) {
      case 'getDashboardData':
        result = getDashboardData();
        break;
      case 'getOrderStatus':
        result = getOrderStatus(e.parameter.commande_id, e.parameter.telephone);
        break;
      case 'getOrderHistory':
        result = getOrderHistory(e.parameter.telephone);
        break;
      case 'submitOrder':
        result = submitOrder(e.parameter.payload);
        break;
      case 'updateStock':
        result = updateStock(e.parameter.product_code, e.parameter.new_stock);
        break;
      case 'getLowStock':
        result = getLowStock();
        break;
      case 'getRecentOrders':
        result = getRecentOrders();
        break;
      case 'getSalesStats':
        result = getSalesStats();
        break;
      default:
        result = { success: false, error: 'Méthode non reconnue' };
    }
    
    return createResponse(true, 'Requête traitée avec succès', result);
    
  } catch (error) {
    console.error('Erreur API:', error);
    return createResponse(false, error.toString(), null, 500);
  }
}

// Récupérer les données du tableau de bord
function getDashboardData() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  
  // Récupérer les statistiques
  const stats = getSalesStats();
  
  // Récupérer les commandes récentes
  const recentOrders = getRecentOrders();
  
  // Récupérer les produits à faible stock
  const lowStock = getLowStock();
  
  // Préparer les données pour les graphiques
  const charts = {
    sales: getSalesChartData(),
    topProducts: getTopProductsChartData()
  };
  
  return {
    stats: stats,
    charts: charts,
    recentOrders: recentOrders,
    lowStock: lowStock
  };
}

// Récupérer le statut d'une commande
function getOrderStatus(commandeId, telephone) {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.commandes);
  
  if (!sheet) {
    return { success: false, error: 'Feuille Commandes non trouvée' };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Trouver les index des colonnes
  const idIndex = headers.indexOf('ID_Commande');
  const telIndex = headers.indexOf('Telephone');
  const nomIndex = headers.indexOf('Nom_Client');
  const dateIndex = headers.indexOf('Date');
  const statutIndex = headers.indexOf('Statut');
  const totalIndex = headers.indexOf('Total');
  const articlesIndex = headers.indexOf('Articles');
  const adresseIndex = headers.indexOf('Adresse');
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowId = row[idIndex];
    const rowTel = row[telIndex] ? row[telIndex].toString().replace(/\D/g, '') : '';
    const searchTel = telephone.replace(/\D/g, '');
    
    if (rowId === commandeId && rowTel === searchTel) {
      return {
        success: true,
        commande_id: rowId,
        date: row[dateIndex],
        nom: row[nomIndex],
        telephone: row[telIndex],
        adresse: row[adresseIndex],
        articles: row[articlesIndex],
        total: row[totalIndex],
        statut: row[statutIndex] || 'En attente'
      };
    }
  }
  
  return { success: false, error: 'Commande non trouvée' };
}

// Récupérer l'historique des commandes d'un client
function getOrderHistory(telephone) {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.commandes);
  
  if (!sheet) {
    return { success: false, error: 'Feuille Commandes non trouvée' };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const telIndex = headers.indexOf('Telephone');
  const idIndex = headers.indexOf('ID_Commande');
  const dateIndex = headers.indexOf('Date');
  const nomIndex = headers.indexOf('Nom_Client');
  const totalIndex = headers.indexOf('Total');
  const statutIndex = headers.indexOf('Statut');
  const articlesIndex = headers.indexOf('Articles');
  const adresseIndex = headers.indexOf('Adresse');
  
  const searchTel = telephone.replace(/\D/g, '');
  const history = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowTel = row[telIndex] ? row[telIndex].toString().replace(/\D/g, '') : '';
    
    if (rowTel === searchTel) {
      history.push({
        commande_id: row[idIndex],
        date: row[dateIndex],
        nom: row[nomIndex],
        telephone: row[telIndex],
        adresse: row[adresseIndex],
        articles: row[articlesIndex],
        total: row[totalIndex],
        statut: row[statutIndex] || 'En attente'
      });
    }
  }
  
  // Trier par date (plus récent d'abord)
  history.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return {
    success: true,
    history: history,
    count: history.length
  };
}

// Soumettre une nouvelle commande
function submitOrder(payload) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(CONFIG.sheets.commandes);
    
    if (!sheet) {
      return { success: false, error: 'Feuille Commandes non trouvée' };
    }
    
    // Parser le payload
    const orderData = JSON.parse(payload);
    
    // Générer un ID de commande unique
    const date = new Date();
    const commandeId = `CMD-MAXI-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(sheet.getLastRow()).padStart(3, '0')}`;
    
    // Préparer la nouvelle ligne
    const newRow = [
      commandeId,
      date.toISOString(),
      orderData.client_nom || '',
      orderData.client_telephone || '',
      orderData.client_adresse || '',
      orderData.articles || '',
      parseFloat(orderData.sous_total || 0),
      parseFloat(orderData.frais_livraison || 0),
      parseFloat(orderData.total || 0),
      parseFloat(orderData.economies || 0),
      parseFloat(orderData.pourcentage_economies || 0),
      'Nouveau', // Statut
      '', // Notes
      '', // Livreur
      '', // Date livraison
      orderData.timestamp || new Date().toISOString()
    ];
    
    // Ajouter la ligne à la feuille
    sheet.appendRow(newRow);
    
    // Mettre à jour les stocks
    if (orderData.articles) {
      try {
        const articles = JSON.parse(orderData.articles);
        articles.forEach(article => {
          updateStockInBackground(article.code, -article.quantite);
        });
      } catch (e) {
        console.warn('Erreur mise à jour stocks:', e);
      }
    }
    
    // Mettre à jour les statistiques
    updateStatsInBackground(orderData.total || 0);
    
    return {
      success: true,
      commande_id: commandeId,
      message: 'Commande enregistrée avec succès'
    };
    
  } catch (error) {
    console.error('Erreur soumission commande:', error);
    return { success: false, error: error.toString() };
  }
}

// Mettre à jour le stock (fonction interne)
function updateStockInBackground(productCode, quantityChange) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(CONFIG.sheets.produits);
    
    if (!sheet) return;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const codeIndex = headers.indexOf('Code');
    const stockIndex = headers.indexOf('Stock');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][codeIndex] === productCode) {
        const currentStock = parseFloat(data[i][stockIndex]) || 0;
        const newStock = Math.max(0, currentStock + quantityChange);
        sheet.getRange(i + 1, stockIndex + 1).setValue(newStock);
        break;
      }
    }
  } catch (error) {
    console.error('Erreur mise à jour stock:', error);
  }
}

// Mettre à jour les statistiques
function updateStatsInBackground(amount) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(CONFIG.sheets.stats);
    
    if (!sheet) {
      // Créer la feuille si elle n'existe pas
      sheet = ss.insertSheet(CONFIG.sheets.stats);
      sheet.appendRow(['Date', 'Chiffre_affaires', 'Nombre_commandes', 'Valeur_moyenne']);
    }
    
    const today = new Date();
    const dateStr = Utilities.formatDate(today, 'GMT+1', 'yyyy-MM-dd');
    const data = sheet.getDataRange().getValues();
    
    let found = false;
    for (let i = 1; i < data.length; i++) {
      const rowDate = Utilities.formatDate(new Date(data[i][0]), 'GMT+1', 'yyyy-MM-dd');
      if (rowDate === dateStr) {
        // Mettre à jour la ligne existante
        const currentAmount = parseFloat(data[i][1]) || 0;
        const currentCount = parseFloat(data[i][2]) || 0;
        
        sheet.getRange(i + 1, 2).setValue(currentAmount + amount);
        sheet.getRange(i + 1, 3).setValue(currentCount + 1);
        sheet.getRange(i + 1, 4).setValue((currentAmount + amount) / (currentCount + 1));
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Ajouter une nouvelle ligne
      sheet.appendRow([today, amount, 1, amount]);
    }
    
  } catch (error) {
    console.error('Erreur mise à jour stats:', error);
  }
}

// Récupérer les statistiques de vente
function getSalesStats() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.commandes);
  const statsSheet = ss.getSheetByName(CONFIG.sheets.stats);
  
  let totalSales = 0;
  let todayOrders = 0;
  let todayRevenue = 0;
  let totalCustomers = 0;
  let lowStockProducts = 0;
  let averageOrder = 0;
  
  // Calculer le total des ventes
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const totalIndex = headers.indexOf('Total');
    const dateIndex = headers.indexOf('Date');
    const telIndex = headers.indexOf('Telephone');
    
    const today = new Date();
    const todayStr = Utilities.formatDate(today, 'GMT+1', 'yyyy-MM-dd');
    
    const uniqueCustomers = new Set();
    
    for (let i = 1; i < data.length; i++) {
      const rowTotal = parseFloat(data[i][totalIndex]) || 0;
      totalSales += rowTotal;
      
      const rowDate = data[i][dateIndex];
      if (rowDate) {
        const rowDateStr = Utilities.formatDate(new Date(rowDate), 'GMT+1', 'yyyy-MM-dd');
        if (rowDateStr === todayStr) {
          todayOrders++;
          todayRevenue += rowTotal;
        }
      }
      
      const rowTel = data[i][telIndex];
      if (rowTel) {
        uniqueCustomers.add(rowTel.toString());
      }
    }
    
    totalCustomers = uniqueCustomers.size;
    averageOrder = data.length > 1 ? totalSales / (data.length - 1) : 0;
  }
  
  // Compter les produits à faible stock
  const produitsSheet = ss.getSheetByName(CONFIG.sheets.produits);
  if (produitsSheet) {
    const data = produitsSheet.getDataRange().getValues();
    const headers = data[0];
    const stockIndex = headers.indexOf('Stock');
    
    if (stockIndex >= 0) {
      for (let i = 1; i < data.length; i++) {
        const stock = parseFloat(data[i][stockIndex]) || 0;
        if (stock > 0 && stock <= 5) {
          lowStockProducts++;
        }
      }
    }
  }
  
  // Calculer la croissance mensuelle (simplifié)
  const monthlyGrowth = calculateMonthlyGrowth();
  
  return {
    totalSales: totalSales.toFixed(2),
    todayOrders: todayOrders,
    totalCustomers: totalCustomers,
    lowStockProducts: lowStockProducts,
    monthlyGrowth: monthlyGrowth,
    averageOrder: averageOrder.toFixed(2),
    todayRevenue: todayRevenue.toFixed(2)
  };
}

// Calculer la croissance mensuelle
function calculateMonthlyGrowth() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.stats);
  
  if (!sheet || sheet.getLastRow() < 2) {
    return 100; // Croissance par défaut pour le démarrage
  }
  
  const data = sheet.getDataRange().getValues();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  let currentMonthTotal = 0;
  let previousMonthTotal = 0;
  
  for (let i = 1; i < data.length; i++) {
    const rowDate = new Date(data[i][0]);
    const rowAmount = parseFloat(data[i][1]) || 0;
    
    if (rowDate.getMonth() === currentMonth && rowDate.getFullYear() === currentYear) {
      currentMonthTotal += rowAmount;
    } else if (rowDate.getMonth() === (currentMonth - 1 + 12) % 12 && 
               rowDate.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear)) {
      previousMonthTotal += rowAmount;
    }
  }
  
  if (previousMonthTotal === 0) {
    return currentMonthTotal > 0 ? 100 : 0;
  }
  
  const growth = ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
  return Math.round(growth);
}

// Récupérer les données pour le graphique des ventes
function getSalesChartData() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.stats);
  
  const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const data = [0, 0, 0, 0, 0, 0, 0];
  
  if (sheet && sheet.getLastRow() > 1) {
    const sheetData = sheet.getDataRange().getValues();
    
    // Récupérer les 7 derniers jours
    for (let i = Math.max(1, sheetData.length - 7); i < sheetData.length; i++) {
      const rowDate = new Date(sheetData[i][0]);
      const dayOfWeek = rowDate.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
      const amount = parseFloat(sheetData[i][1]) || 0;
      
      // Convertir pour avoir Lundi = 0
      const adjustedDay = (dayOfWeek + 6) % 7;
      if (adjustedDay >= 0 && adjustedDay < 7) {
        data[adjustedDay] += amount;
      }
    }
  }
  
  return {
    labels: labels,
    data: data.map(val => Math.round(val))
  };
}

// Récupérer les données pour le graphique des produits populaires
function getTopProductsChartData() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.commandes);
  
  const productSales = new Map();
  
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const articlesIndex = headers.indexOf('Articles');
    
    for (let i = 1; i < data.length; i++) {
      try {
        const articlesJson = data[i][articlesIndex];
        if (articlesJson) {
          const articles = JSON.parse(articlesJson);
          articles.forEach(article => {
            const productName = article.produit || 'Produit inconnu';
            const quantity = parseInt(article.quantite) || 0;
            
            if (productSales.has(productName)) {
              productSales.set(productName, productSales.get(productName) + quantity);
            } else {
              productSales.set(productName, quantity);
            }
          });
        }
      } catch (e) {
        console.warn('Erreur parsing articles:', e);
      }
    }
  }
  
  // Trier par quantité vendue et prendre les 5 premiers
  const sortedProducts = Array.from(productSales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  return {
    labels: sortedProducts.map(p => p[0]),
    data: sortedProducts.map(p => p[1])
  };
}

// Récupérer les commandes récentes
function getRecentOrders() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.commandes);
  
  const recentOrders = [];
  
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idIndex = headers.indexOf('ID_Commande');
    const dateIndex = headers.indexOf('Date');
    const nomIndex = headers.indexOf('Nom_Client');
    const telIndex = headers.indexOf('Telephone');
    const totalIndex = headers.indexOf('Total');
    const statutIndex = headers.indexOf('Statut');
    
    // Prendre les 10 commandes les plus récentes
    const startRow = Math.max(1, data.length - 10);
    
    for (let i = startRow; i < data.length; i++) {
      recentOrders.push({
        id: data[i][idIndex],
        date: data[i][dateIndex],
        client_name: data[i][nomIndex],
        client_phone: data[i][telIndex],
        total: parseFloat(data[i][totalIndex]) || 0,
        status: data[i][statutIndex] || 'Nouveau'
      });
    }
    
    // Trier par date (plus récent d'abord)
    recentOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  
  return recentOrders;
}

// Récupérer les produits à faible stock
function getLowStock() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.produits);
  
  const lowStock = [];
  
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const codeIndex = headers.indexOf('Code');
    const nomIndex = headers.indexOf('Nom');
    const categorieIndex = headers.indexOf('Categorie');
    const stockIndex = headers.indexOf('Stock');
    const prixIndex = headers.indexOf('Prix');
    
    for (let i = 1; i < data.length; i++) {
      const stock = parseFloat(data[i][stockIndex]) || 0;
      if (stock > 0 && stock <= 5) {
        lowStock.push({
          code: data[i][codeIndex],
          name: data[i][nomIndex],
          category: data[i][categorieIndex],
          stock: stock,
          price: parseFloat(data[i][prixIndex]) || 0
        });
      }
    }
    
    // Trier par stock (le plus bas d'abord)
    lowStock.sort((a, b) => a.stock - b.stock);
  }
  
  return lowStock;
}

// Mettre à jour le stock manuellement
function updateStock(productCode, newStock) {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheets.produits);
  
  if (!sheet) {
    return { success: false, error: 'Feuille Produits non trouvée' };
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const codeIndex = headers.indexOf('Code');
  const stockIndex = headers.indexOf('Stock');
  
  let updated = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][codeIndex] === productCode) {
      sheet.getRange(i + 1, stockIndex + 1).setValue(parseInt(newStock) || 0);
      updated = true;
      break;
    }
  }
  
  if (updated) {
    return { success: true, message: `Stock mis à jour pour ${productCode}: ${newStock}` };
  } else {
    return { success: false, error: `Produit ${productCode} non trouvé` };
  }
}

// Créer une réponse JSON
function createResponse(success, message, data = null, statusCode = 200) {
  const response = {
    success: success,
    message: message,
    data: data
  };
  
  const output = ContentService.createTextOutput(JSON.stringify(response));
  output.setMimeType(ContentService.MimeType.JSON);
  output.setStatusCode(statusCode);
  
  return output;
}

// Fonction d'initialisation (à exécuter une fois)
function initializeSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  
  // Créer la feuille Commandes si elle n'existe pas
  let sheet = ss.getSheetByName(CONFIG.sheets.commandes);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheets.commandes);
    sheet.appendRow([
      'ID_Commande',
      'Date',
      'Nom_Client',
      'Telephone',
      'Adresse',
      'Articles',
      'Sous_total',
      'Frais_livraison',
      'Total',
      'Economies',
      'Pourcentage_economies',
      'Statut',
      'Notes',
      'Livreur',
      'Date_livraison',
      'Timestamp'
    ]);
    
    // Formater l'en-tête
    const headerRange = sheet.getRange(1, 1, 1, 16);
    headerRange.setBackground('#4a86e8')
      .setFontColor('white')
      .setFontWeight('bold');
    
    // Ajuster la largeur des colonnes
    sheet.autoResizeColumns(1, 16);
  }
  
  // Créer la feuille Statistiques si elle n'existe pas
  sheet = ss.getSheetByName(CONFIG.sheets.stats);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheets.stats);
    sheet.appendRow(['Date', 'Chiffre_affaires', 'Nombre_commandes', 'Valeur_moyenne']);
    
    const headerRange = sheet.getRange(1, 1, 1, 4);
    headerRange.setBackground('#4a86e8')
      .setFontColor('white')
      .setFontWeight('bold');
  }
  
  // Créer la feuille Clients si elle n'existe pas
  sheet = ss.getSheetByName(CONFIG.sheets.clients);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheets.clients);
    sheet.appendRow([
      'Nom',
      'Telephone',
      'Adresse',
      'Premiere_commande',
      'Derniere_commande',
      'Total_commandes',
      'Total_depense',
      'Notes'
    ]);
    
    const headerRange = sheet.getRange(1, 1, 1, 8);
    headerRange.setBackground('#4a86e8')
      .setFontColor('white')
      .setFontWeight('bold');
  }
  
  return 'Feuilles initialisées avec succès!';
}

// Tester l'API
function testAPI() {
  const testData = {
    token: CONFIG.password,
    method: 'getDashboardData'
  };
  
  const params = {
    parameter: testData
  };
  
  const result = handleRequest(params);
  return result.getContent();
}
