/*********************************
 * CONFIG
 *********************************/
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyMa4TcmjykCb_O3VvjaakExOTfXk369B4FZ318WK4TC6jK50Qq9c7gaSuYUB-DS1yY/exec";

/*********************************
 * ENVOYER UNE COMMANDE (GitHub Pages OK)
 *********************************/
export function envoyerCommande(dataCommande) {
  try {
    if (!dataCommande || typeof dataCommande !== "object") {
      console.error("Données de commande invalides", dataCommande);
      return;
    }

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors", // évite l'erreur CORS depuis GitHub Pages
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        nom: dataCommande.nom || "",
        telephone: dataCommande.telephone || "",
        adresse: dataCommande.adresse || "",
        articles: dataCommande.articles || [],
        sousTotal: Number(dataCommande.sousTotal || 0),
        livraison: Number(dataCommande.livraison || 0),
        total: Number(dataCommande.total || 0),
      }),
    });

    // Avec no-cors, on ne peut pas lire la réponse : c'est normal.
    console.log("Commande envoyée à Google Sheets (via Apps Script).");
  } catch (err) {
    console.error("Erreur envoi commande :", err);
  }
}

/*********************************
 * TEST (optionnel)
 *********************************/
export function testCommande() {
  envoyerCommande({
    nom: "TEST API NEW",
    telephone: "111",
    adresse: "Carthage",
    articles: [{ name: "Produit test", qty: 1, price: 5, category: "Test" }],
    sousTotal: 5,
    livraison: 3,
    total: 8,
  });
}
