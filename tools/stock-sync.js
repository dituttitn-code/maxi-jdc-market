const STOCK_API_URL =
  "https://script.google.com/macros/s/AKfycbzB3EDpYBby6J9HWTcVISia_bkW8stDhDIyhPJMpxDtM3mg7MS_86BkkLWhCyz23Fbe1A/exec";

const SYNC_INTERVAL_MS = 30000;

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function normalizePrice(value) {
  let price = toNumber(value, 0);

  // Sécurité : si jamais une source envoie encore des millimes
  // ex: 4300 => 4.300 dt
  if (price > 1000) {
    price = price / 1000;
  }

  return Number(price.toFixed(3));
}

function normalizeStock(value) {
  const stock = toNumber(value, 0);
  return stock >= 0 ? stock : 0;
}

function normalizeProduct(raw, index) {
  const code = String(raw.code || raw.Article || "").trim();
  const name = String(raw.name || raw.Produits || "").trim();
  const category = String(raw.category || raw.Categorie || "Non classé").trim();

  const price = normalizePrice(raw.price ?? raw.Prix ?? 0);
  const stock = normalizeStock(raw.stock ?? raw.Stock ?? 0);

  return {
    id: raw.id || index + 1,
    code: code,
    name: name,
    category: category,
    price: price,
    stock: stock,
    image: raw.image || `images/products/${code}.jpg`,
    active: raw.active !== false,
    inStock: stock > 0
  };
}

export async function loadProducts() {
  try {
    const response = await fetch(`${STOCK_API_URL}?mode=all`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error("API error");
    }

    const items = Array.isArray(data.items) ? data.items : [];

    return items
      .map(normalizeProduct)
      .filter(p => p.code && p.name && p.price > 0 && p.active);

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
      products.map(p => [p.code, p.price, p.stock, p.category, p.active])
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
