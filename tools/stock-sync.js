// REMPLACEZ CETTE URL par votre URL de déploiement la plus récente
const STOCK_API_URL = "https://script.google.com/macros/s/AKfycbysxkq2maMahmaPW0-a5sQoqHMNM5NtVq9FWjOxHaf4lJMocTQn6Utmy8_cJCNOUTBNwA/exec";

const SYNC_INTERVAL_MS = 30000;

function cleanText(v) { return v ? String(v).trim() : ""; }

function toNumber(v) {
  if (!v || v === "") return 0;
  const n = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function normalizeProduct(raw, index) {
  // Support du format objet {code, name...} ou tableau [A, B, C...]
  const isArr = Array.isArray(raw);
  const code = cleanText(isArr ? raw[0] : (raw.code || raw.article || ""));
  const name = cleanText(isArr ? raw[1] : (raw.name || raw.produits || ""));
  const stock = toNumber(isArr ? raw[2] : raw.stock);
  const price = toNumber(isArr ? raw[3] : raw.price);
  const cat = cleanText(isArr ? raw[4] : (raw.category || raw.categorie || "Épicerie Salée"));
  const actif = cleanText(isArr ? raw[5] : (raw.actif || "oui")).toLowerCase();

  return {
    id: code || `item-${index}`,
    code: code,
    name: name || `Produit ${code}`,
    category: cat === "" ? "Épicerie Salée" : cat,
    price: price > 1000 ? price / 1000 : price, // Correction millimes
    stock: stock,
    image: `images/products/${code}.jpg`,
    active: actif !== "non", // On accepte tout sauf "non"
    inStock: true // ON FORCE L'AFFICHAGE même si stock est à 0
  };
}

export async function loadProducts() {
  try {
    const resp = await fetch(`${STOCK_API_URL}?t=${Date.now()}`);
    if (!resp.ok) throw new Error("Erreur réseau");
    const data = await resp.json();
    
    const rows = Array.isArray(data) ? data : (data.products || []);
    
    // FILTRE SIMPLIFIÉ : On affiche tout ce qui a un code
    const products = rows
      .map((row, idx) => normalizeProduct(row, idx))
      .filter(p => p.code !== ""); 

    console.log("✅ Produits chargés :", products.length);
    return products;
  } catch (err) {
    console.error("❌ Erreur :", err);
    return [];
  }
}

export async function autoSyncProducts(renderFunction) {
  async function sync() {
    const products = await loadProducts();
    renderFunction(products);
  }
  await sync();
  setInterval(sync, SYNC_INTERVAL_MS);
}
