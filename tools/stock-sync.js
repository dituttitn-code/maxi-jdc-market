/*********************************
 STOCK SYNC - MAXI JDC MARKET
 Synchronisation Google Sheets
*********************************/

const STOCK_API_URL =
  "https://script.google.com/macros/s/AKfycbx1T7J7RRslouJ3l03rXY7VPVloW-MUrvV_mbj5GlRWRxSv8XnR2osWYydwnfKo05YISA/exec";

/*********************************
 Charger tous les produits
*********************************/
export async function loadProducts() {
  try {
    const res = await fetch(STOCK_API_URL + "?mode=all");
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Erreur API stock");
    }

    console.log("📦 Produits chargés:", data.items);

    return data.items;

  } catch (err) {
    console.error("❌ Erreur chargement produits:", err);
    return [];
  }
}

/*********************************
 Charger promotions
*********************************/
export async function loadPromotions() {
  try {
    const res = await fetch(STOCK_API_URL + "?mode=promotions");
    const data = await res.json();

    if (!data.ok) return [];

    return data.items;

  } catch (err) {
    console.error("Erreur promotions:", err);
    return [];
  }
}

/*********************************
 Charger catégories
*********************************/
export async function loadCategories() {
  try {
    const res = await fetch(STOCK_API_URL + "?mode=categories");
    const data = await res.json();

    if (!data.ok) return {};

    return data.categories;

  } catch (err) {
    console.error("Erreur catégories:", err);
    return {};
  }
}

/*********************************
 Synchronisation automatique
*********************************/
export async function autoSyncProducts(renderFunction) {

  async function refresh() {
    const products = await loadProducts();

    if (renderFunction && typeof renderFunction === "function") {
      renderFunction(products);
    }
  }

  await refresh();

  // refresh toutes les 30 sec
  setInterval(refresh, 30000);
}
