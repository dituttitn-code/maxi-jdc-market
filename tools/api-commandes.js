// api-commandes.js
const API_COMMANDES = "https://script.google.com/macros/s/AKfycbxpL1Iv3FL1aYy2EwwRyrian8Kv8wwASl43mrebdg0LoEd-ZX2LSPt1HOUQxVvqcbJh/exec";

// articles: tableau [{name, qty, price, category}, ...]
function envoyerCommande({ nom, telephone, adresse, livraison = 0, articles = [] }) {
  const payload = new URLSearchParams({
    action: "create",
    nom: String(nom || "").trim(),
    telephone: String(telephone || "").trim(),
    adresse: String(adresse || "").trim(),
    livraison: String(livraison || 0),
    articles: JSON.stringify(articles || [])
  });

  // no-cors pour éviter le blocage CORS sur GitHub Pages
  return fetch(API_COMMANDES, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: payload
  });
}

