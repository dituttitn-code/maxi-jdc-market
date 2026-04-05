const STOCK_API_URL =
  "https://script.google.com/macros/s/AKfycbzYQG0qjx1yE3vXgF-_j_53jBkU-CpTdPVW8Uf2Ws0UVg4Tjf_KqcH9SoVfpSGuDjk9GQ/exec";

const SYNC_INTERVAL_MS = 30000;

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

function normalizeCategory(value) {
  return cleanText(value);
}

function normalizeProduct(raw, index) {
  const code = cleanText(
    raw.code ??
    raw.Code ??
    raw.article ??
    raw.Article ??
    ""
  );

  const name = cleanText(
    raw.name ??
    raw.Name ??
    raw.produits ??
    raw.Produits ??
    raw.produit ??
    raw.Produit ??
    raw["Désignation"] ??
    raw.Designation ??
    ""
  );

  const category = normalizeCategory(
    raw.category ??
    raw.Category ??
    raw.categorie ??
    raw.Categorie ??
    ""
  );

  const price = normalizePrice(
    raw.price ??
    raw.Price ??
    raw.prix ??
    raw.Prix ??
    raw["PU.V.TTC"] ??
    0
  );

  const stock = normalizeStock(
    raw.stock ??
    raw.Stock ??
    raw.STOCK ??
    0
  );

  const active = normalizeActive(
    raw.actif ??
    raw.Actif ??
    raw.active ??
    raw.Active ??
    "oui"
  );

  return {
    id: raw.id || code || index + 1,
    code,
    name,
    category,
    price,
    stock,
    image: raw.image || `images/products/${code}.jpg`,
    active,
    inStock: stock > 0,
    raw
  };
}

export async function loadProducts() {
  try {
    const response = await fetch(`${STOCK_API_URL}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log("DATA Google Sheets =", data);

    // IMPORTANT :
    // Code.gs renvoie directement un tableau
    // mais on accepte aussi { products: [...] } si jamais ça change
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data.products)
        ? data.products
        : [];

    const products = rows
      .map(normalizeProduct)
      .filter((p) => p.code && p.name && p.active);

    console.log("Produits normalisés =", products.length, products);

    return products;

  } catch (err) {
    console.error("Erreur loadProducts", err);
    return [];
  }
}

export async function autoSyncProducts(renderFunction) {
  let timer = null;
  let lastSignature = "";

  async function sync() {
    const products = await loadProducts();

    const signature = JSON.stringify(
      products.map((p) => [
        p.code,
        p.name,
        p.price,
        p.stock,
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
  timer = setInterval(sync, SYNC_INTERVAL_MS);

  return () => {
    if (timer) clearInterval(timer);
  };
}

export function countProductsByCategory(products) {
  const counts = {};

  for (const product of products) {
    const category = cleanText(product.category) || "Non classé";
    counts[category] = (counts[category] || 0) + 1;
  }

  return counts;
}

export function filterProductsByCategory(products, selectedCategory) {
  if (!selectedCategory || selectedCategory === "Tous") {
    return products;
  }

  if (selectedCategory === "Non classé") {
    return products.filter((product) => !cleanText(product.category));
  }

  return products.filter((product) => {
    return cleanText(product.category) === selectedCategory;
  });
}
