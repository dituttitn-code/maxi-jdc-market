// config.js - VERSION CORRIGÉE
const APP_CONFIG = {
  // URL de votre Google Apps Script
  googleScriptUrl: "https://script.google.com/macros/s/AKfycby3acB0gMMk-Ub8CXt__33nH0NNIrYfPeU3DEiLmUCLDW-RMLnPc_F_5eDjLYnxDu8/exec",
  
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
