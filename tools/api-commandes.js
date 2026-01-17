<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Commande – MAXI JDC MARKET</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>

<h2>Nouvelle commande</h2>

<label>Nom</label><br>
<input id="nom" value="Lotfi"><br><br>

<label>Téléphone</label><br>
<input id="telephone" value="55532482"><br><br>

<label>Adresse</label><br>
<input id="adresse" value="Carthage"><br><br>

<button onclick="commander()">Commander</button>

<script>
/* ================================
   CONFIG
================================ */
const API_COMMANDES = "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";
const WHATSAPP_NUM = "21625600978";

/* ================================
   ENVOI COMMANDE (FIABLE)
================================ */
function envoyerCommande({ nom, telephone, adresse, livraison = 3, articles = [] }) {

  const payload = new URLSearchParams({
    action: "create",
    nom,
    telephone,
    adresse,
    livraison,
    articles: JSON.stringify(articles)
  });

  // ✅ sendBeacon = garanti même si WhatsApp s’ouvre
  const blob = new Blob(
    [payload.toString()],
    { type: "application/x-www-form-urlencoded;charset=UTF-8" }
  );

  const ok = navigator.sendBeacon(API_COMMANDES, blob);

  if (ok) {
    return Promise.resolve(true);
  }

  // fallback
  return fetch(API_COMMANDES, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: payload
  }).then(() => true).catch(() => false);
}

/* ================================
   BOUTON COMMANDER
================================ */
async function commander() {
  const nom = document.getElementById("nom").value.trim();
  const telephone = document.getElementById("telephone").value.trim();
  const adresse = document.getElementById("adresse").value.trim();

  if (!nom || !telephone || !adresse) {
    alert("❌ Merci de remplir tous les champs");
    return;
  }

  const articles = [
    { name: "CAKE VANILLE VANOISE", qty: 2, price: 6.4 },
    { name: "10 CAPSULES INTENSE-GOLDEN COFFEE", qty: 3, price: 17.9 }
  ];

  // 1️⃣ ENVOI GOOGLE SHEET
  await envoyerCommande({ nom, telephone, adresse, articles });

  // 2️⃣ MESSAGE WHATSAPP
  const message = `
NOUVELLE COMMANDE - MAXI JDC MARKET
Nom: ${nom}
Téléphone: ${telephone}
Adresse: ${adresse}

TOTAL: 69,50 dt
  `.trim();

  const waLink =
    "https://wa.me/" + WHATSAPP_NUM +
    "?text=" + encodeURIComponent(message);

  alert("✅ Commande enregistrée");
  window.open(waLink, "_blank");
}
</script>

</body>
</html>
