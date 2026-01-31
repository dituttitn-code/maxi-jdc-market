// validation-protection.js
// Protection contre les soumissions multiples
(function() {
  'use strict';
  
  let validationLock = false;
  const MAX_RETRIES = 3;
  
  window.protectValidation = {
    isLocked: function() {
      return validationLock;
    },
    
    lock: function() {
      validationLock = true;
      console.log("🔒 Validation verrouillée");
    },
    
    unlock: function() {
      validationLock = false;
      console.log("🔓 Validation déverrouillée");
    },
    
    withLock: async function(callback, maxRetries = MAX_RETRIES) {
      if (validationLock) {
        console.warn("⚠️ Validation déjà en cours");
        return { success: false, error: "Validation en cours" };
      }
      
      validationLock = true;
      try {
        return await callback();
      } finally {
        validationLock = false;
      }
    }
  };
  
  // Protection contre le double-clic
  document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('button[data-protect]');
    buttons.forEach(button => {
      button.addEventListener('click', function(e) {
        if (validationLock) {
          e.preventDefault();
          e.stopPropagation();
          console.warn("🚫 Double-clic bloqué");
          return false;
        }
      });
    });
  });
  
  console.log("✅ Protection anti-doublon chargée");
})();
