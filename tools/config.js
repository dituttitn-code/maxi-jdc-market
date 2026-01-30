// config.js - VERSION CORRIGÉE
const APP_CONFIG = {
  // URL de votre Google Apps Script
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbyJs00tpzQFuJREuTGGJMl-76UIOFkKWA4Jg5nxyL6h1bhFGZKn_EBfJB33BsNyp67w/exec",
  
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
