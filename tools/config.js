/*********************************
 * CONFIGURATION MAXI JDC MARKET
 *********************************/

window.APP_CONFIG = window.APP_CONFIG || {};

// URL du Google Apps Script
window.APP_CONFIG.googleScriptUrl = "https://script.google.com/macros/s/AKfycbziOpsrvIpaFP9CP0tA38CZfwRzHTVTbdzXHVxcK9AxY60GNSltkvN6BedwrbMu4kx6/exec";

// Fonction pour obtenir l'URL du script
window.APP_CONFIG.getScriptUrl = function() {
  return this.googleScriptUrl;
};

// Autres configurations
window.APP_CONFIG.appName = "MAXI JDC MARKET";
window.APP_CONFIG.version = "2.0.0";
window.APP_CONFIG.debug = true;

// Images base URL
window.APP_CONFIG.imagesBaseUrl = "https://dituttitn-code.github.io/maxi-jdc-market/images/";

// Configuration WhatsApp
window.APP_CONFIG.whatsapp = {
  number: "+21625600978",
  message: "Bonjour, je souhaite commander sur MAXI JDC MARKET"
};

console.log("✅ Configuration chargée:", window.APP_CONFIG);
