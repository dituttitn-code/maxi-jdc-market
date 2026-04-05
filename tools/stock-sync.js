const STOCK_API_URL = "https://script.google.com/macros/s/AKfycbwuuDr-WfsxEj7SJUMnMBsmUlKeinz6FUL3teZLawXuRz_sfUVREofObEclNHL8wOn05A/exec";
const SYNC_INTERVAL_MS = 30000;

function cleanText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePrice(value) {
  let price = toNumber(value, 0);
  if (price > 1000) price = price / 1000; // Gestion des millimes
  return Number(price.toFixed(3));
}

function normalizeProduct(raw, index) {
  const code = cleanText(raw.code || raw.article || "");
  let name = cleanText(raw.name || raw.produits || "");
  if (!name && code) name = `Produit ${code}`;

  const stock = Math.floor(toNumber(raw.stock, 0));
  const price = normalizePrice(raw.price || raw.prix || 0);
  
  // Correction : Catégorie par défaut si vide pour éviter que le produit disparaisse des menus
  let category = cleanText(raw.category || raw.categorie || "");
  if (category === "") category = "Épicerie Salée";

  const active = !["non", "false", "0", "inactif"].includes(cleanText(raw.actif || raw.active).toLowerCase());

  return {
    id: code || `item-${index}`,
    code,
    name,
    category,
    price,
    stock,
    image: `images/products/${code}.jpg`,
    active,
    inStock: stock > 0
  };
}

export async function loadProducts() {
  try {
    const response = await fetch(`${STOCK_API_URL}?t=${Date.now()}`, { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error(`Erreur: ${response.status}`);
    const data = await response.json();
    
    const rows = Array.isArray(data) ? data : (data.products || []);
    const products = rows
      .map((row, idx) => normalizeProduct(row, idx))
      .filter((p) => p.code !== "" && p.active === true);

    console.log(`✅ ${products.length} produits chargés.`);
    return products;
  } catch (err) {
    console.error("❌ Erreur chargement:", err);
    return [];
  }
}

export async function autoSyncProducts(renderFunction) {
  let lastSignature = "";
  async function sync() {
    const products = await loadProducts();
    const signature = JSON.stringify(products.map(p => [p.code, p.stock, p.price, p.active]));
    if (signature !== lastSignature) {
      lastSignature = signature;
      renderFunction(products);
    }
  }
  await sync();
  setInterval(sync, SYNC_INTERVAL_MS);
}
