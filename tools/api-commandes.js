/************************************************************
 * api-commandes.js — MAXI JDC MARKET (CORRIGÉ)
 ************************************************************/

/** =========================================================
 * CONFIG
 * ========================================================= */
const FALLBACK_API_URL = "https://script.google.com/macros/s/AKfycbzOIsVxlatsaMDIyhL2onPbcxXt-pVt94ImtvYVmIXLPtc-RBDUfclVXAPg8k5Ask6A/exec";

function getApiUrl() {
  if (typeof window !== "undefined") {
    if (window.CONFIG && window.CONFIG.commandeApiUrl) return window.CONFIG.commandeApiUrl;
    if (window.API_URL) return window.API_URL;
  }
  return FALLBACK_API_URL;
}

const DEFAULT_STATUS = "⏳ EN ATTENTE";
const STATUTS_VALIDES = [
  "🟡 NOUVELLE",
  "🔵 EN PRÉPARATION", 
  "🟠 EN LIVRAISON",
  "✅ LIVRÉE",
  "❌ ANNULÉE",
  "⏳ EN ATTENTE"
];

const FRAIS_LIVRAISON = 3.00;
const MINIMUM_LIVRAISON = 15.00;
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
  return new URLSearchParams(payload).toString();
}

/** =========================================================
 * FONCTIONS DE PARSING CORRIGÉES
 * ========================================================= */

/**
 * Parse les données brutes pour extraire les informations correctement
 * Format attendu dans "Détails de votre commande":
 * 
 * Partie haute: 👤 NOM, 📞 TÉLÉPHONE, 📍 ADRESSE
 * Partie milieu: 🛒 ARTICLES
 * Partie basse: 🆔 N° COMMANDE, 💰 TOTAL
 */
