<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>API Commandes - Test (Google Sheet)</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#0b1b2b;color:#e8f0ff;margin:0;padding:20px}
    .card{max-width:780px;margin:0 auto;background:#112a44;border:1px solid #1e3a5f;border-radius:14px;padding:16px}
    h1{font-size:18px;margin:0 0 12px}
    label{display:block;margin:10px 0 6px;font-size:13px;color:#cfe0ff}
    input,textarea,select{width:100%;padding:10px;border-radius:10px;border:1px solid #284a76;background:#0e2238;color:#e8f0ff;box-sizing:border-box}
    textarea{min-height:120px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    button{padding:10px 12px;border-radius:12px;border:0;background:#18a46b;color:#061322;font-weight:700;cursor:pointer}
    button.secondary{background:#1f3a5d;color:#e8f0ff;border:1px solid #2b4d7a}
    .hint{font-size:12px;color:#b9d2ff;opacity:.9;margin-top:10px;line-height:1.35}
    .status{margin-top:12px;padding:10px;border-radius:12px;background:#0e2238;border:1px dashed #2b4d7a;font-size:13px;white-space:pre-wrap}
    .ok{color:#7dffb5}
    .err{color:#ff8a8a}
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ Enregistrer une commande dans Google Sheet (COMMANDES)</h1>

    <!-- IMPORTANT: charge ton api-commandes.js avec anti-cache -->
    <script src="tools/api-commandes.js?v=20260117_1"></script>

    <form id="commandeForm">
      <div class="row">
        <div>
          <label>Nom</label>
          <input id="nom" required placeholder="Ex: Lotfi" />
        </div>
        <div>
          <label>Téléphone</label>
          <input id="telephone" required placeholder="+216 55532482" />
        </div>
      </div>

      <label>Adresse</label>
      <input id="adresse" required placeholder="Ex: Carthage" />

      <div class="row">
        <div>
          <label>Livraison (dt)</label>
          <input id="livraison" type="number" step="0.01" value="3" />
        </div>
        <div>
          <label>Statut</label>
          <select id="statut">
            <option value="Nouveau" selected>Nouveau</option>
            <option value="En cours">En cours</option>
            <option value="Livrée">Livrée</option>
            <option value="Annulée">Annulée</option>
          </select>
        </div>
      </div>

      <label>Articles (JSON) — obligatoire</label>
      <textarea id="articles" spellcheck="false">[
  { "name": "CAKE VANILLE", "qty": 2, "price": 6.4, "category": "Food" },
  { "name": "COFFEE CAPSULES", "qty": 3, "price": 17.9, "category": "Coffee" }
]</textarea>

      <div class="btns">
        <button type="submit">Enregistrer commande + ouvrir WhatsApp</button>
        <button type="button" class="secondary" id="btnPing">Tester connexion (PING)</button>
        <button type="button" class="secondary" id="btnOnlySave">Enregistrer seulement</button>
      </div>

      <div class="hint">
        ⚠️ Si tu utilises GitHub Pages, change le <b>v=...</b> du script à chaque modif pour éviter le cache.<br/>
        Ce fichier HTML fonctionne même tout seul : il écrit dans l’onglet <b>COMMANDES</b> via ton Apps Script.
      </div>

      <div id="out" class="status">Statut: prêt.</div>
    </form>
  </div>

  <script>
    const out = document.getElementById("out");
    const $ = (id) => document.getElementById(id);

    function setOutOk(msg, obj){
      out.classList.remove("err"); out.classList.add("ok");
      out.textContent = msg + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    }
    function setOutErr(msg, obj){
      out.classList.remove("ok"); out.classList.add("err");
      out.textContent = msg + (obj ? "\n\n" + JSON.stringify(obj, null, 2) : "");
    }

    function safeParseArticles(text){
      try {
        const v = JSON.parse(text);
        return Array.isArray(v) ? v : [];
      } catch(e){
        return null; // null = JSON invalide
      }
    }

    function buildWhatsappMessage(data){
      const lines = [];
      lines.push("NOUVELLE COMMANDE - MAXI JDC MARKET");
      lines.push("CLIENT:");
      lines.push("Nom: " + data.nom);
      lines.push("Téléphone: " + data.telephone);
      lines.push("Adresse: " + data.adresse);
      lines.push("");
      lines.push("ARTICLES:");
      lines.push("--------------------------------");
      let sousTotal = 0;
      (data.articles || []).forEach(it => {
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const total = qty * price;
        sousTotal += total;
        lines.push(`${qty}x ${it.name}  (${it.id || ""})`.trim());
        lines.push(`  ${price.toFixed(2)} dt × ${qty} = ${total.toFixed(2)} dt`);
      });
      lines.push("--------------------------------");
      lines.push("Sous-total: " + sousTotal.toFixed(2) + " dt");
      lines.push("Livraison: " + Number(data.livraison || 0).toFixed(2) + " dt");
      lines.push("TOTAL: " + (sousTotal + Number(data.livraison||0)).toFixed(2) + " dt");
      return lines.join("\n");
    }

    async function saveCommande(openWhatsapp){
      // ✅ Vérif que l'API est chargée
      if (!window.CommandesAPI || typeof window.CommandesAPI.create !== "function") {
        setOutErr("❌ CommandesAPI introuvable. Vérifie que tools/api-commandes.js est bien chargé (et cache v=...).");
        return;
      }

      const nom = $("nom").value.trim();
      const telephone = $("telephone").value.trim();
      const adresse = $("adresse").value.trim();
      const livraison = Number($("livraison").value || 0);
      const statut = $("statut").value;

      if (!nom || !telephone || !adresse) {
        setOutErr("❌ Remplis Nom / Téléphone / Adresse.");
        return;
      }

      const parsed = safeParseArticles($("articles").value);
      if (parsed === null) {
        setOutErr("❌ JSON articles invalide. Corrige le JSON dans la zone Articles.");
        return;
      }
      if (!parsed.length) {
        setOutErr("❌ Articles vide. Il faut au moins 1 article.");
        return;
      }

      const payload = { nom, telephone, adresse, livraison, articles: parsed, statut };

      setOutOk("⏳ Enregistrement en cours...");

      const res = await window.CommandesAPI.create(payload);

      if (res && res.ok) {
        setOutOk("✅ Commande enregistrée dans Google Sheet !", res);

        if (openWhatsapp) {
          const msg = buildWhatsappMessage(payload);
          const whatsappPhone = "21625600978"; // <-- mets ton numéro WhatsApp ici (sans +)
          const whatsappLink = "https://wa.me/" + whatsappPhone + "?text=" + encodeURIComponent(msg);
          window.open(whatsappLink, "_blank");
        }
      } else {
        setOutErr("❌ Erreur d'enregistrement", res);
        alert("❌ Erreur d'enregistrement: " + (res?.error || "inconnue"));
      }
    }

    // ✅ Form submit
    $("commandeForm").addEventListener("submit", async (event) => {
      event.preventDefault(); // ✅ ICI seulement
      await saveCommande(true);
    });

    // ✅ Ping
    $("btnPing").addEventListener("click", async () => {
      if (!window.CommandesAPI || typeof window.CommandesAPI.ping !== "function") {
        setOutErr("❌ CommandesAPI introuvable. Vérifie tools/api-commandes.js + cache v=...");
        return;
      }
      setOutOk("⏳ Ping...");
      const res = await window.CommandesAPI.ping();
      if (res && res.ok) setOutOk("✅ PING OK (connecté à la feuille)", res);
      else setOutErr("❌ PING KO", res);
    });

    // ✅ Save only (sans WhatsApp)
    $("btnOnlySave").addEventListener("click", async () => {
      await saveCommande(false);
    });
  </script>
</body>
</html>
