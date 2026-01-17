<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Commander - MAXI JDC MARKET</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:24px auto;padding:0 12px}
    label{display:block;margin:10px 0 6px}
    input,textarea{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px}
    button{margin-top:14px;padding:12px 14px;border:0;border-radius:10px;cursor:pointer}
    .btn{background:#111;color:#fff}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .hint{color:#555;font-size:13px;margin-top:8px}
  </style>
</head>
<body>

<h2>Nouvelle commande</h2>

<div class="row">
  <div>
    <label>Nom</label>
    <input id="nom" placeholder="Nom" value="Lotfi" />
  </div>
  <div>
    <label>Téléphone</label>
    <input id="telephone" placeholder="Téléphone" value="+216 55532482" />
  </div>
</div>

<label>Adresse</label>
<input id="adresse" placeholder="Adresse" value="Carthage" />

<div class="row">
  <div>
    <label>Livraison (DT)</label>
    <input id="livraison" placeholder="3" value="3" />
  </div>
  <div>
    <label>WhatsApp Admin</label>
    <input id="wa" placeholder="21625600978" value="21625600978" />
  </div>
</div>

<label>Articles (JSON) — tu peux laisser comme ça pour tester</label>
<textarea id="articles" rows="7">[
  {"name":"CAKE VANILLE VANOISE (2721)","qty":2,"price":6.4,"category":"GATEAUX"},
  {"name":"10 CAPSULES INTENSE-GOLDEN COFFEE (4420)","qty":3,"price":17.9,"category":"CAFE"}
]</textarea>

<button class="btn" id="btnCommander">Commander</button>
<div class="hint" id="hint"></div>

<script>
/* =========================
   CONFIG
========================= */
const API_COMMANDES = "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

/* =========================
   JSONP (GET + callback) => 100% OK sur GitHub Pages
========================= */
function envoyerCommandeJSONP({ nom, telephone, adresse, livraison = 0, articles = [] }) {
  return new Promise((resolve) => {
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    window[cbName] = (res) => {
      try { delete window[cbName]; } catch(e) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
      resolve(res || { ok:false, error:"Réponse vide" });
    };

    const url = new URL(API_COMMANDES);
    url.searchParams.set("callback", cbName);
    url.searchParams.set("action", "create");
    url.searchParams.set("nom", String(nom || "").trim());
    url.searchParams.set("telephone", String(telephone || "").trim());
    url.searchParams.set("adresse", String(adresse || "").trim());
    url.searchParams.set("livraison", String(livraison || 0));
    url.searchParams.set("articles", JSON.stringify(articles || []));

    const script = document.createElement("script");
    script.src = url.toString();
    script.onerror = () => {
      try { delete window[cbName]; } catch(e) {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
      resolve({ ok:false, error:"Erreur réseau / bloqueur (JSONP)" });
    };

    document.body.appendChild(script);
  });
}

/* =========================
   Helpers
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
    const q = Number(a.qty ?? a.qte ?? 0) || 0;
    const p = Number(String(a.price ?? a.prix ?? 0).replace(",", ".")) || 0;
    s += q * p;
  }
  return Math.round(s * 100) / 100;
}

function buildWhatsappMessage({ nom, telephone, adresse, articles, livraison }) {
  const sousTotal = calcSousTotal(articles);
  const total = Math.round((sousTotal + livraison) * 100) / 100;

  const lines = [];
  lines.push("NOUVELLE COMMANDE - MAXI JDC MARKET");
  lines.push("📅 " + new Date().toLocaleString("fr-FR"));
  lines.push("");
  lines.push("👤 CLIENT");
  lines.push("Nom: " + nom);
  lines.push("Téléphone: " + telephone);
  lines.push("Adresse: " + adresse);
  lines.push("");
  lines.push("🛒 ARTICLES");
  lines.push("────────────────────────────────────────");
  for (const a of articles) {
    const q = Number(a.qty ?? 0) || 0;
    const p = Number(String(a.price ?? 0).replace(",", ".")) || 0;
    const t = Math.round((q * p) * 100) / 100;
    lines.push(`${q}x ${a.name}`);
    lines.push(`  ${p.toFixed(2)} dt × ${q} = ${t.toFixed(2)} dt`);
  }
  lines.push("────────────────────────────────────────");
  lines.push("Sous-total: " + sousTotal.toFixed(2) + " dt");
  lines.push("Livraison: " + livraison.toFixed(2) + " dt");
  lines.push("TOTAL: " + total.toFixed(2) + " dt");
  return lines.join("\n");
}

/* =========================
   Bouton Commander
========================= */
const btn = document.getElementById("btnCommander");
const hint = document.getElementById("hint");

btn.addEventListener("click", async () => {
  btn.disabled = true;
  hint.textContent = "Enregistrement en cours...";

  const nom = document.getElementById("nom").value.trim();
  const telephone = document.getElementById("telephone").value.trim();
  const adresse = document.getElementById("adresse").value.trim();
  const livraison = Number(String(document.getElementById("livraison").value).replace(",", ".")) || 0;
  const wa = document.getElementById("wa").value.trim();

  const articles = parseArticles(document.getElementById("articles").value);

  if (!nom || !telephone || !adresse) {
    alert("❌ Merci de remplir Nom / Téléphone / Adresse");
    btn.disabled = false;
    hint.textContent = "";
    return;
  }
  if (!articles.length) {
    alert("❌ Articles JSON invalide ou vide");
    btn.disabled = false;
    hint.textContent = "";
    return;
  }

  // ✅ 1) Enregistrer dans Google Sheet
  const res = await envoyerCommandeJSONP({ nom, telephone, adresse, livraison, articles });

  if (res && res.ok) {
    hint.textContent = "✅ Commande enregistrée. Ouverture WhatsApp...";
    alert("✅ Commande enregistrée !");

    // ✅ 2) Ouvrir WhatsApp seulement si OK
    const msg = buildWhatsappMessage({ nom, telephone, adresse, articles, livraison });
    const waLink = "https://wa.me/" + wa.replace(/\D/g,"") + "?text=" + encodeURIComponent(msg);
    window.open(waLink, "_blank");
  } else {
    alert("❌ Erreur d'enregistrement: " + (res?.error || "inconnue"));
    hint.textContent = "❌ Échec: " + (res?.error || "inconnue");
  }

  btn.disabled = false;
});
</script>

</body>
</html>
