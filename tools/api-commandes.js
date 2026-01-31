/*********************************
 * API COMMANDES - MAXI JDC MARKET
 * Fix définitif session_id
 *********************************/

// ✅ URL depuis config.js
const API_URL =
  (window.APP_CONFIG && typeof window.APP_CONFIG.getScriptUrl === "function")
    ? window.APP_CONFIG.getScriptUrl()
    : (window.APP_CONFIG?.googleScriptUrl || "https://script.google.com/macros/s/AKfycbziOpsrvIpaFP9CP0tA38CZfwRzHTVTbdzXHVxcK9AxY60GNSltkvN6BedwrbMu4kx6/exec");

// ✅ Token (optionnel selon serveur)
const API_TOKEN = "CHANGE-ME-SECRET-123456";

// Anti double-click client
let sendingOrder = false;

// session storage
const SESSION_KEY = "maxi_jdc_session_id";

/**
 * GET helper
 */
async function getJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`);
  return await resp.json();
}

/**
 * POST helper optimisé pour Google Apps Script
 */
async function postToGoogleScript(payloadObj) {
  if (!API_URL) {
    console.error("❌ API_URL manquante");
    throw new Error("API_URL manquante (config.js).");
  }

  // Vérifier que 'method' est présent
  if (!payloadObj.method) {
    console.error("❌ Paramètre 'method' manquant dans le payload");
    payloadObj.method = 'saveOrder'; // Valeur par défaut
  }

  const formData = new URLSearchParams();
  
  // Ajouter tous les paramètres
  Object.entries(payloadObj || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });

  console.log("🚀 Envoi POST à Google Apps Script");
  console.log("🔗 URL:", API_URL);
  console.log("📦 Payload:", payloadObj);
  console.log("📄 FormData:", formData.toString());

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: formData.toString()
    });

    console.log("📨 Réponse reçue - Status:", resp.status, resp.statusText);
    
    const text = await resp.text();
    console.log("📄 Réponse brute:", text);
    
    try {
      const json = JSON.parse(text);
      console.log("✅ Réponse JSON parsée:", json);
      return json;
    } catch (jsonError) {
      console.warn("⚠️ Réponse non-JSON:", text);
      // Essayer de parser malgré tout si c'est du JSON mal formé
      try {
        // Chercher du JSON dans le texte
        const jsonMatch = text.match(/{.*}/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log("✅ JSON extrait du texte:", parsed);
          return parsed;
        }
      } catch (e) {
        // Ignorer
      }
      
      return { 
        success: false, 
        rawResponse: text,
        message: "Réponse non-JSON du serveur" 
      };
    }
  } catch (error) {
    console.error("❌ Erreur fetch:", error);
    return { 
      success: false, 
      error: error.message,
      message: "Erreur réseau lors de l'envoi" 
    };
  }
}

/**
 * ✅ récupère/assure une session valide
 */
async function ensureSessionId() {
  // Vérifier si on a déjà une session
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing && existing.trim()) {
    console.log("✅ Session existante trouvée:", existing);
    return existing.trim();
  }

  console.log("🔄 Création d'une nouvelle session...");
  
  try {
    // Demander au serveur une nouvelle session
    const url = `${API_URL}?method=startSession&t=${Date.now()}`;
    console.log("🔗 Appel startSession:", url);
    
    const response = await fetch(url);
    const text = await response.text();
    console.log("📄 Réponse startSession brute:", text);
    
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // Essayer d'extraire le JSON
      const match = text.match(/{.*}/s);
      if (match) {
        json = JSON.parse(match[0]);
      } else {
        throw new Error("Réponse non-JSON");
      }
    }
    
    const sid = String(json?.session_id || json?.sessionId || "").trim();
    
    if (json?.success && sid) {
      localStorage.setItem(SESSION_KEY, sid);
      console.log("✅ Nouvelle session créée:", sid);
      return sid;
    }
    
    throw new Error("Session ID non reçu du serveur");
  } catch (error) {
    console.error("❌ Erreur création session:", error);
    
    // Fallback: générer un ID local
    const fallbackId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(SESSION_KEY, fallbackId);
    console.log("⚠️ Session fallback générée:", fallbackId);
    return fallbackId;
  }
}

/*********************************
 * ENVOYER UNE COMMANDE
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  if (sendingOrder) {
    return { 
      success: true, 
      duplicated: true, 
      message: "⏳ Envoi déjà en cours (double clic bloqué)." 
    };
  }
  
  sendingOrder = true;
  console.log("🔄 Début envoi commande...");

  try {
    // ✅ Session obligatoire
    const sid = await ensureSessionId();
    console.log("✅ Session ID à utiliser:", sid);

    // Normaliser les articles
    let articlesFormat = [];
    if (Array.isArray(dataCommande.articles)) {
      articlesFormat = dataCommande.articles.map((item, index) => {
        const q = parseInt(item.quantite || item.qty || item.quantity || 1, 10) || 1;
        const pu = parseFloat(item.prix_unitaire || item.prix || item.price || 0) || 0;
        const total = parseFloat((q * pu).toFixed(2));
        
        return {
          id: item.id || `item_${index}`,
          produit: item.produit || item.nom || item.name || `Produit ${index + 1}`,
          quantite: q,
          prix_unitaire: pu,
          prix_total: total,
          remarque: item.remarque || ""
        };
      });
    }

    // Calculer le total
    let total = parseFloat(dataCommande.total || 0);
    if ((!total || total === 0) && articlesFormat.length > 0) {
      total = articlesFormat.reduce((sum, it) => sum + (Number(it.prix_total) || 0), 0);
    }

    console.log("📊 Articles formatés:", articlesFormat);
    console.log("💰 Total calculé:", total);

    // Préparer le payload pour Google Apps Script
    const payload = {
      method: 'saveOrder',  // ✅ DOIT être 'method' pour Google Apps Script
      token: API_TOKEN,
      session_id: sid,

      // Informations client
      nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.client || "",
      telephone: dataCommande.telephone || dataCommande.phone || "",
      adresse: dataCommande.adresse || dataCommande.address || "",
      gps: dataCommande.gps || dataCommande.localisation || "",
      notes: dataCommande.notes || dataCommande.remarques || "",

      // Articles (sérialisés en JSON)
      articles: JSON.stringify(articlesFormat),
      
      // Totaux
      total: total.toFixed(2),
      sous_total: (total * 0.8).toFixed(2), // Exemple de calcul
      livraison: dataCommande.frais_livraison || "0.00",
      
      // Métadonnées
      date: new Date().toISOString(),
      source: "site_web",
      version: "1.0"
    };

    console.log("🎯 Payload final pour envoi:", payload);

    // Envoyer la commande
    const result = await postToGoogleScript(payload);
    
    // Gérer les réponses spécifiques
    if (result?.requires_session || result?.session_expired) {
      console.warn("⚠️ Session expirée, tentative de renouvellement...");
      localStorage.removeItem(SESSION_KEY);
      const newSid = await ensureSessionId();
      payload.session_id = newSid;
      
      // Réessayer une fois avec la nouvelle session
      const retryResult = await postToGoogleScript(payload);
      return retryResult;
    }
    
    // Log du résultat
    if (result.success) {
      console.log("✅ Commande envoyée avec succès!");
      if (result.order_id) {
        console.log("🆔 Numéro de commande:", result.order_id);
      }
    } else {
      console.error("❌ Échec envoi commande:", result.message || result.error);
    }
    
    return result;
    
  } catch (error) {
    console.error("❌ Erreur fatale dans envoyerCommande:", error);
    return {
      success: false,
      error: error.message,
      message: "Erreur technique lors de l'envoi de la commande",
      timestamp: new Date().toISOString()
    };
  } finally {
    sendingOrder = false;
    console.log("🏁 Fin processus envoi commande");
  }
}

/*********************************
 * TEST API
 *********************************/
export async function testerConnexionAPI() {
  console.log("🧪 Test connexion API...");
  
  try {
    const url = `${API_URL}?method=test&t=${Date.now()}`;
    console.log("🔗 URL test:", url);
    
    const response = await fetch(url);
    const text = await response.text();
    console.log("📄 Réponse test brute:", text);
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      const match = text.match(/{.*}/s);
      data = match ? JSON.parse(match[0]) : { success: false, message: "Réponse non-JSON" };
    }
    
    const result = { 
      connecte: !!data.success, 
      message: data.message, 
      details: data.details, 
      url: API_URL,
      raw: text
    };
    
    console.log("📊 Résultat test:", result);
    return result;
    
  } catch (error) {
    console.error("❌ Erreur test API:", error);
    return {
      connecte: false,
      message: `Erreur: ${error.message}`,
      url: API_URL,
      error: error.toString()
    };
  }
}

/*********************************
 * FONCTIONS UTILITAIRES
 *********************************/

/**
 * Obtenir la session courante
 */
export function getCurrentSessionId() {
  return localStorage.getItem(SESSION_KEY) || null;
}

/**
 * Réinitialiser la session (déconnexion)
 */
export function resetSession() {
  const oldId = localStorage.getItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  console.log("🔄 Session réinitialisée. Ancien ID:", oldId);
  return ensureSessionId(); // Crée une nouvelle session
}

/**
 * Vérifier si une commande est en cours d'envoi
 */
export function isSendingOrder() {
  return sendingOrder;
}

/**
 * Fonction de debug pour tester rapidement
 */
export async function testCommandeRapide() {
  const commandeTest = {
    nom_client: "Client Test",
    telephone: "123456789",
    adresse: "123 Rue Test, Tunis",
    articles: [
      { produit: "Café 250g", quantite: 2, prix_unitaire: 12.5 },
      { produit: "Thé Vert 100g", quantite: 1, prix_unitaire: 8.75 },
      { produit: "Biscuits Chocolat", quantite: 3, prix_unitaire: 4.25 }
    ],
    notes: "Commande de test depuis la console"
  };
  
  console.log("🧪 Début test commande rapide...");
  const result = await envoyerCommande(commandeTest);
  console.log("📊 Résultat test:", result);
  return result;
}

// Debug config
if (typeof window !== 'undefined') {
  if (!window.APP_CONFIG) {
    console.warn("⚠️ config.js non chargé. Vérifie le chemin vers tools/config.js");
    console.warn("⚠️ URL API utilisée:", API_URL);
  } else {
    console.log("✅ config.js chargé");
    console.log("🔗 API_URL =", API_URL);
    
    // Initialiser la session au chargement (silencieusement)
    setTimeout(() => {
      ensureSessionId()
        .then(sid => console.log("✅ Session initialisée:", sid))
        .catch(e => console.warn("⚠️ Initialisation session échouée:", e.message));
    }, 1000);
  }
  
  // Exposer les fonctions pour débogage dans la console
  window.API_COMMANDES = {
    envoyerCommande,
    testerConnexionAPI,
    testCommandeRapide,
    getCurrentSessionId,
    resetSession,
    isSendingOrder,
    ensureSessionId,
    API_URL,
    API_TOKEN
  };
  
  console.log("🔧 API Commandes chargée. Utilisez window.API_COMMANDES pour tester.");
}

export default {
  envoyerCommande,
  testerConnexionAPI,
  testCommandeRapide,
  getCurrentSessionId,
  resetSession,
  isSendingOrder,
  ensureSessionId
};
