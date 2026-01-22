// api-commandes.js - MAXI JDC MARKET
const COMMANDE_API_URL = 'https://script.google.com/macros/s/AKfycbxEWUPEZheffRy-reuGbYTSYInYYu0ENwWCTD8Gt896cxmGwO_jaZtWMnoSuQ5AHBH0/exec';

// ===================== FONCTIONS API =====================

/**
 * Récupère le statut d'une commande depuis l'API
 * @param {string} commandeId - ID de la commande (ex: CMD-MAXI-20260122-001)
 * @param {string} telephone - Téléphone du client (8 chiffres)
 * @returns {Promise<Object>} Données de la commande
 */
async function getOrderStatus(commandeId, telephone) {
    try {
        console.log(`🔍 Recherche commande: ${commandeId}, tel: ${telephone}`);
        
        const response = await fetch(
            `${COMMANDE_API_URL}?method=getOrderStatus&commande_id=${encodeURIComponent(commandeId)}&telephone=${encodeURIComponent(telephone)}&t=${Date.now()}`
        );
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 Données reçues:', data);
        
        if (!data.success) {
            throw new Error(data.error || "Commande non trouvée");
        }
        
        // Formater la réponse
        return {
            success: true,
            commande_id: data.commande_id || commandeId,
            date: data.date || new Date().toISOString(),
            nom: data.nom || 'Non spécifié',
            telephone: data.telephone || telephone,
            adresse: data.adresse || 'Non spécifiée',
            articles: data.articles || 'Aucun détail',
            total: parseFloat(data.total) || 0,
            statut: data.statut || 'En attente',
            raw: data // Garder les données brutes
        };
        
    } catch (error) {
        console.error('❌ Erreur getOrderStatus:', error);
        return {
            success: false,
            error: error.message,
            commande_id: commandeId,
            statut: 'Non trouvé'
        };
    }
}

/**
 * Récupère l'historique des commandes d'un client
 * @param {string} telephone - Téléphone du client (8 chiffres)
 * @returns {Promise<Object>} Historique des commandes
 */
async function getOrderHistory(telephone) {
    try {
        console.log(`📜 Recherche historique pour tel: ${telephone}`);
        
        const response = await fetch(
            `${COMMANDE_API_URL}?method=getOrderHistory&telephone=${encodeURIComponent(telephone)}&t=${Date.now()}`
        );
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📜 Historique reçu:', data);
        
        if (!data.success) {
            throw new Error(data.error || "Aucun historique trouvé");
        }
        
        return {
            success: true,
            history: data.history || [],
            count: data.history ? data.history.length : 0
        };
        
    } catch (error) {
        console.error('❌ Erreur getOrderHistory:', error);
        return {
            success: false,
            error: error.message,
            history: [],
            count: 0
        };
    }
}

/**
 * Enregistre une nouvelle commande (méthode POST)
 * @param {Object} orderData - Données complètes de la commande
 * @returns {Promise<Object>} Résultat
 */
async function submitOrder(orderData) {
    try {
        console.log('📤 Envoi commande:', orderData);
        
        // Formater les données pour l'API
        const payload = {
            action: 'submit',
            token: 'MAXI_JDC_2026',
            timestamp: new Date().toISOString(),
            ...orderData
        };
        
        const response = await fetch(COMMANDE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        console.log('📥 Réponse submitOrder:', data);
        
        return {
            success: data.success || false,
            message: data.message || 'Commande enregistrée',
            commande_id: data.commande_id,
            raw: data
        };
        
    } catch (error) {
        console.error('❌ Erreur submitOrder:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Enregistre une commande avec JSONP (fallback pour CORS)
 * @param {Object} orderData - Données de la commande
 * @returns {Promise<Object>} Résultat
 */
function submitOrderJsonp(orderData) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Date.now();
        
        // Préparer l'URL
        const payload = {
            action: 'submit',
            token: 'MAXI_JDC_2026',
            timestamp: new Date().toISOString(),
            ...orderData
        };
        
        const url = `${COMMANDE_API_URL}?payload=${encodeURIComponent(JSON.stringify(payload))}&callback=${callbackName}`;
        
        console.log('📤 JSONP URL:', url);
        
        // Créer le script
        const script = document.createElement('script');
        script.src = url;
        
        // Définir la fonction callback
        window[callbackName] = function(data) {
            console.log('📥 Réponse JSONP:', data);
            
            // Nettoyer
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            
            resolve({
                success: data.success || false,
                message: data.message || 'Commande enregistrée via JSONP',
                commande_id: data.commande_id,
                raw: data
            });
        };
        
        // Gestion d'erreur
        script.onerror = function() {
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            
            reject(new Error('Erreur réseau JSONP'));
        };
        
        // Timeout
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error('Timeout JSONP'));
            }
        }, 10000);
        
        document.body.appendChild(script);
    });
}

