/* =========================================================
   MAXI JDC MARKET - tools/config.js
   ✅ Fix: Toujours afficher le N° COMMANDE renvoyé par l'API
   (data.commande_id) et jamais le numéro généré côté client.
   ========================================================= */

/**
 * 1) Mets ici l'URL de ton WebApp Apps Script (le même que tu utilises déjà)
 * Exemple:
 * https://script.google.com/macros/s/AKfycbx0KoGqKQFpJJAkrcSvxxZ0_LQdYntzIy9s4BqxpHOZtMJGDxoCpbw2VhUVSrfwNvqg/exec
 */
const APPS_SCRIPT_URL = "PUT_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE";

/**
 * Config globale (si ton app utilise window.APP_CONFIG)
 * Tu peux ajouter d'autres clés si tu en as besoin.
 */
window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.API_URL = APPS_SCRIPT_URL;

/* -----------------------------
   Helpers généraux
--------------------------------*/
function safeText(x) {
  return (x === null || x === undefined) ? "" : String(x);
}

function normalizePhone(tel) {
  return safeText(tel).trim();
}

function normalizeName(n) {
  const s = safeText(n).trim();
  return s || "Client";
}

function normalizeAddress(a) {
  return safeText(a).trim();
}

/**
 * IMPORTANT:
 * Cette fonction ne doit PAS imposer un numéro de commande local.
 * On envoie les infos, et on attend le retour API pour récupérer commande_id.
 */
function buildOrderPayload(order) {
  return {
    action: "saveOrder",
    nom_client: normalizeName(order.nom_client || order.nom || order.client || ""),
    telephone: normalizePhone(order.telephone || order.tel || order.phone || ""),
    adresse: normalizeAddress(order.adresse || order.address || ""),
    articles: order.articles ?? order.items ?? order.panier ?? "",
    total: order.total ?? ""
    // ⚠️ Ne pas envoyer commande_id généré localement
  };
}

/* -----------------------------
   Appel API (saveOrder)
--------------------------------*/
async function saveOrder(orderObj) {
  if (!window.APP_CONFIG.API_URL || window.APP_CONFIG.API_URL.includes("PUT_YOUR")) {
    throw new Error("API_URL non configurée dans tools/config.js");
  }

  const payload = buildOrderPayload(orderObj);

  const res = await fetch(window.APP_CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  // Apps Script renvoie du JSON texte
  const data = await res.json();

  // ✅ Toujours retourner la réponse serveur (contient commande_id final)
  return data;
}

/* -----------------------------
   UI: Message succès (N° Correct)
--------------------------------*/
function renderOrderSuccessMessage(data) {
  const ref = safeText(data?.commande_id).trim();

  // Si jamais l’API répond sans commande_id (rare), on fallback
  const commandeIdFinal = ref || "CMD-MAXI-INCONNU";

  return (
`✅ Commande Enregistrée
Merci pour votre commande chez MAXI JDC MARKET.
📦 Votre commande, référence ${commandeIdFinal}, a bien été enregistrée.
⏳ Elle est actuellement en cours de préparation.
📞 Nous vous contacterons prochainement pour la livraison.
🔗 Pour suivre l'état de votre commande, utilisez le numéro ${commandeIdFinal} dans la section « Suivi commande » de votre espace client.`
  );
}

/* -----------------------------
   Copier / Télécharger
--------------------------------*/
async function copyTextToClipboard(text) {
  const t = safeText(text);
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch (e) {
    // fallback vieux navigateurs
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_) {
      return false;
    }
  }
}

function downloadTextFile(filename, content) {
  const blob = new Blob([safeText(content)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------
   ✅ Fonction principale à utiliser au clic "Valider et envoyer"
   ---------------------------------------------------------
   - Envoie la commande
   - Récupère data.commande_id FINAL
   - Affiche le message avec le BON numéro
   - Fournit handlers copier/télécharger basés sur le BON numéro
----------------------------------------------------------*/
window.submitOrderAndShowPopup = async function submitOrderAndShowPopup(orderObj, ui) {
  // ui est optionnel : tu peux passer tes fonctions UI existantes
  // ui.showModal(text, {onCopy, onDownload, onOk}) par exemple.

  try {
    const data = await saveOrder(orderObj);

    if (!data || data.success !== true) {
      const msg = safeText(data?.message) || "❌ Erreur lors de l'enregistrement";
      if (ui?.showError) ui.showError(msg);
      else alert(msg);
      return { success: false, data };
    }

    // ✅ LE VRAI NUMERO (celui dans Google Sheet)
    const commandeIdFinal = safeText(data.commande_id).trim();

    const message = renderOrderSuccessMessage(data);

    // Affichage (selon ton UI)
    if (ui?.showSuccessModal) {
      ui.showSuccessModal(message, {
        onCopy: async () => copyTextToClipboard(commandeIdFinal),
        onDownload: () => downloadTextFile(`commande-${commandeIdFinal}.txt`, message),
        onOk: () => ui.closeModal?.()
      });
    } else {
      // fallback simple
      alert(message);
      // et copie auto si tu veux:
      // await copyTextToClipboard(commandeIdFinal);
    }

    return { success: true, data };

  } catch (err) {
    const msg = "❌ Erreur réseau / serveur: " + safeText(err);
    if (ui?.showError) ui.showError(msg);
    else alert(msg);
    return { success: false, error: String(err) };
  }
};

/* ---------------------------------------------------------
   Exports utilitaires si ton app en a besoin
----------------------------------------------------------*/
window.MAXI_API = {
  saveOrder,
  renderOrderSuccessMessage,
  copyTextToClipboard,
  downloadTextFile
};
