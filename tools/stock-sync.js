const STOCK_API_URL =
  "https://script.google.com/macros/s/AKfycbx1T7J7RRslouJ3l03rXY7VPVloW-MUrvV_mbj5GlRWRxSv8XnR2osWYydwnfKo05YISA/exec";

/* charger les produits */
export async function loadProducts() {
  try {
    const response = await fetch(STOCK_API_URL + "?mode=all");
    const data = await response.json();

    if (!data.ok) {
      console.error("API erreur", data);
      return [];
    }

    console.log("Produits chargés :", data.total);

    return data.items || [];

  } catch (err) {
    console.error("Erreur API stock", err);
    return [];
  }
}

/* synchronisation automatique */
export async function autoSyncProducts(renderFunction) {

  async function sync() {
    const products = await loadProducts();
    renderFunction(products);
  }

  /* premier chargement */
  await sync();

  /* refresh toutes les 30 secondes */
  setInterval(sync, 30000);
}
