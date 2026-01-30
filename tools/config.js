// config.js
const APP_CONFIG = {
  // URL de votre Google Apps Script
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbw-gHqEjb1RmcL14F165QAzu96pkZxpdTS3Ms1jaVWpehJnU0nkp1iH_izqj4xMHo_a/exec",
  
  // Configuration existante
  minOrder: 15,
  freeShipping: 100,
  shippingFee: 3,
  whatsappNumber: "21625600978",
  itemsPerPage: 24,
  
  // Méthode pour obtenir l'URL
  getScriptUrl: function() {
    return this.googleScriptUrl;
  }
};

// Rendre la configuration accessible globalement
window.APP_CONFIG = APP_CONFIG;
