const STOCK_API_URL = "https://script.google.com/macros/s/AKfycbwO238N5IQfqtl0uoOExH3Mhtf3PfO7lEbqg4YyPluJjbsAXvY73r1xE1FmA73wBmHo/exec";

const SYNC_INTERVAL_MS = 30000;

/**
 * Fonctions de nettoyage et sécurité
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
  // Correction automatique si le prix est en millimes (ex: 9300 au lieu de 9.3)
  if (price > 1000) price = price / 1000;
  return Number(price.toFixed(3));
}

function normalizeStock(value) {
  const stock = Math.floor(toNumber(value, 0));
  return stock >= 0 ? stock : 0;
}

function normalizeActive(value) {
  const v = cleanText(value).toLowerCase();
  // Par défaut, si ce n'est pas explicitement "non", on considère que c'est actif
  return !["non", "false", "0", "inactif"].includes(v);
}

/**
 * NORMALISATION ROBUSTE
 * Cette fonction répare les données manquantes (comme les noms vides)
 */
function normalizeProduct(raw, index) {
  const isArray = Array.isArray(raw);

  // Mappage par index (A=0, B=1, C=2, D=3, E=4, F=5) ou par nom de propriété
  const code = cleanText(isArray ? raw[0] : (raw.code || raw.Article || ""));
  
  // SÉCURITÉ : Si le nom est vide, on utilise le code pour que le produit ne disparaisse pas
  let name = cleanText(isArray ? raw[1] : (raw.name || raw.Produits || ""));
  if (!name && code) {
    name = "Produit " + code; 
  }

  const stock = normalizeStock(isArray ? raw[2] : (raw.stock || raw.Stock || 0));
  const price = normalizePrice(isArray ? raw[3] : (raw.price || raw.Prix || 0));
  const category = cleanText(isArray ? raw[4] : (raw.category || raw.Categorie || ""));
  const active = normalizeActive(isArray ? raw[5] : (raw.active || raw.Actif || "oui"));

  return {
    id: code || `item-${index}`,
    code,
    name,
    category: category || "Épicerie Salée", // Catégorie par défaut
    price,
    stock,
    image: `images/products/${code}.jpg`,
    active,
    inStock: stock > 0,
    rawData: raw // Garde une trace pour le debug
  };
}

/**
 * Chargement et Filtrage des données
 */
export async function loadProducts() {
  try {
    const response = await fetch(`${STOCK_API_URL}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) throw new Error(`Erreur Serveur: ${response.status}`);

    const data = await response.json();
    
    // On extrait les lignes peu importe la structure du JSON (Array simple ou Objet .products)
    const rows = Array.isArray(data) ? data : (data.products || []);

    // FILTRE FINAL : On n'affiche que les produits qui ont au moins un code et qui sont actifs
    const products = rows
      .map((row, idx) => normalizeProduct(row, idx))
      .filter(p => p.code !== "" && p.active === true);

    console.log(`✅ ${products.length} produits synchronisés avec succès.`);
    return products;

  } catch (err) {
    console.error("❌ Erreur lors du chargement des produits:", err);
    return [];
  }
}

/**
 * Synchronisation automatique en arrière-plan
 */
export async function autoSyncProducts(renderFunction) {
  let lastSignature = "";

  async function sync() {
    const products = await loadProducts();
    // On ne rafraîchit l'affichage que si les données ont réellement changé
    const signature = JSON.stringify(products.map(p => [p.code, p.stock, p.price]));

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
 * Utilitaires pour l'interface
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
