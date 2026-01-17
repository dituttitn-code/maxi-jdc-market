<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Commander - MAXI JDC MARKET</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;max-width:860px;margin:24px auto;padding:0 12px}
    h2{margin:0 0 12px}
    label{display:block;margin:10px 0 6px}
    input,textarea{width:100%;padding:10px;border:1px solid #ccc;border-radius:10px}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    button{margin-top:14px;padding:12px 14px;border:0;border-radius:12px;background:#111;color:#fff;cursor:pointer}
    button:disabled{opacity:.6;cursor:not-allowed}
    .msg{margin-top:12px;font-size:14px;white-space:pre-wrap}
  </style>
</head>
<body>

<h2>Nouvelle commande</h2>

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
    <label>WhatsApp admin (numéro)</label>
    <input id="wa" value="21625600978">
  </div>
</div>

<label>Articles (JSON) – laisse comme ça pour tester</label>
<textarea id="articles" rows="6">[
  {"name":"CAKE VANILLE VANOISE (2721)","qty":2,"price":6.4,"category":"GATEAUX"},
  {"name":"10 CAPSULES INTENSE-GOLDEN COFFEE (4420)","qty":3,"price":17.9,"category":"CAFE"}
]</textarea>

<button id="btn">Commander</button>
<div class="msg" id="msg"></div>

<script>
/* =========================
   CONFIG
========================= */
const API_COMMANDES = "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

/* =========================
   JSONP -> 100% OK GitHub Pages
========================= */
function gsJsonp(params = {}) {
  return new Promise((resolve) => {
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    const cleanup = (script) => {
      try { delete window[cbName]; } catch (_) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };

    window[cbName] = (res) => {
      cleanup(script);
      resolve(res || { ok:false, error:"Réponse vide" });
    };

    const url = new URL(API_COMMANDES);
    url.searchParams.set("callback", cbName);

    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null) return;
      url.searchParams.set(k, typeof v === "string" ? v : String(v));
    });

    const script = document.createElement("script");
    script.src = url.toString();
    script.onerror = () => {
      cleanup(script);
      resolve({ ok:false, error:"Erreur réseau/JSONP (bloqueur, offline, URL)" });
    };

    document.body.appendChild(script);
  });
}

function envoyerCommande({ nom, telephone, adresse, livraison = 0, articles = [], statut = "Nouveau" }) {
  return gsJsonp({
    action: "create",
    nom: String(nom || "").trim(),
    telephone: String(telephone || "").trim(),
    adresse: String(adresse || "").trim(),
    livraison: String(livraison || 0),
    statut: String(statut || "Nouveau").trim() || "Nouveau",
    articles: JSON.stringify(articles || []),
  });
}

/* =========================
   UTILITAIRES
========================= */
function parseArticles(txt) {
  try {
    const v = JSON.parse(txt);
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

function calcSousTotal(articles) {
  let s = 0;
  for (const a of articles) {
    const q = Number(a.qty ?? 0) || 0;
    const p = Number(String(a.price ?? 0).replace(",", ".")) || 0;
    s += q * p;
  }
  return Math.round(s * 100) / 100;
}

function buildWhatsappMessage({ nom, telephone, adresse, articles, livraison }) {
  const st = calcSousTotal(articles);
  const total = Math.round((st + livraison) * 100) / 100;

  let txt = `NOUVELLE COMMANDE - MAXI JDC MARKET\n`;
  txt += `📅 ${new Date().toLocaleString("fr-FR")}\n\n`;
  txt += `👤 CLIENT\nNom: ${nom}\nTéléphone: ${telephone}\nAdresse: ${adresse}\n\n`;
  txt += `🛒 ARTICLES\n────────────────────────────────────────\n`;
  for (const a of articles) {
    const q = Number(a.qty ?? 0) || 0;
    const p = Number(String(a.price ?? 0).replace(",", ".")) || 0;
    const t = Math.round((q * p) * 100) / 100;
    txt += `${q}x ${a.name}\n  ${p.toFixed(2)} dt × ${q} = ${t.toFixed(2)} dt\n`;
  }
  txt += `────────────────────────────────────────\n`;
  txt += `Sous-total: ${st.toFixed(2)} dt\n`;
  txt += `Livraison: ${livraison.toFixed(2)} dt\n`;
  txt += `TOTAL: ${total.toFixed(2)} dt\n`;
  return txt;
}

/* =========================
   ACTION BOUTON
========================= */
const btn = document.getElementById("btn");
const msg = document.getElementById("msg");

btn.addEventListener("click", async () => {
  btn.disabled = true;
  msg.textContent = "⏳ Enregistrement en cours...";

  const nom = document.getElementById("nom").value.trim();
  const telephone = document.getElementById("telephone").value.trim();
  const adresse = document.getElementById("adresse").value.trim();
  const livraison = Number(String(document.getElementById("livraison").value).replace(",", ".")) || 0;
  const wa = document.getElementById("wa").value.trim().replace(/\D/g,"");

  const articles = parseArticles(document.getElementById("articles").value);

  if (!nom || !telephone || !adresse) {
    alert("❌ Remplis Nom / Téléphone / Adresse");
    msg.textContent = "❌ Champs manquants.";
    btn.disabled = false;
    return;
  }

  if (!articles.length) {
    alert("❌ Articles JSON invalide / vide");
    msg.textContent = "❌ Articles invalides.";
    btn.disabled = false;
    return;
  }

  // ✅ 1) Enregistrer d'abord dans Google Sheet
  const res = await envoyerCommande({ nom, telephone, adresse, livraison, articles });

  if (res && res.ok) {
    msg.textContent = "✅ Commande enregistrée dans Google Sheet (onglet COMMANDES).";
    alert("✅ Commande enregistrée !");

    // ✅ 2) Ouvrir WhatsApp après succès
    const waMsg = buildWhatsappMessage({ nom, telephone, adresse, articles, livraison });
    const whatsappLink = `https://wa.me/${wa}?text=` + encodeURIComponent(waMsg);
    window.open(whatsappLink, "_blank");
  } else {
    msg.textContent = "❌ Erreur: " + (res?.error || "inconnue");
    alert("❌ Erreur d'enregistrement: " + (res?.error || "inconnue"));
  }

  btn.disabled = false;
});
</script>

</body>
</html>
