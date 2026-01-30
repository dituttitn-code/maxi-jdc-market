// validation-protection.js - À placer dans le même dossier que vos autres fichiers

// URL de votre script Apps Script (REMPLACEZ par votre URL)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzKreRtF1uwtJyMsn5pNUFAzZVU7iH8tmLFgg10cwvUV5qoJqI6sZRlNEHkbQiuB-Kki/exec';

// Variables globales
let sessionId = null;
let isSubmitting = false;
let submitTimeout = null;

// 1. PROTECTION CONTRE LES CLICS MULTIPLES
function protectSubmitButton() {
  // Chercher TOUS les boutons de validation possibles
  const buttonSelectors = [
    'button[onclick*="valider"]',
    'button[onclick*="envoyer"]',
    'button:contains("Valider")',
    'button:contains("Envoyer")',
    'button:contains("VALIDER")',
    'button:contains("ENVOYER")',
    '[class*="valider"]',
    '[class*="envoyer"]',
    '#btn-valider',
    '#btn-envoyer',
    '#valider-commande',
    '#envoyer-commande',
    '.btn-valider',
    '.btn-envoyer'
  ];

  let submitBtn = null;
  
  // Essayer chaque sélecteur
  for (const selector of buttonSelectors) {
    try {
      const btn = document.querySelector(selector);
      if (btn && btn.tagName === 'BUTTON') {
        submitBtn = btn;
        console.log(`✅ Bouton trouvé avec: ${selector}`);
        break;
      }
    } catch (e) {
      // Ignorer les sélecteurs invalides
    }
  }

  if (!submitBtn) {
    console.warn('⚠️ Bouton de validation non trouvé');
    // Chercher par texte contenu
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const text = btn.textContent.toLowerCase();
      if (text.includes('valider') || text.includes('envoyer')) {
        submitBtn = btn;
        console.log('✅ Bouton trouvé par texte:', text);
        break;
      }
    }
  }

  if (!submitBtn) {
    console.error('❌ Aucun bouton de validation trouvé sur cette page');
    return;
  }

  const originalText = submitBtn.innerHTML;
  const originalOnClick = submitBtn.onclick;
  const originalBgColor = submitBtn.style.backgroundColor || '';

  // 2. GÉNÉRER UNE SESSION UNIQUE
  async function initializeSession() {
    try {
      const response = await fetch(`${SCRIPT_URL}?action=generatesession`);
      const data = await response.json();
      
      if (data.success) {
        sessionId = data.session_id;
        localStorage.setItem('maxi_jdc_session', sessionId);
        console.log('🔒 Session créée:', sessionId.substring(0, 8) + '...');
        
        // Vérifier si déjà validé
        checkSessionStatus();
      }
    } catch (error) {
      console.error('❌ Erreur session:', error);
    }
  }

  // 3. VÉRIFIER STATUT SESSION
  async function checkSessionStatus() {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`${SCRIPT_URL}?action=validatesession&session_id=${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.already_validated) {
        // Désactiver le bouton si déjà validé
        submitBtn.disabled = true;
        submitBtn.innerHTML = '✅ Déjà validé';
        submitBtn.style.backgroundColor = '#e0e0e0';
        submitBtn.style.cursor = 'not-allowed';
        
        showMessage('Cette commande a déjà été validée. Le bouton est désactivé.', 'info');
      }
    } catch (error) {
      console.error('❌ Erreur vérification:', error);
    }
  }

  // 4. FONCTION DE VALIDATION SÉCURISÉE
  async function secureValidateOrder() {
    if (isSubmitting) {
      console.log('⏳ Validation déjà en cours...');
      return;
    }
    
    // Vérifier session
    if (!sessionId) {
      showMessage('❌ Session non initialisée. Rechargez la page.', 'error');
      return;
    }
    
    // DÉSACTIVER IMMÉDIATEMENT LE BOUTON
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Validation en cours...';
    submitBtn.style.backgroundColor = '#ff9800';
    
    // Désactiver après 30 secondes max
    submitTimeout = setTimeout(() => {
      if (isSubmitting) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        submitBtn.style.backgroundColor = originalBgColor;
        isSubmitting = false;
        showMessage('⚠️ Délai dépassé. Réessayez.', 'warning');
      }
    }, 30000);
    
    try {
      // VÉRIFIER SESSION AVANT ENVOI
      const checkResponse = await fetch(`${SCRIPT_URL}?action=validatesession&session_id=${sessionId}`);
      const checkData = await checkResponse.json();
      
      if (!checkData.can_validate) {
        clearTimeout(submitTimeout);
        
        if (checkData.already_validated) {
          submitBtn.innerHTML = '✅ Déjà validé';
          submitBtn.style.backgroundColor = '#e0e0e0';
          showMessage('Cette commande a déjà été validée.', 'info');
        } else if (checkData.too_many_attempts) {
          submitBtn.innerHTML = '🚫 Trop de tentatives';
          showMessage('Trop de tentatives. Attendez 5 minutes.', 'error');
        }
        
        isSubmitting = false;
        return;
      }
      
      // RÉCUPÉRER LES DONNÉES DE COMMANDE
      const orderData = collectOrderData();
      orderData.session_id = sessionId;
      
      console.log('📤 Envoi sécurisé:', orderData);
      
      // ENVOYER LA COMMANDE
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
      
      const result = await response.json();
      console.log('📥 Réponse:', result);
      clearTimeout(submitTimeout);
      
      if (result.success) {
        // SUCCÈS
        submitBtn.innerHTML = '✅ Commande envoyée';
        submitBtn.style.backgroundColor = '#4CAF50';
        isSubmitting = false;
        
        showMessage(
          `Commande #${result.commande_id} validée !<br>Total: ${result.total} dt`,
          'success'
        );
        
        // Mettre à jour le numéro de commande affiché
        updateOrderDisplay(result.commande_id);
        
        // Exécuter l'action originale si elle existe
        if (typeof originalOnClick === 'function') {
          setTimeout(originalOnClick, 1000);
        }
        
      } else {
        // ÉCHEC
        if (result.already_validated) {
          submitBtn.innerHTML = '✅ Déjà validé';
          submitBtn.style.backgroundColor = '#e0e0e0';
          showMessage('Cette commande a déjà été validée.', 'info');
        } else if (result.is_duplicate) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          submitBtn.style.backgroundColor = originalBgColor;
          showMessage(
            '⚠️ Commande similaire déjà enregistrée récemment.<br>Attendez quelques secondes.',
            'warning'
          );
        } else {
          // Réactiver le bouton pour réessayer
          submitBtn.disabled = false;
          submitBtn.innerHTML = '🔄 Réessayer';
          submitBtn.style.backgroundColor = '#F44336';
          showMessage(`Erreur: ${result.message || 'Inconnue'}`, 'error');
        }
        isSubmitting = false;
      }
      
    } catch (error) {
      // ERREUR RÉSEAU
      console.error('❌ Erreur réseau:', error);
      clearTimeout(submitTimeout);
      
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🌐 Réessayer (erreur réseau)';
      submitBtn.style.backgroundColor = '#FF9800';
      isSubmitting = false;
      
      showMessage('Erreur réseau. Vérifiez votre connexion.', 'error');
    }
  }

  // 5. COLLECTER LES DONNÉES (FONCTION GÉNÉRIQUE)
  function collectOrderData() {
    // Cette fonction DOIT être adaptée à chaque page
    // Version générique - à adapter selon votre structure
    
    const data = {
      nom_client: getValue('nom', 'nom-client', 'client-nom', 'Client'),
      telephone: getValue('telephone', 'tel', 'client-telephone', '+216'),
      adresse: getValue('adresse', 'address', 'client-adresse', ''),
      gps: getValue('gps', 'GPS', 'client-gps', ''),
      articles: getArticlesText(),
      total: getTotalAmount()
    };
    
    console.log('📋 Données collectées:', data);
    return data;
  }

  // Fonctions utilitaires génériques
  function getValue(...ids) {
    for (const id of ids) {
      // Chercher par ID
      let el = document.getElementById(id);
      if (el) return el.value || el.textContent || el.innerText;
      
      // Chercher par name
      el = document.querySelector(`[name="${id}"]`);
      if (el) return el.value || el.textContent || el.innerText;
      
      // Chercher par classe
      el = document.querySelector(`.${id}`);
      if (el) return el.value || el.textContent || el.innerText;
    }
    return '';
  }

  function getArticlesText() {
    // Chercher un conteneur d'articles
    const containers = [
      document.getElementById('articles-container'),
      document.getElementById('articles-list'),
      document.getElementById('panier'),
      document.querySelector('.articles-list'),
      document.querySelector('.panier'),
      document.querySelector('.items-list')
    ].filter(c => c !== null);
    
    if (containers.length > 0) {
      return containers[0].textContent.trim();
    }
    
    // Collecter les articles individuels
    const articleItems = document.querySelectorAll('.article-item, .product-item, .item');
    if (articleItems.length > 0) {
      return Array.from(articleItems)
        .map(item => item.textContent.trim())
        .filter(text => text && !text.toLowerCase().includes('total'))
        .join('\n');
    }
    
    return 'Articles non détectés';
  }

  function getTotalAmount() {
    const totalElements = [
      document.getElementById('total-commande'),
      document.getElementById('total'),
      document.getElementById('montant-total'),
      document.querySelector('[class*="total"]'),
      document.querySelector('[class*="montant"]')
    ].filter(el => el !== null);
    
    if (totalElements.length > 0) {
      const text = totalElements[0].textContent.trim();
      const match = text.match(/[\d,\.]+/);
      return match ? match[0].replace(',', '.') : '0';
    }
    
    return '0';
  }

  // 6. AFFICHER DES MESSAGES
  function showMessage(message, type = 'info') {
    let messageEl = document.getElementById('validation-message');
    
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = 'validation-message';
      document.body.appendChild(messageEl);
    }
    
    messageEl.innerHTML = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${type === 'success' ? '#4CAF50' : 
                   type === 'error' ? '#F44336' : 
                   type === 'warning' ? '#FF9800' : '#2196F3'};
      color: white;
      border-radius: 5px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 400px;
      animation: slideIn 0.3s ease;
    `;
    
    setTimeout(() => {
      messageEl.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, 300);
    }, 5000);
  }

  // 7. METTRE À JOUR L'AFFICHAGE
  function updateOrderDisplay(commandeId) {
    const elements = [
      document.getElementById('commande-numero'),
      document.getElementById('order-id'),
      document.querySelector('[class*="commande"]'),
      document.querySelector('[class*="order"]')
    ].filter(el => el !== null);
    
    if (elements.length > 0) {
      elements[0].textContent = commandeId;
    }
  }

  // 8. REMPLACER L'ACTION DU BOUTON
  const originalClickHandler = submitBtn.onclick;
  
  submitBtn.onclick = function(event) {
    event.preventDefault();
    event.stopPropagation();
    
    secureValidateOrder();
    return false;
  };

  // 9. AJOUTER UN INDICATEUR VISUEL
  if (!submitBtn.innerHTML.includes('🔒')) {
    submitBtn.innerHTML = '🔒 ' + originalText;
  }
  
  // 10. INITIALISER LA SESSION AU CHARGEMENT
  function initValidationSystem() {
    // Récupérer session existante
    sessionId = localStorage.getItem('maxi_jdc_session');
    
    if (sessionId) {
      console.log('🔍 Session existante trouvée');
      checkSessionStatus();
    } else {
      initializeSession();
    }
  }

  // Exposer la fonction d'initialisation
  window.initValidationSystem = initValidationSystem;
  
  // Initialiser
  setTimeout(initValidationSystem, 500);
}

// 11. INITIALISER LA PROTECTION AU CHARGEMENT DE LA PAGE
document.addEventListener('DOMContentLoaded', function() {
  console.log('🛡️ Initialisation protection anti-doublon...');
  
  // Attendre que la page soit complètement chargée
  setTimeout(protectSubmitButton, 1000);
  
  // Ajouter les styles CSS
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
    
    .protected-button::after {
      content: "🔒";
      margin-left: 5px;
    }
  `;
  document.head.appendChild(style);
});

// 12. FONCTION DE RÉINITIALISATION
function resetValidation() {
  localStorage.removeItem('maxi_jdc_session');
  sessionId = null;
  location.reload();
}

// Exposer la fonction de réinitialisation
window.resetValidation = resetValidation;

// Mode debug
if (window.location.hash === '#debug') {
  const debugBtn = document.createElement('button');
  debugBtn.textContent = '🔄 Debug: Réinitialiser session';
  debugBtn.onclick = resetValidation;
  debugBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #FF9800;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 5px;
    cursor: pointer;
    z-index: 9999;
    font-size: 11px;
    opacity: 0.8;
  `;
  document.body.appendChild(debugBtn);
  
  console.log('🔧 Mode debug activé');
}
