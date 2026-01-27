/************************************************************
 * api-commandes.js — MAXI JDC MARKET (COMPLET & PROPRE)
 * ----------------------------------------------------------
 * ✅ Compatible avec Google Apps Script WebApp (API)
 * Endpoints attendus côté code.gs :
 *   - POST  : method=saveOrder
 *   - GET   : method=getAllOrders
 *   - GET   : method=getOrderStatus&commande_id=...
 *   - GET   : method=updateOrderStatus&commande_id=...&statut=...
 *
 * ✅ Gère les 8 colonnes Google Sheet :
 *   DATE | NOM CLIENT | TÉLÉPHONE | ADRESSE | N° COMMANDE | ARTICLES | TOTAL | STATUT
 *
 * ✅ Plus d’erreur ".data" (bug supprimé)
 * ✅ Timeout + erreurs propres
 ************************************************************/

/** =========================================================
 * CONFIG
 * ========================================================= */
const FALLBACK_API_URL =
  "https://script.google.com/macros/s/REPLACE_ME/exec"; // <- sécurité si pas de CONFIG

function getApiUrl() {
  // Priorité : window.CONFIG.commandeApiUrl (comme ton index.html)
  // Sinon : window.API_URL (certaines pages)
  // Sinon : FALLBACK
  if (typeof window !== "undefined") {
    if (window.CONFIG && window.CONFIG.commandeApiUrl) return window.CONFIG.commandeApiUrl;
    if (window.API_URL) return window.API_URL;
  }
  return FALLBACK_API_URL;
}

const DEFAULT_STATUS = "En attente";
const DEFAULT_WA_NUMBER = "0021625600978"; // WhatsApp magasin (Business)

/** =========================================================
 * UTILITAIRES HTTP
 * ========================================================= */
