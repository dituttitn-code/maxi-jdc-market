const STOCK_API_URL =
"https://script.google.com/macros/s/AKfycbzjjImJdP7p2TVd4TIFMK9PzLevWfkVWwrblsINn4gGGlPMzZtYByojtXH4DFgZvxiLhg/exec";

const SYNC_INTERVAL_MS = 30000;

function normalizeProduct(raw, index) {

  const code = String(raw.code || raw.Article || "").trim();
  const name = String(raw.name || raw.Produits || "").trim();
  const category = String(raw.category || raw.Categorie || "Non classé").trim();

  let price = Number(String(raw.price || raw.Prix || 0).replace(",", "."));
  let stock = Number(String(raw.stock || raw.Stock || 100).replace(",", "."));

  if (!Number.isFinite(price)) price = 0;
  if (!Number.isFinite(stock) || stock <= 0) stock = 100;

  return {
    id: raw.id || index + 1,
    code: code,
    name: name,
    category: category,
    price: price,
    stock: stock,
    image: raw.image || `images/products/${code}.jpg`,
    active: raw.active !== false
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

  }

  catch (err) {

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
      products.map(p => [p.code, p.price, p.stock])
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
