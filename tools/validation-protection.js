// validation-protection.js - PROTECTION ANTI-DOUBLON POUR MAXI JDC MARKET
// À placer dans le même dossier que vos fichiers HTML



let sessionId = null;
let isSubmitting = false;
let submitTimeout = null;

// 1. INITIALISATION - AU CHARGEMENT DE LA PAGE
function initValidationSystem() {
    console.log('🚀 Initialisation système de validation...');
    
    // Vérifier si l'URL est configurée
    if (!SCRIPT_URL || SCRIPT_URL.includes('AKfycbw-gHqEjb1RmcL14F165QAzu96pkZxpdTS3Ms1jaVWpehJnU0nkp1iH_izqj4xMHo_a')) {
        console.warn('⚠️ URL Google Apps Script non configurée dans config.js');
    }
    
    // Vérifier si on est sur une page de commande
    if (!isOrderPage()) {
        console.log('📄 Page non concernée, protection inactive');
        return;
    }
    
    // Générer ou récupérer une session
    loadOrCreateSession();
    
    // Protéger le bouton de validation
    setTimeout(protectSubmitButton, 500);
}

// 2. VÉRIFIER SI C'EST UNE PAGE DE COMMANDE
function isOrderPage() {
    const path = window.location.pathname.toLowerCase();
    const page = path.substring(path.lastIndexOf('/') + 1);
    
    // Pages qui ont besoin de la protection
    const orderPages = [
        'validation-commande.html',
        'commander.html',
        'index.html',
        'commande.html',
        'panier.html'
    ];
    
    return orderPages.includes(page) || 
           document.querySelector('button:contains("Valider"), button:contains("Envoyer")') !== null;
}

// 3. CHARGER OU CRÉER UNE SESSION
async function loadOrCreateSession() {
    // Récupérer session existante
    sessionId = localStorage.getItem('maxi_jdc_session');
    
    if (sessionId) {
        console.log('🔍 Session existante:', sessionId.substring(0, 10) + '...');
        await checkSessionStatus();
    } else {
        await createNewSession();
    }
    
    // Afficher l'info de session (debug)
    showSessionInfo();
}

// 4. CRÉER UNE NOUVELLE SESSION
async function createNewSession() {
    try {
        console.log('🆕 Création nouvelle session...');
        
        const response = await fetch(`${SCRIPT_URL}?action=generatesession`);
        const data = await response.json();
        
        if (data.success) {
            sessionId = data.session_id;
            localStorage.setItem('maxi_jdc_session', sessionId);
            console.log('✅ Session créée:', sessionId.substring(0, 10) + '...');
            
            // Marquer comme non validée
            localStorage.setItem('maxi_jdc_validated', 'false');
        } else {
            console.error('❌ Erreur création session:', data);
        }
    } catch (error) {
        console.error('❌ Erreur réseau création session:', error);
        // Fallback: générer un ID local
        sessionId = 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('maxi_jdc_session', sessionId);
        localStorage.setItem('maxi_jdc_validated', 'false');
    }
}

