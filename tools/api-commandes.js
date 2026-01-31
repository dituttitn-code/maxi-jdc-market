<!-- ================= API COMMANDES (AJOUT SÉCURISÉ) ================= -->

<script src="tools/config.js"></script>

<script>
console.log("🚀 Chargement API_COMMANDES");

// Ne rien casser si déjà présent
if (!window.API_COMMANDES) {

  const SESSION_KEY = "maxi_jdc_session_id";
  let sendingOrder = false;

  function getAPIUrl() {
    if (window.APP_CONFIG && window.APP_CONFIG.googleScriptUrl) {
      return window.APP_CONFIG.googleScriptUrl;
    }
    console.error("❌ googleScriptUrl manquant dans config.js");
    return null;
  }

  async function testerConnexionAPI() {
    const url = getAPIUrl();
    if (!url) return { connecte: false };

    const r = await fetch(url + "?method=test&t=" + Date.now());
    const txt = await r.text();

    try {
      return JSON.parse(txt);
    } catch {
      return { connecte: false, raw: txt };
    }
  }

  async function envoyerCommande(data) {
    const url = getAPIUrl();
    if (!url) return { success: false };

    if (sendingOrder) return { success: true, duplicated: true };
    sendingOrder = true;

    try {
      const sessionId = localStorage.getItem(SESSION_KEY) || ("local_" + Date.now());
      localStorage.setItem(SESSION_KEY, sessionId);

      const form = new URLSearchParams();
      form.append("method", "saveOrder");
      form.append("session_id", sessionId);
      form.append("nom_client", data.nom_client || "");
      form.append("telephone", data.telephone || "");
      form.append("adresse", data.adresse || "");
      form.append("articles", JSON.stringify(data.articles || []));
      form.append("date", new Date().toISOString());

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });

      return JSON.parse(await r.text());
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      sendingOrder = false;
    }
  }

  // ✅ LA LIGNE QUI MANQUAIT
  window.API_COMMANDES = {
    testerConnexionAPI,
    envoyerCommande
  };

  console.log("✅ API_COMMANDES prêt");
}
</script>

<!-- ================= FIN API COMMANDES ================= -->
