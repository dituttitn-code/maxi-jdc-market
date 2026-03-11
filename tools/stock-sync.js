const STOCK_API_URL = "https://script.google.com/macros/s/AKfycbx1T7J7RRslouJ3l03rXY7VPVloW-MUrvV_mbj5GlRWRxSv8XnR2osWYydwnfKo05YISA/exec";

export async function loadProducts() {
  try {
    const response = await fetch(`${STOCK_API_URL}?mode=all`);
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || "Erreur API stock");
    }

    return data.items || [];
  } catch (error) {
    console.error("Erreur chargement produits:", error);
    return [];
  }
}

export async function autoSyncProducts(renderFunction) {
  async function refresh() {
    const products = await loadProducts();
    if (typeof renderFunction === "function") {
      renderFunction(products);
    }
  }

  await refresh();
  setInterval(refresh, 30000);
}
