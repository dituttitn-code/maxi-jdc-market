/*********************************
 * API COMMANDES - MAXI JDC MARKET
 * Version simplifiée - Pas de modules
 *********************************/

// Variables globales
let sendingOrder = false;
const SESSION_KEY = "maxi_jdc_session_id";

// Fonction pour obtenir l'URL API
function getAPIUrl() {
  if (!window.APP_CONFIG) {
    console.error("❌ APP_CONFIG non défini");
    throw new Error("config.js non chargé");
  }
  
  const url = window.APP_CONFIG.googleScriptUrl;
  if (!url) {
    throw new Error("URL API non configurée");
  }
  
  return url;
}

// Fonction pour obtenir le token
function getAPIToken() {
  return window.APP_CONFIG?.apiToken || "CHANGE-ME-SECRET-123456";
}

// Gestion de session
async function ensureSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing && existing.trim()) {
    return existing.trim();
  }

  try {
    const API_URL = getAPIUrl();
    const url = `${API_URL}?method=startSession&t=${Date.now()}`;
    const response = await fetch(url);
    const text = await response.text();
    
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      const match = text.match(/{[\s\S]*}/);
      json = match ? JSON.parse(match[0]) : {};
    }
    
    const sid = String(json?.session_id || "").trim();
    if (json?.success && sid) {
      localStorage.setItem(SESSION_KEY, sid);
      return sid;
    }
  } catch (error) {
    console.warn("Erreur session:", error);
  }
  
  const fallbackId = 'local_' + Date.now();
  localStorage.setItem(SESSION_KEY, fallbackId);
  return fallbackId;
}

// Tester la connexion API
async function testerConnexionAPI() {
  try {
    const API_URL = getAPIUrl();
    const url = `${API_URL}?method=test&t=${Date.now()}`;
    const response = await fetch(url);
    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      const match = text.match(/{[\s\S]*}/);
      data = match ? JSON.parse(match[0]) : { success: false };
    }
    
    return { 
      connecte: !!data.success, 
      message: data.message || "Pas de message", 
      details: data.details,
      url: API_URL
    };
  } catch (error) {
    return { connecte: false, message: `Erreur: ${error.message}` };
  }
}

// Envoyer une commande
async function envoyerCommande(dataCommande) {
  if (sendingOrder) {
    return { success: true, duplicated: true, message: "⏳ Envoi déjà en cours" };
  }
  sendingOrder = true;

  try {
    const API_URL = getAPIUrl();
    const API_TOKEN = getAPIToken();
    const sid = await ensureSessionId();
    
    // Préparer les articles
    const articlesFormat = Array.isArray(dataCommande.articles) 
      ? dataCommande.articles.map(item => ({
          produit: item.produit || item.nom || "",
          quantite: parseInt(item.quantite || 1),
          prix_unitaire: parseFloat(item.prix_unitaire || 0),
          prix_total: parseFloat(((item.quantite || 1) * (item.prix_unitaire || 0)).toFixed(2))
        }))
      : [];

    const total = articlesFormat.reduce((sum, it) => sum + it.prix_total, 0);

    // Préparer les données POST
    const formData = new URLSearchParams();
    formData.append('method', 'saveOrder');
    formData.append('token', API_TOKEN);
    formData.append('session_id', sid);
    formData.append('nom_client', dataCommande.nom_client || "");
    formData.append('telephone', dataCommande.telephone || "");
    formData.append('adresse', dataCommande.adresse || "");
    formData.append('articles', JSON.stringify(articlesFormat));
    formData.append('total', total.toFixed(2));
    formData.append('date', new Date().toISOString());

    // Envoyer la requête
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });

    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/{[\s\S]*}/);
      return match ? JSON.parse(match[0]) : { success: false, raw: text };
    }
  } finally {
    sendingOrder = false;
  }
}

// Fonctions utilitaires
function getCurrentSessionId() {
  return localStorage.getItem(SESSION_KEY) || null;
}

function resetSession() {
  localStorage.removeItem(SESSION_KEY);
  return ensureSessionId();
}

function isSendingOrder() {
  return sendingOrder;
}

async function testCommandeRapide() {
  const commandeTest = {
    nom_client: "Client Test",
    telephone: "123456789",
    adresse: "Test Adresse",
    articles: [
      { produit: "Produit Test 1", quantite: 2, prix_unitaire: 10.5 },
      { produit: "Produit Test 2", quantite: 1, prix_unitaire: 25.0 }
    ]
  };
  
  console.log("🧪 Test commande...");
  const result = await envoyerCommande(commandeTest);
  console.log("📊 Résultat:", result);
  return result;
}

// Initialisation et exposition
(function init() {
  // Vérifier la configuration
  if (!window.APP_CONFIG) {
    console.error("⚠️ APP_CONFIG non trouvé. Chargez config.js avant api-commandes.js");
  } else {
    console.log("✅ config.js détecté, URL:", window.APP_CONFIG.googleScriptUrl);
    
    // Initialiser la session
    setTimeout(() => {
      ensureSessionId()
        .then(sid => console.log("✅ Session:", sid))
        .catch(e => console.warn("⚠️ Session:", e));
    }, 1000);
  }
  
  // Exposer les fonctions globalement
  window.API_COMMANDES = {
    envoyerCommande,
    testerConnexionAPI,
    testCommandeRapide,
    getCurrentSessionId,
    resetSession,
    isSendingOrder,
    ensureSessionId,
    getAPIUrl,
    getAPIToken
  };
  
  console.log("🔧 API Commandes chargée. Testez avec: window.API_COMMANDES.testerConnexionAPI()");
})();
