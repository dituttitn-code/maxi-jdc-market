// config.js
const APP_CONFIG = {
  googleScriptUrl: "https://script.google.com/macros/s/AKfycby3acB0gMMk-Ub8CXt__33nH0NNIrYfPeU3DEiLmUCLDW-RMLnPc_F_5eDjLYnxDu8/exec",
  minOrder: 15,
  freeShipping: 100,
  shippingFee: 3,
  whatsappNumber: "21625600978",
  itemsPerPage: 24,
  getScriptUrl: function() { return this.googleScriptUrl; }
};
window.APP_CONFIG = APP_CONFIG;
