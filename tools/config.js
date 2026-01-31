const APP_CONFIG = {
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbxYL6UI7ONUOBzeBFHwX_OsJ8gjFFYQEFc49oD9fBfVhPyZ-th-dA7NDhRAYIbwU7bF/exec",
  minOrder: 15,
  freeShipping: 100,
  shippingFee: 3,
  whatsappNumber: "21625600978",
  itemsPerPage: 24,
  getScriptUrl: function() { return this.googleScriptUrl; }
};
window.APP_CONFIG = APP_CONFIG;