/**
 * Teste la connexion à l'API
 * @returns {Promise<boolean>} True si l'API répond
 */
async function testAPI() {
    try {
        const response = await fetch(`${COMMANDE_API_URL}?method=test&t=${Date.now()}`);
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error('❌ Test API échoué:', error);
        return false;
    }
}

// ===================== FONCTIONS UTILITAIRES =====================

/**
 * Formate les données pour l'envoi d'une commande
 * @param {Object} cart - Panier
 * @param {Object} user - Utilisateur
 * @param {Object} totals - Totaux
 * @returns {Object} Données formatées
 */
function formatOrderData(cart, user, totals) {
    // Convertir le panier en format texte lisible
    const articles = Object.values(cart).map(item => {
        const ligne = `${item.quantity}x ${item.name} (${item.code})`;
        const prix = `${formatPrice(item.price)} × ${item.quantity} = ${formatPrice(item.price * item.quantity)}`;
        
        if (item.isPromotion && item.oldPrice) {
            const economie = item.oldPrice - item.price;
            const totalEconomie = economie * item.quantity;
            return `${ligne}\n  ${prix}\n  💰 ÉCONOMIE: ${formatPrice(totalEconomie)} (ancien: ${formatPrice(item.oldPrice * item.quantity)})`;
        }
        
        return `${ligne}\n  ${prix}`;
    }).join('\n\n');
    
    // Générer un ID de commande
    const now = new Date();
    const commandeId = `CMD-MAXI-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;
    
    return {
        commande_id: commandeId,
        client_nom: user.name || '',
        client_telephone: user.phone.replace(/\D/g, '') || '',
        client_adresse: user.address || '',
        articles: articles,
        sous_total: totals.subtotal.toFixed(2),
        frais_livraison: totals.shipping.toFixed(2),
        total: totals.total.toFixed(2),
        economies: totals.savings ? totals.savings.toFixed(2) : '0.00',
        pourcentage_economies: totals.savingsPercentage || 0,
        statut: 'NOUVEAU',
        date_commande: now.toISOString(),
        gps_lat: user.lat || '',
        gps_lng: user.lng || ''
    };
}

/**
 * Formate un prix
 * @param {number} amount - Montant
 * @returns {string} Prix formaté
 */
function formatPrice(amount) {
    return Number(amount).toFixed(2).replace('.', ',') + ' dt';
}

/**
 * Vérifie si un numéro de commande a un format valide
 * @param {string} commandeId - ID de commande
 * @returns {boolean} True si valide
 */
function isValidCommandeId(commandeId) {
    return /^CMD-MAXI-\d{8}-\d{3,4}$/.test(commandeId);
}

/**
 * Nettoie un numéro de téléphone
 * @param {string} phone - Numéro de téléphone
 * @returns {string} Numéro nettoyé
 */
function cleanPhoneNumber(phone) {
    return phone.replace(/\D/g, '').slice(-8); // Garder les 8 derniers chiffres
}

// ===================== EXPORT =====================

window.CommandeAPI = {
    // Fonctions principales
    getOrderStatus,
    getOrderHistory,
    submitOrder,
    submitOrderJsonp,
    testAPI,
    
    // Fonctions utilitaires
    formatOrderData,
    formatPrice,
    isValidCommandeId,
    cleanPhoneNumber,
    
    // Constantes
    API_URL: COMMANDE_API_URL
};

console.log('✅ API Commandes chargée - URL:', COMMANDE_API_URL);