// 5. VÉRIFIER LE STATUT DE LA SESSION
async function checkSessionStatus() {
    if (!sessionId) return;
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=validatesession&session_id=${sessionId}`);
        const data = await response.json();
        
        if (data.success) {
            if (data.already_validated) {
                console.log('ℹ️ Session déjà validée');
                localStorage.setItem('maxi_jdc_validated', 'true');
            } else {
                localStorage.setItem('maxi_jdc_validated', 'false');
            }
        }
    } catch (error) {
        console.error('❌ Erreur vérification session:', error);
    }
}

// 6. PROTÉGER LE BOUTON DE SOUMISSION
function protectSubmitButton() {
    console.log('🛡️ Recherche du bouton de validation...');
    
    // Chercher le bouton "Valider et envoyer" dans votre interface
    const button = findSubmitButton();
    
    if (!button) {
        console.error('❌ Bouton de validation non trouvé');
        showError('Bouton de validation non trouvé');
        return;
    }
    
    console.log('✅ Bouton trouvé:', button.textContent);
    
    // Sauvegarder l'état original
    const originalState = {
        onclick: button.onclick,
        text: button.innerHTML,
        disabled: button.disabled,
        bgColor: button.style.backgroundColor || ''
    };
    
    // Vérifier si la session est déjà validée
    const alreadyValidated = localStorage.getItem('maxi_jdc_validated') === 'true';
    
    if (alreadyValidated) {
        disableButton(button, '✅ Déjà validé', '#e0e0e0');
        showInfo('Cette commande a déjà été validée.');
        return;
    }
    
    // Ajouter l'indicateur visuel
    if (!button.innerHTML.includes('🔒')) {
        button.innerHTML = '🔒 ' + button.innerHTML.replace('🔒 ', '');
    }
    
    // Remplacer l'action du bouton
    button.onclick = async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('🖱️ Clic sur bouton protégé');
        
        // Prévenir les clics multiples
        if (isSubmitting) {
            console.log('⏳ Déjà en cours de soumission');
            return false;
        }
        
        // Désactiver immédiatement
        isSubmitting = true;
        disableButton(button, '⏳ Validation en cours...', '#ff9800');
        
        // Timeout de sécurité
        submitTimeout = setTimeout(() => {
            if (isSubmitting) {
                resetButton(button, originalState);
                isSubmitting = false;
                showError('Délai dépassé. Réessayez.');
            }
        }, 30000);
        
        try {
            // Vérifier la session
            if (!sessionId) {
                await loadOrCreateSession();
            }
            
            const canValidate = await validateSession();
            
            if (!canValidate) {
                clearTimeout(submitTimeout);
                disableButton(button, '✅ Déjà validé', '#e0e0e0');
                localStorage.setItem('maxi_jdc_validated', 'true');
                showInfo('Cette commande a déjà été validée.');
                isSubmitting = false;
                return false;
            }
            
            // Préparer les données
            const orderData = collectOrderData();
            orderData.session_id = sessionId; // ← ESSENTIEL: ajouter le session_id
            
            console.log('📤 Données à envoyer:', orderData);
            
            // Envoyer la commande
            const result = await sendOrder(orderData);
            
            clearTimeout(submitTimeout);
            
            if (result.success) {
                // SUCCÈS
                disableButton(button, '✅ Commande envoyée', '#4CAF50');
                localStorage.setItem('maxi_jdc_validated', 'true');
                
                showSuccess(
                    `Commande #${result.commande_id} validée !<br>
                    Total: ${result.total} dt`
                );
                
                // Mettre à jour l'affichage si possible
                updateOrderDisplay(result.commande_id);
                
                // Exécuter l'action originale si nécessaire
                if (typeof originalState.onclick === 'function') {
                    setTimeout(originalState.onclick, 1000);
                }
                
            } else {
                // ÉCHEC
                handleSubmissionError(result, button, originalState);
            }
            
            isSubmitting = false;
            
        } catch (error) {
            // ERREUR RÉSEAU
            clearTimeout(submitTimeout);
            console.error('❌ Erreur:', error);
            
            resetButton(button, originalState);
            isSubmitting = false;
            
            showError('Erreur réseau. Vérifiez votre connexion.');
        }
        
        return false;
    };
    
    console.log('✅ Bouton protégé avec succès');
}

// 7. TROUVER LE BOUTON DE VALIDATION
function findSubmitButton() {
    // Priorité 1: Bouton avec texte spécifique
    const buttons = document.querySelectorAll('button');
    
    for (const button of buttons) {
        const text = button.textContent.toLowerCase();
        if (text.includes('valider et envoyer') || 
            text.includes('valider la commande') ||
            text.includes('confirmer la commande')) {
            return button;
        }
    }
    
    // Priorité 2: Bouton avec ID spécifique
    const buttonIds = ['btn-valider', 'btn-envoyer', 'valider-commande', 'submit-order'];
    
    for (const id of buttonIds) {
        const button = document.getElementById(id);
        if (button) return button;
    }
    
    // Priorité 3: Premier bouton avec "Valider" ou "Envoyer"
    for (const button of buttons) {
        const text = button.textContent.toLowerCase();
        if (text.includes('valider') || text.includes('envoyer')) {
            return button;
        }
    }
    
    // Priorité 4: Bouton dans un formulaire
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) return submitBtn;
    }
    
    return null;
}

// 8. VALIDER LA SESSION AVANT ENVOI
async function validateSession() {
    if (!sessionId) return false;
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=validatesession&session_id=${sessionId}`);
        const data = await response.json();
        
        return data.success && data.can_validate;
    } catch (error) {
        console.error('❌ Erreur validation session:', error);
        return true; // Permettre en cas d'erreur
    }
}

