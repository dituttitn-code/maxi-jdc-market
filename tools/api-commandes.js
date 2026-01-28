/************************************************************
 * api-commandes.js — MAXI JDC MARKET (COMPLET & PROPRE)
 * FIX: parse "Détails de votre commande" => colonnes Sheets
 * FIX: total sans frais livraison (on prend Sous-total)
 ************************************************************/

/** =========================================================
 * CONFIG
 * ========================================================= */
const FALLBACK_API_URL =
  "https://script.google.com/macros/s/AKfycbzOIsVxlatsaMDIyhL2onPbcxXt-pVt94ImtvYVmIXLPtc-RBDUfclVXAPg8k5Ask6A/exec";

function getApiUrl() {
  if (typeof window !== "undefined") {
    if (window.CONFIG && window.CONFIG.commandeApiUrl) return window.CONFIG.commandeApiUrl;
    if (window.API_URL) return window.API_URL;
  }
  return FALLBACK_API_URL;
}

// TOUS LES STATUTS UNIFIÉS
const DEFAULT_STATUS = "⏳ EN ATTENTE";
const STATUTS_VALIDES = [
  "🟡 NOUVELLE",
  "🔵 EN PRÉPARATION",
  "🟠 EN LIVRAISON",
  "✅ LIVRÉE",
  "❌ ANNULÉE",
  "⏳ EN ATTENTE"
];
const DEFAULT_WA_NUMBER = "0021625600978";

/** =========================================================
 * UTILITAIRES HTTP
 * ========================================================= */
