const STOCK_API_URL = "https://script.google.com/macros/s/AKfycbwO238N5IQfqtl0uoOExH3Mhtf3PfO7lEbqg4YyPluJjbsAXvY73r1xE1FmA73wBmHo/exec";

const SYNC_INTERVAL_MS = 30000;

/**
 * Nettoyage et Normalisation
 */
function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePrice(value) {
  let price = toNumber(value, 0);
  if (price > 1000) price = price / 1000;
  return Number(price.toFixed(3));
}

function normalizeStock(value) {
  const stock = Math.floor(toNumber(value, 0));
  return stock >= 0 ? stock : 0;
}

function normalizeActive(value) {
  const v = cleanText(value).toLowerCase();
  return !["non", "false", "0", "inactif", "inactive"].includes(v);
}

/**
 * NORMALISATION INTELLIGENTE
 * Capable de lire un Objet {code, name...} OU un Tableau [A, B, C, D, E, F]
 */
function normalizeProduct(raw, index) {
  const isArray = Array.isArray(raw);

  // Mappage des colonnes Google Sheets : A=0, B=1, C=2, D=3, E=4, F=5
  const code = cleanText(isArray ? raw[0] : (raw.code || raw.Code || raw.Article || ""));
  const name = cleanText(isArray ? raw[1] : (raw.name || raw.Produits || raw.Designation || ""));
  const stock = normalizeStock(isArray ? raw[2] : (raw.stock || raw.Stock || 0));
  const price = normalizePrice(isArray ? raw[3] : (raw.price || raw.Prix || raw["PU.V.TTC"] || 0));
  const category = cleanText(isArray ? raw[4] : (raw.category || raw.Categorie || ""));
  const active = normalizeActive(isArray ? raw[5] : (raw.actif || raw.Actif || "oui"));

  return {
    id: code || `idx-${index}`,
    code,
    name,
    category: category || "Épicerie Salée", // Valeur par défaut pour éviter les trous
    price,
    stock,
    image: `images/products/${code}.jpg`,
    active,
    inStock: stock > 0
  };
}

/**
 * Chargement des données
 */
export async function loadProducts() {
  try {
    const response = await fetch(`${STOCK_API_URL}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    
    // Détection de la structure de réponse
    const rows = Array.isArray(data) ? data : (data.products || []);

    // Filtrage : On garde uniquement ce qui a un code, un nom et qui est actif
    const products = rows
      .map((row, idx) => normalizeProduct(row, idx))
      .filter(p => p.code !== "" && p.name !== "" && p.active === true);

    console.log("Sync terminée :", products.length, "produits chargés.");
    return products;

  } catch (err) {
    console.error("Erreur loadProducts:", err);
    return [];
  }
}

/**
 * Synchronisation automatique
 */
export async function autoSyncProducts(renderFunction) {
  let lastSignature = "";

  async function sync() {
    const products = await loadProducts();
    const signature = JSON.stringify(products);

    if (signature !== lastSignature) {
      lastSignature = signature;
      renderFunction(products);
    }
  }

  await sync();
  const timer = setInterval(sync, SYNC_INTERVAL_MS);
  return () => clearInterval(timer);
}

/**
 * Fonctions de filtrage
 */
export function countProductsByCategory(products) {
  const counts = {};
  products.forEach(p => {
    const cat = p.category || "Épicerie Salée";
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return counts;
}

export function filterProductsByCategory(products, selectedCategory) {
  if (!selectedCategory || selectedCategory === "Tous") return products;
  return products.filter(p => p.category === selectedCategory);
}
