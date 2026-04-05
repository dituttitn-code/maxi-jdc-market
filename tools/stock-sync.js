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

  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePrice(value) {
  let price = toNumber(value, 0);

  // Correction auto si prix en millimes
  if (price > 1000) {
    price = price / 1000;
  }

  return Number(price.toFixed(3));
}

function normalizeStock(value) {
  const stock = Math.floor(toNumber(value, 0));
  return stock >= 0 ? stock : 0;
}

function normalizeActive(value) {
  const v = cleanText(value).toLowerCase();

  // Tout sauf "non/false/0/inactif" = actif
  return !["non", "false", "0", "inactif", "inactive"].includes(v);
}

function normalizeCategory(value) {
  // IMPORTANT : ne pas forcer "Épicerie Salée"
  // si catégorie vide, on la laisse vide
  return cleanText(value);
}

/**
 * NORMALISATION ROBUSTE
 * Compatible avec :
 * - tableau brut [A,B,C,D,E,F]
 * - objets venant de Code.gs
 */
function normalizeProduct(raw, index) {
  const isArray = Array.isArray(raw);

  const code = cleanText(
    isArray
      ? raw[0]
      : (
          raw.code ??
          raw.Code ??
          raw.article ??
          raw.Article ??
          ""
        )
  );

  let name = cleanText(
    isArray
      ? raw[1]
      : (
          raw.name ??
          raw.Name ??
          raw.produits ??
          raw.Produits ??
          raw.produit ??
          raw.Produit ??
          raw["Désignation"] ??
          raw.Designation ??
          ""
        )
  );

  // Sécurité : si nom vide, garder le produit visible
  if (!name && code) {
    name = `Produit ${code}`;
  }

  const stock = normalizeStock(
    isArray
      ? raw[2]
      : (
          raw.stock ??
          raw.Stock ??
          raw.STOCK ??
          0
        )
  );

  const price = normalizePrice(
    isArray
      ? raw[3]
      : (
          raw.price ??
          raw.Price ??
          raw.prix ??
          raw.Prix ??
          raw["PU.V.TTC"] ??
          0
        )
  );

  const category = normalizeCategory(
    isArray
      ? raw[4]
      : (
          raw.category ??
          raw.Category ??
          raw.categorie ??
          raw.Categorie ??
          ""
        )
  );

  const active = normalizeActive(
    isArray
      ? raw[5]
      : (
          raw.actif ??
          raw.Actif ??
          raw.active ??
          raw.Active ??
          "oui"
        )
  );

  return {
    id: code || `item-${index}`,
    code,
    name,
    category,
    price,
    stock,
    image: `images/products/${code}.jpg`,
    active,
    inStock: stock > 0,
    rawData: raw
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

    if (!response.ok) {
      throw new Error(`Erreur Serveur: ${response.status}`);
    }

    const data = await response.json();
    console.log("DATA Google Sheets =", data);

    // Supporte soit :
    // 1) un tableau direct []
    // 2) un objet { products: [...] }
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data.products)
        ? data.products
        : [];

    const products = rows
      .map((row, idx) => normalizeProduct(row, idx))
      .filter((p) => p.code !== "" && p.active === true);

    console.log(`✅ ${products.length} produits synchronisés avec succès.`, products);

    return products;
  } catch (err) {
    console.error("❌ Erreur lors du chargement des produits:", err);
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

    const signature = JSON.stringify(
      products.map((p) => [
        p.code,
        p.name,
        p.stock,
        p.price,
        p.category,
        p.active
      ])
    );

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
 * Utilitaires interface
 */
export function countProductsByCategory(products) {
  const counts = {};

  products.forEach((p) => {
    const cat = p.category && p.category.trim() !== ""
      ? p.category
      : "Non classé";

    counts[cat] = (counts[cat] || 0) + 1;
  });

  return counts;
}

export function filterProductsByCategory(products, selectedCategory) {
  if (!selectedCategory || selectedCategory === "Tous") {
    return products;
  }

  if (selectedCategory === "Non classé") {
    return products.filter((p) => !cleanText(p.category));
  }

  return products.filter((p) => p.category === selectedCategory);
}