async function requestJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });

    if (!res.ok) {
      const text = await safeReadText(res);
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? " — " + text : ""}`);
    }

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
  try { return await res.text(); } catch { return ""; }
}

function buildGetUrl(method, params = {}) {
  const api = getApiUrl();
  const qs = new URLSearchParams({ method, ...params, t: Date.now() }).toString();
  return `${api}?${qs}`;
}

function buildPostBody(payload) {
  return new URLSearchParams(payload).toString();
}

/** =========================================================
 * HELPERS TEXTE: parsing "Détails de votre commande"
 * ========================================================= */

/**
 * Ex: "67,10 dt" / "67.10 dt" / "67,10" -> 67.10
 */
function parseDtAmount(s) {
  const m = String(s || "")
    .replace(/\u00A0/g, " ")
    .match(/([\d]+(?:[.,]\d{1,3})?)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(",", ".")) || 0;
}

/**
 * Détecte si un texte ressemble au bloc "Détails de votre commande"
 */
function looksLikeDetailsBlock(text) {
  const t = String(text || "");
  return /Détails de votre commande|👤\s*CLIENT|🛒\s*ARTICLES|N°\s*Commande/i.test(t);
}

/**
 * Extrait sections:
 * - CLIENT: nom, telephone, adresse (+ GPS facultatif)
 * - ARTICLES: texte seulement
 * - BAS: commande_id, sous_total, livraison, total
 */
function parseDetailsCommande(rawText) {
  const text = String(rawText || "").replace(/\r/g, "").trim();
  if (!text) return null;

  // Normaliser pour faciliter les regex
  const t = text.replace(/\u00A0/g, " ");

  // --- CLIENT ---
  const nom =
    (t.match(/(?:Nom|NOM)\s*:\s*(.+)/i)?.[1] || "").split("\n")[0]?.trim() || "";
  const telephone =
    (t.match(/(?:Tél|Tel|Téléphone)\s*:\s*(.+)/i)?.[1] || "").split("\n")[0]?.trim() || "";
  const adresse =
    (t.match(/(?:Adresse)\s*:\s*(.+)/i)?.[1] || "").split("\n")[0]?.trim() || "";

  // GPS facultatif
  const gps = (t.match(/GPS\s*:\s*([-\d.]+)\s*,\s*([-\d.]+)/i) || null);

  // --- N° COMMANDE ---
  // Accepte: "N° Commande: CMD-MAXI-20260128-002" ou "Commande: CMD-..."
  const commandeId =
    (t.match(/N[°º]\s*Commande\s*:\s*([A-Z0-9-]+)/i)?.[1] ||
      t.match(/\bCMD-[A-Z0-9-]+\b/i)?.[0] ||
      "").trim();

  // --- PRIX BAS ---
  const sousTotal = parseDtAmount(t.match(/Sous-?total\s*:\s*([^\n]+)/i)?.[1]);
  const livraison = parseDtAmount(t.match(/Livraison\s*:\s*([^\n]+)/i)?.[1]);
  const totalAffiche = parseDtAmount(t.match(/\bTOTAL\b\s*:\s*([^\n]+)/i)?.[1]);

  // --- ARTICLES SECTION ---
  // On prend le bloc entre "🛒 ARTICLES" et "Sous-total" / "Livraison" / "TOTAL" / "N° Commande"
  let articlesBlock = "";
  {
    const startIdx = t.search(/🛒\s*ARTICLES/i);
    if (startIdx >= 0) {
      const afterStart = t.slice(startIdx);
      // coupe au premier indicateur de bas
      const cutIdx = afterStart.search(/Sous-?total\s*:|Livraison\s*:|\bTOTAL\b\s*:|N[°º]\s*Commande\s*:/i);
      articlesBlock = (cutIdx >= 0 ? afterStart.slice(0, cutIdx) : afterStart);

      // enlever l'entête "🛒 ARTICLES"
      articlesBlock = articlesBlock.replace(/🛒\s*ARTICLES/i, "").trim();
    }
  }

  // Nettoyage: enlever lignes séparateurs
  const articlesLines = String(articlesBlock || "")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !/^_{3,}$/.test(l) && !/^-{3,}$/.test(l));

  return {
    nom,
    telephone,
    adresse,
    gps: gps ? { lat: gps[1], lng: gps[2] } : null,
    commande_id: commandeId,
    sous_total: sousTotal,
    livraison,
    total_affiche: totalAffiche,
    articles_lines: articlesLines
  };
}

/** =========================================================
 * ARTICLES: formatage / parsing
 * ========================================================= */

/**
 * IMPORTANT:
 * - Supporte JSON array (objets)
 * - Supporte texte "1x Produit @ 3.00 dt = 3.00 dt"
 * - Supporte format DETAILS (2 lignes): 
 *    "4x BOGA CITRON 1.5L (2137)"
 *    "3,80 dt × 4 = 15,20 dt"
 */
export function normaliserArticles(input) {
  if (!input) return [];

  // 1) tableau d'objets
  if (Array.isArray(input)) {
    return input.map((it) => {
      const produit = String(it.produit || it.nom || it.name || "").trim();
      const quantite = Math.max(1, parseInt(it.quantite ?? it.qty ?? 1, 10) || 1);
      const prix_unitaire = parseFloat(String(it.prix_unitaire ?? it.prix ?? it.price ?? 0).replace(",", ".")) || 0;
      const prix_total = parseFloat((prix_unitaire * quantite).toFixed(2));
      return { produit, quantite, prix_unitaire, prix_total };
    }).filter(a => a.produit);
  }

  // 2) string
  if (typeof input === "string") {
    const s = input.replace(/\r/g, "").trim();
    if (!s) return [];

    // JSON string ?
    try {
      if (s.startsWith("[")) return normaliserArticles(JSON.parse(s));
    } catch { /* ignore */ }

    // Si on reçoit tout le bloc "Détails", extraire uniquement les lignes d'articles
    let lines = s.split("\n").map(x => x.trim()).filter(Boolean);
    if (looksLikeDetailsBlock(s)) {
      const parsed = parseDetailsCommande(s);
      if (parsed?.articles_lines?.length) lines = parsed.articles_lines;
    }

    const out = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Pattern 1: "2x Produit @ 3.00 dt = 6.00 dt"
      let m = line.match(/^(\d+)x\s+(.+?)\s+@\s+([\d.,]+)\s*dt\s*=\s*([\d.,]+)\s*dt$/i);
      if (m) {
        const quantite = parseInt(m[1], 10);
        const produit = m[2].trim();
        const prix_unitaire = parseFloat(m[3].replace(",", "."));
        const prix_total = parseFloat(m[4].replace(",", "."));
        out.push({ produit, quantite, prix_unitaire, prix_total });
        continue;
      }

      // Pattern 2: ligne produit "4x BOGA CITRON ..."
      m = line.match(/^(\d+)x\s+(.+)$/i);
      if (m) {
        const quantite = parseInt(m[1], 10) || 1;
        const produit = m[2].trim();

        // Pattern 2b: si ligne suivante contient prix "3,80 dt × 4 = 15,20 dt"
        const next = lines[i + 1] || "";
        const m2 = next.match(/([\d.,]+)\s*dt\s*[x×]\s*(\d+)\s*=\s*([\d.,]+)\s*dt/i);
        if (m2) {
          const prix_unitaire = parseFloat(m2[1].replace(",", ".")) || 0;
          const prix_total = parseFloat(m2[3].replace(",", ".")) || parseFloat((prix_unitaire * quantite).toFixed(2));
          out.push({ produit, quantite, prix_unitaire, prix_total });
          i += 1; // sauter la ligne prix
        } else {
          out.push({ produit, quantite, prix_unitaire: 0, prix_total: 0 });
        }
        continue;
      }

      // Autres lignes : ignorer (ex: séparateurs, titres)
    }

    return out.filter(a => a.produit);
  }

  return [];
}

export function formaterArticlesTexte(articlesNorm) {
  const arr = normaliserArticles(articlesNorm);
  if (!arr.length) return "";
  return arr.map(a => {
    if (a.prix_unitaire > 0) {
      return `${a.quantite}x ${a.produit} @ ${a.prix_unitaire.toFixed(2)} dt = ${a.prix_total.toFixed(2)} dt`;
    }
    return `${a.quantite}x ${a.produit}`;
  }).join("\n");
}

/**
 * total SANS frais livraison:
 * - si on a un Sous-total => on prend ça
 * - sinon on calcule sum(prix_total)
 * - fallback: fallbackTotal
 */
export function calculerTotal(articlesNorm, fallbackTotal = 0) {
  const arr = normaliserArticles(articlesNorm);
  const sum = arr.reduce((s, a) => s + (parseFloat(a.prix_total) || 0), 0);
  const t = sum > 0 ? sum : (parseFloat(fallbackTotal) || 0);
  return parseFloat(t.toFixed(2));
}

/** =========================================================
 * NUMÉRO COMMANDE LOCAL
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
  const api = getApiUrl();
  try {
    const r = await requestJson(`${api}?method=test&t=${Date.now()}`, {}, 8000);
    return { connecte: !!r.success, message: r.message || "OK", url: api, raw: r };
  } catch {
    try {
      const r2 = await requestJson(buildGetUrl("getAllOrders"), {}, 8000);
      return { connecte: !!r2.success, message: "OK", url: api, raw: r2 };
    } catch (e2) {
      return { connecte: false, message: e2.message || "Erreur", url: api };
    }
  }
}

/** =========================================================
 * ENVOYER COMMANDE (POST saveOrder)
 * ========================================================= */
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  const api = getApiUrl();

  // --- 1) SI on reçoit le gros texte "Détails", on parse et on corrige le mapping ---
  let parsed = null;
  if (typeof dataCommande.articles === "string" && looksLikeDetailsBlock(dataCommande.articles)) {
    parsed = parseDetailsCommande(dataCommande.articles);
  }

  // Champs CLIENT: priorité au haut "Détails"
  const nom = String(parsed?.nom || dataCommande.nom || dataCommande.client_nom || "").trim();
  const telephone = String(parsed?.telephone || dataCommande.telephone || dataCommande.client_telephone || "").trim();
  const adresse = String(parsed?.adresse || dataCommande.adresse || dataCommande.client_adresse || "").trim();

  if (!nom || !telephone || !adresse) {
    throw new Error("Champs manquants: nom / telephone / adresse");
  }

  // N° commande: priorité au bas "Détails"
  const commande_id = String(
    parsed?.commande_id ||
    dataCommande.commande_id ||
    dataCommande.commandeId ||
    ""
  ).trim();

  // ARTICLES: priorité au milieu "Détails"
  let articlesSource = dataCommande.articles;
  if (parsed?.articles_lines?.length) {
    articlesSource = parsed.articles_lines.join("\n");
  }

  const articlesNorm = normaliserArticles(articlesSource);
  const articlesTexte =
    (typeof articlesSource === "string" && !articlesSource.trim().startsWith("["))
      ? String(articlesSource).trim()
      : formaterArticlesTexte(articlesNorm);

  // TOTAL: on veut SANS livraison => prendre Sous-total si présent
  let total = 0;
  if (parsed && parsed.sous_total > 0) {
    total = parsed.sous_total; // ✅ sans frais livraison
  } else {
    total = calculerTotal(articlesNorm, dataCommande.total);
  }

  const payload = {
    method: "saveOrder",
    ...(commande_id ? { commande_id } : {}), // si pas de commande_id, l'API peut en générer un
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
 * RÉCUPÉRER COMMANDES (GET getAllOrders)
 * ========================================================= */
export async function recupererCommandes() {
  const data = await requestJson(buildGetUrl("getAllOrders"), {}, 15000);
  if (!data.success) throw new Error(data.error || data.message || "Erreur récupération commandes");

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
 * SUIVRE UNE COMMANDE (GET getOrderStatus)
 * ========================================================= */
export async function suivreCommande(commandeId) {
  const cid = String(commandeId || "").trim();
  if (!cid) throw new Error("commandeId manquant");

  const data = await requestJson(buildGetUrl("getOrderStatus", {
    commande_id: cid
  }), {}, 12000);

  if (!data.success) throw new Error(data.error || data.message || "Commande non trouvée");

  // ✅ Sécurité: si l'API renvoie un autre id (ex: +1), on refuse
  const returnedId = String(data.commande_id || data.order_id || "").trim();
  if (returnedId && returnedId.toUpperCase() !== cid.toUpperCase()) {
    throw new Error("Commande non trouvée (identifiant différent renvoyé)");
  }

  return {
    Date: data.date || "",
    Nom: data.nom || "",
    Téléphone: data.telephone || "",
    Adresse: data.adresse || "",
    Commande: data.commande_id || cid,
    Articles: data.articles || "",
    Total: data.total || "0",
    Statut: data.statut || DEFAULT_STATUS,
    _raw: data
  };
}

/** =========================================================
 * HISTORIQUE CLIENT
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
 * METTRE À JOUR STATUT (GET updateOrderStatus)
 * ========================================================= */
export async function mettreAJourStatut(commandeId, nouveauStatut) {
  if (!commandeId || !nouveauStatut) throw new Error("Paramètres manquants");

  if (!STATUTS_VALIDES.includes(nouveauStatut)) {
    throw new Error(`Statut invalide. Utilisez l'un de: ${STATUTS_VALIDES.join(", ")}`);
  }

  const data = await requestJson(buildGetUrl("updateOrderStatus", {
    commande_id: commandeId,
    statut: nouveauStatut
  }), {}, 12000);

  if (!data.success) throw new Error(data.error || data.message || "Erreur mise à jour statut");
  return data;
}