export function parserDonneesCommande(rawData) {
  const result = {
    nom: "",
    telephone: "",
    adresse: "",
    articles: "",
    commande_id: "",
    total: 0
  };

  if (!rawData) return result;

  const text = String(rawData).trim();
  
  // 1. Extraire le numéro de commande correct (dans les ARTICLES actuellement)
  const idMatch = text.match(/🆔\s*N°?\s*COMMANDE?\s*[:：]?\s*([A-Z0-9\-]+)/i) ||
                  text.match(/Commande\s*[:：]?\s*([A-Z0-9\-]+)/i) ||
                  text.match(/(CMD-[A-Z0-9\-]+)/i);
  
  if (idMatch && idMatch[1]) {
    result.commande_id = idMatch[1].trim().toUpperCase();
  }

  // 2. Extraire le nom client (partie haute)
  const nomMatch = text.match(/👤\s*(?:NOM)?\s*[:：]?\s*([^\n📞📍]+)/i) ||
                   text.match(/Client\s*[:：]?\s*([^\n📞📍]+)/i);
  if (nomMatch && nomMatch[1]) {
    result.nom = nomMatch[1].trim();
  }

  // 3. Extraire le téléphone (partie haute)
  const telMatch = text.match(/📞\s*(?:TÉL|TEL|PHONE)?\s*[:：]?\s*([^\n📍]+)/i) ||
                   text.match(/T[ée]l[ée]phone\s*[:：]?\s*([^\n📍]+)/i);
  if (telMatch && telMatch[1]) {
    result.telephone = telMatch[1].trim().replace(/\s+/g, '');
  }

  // 4. Extraire l'adresse (dans les ARTICLES actuellement, doit être déplacée)
  const adresseMatch = text.match(/📍\s*(?:ADRESSE)?\s*[:：]?\s*([^\n🛒👤📞]+)/i) ||
                       text.match(/Adresse\s*[:：]?\s*([^\n🛒👤📞]+)/i);
  
  if (adresseMatch && adresseMatch[1]) {
    result.adresse = adresseMatch[1].trim();
  } else {
    // Chercher l'adresse dans la partie articles (cas où elle est mal placée)
    const articlesSection = text.split('🛒')[1] || '';
    const possibleAdresse = articlesSection.split('\n').find(line => 
      line.includes('rue') || line.includes('avenue') || line.includes('Rue') || 
      line.includes('Avenue') || line.includes('immeuble') || line.includes('appartement') ||
      (line.length > 30 && !line.includes('x') && !line.includes('@') && !line.includes('dt'))
    );
    if (possibleAdresse) {
      result.adresse = possibleAdresse.trim();
    }
  }

  // 5. Extraire les articles (partie milieu)
  // Trouver la section entre 🛒 ARTICLES et le prochain emoji ou la fin
  const articlesStart = text.indexOf('🛒');
  if (articlesStart !== -1) {
    const afterArticles = text.substring(articlesStart);
    const nextSection = afterArticles.search(/🆔|💰|👤|📞|📍/);
    const articlesText = nextSection !== -1 
      ? afterArticles.substring(0, nextSection)
      : afterArticles;
    
    // Nettoyer les articles: retirer l'adresse si elle s'y trouve
    let cleanedArticles = articlesText.replace(/🛒\s*(?:ARTICLES)?\s*[:：]?\s*/i, '');
    if (result.adresse) {
      cleanedArticles = cleanedArticles.replace(result.adresse, '').replace(/📍\s*ADRESSE.*/i, '');
    }
    
    // Retirer le numéro de commande si présent dans les articles
    if (result.commande_id) {
      cleanedArticles = cleanedArticles.replace(new RegExp(result.commande_id, 'g'), '');
    }
    
    result.articles = cleanedArticles.trim();
  }

  // 6. Extraire le total
  const totalMatch = text.match(/💰\s*(?:TOTAL)?\s*[:：]?\s*([\d.,]+)\s*dt?/i) ||
                     text.match(/Total\s*[:：]?\s*([\d.,]+)\s*dt?/i);
  if (totalMatch && totalMatch[1]) {
    const totalStr = totalMatch[1].replace(',', '.');
    result.total = parseFloat(totalStr);
    
    // S'assurer que les frais de livraison ne sont pas inclus deux fois
    const articlesTotal = calculerTotalArticles(result.articles);
    if (result.total > articlesTotal && (result.total - articlesTotal) === FRAIS_LIVRAISON) {
      // Les frais sont déjà inclus, ne rien faire
    } else if (result.total > 0 && result.total < MINIMUM_LIVRAISON) {
      // Ajouter les frais de livraison si nécessaire
      result.total += FRAIS_LIVRAISON;
    }
  }

  return result;
}

/** =========================================================
 * ARTICLES: formatage / parsing
 * ========================================================= */
export function normaliserArticles(input) {
  if (!input) return [];
  
  if (Array.isArray(input)) {
    return input
      .map((it) => {
        const produit = String(it.produit || it.nom || it.name || "").trim();
        const quantite = Math.max(1, parseInt(it.quantite ?? it.qty ?? 1, 10) || 1);
        const prix_unitaire = parseFloat(it.prix_unitaire ?? it.prix ?? it.price ?? 0) || 0;
        const prix_total = parseFloat((prix_unitaire * quantite).toFixed(2));
        return { produit, quantite, prix_unitaire, prix_total };
      })
      .filter(a => a.produit && !a.produit.includes('📍') && !a.produit.includes('ADRESSE'));
  }
  
  if (typeof input === "string") {
    const s = input.trim();
    if (!s) return [];
    
    try {
      if (s.startsWith("[")) return normaliserArticles(JSON.parse(s));
    } catch {}
    
    const lines = s.split("\n").map(x => x.trim()).filter(Boolean);
    const out = [];
    
    for (const line of lines) {
      // Ignorer les lignes qui contiennent des informations d'adresse
      if (line.includes('📍') || line.includes('ADRESSE') || 
          line.includes('rue') || line.includes('Rue') ||
          line.includes('avenue') || line.includes('Avenue') ||
          line.includes('immeuble') || line.includes('Immeuble') ||
          line.includes('appartement') || line.includes('Appartement')) {
        continue;
      }
      
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
        out.push({
          produit: m[2].trim(),
          quantite: parseInt(m[1], 10),
          prix_unitaire: 0,
          prix_total: 0
        });
      } else if (line && !line.includes('🆔') && !line.includes('💰')) {
        // Si la ligne n'est pas vide et ne contient pas d'emoji spécial
        out.push({
          produit: line.trim(),
          quantite: 1,
          prix_unitaire: 0,
          prix_total: 0
        });
      }
    }
    return out;
  }
  
  return [];
}

