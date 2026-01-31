// validation-protection.js - PROTECTION ANTI-DOUBLON POUR MAXI JDC MARKET
// Version stable: session + anti double clic + envoi Apps Script en x-www-form-urlencoded

(function () {
  "use strict";

  // ✅ URL depuis config.js (robuste)
  const SCRIPT_URL =
    (window.APP_CONFIG && typeof window.APP_CONFIG.getScriptUrl === "function"
      ? window.APP_CONFIG.getScriptUrl()
      : (window.APP_CONFIG && window.APP_CONFIG.googleScriptUrl) || "") || "";

  let sessionId = null;
  let isSubmitting = false;
  let submitTimeout = null;

  // -------------------------
  // 1) INIT
  // -------------------------
  function initValidationSystem() {
    console.log("🚀 Validation system init");

    if (!SCRIPT_URL || !SCRIPT_URL.includes("script.google.com/macros/s/")) {
      console.warn("⚠️ SCRIPT_URL manquante ou invalide. Vérifie config.js");
      return; // on n'empêche pas le site de fonctionner
    }

    if (!isOrderPage()) {
      return;
    }

    // Session + protection bouton
    loadOrCreateSession()
      .finally(() => {
        setTimeout(protectSubmitButton, 500);
      });
  }

  // -------------------------
  // 2) Pages concernées
  // -------------------------
  function isOrderPage() {
    const path = (window.location.pathname || "").toLowerCase();
    const page = path.substring(path.lastIndexOf("/") + 1);

    const orderPages = [
      "validation-commande.html",
      "commander.html",
      "index.html",
      "commande.html",
      "panier.html"
    ];

    return orderPages.includes(page);
  }

  // -------------------------
  // 3) SESSION
  // -------------------------
  async function loadOrCreateSession() {
    sessionId = localStorage.getItem("maxi_jdc_session");

    if (sessionId) {
      console.log("🔍 Session existante:", sessionId.slice(0, 10) + "…");
      await checkSessionStatus();
    } else {
      await createNewSession();
    }

    showSessionInfo();
  }

  async function createNewSession() {
    try {
      console.log("🆕 Création session…");
      const url = `${SCRIPT_URL}?action=generatesession&t=${Date.now()}`;
      const data = await safeFetchJson(url, { method: "GET" });

      if (data && data.success && data.session_id) {
        sessionId = data.session_id;
        localStorage.setItem("maxi_jdc_session", sessionId);
        localStorage.setItem("maxi_jdc_validated", "false");
        console.log("✅ Session créée:", sessionId.slice(0, 10) + "…");
      } else {
        console.error("❌ Erreur création session:", data);
        fallbackLocalSession();
      }
    } catch (e) {
      console.error("❌ Erreur réseau session:", e);
      fallbackLocalSession();
    }
  }

  function fallbackLocalSession() {
    // On évite de bloquer le site si session API indispo.
    sessionId = "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("maxi_jdc_session", sessionId);
    localStorage.setItem("maxi_jdc_validated", "false");
  }

  async function checkSessionStatus() {
    if (!sessionId) return;
    try {
      const url = `${SCRIPT_URL}?action=validatesession&session_id=${encodeURIComponent(
        sessionId
      )}&t=${Date.now()}`;
      const data = await safeFetchJson(url, { method: "GET" });

      if (data && data.success) {
        localStorage.setItem("maxi_jdc_validated", data.already_validated ? "true" : "false");
      }
    } catch (e) {
      console.warn("⚠️ checkSessionStatus error:", e);
    }
  }

  async function validateSessionServerSide() {
    if (!sessionId) return false;
    try {
      const url = `${SCRIPT_URL}?action=validatesession&session_id=${encodeURIComponent(
        sessionId
      )}&t=${Date.now()}`;
      const data = await safeFetchJson(url, { method: "GET" });
      return !!(data && data.success && data.can_validate);
    } catch (e) {
      console.warn("⚠️ validateSessionServerSide error:", e);
      // En cas d'erreur réseau, on laisse passer plutôt que bloquer
      return true;
    }
  }

  // -------------------------
  // 4) PROTECTION BOUTON
  // -------------------------
  function protectSubmitButton() {
    const button = findSubmitButton();
    if (!button) {
      // ne bloque pas le site, juste log
      console.warn("⚠️ Bouton de validation introuvable sur cette page");
      return;
    }

    // déjà validé ?
    const alreadyValidated = localStorage.getItem("maxi_jdc_validated") === "true";
    if (alreadyValidated) {
      disableButton(button, "✅ Déjà validé", "#e0e0e0");
      return;
    }

    // marquage visuel (sans casser l'UI)
    if (!String(button.innerHTML).includes("🔒")) {
      button.innerHTML = "🔒 " + String(button.innerHTML).replace("🔒 ", "");
    }

    // sauvegarder état original
    const originalState = {
      onclick: button.onclick,
      text: button.innerHTML,
      disabled: button.disabled,
      bgColor: button.style.backgroundColor || ""
    };

    // override click
    button.addEventListener(
      "click",
      async function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (isSubmitting) return false;

        isSubmitting = true;
        disableButton(button, "⏳ Validation en cours…", "#ff9800");

        submitTimeout = setTimeout(() => {
          if (isSubmitting) {
            resetButton(button, originalState);
            isSubmitting = false;
            showError("Délai dépassé. Réessayez.");
          }
        }, 30000);

        try {
          if (!sessionId) await loadOrCreateSession();

          // validation session
          const canValidate = await validateSessionServerSide();
          if (!canValidate) {
            clearTimeout(submitTimeout);
            disableButton(button, "✅ Déjà validé", "#e0e0e0");
            localStorage.setItem("maxi_jdc_validated", "true");
            showInfo("Cette commande a déjà été validée.");
            isSubmitting = false;
            return false;
          }

          // construire payload
          const orderData = collectOrderData();

          // ✅ obligatoire pour ton Code.gs
          orderData.session_id = sessionId;

          // ✅ IMPORTANT: ton routeur utilise action OU method
          orderData.method = "saveOrder";

          console.log("📤 Envoi commande:", orderData);

          // envoi
          const result = await sendOrder(orderData);

          clearTimeout(submitTimeout);

          if (result && result.success) {
            disableButton(button, "✅ Commande envoyée", "#4CAF50");
            localStorage.setItem("maxi_jdc_validated", "true");

            showSuccess(
              `Commande #${result.commande_id || result.commandeId || "OK"} validée !<br>Total: ${
                result.total || ""
              } dt`
            );

            // mise à jour UI si éléments existent
            updateOrderDisplay(result.commande_id || result.commandeId);

            // exécuter l'action originale après succès (si elle existait)
            if (typeof originalState.onclick === "function") {
              setTimeout(() => {
                try {
                  originalState.onclick();
                } catch (_) {}
              }, 800);
            }
          } else {
            // erreurs serveur
            resetButton(button, originalState);

            if (result && result.requires_session) {
              showError("Problème de session. Rechargez la page.");
              localStorage.removeItem("maxi_jdc_session");
              localStorage.removeItem("maxi_jdc_validated");
            } else if (result && result.is_duplicate) {
              showInfo("⚠️ Commande déjà enregistrée récemment (doublon).");
            } else {
              showError((result && result.message) || "Erreur lors de l’enregistrement.");
            }
          }

          isSubmitting = false;
          return false;
        } catch (e) {
          clearTimeout(submitTimeout);
          console.error("❌ Erreur submit:", e);
          resetButton(button, originalState);
          isSubmitting = false;
          showError("Erreur réseau. Vérifiez votre connexion.");
          return false;
        }
      },
      true
    );

    console.log("✅ Bouton protégé:", button.textContent);
  }

  function findSubmitButton() {
    const buttons = document.querySelectorAll("button");

    // priorité: libellés connus
    for (const b of buttons) {
      const t = (b.textContent || "").toLowerCase();
      if (t.includes("valider et envoyer") || t.includes("valider la commande") || t.includes("confirmer")) {
        return b;
      }
    }

    // ids connus
    const ids = ["btn-valider", "btn-envoyer", "valider-commande", "submit-order"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }

    // fallback: premier bouton valider/envoyer
    for (const b of buttons) {
      const t = (b.textContent || "").toLowerCase();
      if (t.includes("valider") || t.includes("envoyer")) return b;
    }

    return null;
  }

  // -------------------------
  // 5) COLLECTE DONNÉES (ne casse rien)
  // -------------------------
  function collectOrderData() {
    const data = {
      nom_client: getClientName(),
      telephone: getClientPhone(),
      adresse: getClientAddress(),
      articles: getArticles(),
      total: getTotal()
    };

    // normaliser total
    if (data.total != null) {
      data.total = String(data.total).replace(/[^\d.,]/g, "").replace(",", ".");
    }
    return data;
  }

  function getClientName() {
    const candidates = [
      document.getElementById("client-nom"),
      document.getElementById("nom-client"),
      document.querySelector('[name="nom"]'),
      document.querySelector(".client-nom"),
      document.querySelector(".nom-client")
    ];
    for (const el of candidates) {
      if (el) return (el.value || el.textContent || "Client").trim();
    }
    return "Client";
  }

  function getClientPhone() {
    const candidates = [
      document.getElementById("client-telephone"),
      document.getElementById("telephone"),
      document.querySelector('[name="telephone"]'),
      document.querySelector('[name="tel"]'),
      document.querySelector(".telephone")
    ];
    for (const el of candidates) {
      if (el) return (el.value || el.textContent || "").trim();
    }
    return "";
  }

  function getClientAddress() {
    const candidates = [
      document.getElementById("client-adresse"),
      document.getElementById("adresse"),
      document.querySelector('[name="adresse"]'),
      document.querySelector(".adresse")
    ];
    for (const el of candidates) {
      if (el) return (el.value || el.textContent || "").trim();
    }
    return "";
  }

  function getArticles() {
    // conteneurs typiques
    const containers = [
      document.getElementById("articles-list"),
      document.getElementById("panier"),
      document.querySelector(".articles-list"),
      document.querySelector(".panier"),
      document.querySelector(".items-list")
    ];

    for (const c of containers) {
      if (c) {
        let text = (c.innerText || c.textContent || "").trim();
        text = text.replace(/TOTAL.*/gi, "").replace(/Sous-total.*/gi, "").replace(/Livraison.*/gi, "").trim();
        if (text) return text;
      }
    }

    // fallback: items
    const items = document.querySelectorAll(".article-item, .product-item, .item");
    if (items.length) {
      return Array.from(items)
        .map((x) => (x.textContent || "").trim())
        .filter((t) => t && !t.toLowerCase().includes("total"))
        .join("\n");
    }

    return "";
  }

  function getTotal() {
    const candidates = [
      document.getElementById("total-commande"),
      document.getElementById("total"),
      document.getElementById("montant-total"),
      document.querySelector(".total-amount"),
      document.querySelector('[class*="total"]')
    ];
    for (const el of candidates) {
      if (el) {
        const text = (el.innerText || el.textContent || "").trim();
        const m = text.match(/[\d]+(?:[.,][\d]{1,2})?/);
        return m ? m[0] : "0";
      }
    }
    return "0";
  }

  // -------------------------
  // 6) ENVOI (FIABLE) : form-urlencoded → pas de préflight
  // -------------------------
  async function sendOrder(orderData) {
    const payload = new URLSearchParams();

    // envoyer toutes les clés (Apps Script va parser)
    Object.keys(orderData || {}).forEach((k) => {
      const v = orderData[k];
      if (v !== undefined && v !== null) payload.append(k, String(v));
    });

    // cache buster
    payload.append("_t", String(Date.now()));

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: payload.toString()
    });

    // si Apps Script renvoie du JSON
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      return { success: false, message: "Réponse non JSON", raw: text };
    }
  }

  // -------------------------
  // 7) UI messages (identique)
  // -------------------------
  function disableButton(button, text, color) {
    button.disabled = true;
    button.innerHTML = text;
    button.style.backgroundColor = color;
    button.style.cursor = "not-allowed";
  }

  function resetButton(button, originalState) {
    button.disabled = originalState.disabled;
    button.innerHTML = originalState.text;
    button.style.backgroundColor = originalState.bgColor;
    button.style.cursor = "";
  }

  function updateOrderDisplay(commandeId) {
    if (!commandeId) return;
    const els = [
      document.getElementById("commande-numero"),
      document.getElementById("order-id"),
      document.querySelector(".commande-numero"),
      document.querySelector(".order-id")
    ];
    for (const el of els) {
      if (el) {
        el.textContent = commandeId;
        break;
      }
    }
  }

  function showSuccess(msg) {
    showNotification(msg, "#4CAF50");
  }
  function showError(msg) {
    showNotification(msg, "#F44336");
  }
  function showInfo(msg) {
    showNotification(msg, "#2196F3");
  }

  function showNotification(message, color) {
    document.querySelectorAll(".validation-notification").forEach((n) => n.remove());

    const n = document.createElement("div");
    n.className = "validation-notification";
    n.innerHTML = message;

    n.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: ${color}; color: white;
      padding: 15px 20px; border-radius: 5px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000; max-width: 420px;
      animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(n);

    setTimeout(() => {
      n.style.animation = "slideOut 0.3s ease";
      setTimeout(() => n.remove(), 250);
    }, 5000);
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
      button:disabled { cursor: not-allowed !important; opacity: 0.7 !important; }
    `;
    document.head.appendChild(style);
  }

  function showSessionInfo() {
    if (window.location.hash !== "#debug") return;

    const info = document.createElement("div");
    info.style.cssText = `
      position: fixed; bottom: 10px; left: 10px;
      background: rgba(0,0,0,0.8); color: white;
      padding: 5px 10px; border-radius: 3px;
      font-size: 10px; z-index: 9999;
    `;
    info.textContent = `Session: ${sessionId ? sessionId.slice(0, 10) + "…" : "none"}`;
    document.body.appendChild(info);
  }

  async function safeFetchJson(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      return { success: false, message: "Réponse non JSON", raw: text };
    }
  }

  // -------------------------
  // 8) Reset debug
  // -------------------------
  function resetValidation() {
    localStorage.removeItem("maxi_jdc_session");
    localStorage.removeItem("maxi_jdc_validated");
    sessionId = null;
    location.reload();
  }

  // expose debug
  window.maxiValidation = {
    reset: resetValidation,
    getSessionId: () => sessionId,
    getScriptUrl: () => SCRIPT_URL
  };

  // -------------------------
  // 9) START
  // -------------------------
  document.addEventListener("DOMContentLoaded", function () {
    addStyles();
    initValidationSystem();

    if (window.location.hash === "#debug") {
      const b = document.createElement("button");
      b.textContent = "🔄 Debug: Réinitialiser";
      b.onclick = resetValidation;
      b.style.cssText = `
        position: fixed; bottom: 50px; right: 20px;
        background: #FF9800; color: white; border: none;
        padding: 8px 12px; border-radius: 5px;
        cursor: pointer; z-index: 9999; font-size: 11px;
      `;
      document.body.appendChild(b);
    }
  });
})();
