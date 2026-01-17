<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Commander - MAXI JDC MARKET</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:24px auto;padding:0 12px}
    input,textarea{width:100%;padding:10px;border:1px solid #ccc;border-radius:10px}
    label{display:block;margin-top:12px;margin-bottom:6px}
    button{margin-top:14px;padding:12px 14px;border:0;border-radius:12px;cursor:pointer;background:#111;color:#fff}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .log{margin-top:10px;color:#333;font-size:13px;white-space:pre-wrap}
  </style>
</head>
<body>

<h2>Nouvelle commande (test)</h2>

<div class="row">
  <div>
    <label>Nom</label>
    <input id="nom" value="Lotfi">
  </div>
  <div>
    <label>Téléphone</label>
    <input id="telephone" value="+216 55532482">
  </div>
</div>

<label>Adresse</label>
<input id="adresse" value="Carthage">

<div class="row">
  <div>
    <label>Livraison (DT)</label>
    <input id="livraison" value="3">
  </div>
  <div>
    <label>WhatsApp Admin (numéro)</label>
    <input id="wa" value="21625600978">
  </div>
</div>

<label>Articles (JSON)</label>
<textarea id="articles" rows="6">[
  {"name":"CAKE VANILLE VANOISE (2721)","qty":2,"price":6.4,"category":"GATEAUX"},
  {"name":"10 CAPSULES INTENSE-GOLDEN COFFEE (4420)","qty":3,"price":17.9,"category":"CAFE"}
]</textarea>

<button id="btn">Commander</button>
<div class="log" id="log"></div>

<!-- ✅ IMPORTANT: charge ton api-commandes.js avec version pour casser le cache -->
<script src="tools/api-commandes.js?v=20260117_1"></script>

<script>
  const logEl = document.getElementById("log");
  const btn = document.getElementById("btn");

  function log(msg){
    logEl.textContent = msg + "\n" + logEl.textContent;
  }

  function calcSousTotal(articles){
    let s = 0;
    for(const a of articles){
      const q = Number(a.qty ?? 0) || 0;
      const p = Number(String(a.price ?? 0).replace(",", ".")) || 0;
      s += q * p;
    }
    return Math.round(s * 100) / 100;
  }

  function buildWhatsappMessage({nom,telephone,adresse,articles,livraison}){
    const st = calcSousTotal(articles);
    const total = Math.round((st + livraison) * 100) / 100;

    let txt = `NOUVELLE COMMANDE - MAXI JDC MARKET\n`;
    txt += `📅 ${new Date().toLocaleString("fr-FR")}\n\n`;
    txt += `👤 CLIENT\nNom: ${nom}\nTéléphone: ${telephone}\nAdresse: ${adresse}\n\n`;
    txt += `🛒 ARTICLES\n────────────────────────\n`;
    for(const a of articles){
      const q = Number(a.qty ?? 0) || 0;
      const p = Number(String(a.price ?? 0).replace(",", ".")) || 0;
      const t = Math.round((q * p) * 100) / 100;
      txt += `${q}x ${a.name}\n  ${p.toFixed(2)} dt × ${q} = ${t.toFixed(2)} dt\n`;
    }
    txt += `────────────────────────\nSous-total: ${st.toFixed(2)} dt\nLivraison: ${livraison.toFixed(2)} dt\nTOTAL: ${total.toFixed(2)} dt\n`;
    return txt;
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    log("➡️ Début enregistrement...");

    try {
      // 1) Vérifie que le fichier api-commandes.js est bien chargé
      if (typeof envoyerCommande !== "function") {
        alert("❌ api-commandes.js n'est pas chargé (chemin/cached).");
        log("❌ envoyerCommande est UNDEFINED -> script non chargé");
        btn.disabled = false;
        return;
      }

      const nom = document.getElementById("nom").value.trim();
      const telephone = document.getElementById("telephone").value.trim();
      const adresse = document.getElementById("adresse").value.trim();
      const livraison = Number(String(document.getElementById("livraison").value).replace(",", ".")) || 0;
      const wa = document.getElementById("wa").value.trim().replace(/\D/g,"");

      let articles;
      try { articles = JSON.parse(document.getElementById("articles").value); }
      catch(e){ articles = []; }

      if (!nom || !telephone || !adresse) {
        alert("❌ Remplis Nom / Téléphone / Adresse");
        btn.disabled = false;
        return;
      }
      if (!Array.isArray(articles) || articles.length === 0) {
        alert("❌ Articles JSON invalide / vide");
        btn.disabled = false;
        return;
      }

      // 2) ✅ ENREGISTRE D'ABORD DANS GOOGLE SHEET
      const res = await envoyerCommande({ nom, telephone, adresse, livraison, articles });

      log("📩 Réponse API: " + JSON.stringify(res));

      if (res && res.ok) {
        alert("✅ Commande enregistrée dans Google Sheet !");
        log("✅ OK enregistré");

        // 3) OUVRE WHATSAPP APRÈS OK
        const msg = buildWhatsappMessage({ nom, telephone, adresse, articles, livraison });
        const whatsappLink = `https://wa.me/${wa}?text=` + encodeURIComponent(msg);
        window.open(whatsappLink, "_blank");
      } else {
        alert("❌ Erreur d'enregistrement: " + (res?.error || "inconnue"));
        log("❌ ERREUR: " + (res?.error || "inconnue"));
      }

    } catch (err) {
      alert("❌ Exception: " + (err?.message || err));
      log("❌ Exception: " + (err?.stack || err));
    }

    btn.disabled = false;
  });
</script>

</body>
</html>