export function calculerTotalArticles(articlesNorm) {
  const arr = normaliserArticles(articlesNorm);
  const sum = arr.reduce((s, a) => s + (parseFloat(a.prix_total) || 0), 0);
  return parseFloat(sum.toFixed(2));
}

export function calculerTotalAvecFrais(articlesNorm, totalSaisi = 0) {
  const totalArticles = calculerTotalArticles(articlesNorm);
  let totalFinal = parseFloat(totalSaisi) || totalArticles;
  
  // Ajouter frais de livraison si nécessaire
  if (totalFinal < MINIMUM_LIVRAISON && totalFinal > 0) {
    totalFinal += FRAIS_LIVRAISON;
  }
  
  // Vérifier que les frais ne sont pas déjà inclus
  const difference = totalFinal - totalArticles;
  if (difference === FRAIS_LIVRAISON) {
    // Frais déjà inclus, ne rien faire
  } else if (totalArticles > 0 && totalFinal === totalArticles) {
    // Ajouter frais si commande < minimum
    if (totalArticles < MINIMUM_LIVRAISON) {
      totalFinal += FRAIS_LIVRAISON;
    }
  }
  
  return parseFloat(totalFinal.toFixed(2));
}

export function formaterArticlesTexte(articlesNorm) {
  const arr = normaliserArticles(articlesNorm);
  if (!arr.length) return "";
  
  return arr
    .map(a => {
      if (a.prix_unitaire > 0) {
        return `${a.quantite}x ${a.produit} @ ${a.prix_unitaire.toFixed(2)} dt = ${a.prix_total.toFixed(2)} dt`;
      }
      return `${a.quantite}x ${a.produit}`;
    })
    .join("\n");
}

/** =========================================================
 * NUMÉRO COMMANDE LOCAL
 * ========================================================= */