// 9. COLLECTER LES DONNÉES DE COMMANDE (ADAPTÉ À VOTRE INTERFACE)
function collectOrderData() {
    // ADAPTEZ CES FONCTIONS À VOTRE HTML
    
    const data = {
        nom_client: getClientName(),
        telephone: getClientPhone(),
        adresse: getClientAddress(),
        articles: getArticles(),
        total: getTotal()
    };
    
    // Nettoyer le total
    if (data.total) {
        data.total = data.total.replace(/[^\d.,]/g, '').replace(',', '.');
    }
    
    return data;
}

// Fonctions d'extraction (à adapter)
function getClientName() {
    // Chercher le nom du client
    const elements = [
        document.getElementById('client-nom'),
        document.getElementById('nom-client'),
        document.querySelector('[name="nom"]'),
        document.querySelector('.client-nom'),
        document.querySelector('.nom-client')
    ];
    
    for (const el of elements) {
        if (el) return el.textContent || el.value || 'Client';
    }
    
    return 'Client';
}

function getClientPhone() {
    const elements = [
        document.getElementById('client-telephone'),
        document.getElementById('telephone'),
        document.querySelector('[name="telephone"]'),
        document.querySelector('[name="tel"]'),
        document.querySelector('.telephone')
    ];
    
    for (const el of elements) {
        if (el) return el.textContent || el.value || '';
    }
    
    return '';
}

function getClientAddress() {
    const elements = [
        document.getElementById('client-adresse'),
        document.getElementById('adresse'),
        document.querySelector('[name="adresse"]'),
        document.querySelector('.adresse')
    ];
    
    for (const el of elements) {
        if (el) return el.textContent || el.value || '';
    }
    
    return '';
}

function getArticles() {
    // Chercher le conteneur d'articles
    const containers = [
        document.getElementById('articles-list'),
        document.getElementById('panier'),
        document.querySelector('.articles-list'),
        document.querySelector('.panier'),
        document.querySelector('.items-list')
    ];
    
    for (const container of containers) {
        if (container) {
            // Nettoyer le texte
            let text = container.textContent || container.innerText;
            
            // Enlever les totaux et calculs
            text = text.replace(/TOTAL.*/gi, '')
                      .replace(/Sous-total.*/gi, '')
                      .replace(/Livraison.*/gi, '')
                      .trim();
            
            return text;
        }
    }
    
    // Fallback: collecter les articles individuels
    const items = document.querySelectorAll('.article-item, .product-item, .item');
    if (items.length > 0) {
        return Array.from(items)
            .map(item => item.textContent.trim())
            .filter(text => text && !text.toLowerCase().includes('total'))
            .join('\n');
    }
    
    return 'Articles non spécifiés';
}

function getTotal() {
    const elements = [
        document.getElementById('total-commande'),
        document.getElementById('total'),
        document.getElementById('montant-total'),
        document.querySelector('.total-amount'),
        document.querySelector('[class*="total"]')
    ];
    
    for (const el of elements) {
        if (el) {
            const text = el.textContent || el.innerText;
            const match = text.match(/[\d,\.]+/);
            return match ? match[0] : '0';
        }
    }
    
    return '0';
}

// 10. ENVOYER LA COMMANDE
async function sendOrder(orderData) {
    console.log('📨 Envoi vers:', SCRIPT_URL);
    
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
    });
    
    return await response.json();
}