/** =========================================================
 * FONCTIONS UTILES POUR LES STATUTS
 * ========================================================= */
export function getStatutsValides() {
  return [...STATUTS_VALIDES];
}

export function getStatutSuivant(statutActuel) {
  const index = STATUTS_VALIDES.indexOf(statutActuel);
  if (index === -1 || index >= STATUTS_VALIDES.length - 1) return null;
  return STATUTS_VALIDES[index + 1];
}

export function formaterStatut(statut) {
  const couleurs = {
    "⏳ EN ATTENTE": "rgba(255, 193, 7, 0.2)",
    "🟡 NOUVELLE": "rgba(255, 235, 59, 0.2)",
    "🔵 EN PRÉPARATION": "rgba(33, 150, 243, 0.2)",
    "🟠 EN LIVRAISON": "rgba(255, 152, 0, 0.2)",
    "✅ LIVRÉE": "rgba(76, 175, 80, 0.2)",
    "❌ ANNULÉE": "rgba(244, 67, 54, 0.2)"
  };

  return {
    texte: statut,
    couleur: couleurs[statut] || "rgba(158, 158, 158, 0.2)",
    emoji: statut.substring(0, 2)
  };
}

/** =========================================================
 * TOP PRODUITS (calcul côté client)
 * ========================================================= */