export function genererNumeroCommandeLocal(prefix = "CMD-MAXI") {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const key = `last_order_${date}`;
  let last = 0;
  try {
    last = parseInt(localStorage.getItem(key) || "0", 10) || 0;
  } catch {}
  last += 1;
  try {
    localStorage.setItem(key, String(last));
  } catch {}
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
 * ENVOYER COMMANDE (POST saveOrder) - CORRIGÉ
 * ========================================================= */
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // Parser et corriger les données
  const donneesCorrigees = parserDonneesCommande(dataCommande.raw || JSON.stringify(dataCommande));
  
  const nom = donneesCorrigees.nom || String(dataCommande.nom || dataCommande.client_nom || "").trim();
  const telephone = donneesCorrigees.telephone || String(dataCommande.telephone || dataCommande.client_telephone || "").trim();
  const adresse = donneesCorrigees.adresse || String(dataCommande.adresse || dataCommande.client_adresse || "").trim();

  if (!nom || !telephone || !adresse) {
    throw new Error("Champs manquants: nom / telephone / adresse");
  }

  // Utiliser le bon numéro de commande
  let commande_id = donneesCorrigees.commande_id || 
                   String(dataCommande.commande_id || dataCommande.commandeId || "").trim();
  
  if (!commande_id) {
    commande_id = genererNumeroCommandeLocal();
  }

  // Nettoyer et formater les articles
  const articlesBruts = donneesCorrigees.articles || dataCommande.articles || "";
  const articlesNorm = normaliserArticles(articlesBruts);
  const articlesTexte = formaterArticlesTexte(articlesNorm);

  // Calculer le total correctement
  const totalSaisi = parseFloat(donneesCorrigees.total || dataCommande.total || 0);
  const total = calculerTotalAvecFrais(articlesNorm, totalSaisi);

  const api = getApiUrl();
  const payload = {
    method: "saveOrder",
    commande_id,
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
 * RÉCUPÉRER COMMANDES (GET getAllOrders) - CORRIGÉ
 * ========================================================= */
export async function recupererCommandes() {
  const data = await requestJson(buildGetUrl("getAllOrders"), {}, 15000);
  
  if (!data.success) throw new Error(data.error || data.message || "Erreur récupération commandes");
  
  const orders = Array.isArray(data.orders) ? data.orders : [];
  
  return orders.map(o => {
    // Parser et corriger les données pour chaque commande
    const donneesCorrigees = parserDonneesCommande(o.raw || JSON.stringify(o));
    
    return {
      date: o.date || o.Date || "",
      nom: donneesCorrigees.nom || o.nom || o.Nom || "",
      telephone: donneesCorrigees.telephone || o.telephone || o["Téléphone"] || o.Telephone || "",
      adresse: donneesCorrigees.adresse || o.adresse || o.Adresse || "",
      commande_id: donneesCorrigees.commande_id || o.commande_id || o.order_id || o.Commande || "",
      articles: donneesCorrigees.articles || o.articles || o.Articles || "",
      total: donneesCorrigees.total || o.total || o.Total || "0",
      statut: o.statut || o.status || o.Statut || DEFAULT_STATUS,
      _raw: o
    };
  });
}

/** =========================================================
 * SUIVRE UNE COMMANDE (GET getOrderStatus) - CORRIGÉ
 * ========================================================= */
export async function suivreCommande(commandeId) {
  if (!commandeId) throw new Error("commandeId manquant");
  
  const data = await requestJson(
    buildGetUrl("getOrderStatus", { commande_id: commandeId }),
    {},
    12000
  );
  
  if (!data.success) throw new Error(data.error || data.message || "Commande non trouvée");
  
  // Parser et corriger les données
  const donneesCorrigees = parserDonneesCommande(data.raw || JSON.stringify(data));
  
  return {
    Date: data.date || "",
    Nom: donneesCorrigees.nom || data.nom || "",
    Téléphone: donneesCorrigees.telephone || data.telephone || "",
    Adresse: donneesCorrigees.adresse || data.adresse || "",
    Commande: donneesCorrigees.commande_id || data.commande_id || commandeId,
    Articles: donneesCorrigees.articles || data.articles || "",
    Total: donneesCorrigees.total || data.total || "0",
    Statut: data.statut || DEFAULT_STATUS,
    _raw: data
  };
}

/** =========================================================
 * HISTORIQUE CLIENT
 * ========================================================= */
export async function recupererHistorique(telephone) {
  const tel = String(telephone || "").trim().replace(/\s+/g, '');
  if (!tel) return [];
  
  const all = await recupererCommandes();
  return all
    .filter(o => String(o.telephone || "").replace(/\s+/g, '').includes(tel))
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
  
  const data = await requestJson(
    buildGetUrl("updateOrderStatus", { commande_id: commandeId, statut: nouveauStatut }),
    {},
    12000
  );
  
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
 * TOP PRODUITS
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
  const donneesCorrigees = parserDonneesCommande(dataCommande);
  
  const nom = donneesCorrigees.nom || dataCommande?.nom || "";
  const telephone = donneesCorrigees.telephone || dataCommande?.telephone || "";
  const adresse = donneesCorrigees.adresse || dataCommande?.adresse || "";
  const articlesTexte = donneesCorrigees.articles || 
                       (typeof dataCommande?.articles === "string" ? dataCommande.articles : 
                       formaterArticlesTexte(dataCommande?.articles));
  const total = donneesCorrigees.total || 
                calculerTotalAvecFrais(dataCommande?.articles, dataCommande?.total);
  
  const msg = `📦 NOUVELLE COMMANDE - MAXI JDC MARKET
N°: ${commandeId}
Date: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}

👤 CLIENT
Nom: ${nom}
Tél: ${telephone}
Adresse: ${adresse}

🛒 ARTICLES
${articlesTexte}

💰 TOTAL: ${total.toFixed(2)} dt
📊 STATUT: ${DEFAULT_STATUS}`;
  
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
  calculerTotalArticles,
  calculerTotalAvecFrais,
  parserDonneesCommande,
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
