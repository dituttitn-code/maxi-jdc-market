/*********************************
 * CONFIGURATION MAXI JDC MARKET
 *********************************/

window.APP_CONFIG = window.APP_CONFIG || {};

// URL du Google Apps Script (METTEZ VOTRE URL ICI)
window.APP_CONFIG.googleScriptUrl = "https://script.google.com/macros/s/AKfycbwKxxNvKARuMTr4Gl3oYeM8kRF3hwnt4YtFzUX2Q_tVzitM7EaVGg9gr5e8l_SC3j44/exec";

// Fonction pour obtenir l'URL du script
window.APP_CONFIG.getScriptUrl = function() {
  return this.googleScriptUrl;
};

// Token API (optionnel)
window.APP_CONFIG.apiToken = "CHANGE-ME-SECRET-123456";

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

console.log("✅ Configuration chargée:", window.APP_CONFIG.appName, "v" + window.APP_CONFIG.version);
console.log("🔗 URL API:", window.APP_CONFIG.googleScriptUrl);
