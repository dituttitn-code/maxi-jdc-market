const STOCK_API_URL =
  "https://script.google.com/macros/s/AKfycbwBKZWZU3_yD6uy1DamW3wMqqjImMwoX0rPdpEQtq3vPYcZ8dLPOh0XxVAZA5Se7wHInA/exec";

const SYNC_INTERVAL_MS = 30000;

function normalizeProduct(raw, index) {
  const code = String(raw.code ?? raw.Article ?? "").trim();
  const name = String(raw.name ?? raw.Produits ?? "").trim();
  const category = String(raw.category ?? raw.Categorie ?? "Non classé").trim();

  let price = Number(String(raw.price ?? raw.Prix ?? 0).replace(",", "."));
  let originalPrice = Number(
    String(raw.originalPrice ?? raw.price ?? raw.Prix ?? 0).replace(",", ".")
  );
  let stock = Number(String(raw.stock ?? raw.Stock ?? 100).replace(",", "."));

  if (!Number.isFinite(price)) price = 0;
  if (!Number.isFinite(originalPrice)) originalPrice = price;
  if (!Number.isFinite(stock) || stock <= 0) stock = 100;

  return {
    id: raw.id ?? index + 1,
    code: code,
    name: name,
    category: category,
    price: price,
    originalPrice: originalPrice,
    stock: stock,
    unit: raw.unit || "pièce",
    image: raw.image || `images/products/${code}.jpg`,
    active: raw.active !== false && raw.active !== "non",
    promo: raw.promo || null
  };
}

export async function loadProducts(options = {}) {
  try {
    const params = new URLSearchParams({
      mode: "products",
      page: String(options.page || 1),
      limit: String(options.limit || 5000)
    });

    if (options.category) params.set("category", options.category);
    if (options.q) params.set("q", options.q);

    const response = await fetch(`${STOCK_API_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "API error");
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

export async function loadCategories() {
  try {
    const response = await fetch(`${STOCK_API_URL}?mode=categories`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "API error");
    }

    return Array.isArray(data.categories) ? data.categories : [];

  } catch (err) {
    console.error("Erreur loadCategories", err);
    return [];
  }
}

export async function loadProductByCode(code) {
  try {
    const params = new URLSearchParams({
      mode: "product",
      code: String(code || "").trim()
    });

    const response = await fetch(`${STOCK_API_URL}?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok || !data.item) {
      return null;
    }

    return normalizeProduct(data.item, 0);

  } catch (err) {
    console.error("Erreur loadProductByCode", err);
    return null;
  }
}

export async function autoSyncProducts(renderFunction, options = {}) {
  let timer = null;
  let lastSignature = "";

  async function sync() {
    const products = await loadProducts(options);

    const signature = JSON.stringify(
      products.map(p => [
        p.code,
        p.price,
        p.originalPrice,
        p.stock,
        p.category,
        p.name
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