// 11. GÉRER LES ERREURS DE SOUMISSION
function handleSubmissionError(result, button, originalState) {
    if (result.already_validated) {
        disableButton(button, '✅ Déjà validé', '#e0e0e0');
        localStorage.setItem('maxi_jdc_validated', 'true');
        showInfo('Cette commande a déjà été validée.');
    } else if (result.requires_session) {
        // Problème de session
        resetButton(button, originalState);
        showError('Problème de session. Rechargez la page.');
        // Forcer une nouvelle session
        localStorage.removeItem('maxi_jdc_session');
        localStorage.removeItem('maxi_jdc_validated');
        setTimeout(() => location.reload(), 2000);
    } else {
        // Autre erreur
        resetButton(button, originalState);
        showError(result.message || 'Erreur inconnue. Réessayez.');
    }
}

// 12. METTRE À JOUR L'AFFICHAGE
function updateOrderDisplay(commandeId) {
    const elements = [
        document.getElementById('commande-numero'),
        document.getElementById('order-id'),
        document.querySelector('.commande-numero'),
        document.querySelector('.order-id')
    ];
    
    for (const el of elements) {
        if (el) {
            el.textContent = commandeId;
            break;
        }
    }
}

// 13. FONCTIONS UTILITAIRES
function disableButton(button, text, color) {
    button.disabled = true;
    button.innerHTML = text;
    button.style.backgroundColor = color;
    button.style.cursor = 'not-allowed';
}

function resetButton(button, originalState) {
    button.disabled = originalState.disabled;
    button.innerHTML = originalState.text;
    button.style.backgroundColor = originalState.bgColor;
    button.style.cursor = '';
}

function showSessionInfo() {
    // Pour debug: afficher l'info de session
    if (window.location.hash === '#debug') {
        const info = document.createElement('div');
        info.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 10px;
            z-index: 9999;
        `;
        info.innerHTML = `Session: ${sessionId ? sessionId.substring(0, 10) + '...' : 'none'}`;
        document.body.appendChild(info);
    }
}

// 14. FONCTIONS DE NOTIFICATION
function showSuccess(message) {
    showNotification(message, '#4CAF50');
}

function showError(message) {
    showNotification(message, '#F44336');
}

function showInfo(message) {
    showNotification(message, '#2196F3');
}

function showNotification(message, color) {
    // Supprimer les notifications existantes
    const oldNotifications = document.querySelectorAll('.validation-notification');
    oldNotifications.forEach(n => n.remove());
    
    // Créer la nouvelle notification
    const notification = document.createElement('div');
    notification.className = 'validation-notification';
    notification.innerHTML = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Masquer après 5 secondes
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// 15. AJOUTER LES STYLES CSS
function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        button:disabled {
            cursor: not-allowed !important;
            opacity: 0.7 !important;
        }
        
        .protected-button {
            position: relative;
        }
        
        .protected-button::before {
            content: "🔒";
            margin-right: 5px;
        }
    `;
    document.head.appendChild(style);
}

// 16. FONCTION DE RÉINITIALISATION (pour tests)
function resetValidation() {
    localStorage.removeItem('maxi_jdc_session');
    localStorage.removeItem('maxi_jdc_validated');
    sessionId = null;
    location.reload();
}

// 17. INITIALISATION AU CHARGEMENT
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Page chargée, démarrage protection...');
    
    // Vérifier si config.js a été chargé
    if (!window.APP_CONFIG) {
        console.warn('⚠️ config.js non chargé. Assurez-vous que <script src="config.js"></script> est présent avant ce script.');
    }
    
    // Ajouter les styles
    addStyles();
    
    // Initialiser le système
    initValidationSystem();
    
    // Ajouter un bouton de debug si besoin
    if (window.location.hash === '#debug') {
        const debugBtn = document.createElement('button');
        debugBtn.textContent = '🔄 Debug: Réinitialiser';
        debugBtn.onclick = resetValidation;
        debugBtn.style.cssText = `
            position: fixed;
            bottom: 50px;
            right: 20px;
            background: #FF9800;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
            z-index: 9999;
            font-size: 11px;
        `;
        document.body.appendChild(debugBtn);
    }
});

// Exposer les fonctions pour debug
window.maxiValidation = {
    reset: resetValidation,
    getSessionId: () => sessionId,
    testAPI: async () => {
        const response = await fetch(`${SCRIPT_URL}?action=test`);
        return await response.json();
    }
};