export async function recupererTopProduits(limit = 10) {
  const orders = await recupererCommandes();
  const map = new Map();

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
 * WHATSAPP helpers
 * ========================================================= */
export function genererLienWhatsAppMagasin(dataCommande, commandeId, waNumber = DEFAULT_WA_NUMBER) {
  const nom = dataCommande?.nom || dataCommande?.client_nom || "";
  const telephone = dataCommande?.telephone || dataCommande?.client_telephone || "";
  const adresse = dataCommande?.adresse || dataCommande?.client_adresse || "";

  let articlesTexte = "";
  if (typeof dataCommande?.articles === "string") {
    // si bloc détails => extraire uniquement articles
    if (looksLikeDetailsBlock(dataCommande.articles)) {
      const p = parseDetailsCommande(dataCommande.articles);
      articlesTexte = p?.articles_lines?.join("\n") || "";
    } else {
      articlesTexte = dataCommande.articles;
    }
  } else {
    articlesTexte = formaterArticlesTexte(dataCommande?.articles);
  }

  // total sans livraison
  let total = 0;
  if (typeof dataCommande?.articles === "string" && looksLikeDetailsBlock(dataCommande.articles)) {
    const p = parseDetailsCommande(dataCommande.articles);
    total = p?.sous_total > 0 ? p.sous_total : calculerTotal(dataCommande?.articles, dataCommande?.total);
  } else {
    total = calculerTotal(dataCommande?.articles, dataCommande?.total);
  }

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
 * EXPORT DEFAULT
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
  ouvrirWhatsApp,
  getStatutsValides,
  getStatutSuivant,
  formaterStatut
};

export default apiCommandes;

if (typeof window !== "undefined") {
  window.apiCommandes = apiCommandes;
  window.STATUTS_VALIDES = STATUTS_VALIDES;
}