async function requestJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    // Apps Script renvoie souvent 200 + JSON
    // Mais si erreur HTTP, on la remonte clairement
    if (!res.ok) {
      const text = await safeReadText(res);
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? " — " + text : ""}`);
    }

    // Certains déploiements renvoient text/plain -> on tente JSON
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Réponse API non-JSON: " + text.slice(0, 200));
    }
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Timeout API (" + timeoutMs + "ms)");
    throw err;
  } finally {
    clearTimeout(t);
  }
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function buildGetUrl(method, params = {}) {
  const api = getApiUrl();
  const qs = new URLSearchParams({ method, ...params, t: Date.now() }).toString();
  return `${api}?${qs}`;
}

function buildPostBody(payload) {
  // Apps Script doPost lit e.parameter pour x-www-form-urlencoded
  return new URLSearchParams(payload).toString();
}

/** =========================================================
 * ARTICLES: formatage / parsing
 * ========================================================= */
export function normaliserArticles(input) {
  // Retourne un tableau d’articles normalisés :
  // { produit, quantite, prix_unitaire, prix_total }
  if (!input) return [];

  // 1) Si déjà tableau
  if (Array.isArray(input)) {
    return input.map((it) => {
      const produit = String(it.produit || it.nom || it.name || "").trim();
      const quantite = Math.max(1, parseInt(it.quantite ?? it.qty ?? 1, 10) || 1);
      const prix_unitaire = parseFloat(it.prix_unitaire ?? it.prix ?? it.price ?? 0) || 0;
      const prix_total = parseFloat((prix_unitaire * quantite).toFixed(2));
      return { produit, quantite, prix_unitaire, prix_total };
    }).filter(a => a.produit);
  }

  // 2) Si string JSON
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];
    try {
      if (s.startsWith("[")) {
        const parsed = JSON.parse(s);
        return normaliserArticles(parsed);
      }
    } catch {
      // pas JSON -> on parse en texte
    }

    // 3) Parse format texte:
    // "3x Produit @ 15.00 dt = 45.00 dt" ou "3x Produit"
    const lines = s.split("\n").map(x => x.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      let m = line.match(/^(\d+)x\s+(.+?)\s+@\s+([\d.,]+)\s*dt\s*=\s*([\d.,]+)\s*dt$/i);
      if (m) {
        const quantite = parseInt(m[1], 10);
        const produit = m[2].trim();
        const prix_unitaire = parseFloat(m[3].replace(",", "."));
        const prix_total = parseFloat(m[4].replace(",", "."));
        out.push({ produit, quantite, prix_unitaire, prix_total });
        continue;
      }
      m = line.match(/^(\d+)x\s+(.+)$/i);
      if (m) {
        out.push({ produit: m[2].trim(), quantite: parseInt(m[1], 10), prix_unitaire: 0, prix_total: 0 });
      }
    }
    return out;
  }

  return [];
}

export function formaterArticlesTexte(articlesNorm) {
  // Convertit en texte multi-lignes lisible (colonne "ARTICLES")
  const arr = normaliserArticles(articlesNorm);
  if (!arr.length) return "";
  return arr.map(a => {
    if (a.prix_unitaire > 0) {
      return `${a.quantite}x ${a.produit} @ ${a.prix_unitaire.toFixed(2)} dt = ${a.prix_total.toFixed(2)} dt`;
    }
    return `${a.quantite}x ${a.produit}`;
  }).join("\n");
}

export function calculerTotal(articlesNorm, fallbackTotal = 0) {
  const arr = normaliserArticles(articlesNorm);
  const sum = arr.reduce((s, a) => s + (parseFloat(a.prix_total) || 0), 0);
  const t = sum > 0 ? sum : (parseFloat(fallbackTotal) || 0);
  return parseFloat(t.toFixed(2));
}

/** =========================================================
 * NUMÉRO COMMANDE LOCAL (si besoin côté front)
 * ========================================================= */
export function genererNumeroCommandeLocal(prefix = "CMD-MAXI") {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const key = `last_order_${date}`;
  let last = 0;
  try { last = parseInt(localStorage.getItem(key) || "0", 10) || 0; } catch {}
  last += 1;
  try { localStorage.setItem(key, String(last)); } catch {}
  const seq = String(last).padStart(3, "0");
  return `${prefix}-${date}-${seq}`;
}

/** =========================================================
 * TEST API
 * ========================================================= */
export async function testerConnexionAPI() {
  // Certains code.gs ont method=test, d’autres non.
  // On essaye "test", sinon on tente "getAllOrders".
  const api = getApiUrl();
  try {
    const r = await requestJson(`${api}?method=test&t=${Date.now()}`, {}, 8000);
    return { connecte: !!r.success, message: r.message || "OK", url: api, raw: r };
  } catch {
    try {
      const r2 = await requestJson(buildGetUrl("getAllOrders"), {}, 8000);
      return { connecte: !!r2.success, message: "OK", url: api, raw: r2 };
    } catch (e2) {
      return { connecte: false, message: e2.message || "Erreur", url نشان: api };
    }
  }
}

/** =========================================================
 * ENVOYER COMMANDE (écriture)
 * ========================================================= */
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  const api = getApiUrl();

  const nom = String(dataCommande.nom || dataCommande.client_nom || "").trim();
  const telephone = String(dataCommande.telephone || dataCommande.client_telephone || "").trim();
  const adresse = String(dataCommande.adresse || dataCommande.client_adresse || "").trim();

  if (!nom || !telephone || !adresse) {
    throw new Error("Champs manquants: nom / telephone / adresse");
  }

  const commande_id = String(dataCommande.commande_id || dataCommande.commandeId || "").trim() || "";
  const articlesNorm = normaliserArticles(dataCommande.articles);
  const articlesTexte =
    typeof dataCommande.articles === "string" && !dataCommande.articles.trim().startsWith("[")
      ? dataCommande.articles
      : formaterArticlesTexte(articlesNorm);

  const total = calculerTotal(articlesNorm, dataCommande.total);

  const payload = {
    method: "saveOrder",
    // si tu veux générer le numéro côté front, passe commande_id
    ...(commande_id ? { commande_id } : {}),
    nom,
    telephone,
    adresse,
    articles: articlesTexte,
    total: total.toFixed(2),
  };

  const result = await requestJson(api, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildPostBody(payload),
  });

  if (!result || !result.success) {
    throw new Error(result?.error || result?.message || "Erreur API lors de l'enregistrement");
  }

  // Normaliser la réponse
  return {
    success: true,
    commande_id: result.commande_id || result.order_id || commande_id,
    statut: result.statut || result.status || DEFAULT_STATUS,
    sheets_url: result.sheets_url,
    whatsapp_url: result.whatsapp_url,
    raw: result
  };
}

/** =========================================================
 * RÉCUPÉRER COMMANDES (lecture)
 * ========================================================= */
export async function recupererCommandes() {
  const data = await requestJson(buildGetUrl("getAllOrders), {}, 15000);
  if (!data.success) throw new Error(data.error || data.message || "Erreur récupération commandes");

  // attend: orders: [{date, nom, telephone, adresse, commande_id, articles, total, statut}]
  const orders = Array.isArray(data.orders) ? data.orders : [];
  return orders.map(o => ({
    date: o.date || o.Date || "",
    nom: o.nom || o.Nom || "",
    telephone: o.telephone || o["Téléphone"] || o.Telephone || "",
    adresse: o.adresse || o.Adresse || "",
    commande_id: o.commande_id || o.order_id || o.Commande || "",
    articles: o.articles || o.Articles || "",
    total: o.total || o.Total || "0",
    statut: o.statut || o.status || o.Statut || DEFAULT_STATUS,
    _raw: o
  }));
}

/** =========================================================
 * SUIVRE UNE COMMANDE (client)
 * ========================================================= */
export async function suivreCommande(commandeId) {
  if (!commandeId) throw new Error("commandeId manquant");

  const data = await requestJson(buildGetUrl("getOrderStatus", {
    commande_id: commandeId
  }), {}, 12000);

  if (!data.success) throw new Error(data.error || data.message || "Commande non trouvée");

  return {
    Date: data.date || "",
    Nom: data.nom || "",
    Téléphone: data.telephone || "",
    Adresse: data.adresse || "",
    Commande: data.commande_id || commandeId,
    Articles: data.articles || "",
    Total: data.total || "0",
    Statut: data.statut || DEFAULT_STATUS,
    _raw: data
  };
}

/** =========================================================
 * HISTORIQUE CLIENT (si code.gs ne l’a pas, on filtre en client)
 * ========================================================= */
export async function recupererHistorique(telephone) {
  const tel = String(telephone || "").trim();
  if (!tel) return [];

  const all = await recupererCommandes();
  return all
    .filter(o => String(o.telephone || "").includes(tel))
    .map(o => ({
      Date: o.date,
      Nom: o.nom,
      Téléphone: o.telephone,
      Adresse: o.adresse,
      Commande: o.commande_id,
      Articles: o.articles,
      Total: o.total,
      Statut: o.statut,
      _raw: o._raw
    }));
}

/** =========================================================
 * METTRE À JOUR STATUT
 * ========================================================= */
export async function mettreAJourStatut(commandeId, nouveauStatut) {
  if (!commandeId || !nouveauStatut) throw new Error("Paramètres manquants");

  const data = await requestJson(buildGetUrl("updateOrderStatus", {
    commande_id: commandeId,
    statut: nouveauStatut
  }), {}, 12000);

  if (!data.success) throw new Error(data.error || data.message || "Erreur mise à jour statut");
  return data;
}

/** =========================================================
 * TOP PRODUITS (calcul côté client à partir des commandes)
 * ========================================================= */
export async function recupererTopProduits(limit = 10) {
  const orders = await recupererCommandes();
  const map = new Map(); // produit -> {produit, quantite, chiffre}

  for (const o of orders) {
    const items = normaliserArticles(o.articles);
    for (const it of items) {
      const k = it.produit;
      const prev = map.get(k) || { produit: k, quantite: 0, chiffre: 0 };
      prev.quantite += it.quantite || 0;
      prev.chiffre += (it.prix_total || 0);
      map.set(k, prev);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.quantite - a.quantite)
    .slice(0, Math.max(1, limit));
}

/** =========================================================
 * WHATSAPP — helpers
 * (ne “send” pas via API officielle; construit un lien wa.me)
 * ========================================================= */
export function genererLienWhatsAppMagasin(dataCommande, commandeId, waNumber = DEFAULT_WA_NUMBER) {
  const nom = dataCommande?.nom || dataCommande?.client_nom || "";
  const telephone = dataCommande?.telephone || dataCommande?.client_telephone || "";
  const adresse = dataCommande?.adresse || dataCommande?.client_adresse || "";
  const articlesTexte = typeof dataCommande?.articles === "string"
    ? dataCommande.articles
    : formaterArticlesTexte(dataCommande?.articles);

  const total = calculerTotal(dataCommande?.articles, dataCommande?.total);

  const msg =
`📦 NOUVELLE COMMANDE - MAXI JDC MARKET
N°: ${commandeId}
Date: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}

👤 CLIENT
Nom: ${nom}
Tél: ${telephone}
Adresse: ${adresse}

🛒 ARTICLES
${articlesTexte}

💰 TOTAL: ${total.toFixed(2)} dt
📊 STATUT: ${DEFAULT_STATUS}
`;

  const url = `https://wa.me/${String(waNumber).replace(/\s+/g, "")}?text=${encodeURIComponent(msg)}`;
  return { url, message: msg };
}

export function ouvrirWhatsApp(url) {
  if (typeof window === "undefined") return false;
  window.open(url, "_blank", "noopener");
  return true;
}

/** =========================================================
 * EXPORT DEFAULT (pratique)
 * ========================================================= */
const apiCommandes = {
  envoyerCommande,
  recupererCommandes,
  suivreCommande,
  recupererHistorique,
  mettreAJourStatut,
  recupererTopProduits,
  normaliserArticles,
  formaterArticlesTexte,
  calculerTotal,
  genererNumeroCommandeLocal,
  testerConnexionAPI,
  genererLienWhatsAppMagasin,
  ouvrirWhatsApp
};

export default apiCommandes;

// Optionnel: exposer en console (debug)
if (typeof window !== "undefined") {
  window.apiCommandes = apiCommandes;
}
