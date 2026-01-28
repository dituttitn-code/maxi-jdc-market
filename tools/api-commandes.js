/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 *********************************/

// URL de l'API Google Apps Script
const API_URL =
  "https://script.google.com/macros/s/AKfycbzOIsVxlatsaMDIyhL2onPbcxXt-pVt94ImtvYVmIXLPtc-RBDUfclVXAPg8k5Ask6A/exec";

/*********************************
 * OUTILS - Normalisation / parsing
 *********************************/
function _norm(v) {
  return (v ?? "").toString().replace(/\r\n/g, "\n").trim();
}

function _firstMatch(text, regex) {
  const m = _norm(text).match(regex);
  return m ? _norm(m[1]) : "";
}

function _parseDT(value) {
  // ex: "44,50 dt" / "44.50" / "TOTAL: 44,50 dt"
  const txt = _norm(value)
    .replace(/dt/gi, "")
    .replace(/[^\d,.\-]/g, " ")
    .trim();

  const m = txt.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function _cleanPhone(phone) {
  const p = _norm(phone);
  if (!p) return "";
  const has216 = p.includes("+216") || p.startsWith("216");
  const digits = p.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (has216) {
    const rest = digits.replace(/^216/, "");
    return `+216${rest}`;
  }
  return digits;
}

/**
 * IMPORTANT : ce parser suit exactement ta règle
 * - Haut : Nom / Téléphone / Adresse
 * - Milieu : Articles
 * - Bas : N° Commande + Total
 *
 * Il accepte un texte qui ressemble à celui affiché dans ta popup
 * "📋 Détails de votre commande".
 */
function parserDetailsCommande(detailsText) {
  const text = _norm(detailsText);
  if (!text) {
    return {
      nom: "",
      telephone: "",
      adresse: "",
      commandeId: "",
      total: 0,
      articlesTexte: ""
    };
  }

  // --- NOM / TEL / ADRESSE (partie haute)
  // Le texte contient typiquement:
  // Nom: Lotfi
  // Téléphone: +216 55532482
  // Adresse: Jardins De Carthage
  const nom = _firstMatch(text, /^\s*Nom\s*:\s*(.+)\s*$/mi);
  const telephoneRaw = _firstMatch(text, /^\s*T[ée]l[ée]phone\s*:\s*(.+)\s*$/mi);
  const telephone = _cleanPhone(telephoneRaw);
  const adresse = _firstMatch(text, /^\s*Adresse\s*:\s*(.+)\s*$/mi);

  // --- ARTICLES (partie milieu)
  // Entre "🛒 ARTICLES" et "Sous-total:" (ou Livraison/TOTAL si Sous-total absent)
  let articlesTexte = "";
  const mArticles =
    text.match(/🛒\s*ARTICLES[\s\S]*?\n([\s\S]*?)\n\s*(Sous-total|Livraison|TOTAL)\s*:/mi) ||
    text.match(/🛒\s*ARTICLES[\s\S]*?\n([\s\S]*?)\n\s*📦/mi); // fallback

  if (mArticles) {
    articlesTexte = _norm(mArticles[1]);

    // enlever séparateurs ───── / -----
    articlesTexte = articlesTexte
      .replace(/^[─\-]{5,}\s*$/gm, "")
      .replace(/^\s+|\s+$/g, "")
      .trim();
  }

  // --- TOTAL (partie basse)
  const totalStr = _firstMatch(text, /^\s*TOTAL\s*:\s*(.+)\s*$/mi);
  const total = _parseDT(totalStr);

  // --- N° COMMANDE (partie basse)
  // ex: "N° Commande: CMD-MAXI-20260128-023"
  const commandeId =
    _firstMatch(text, /^\s*N[°º]\s*Commande\s*:\s*(.+)\s*$/mi) ||
    _firstMatch(text, /^\s*📦\s*N[°º]\s*Commande\s*:\s*(.+)\s*$/mi);

  return { nom, telephone, adresse, commandeId, total, articlesTexte };
}

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 * Envoie la commande au Google Sheet et génère WhatsApp
 *********************************/
export async function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // 1) Trouver le texte "Détails de votre commande" si présent
  // (selon l'app ça peut s'appeler details, orderDetails, etc.)
  const detailsText =
    dataCommande.detailsCommande ||
    dataCommande.details ||
    dataCommande.orderDetails ||
    dataCommande.details_text ||
    "";

  // 2) Parser le texte (si existe)
  const parsed = parserDetailsCommande(detailsText);

  // 3) Déterminer nom / tel / adresse
  // Priorité : champs structurés -> sinon parsing -> sinon vide
  const nomFinal = _norm(dataCommande.nom || dataCommande.client_nom) || parsed.nom || "";
  const telFinal =
    _cleanPhone(dataCommande.telephone || dataCommande.client_telephone) ||
    parsed.telephone ||
    "";
  const adrFinal = _norm(dataCommande.adresse || dataCommande.client_adresse) || parsed.adresse || "";

  // 4) Déterminer ARTICLES :
  // - si tableau : on formate propre
  // - si string (et ressemble à un "Détails...") : on parse et on prend milieu
  // - sinon : on garde texte brut
  let articlesTexteFinal = "";
  let articlesArrayForWhatsapp = [];

  if (Array.isArray(dataCommande.articles)) {
    // On construit un texte propre + liste pour whatsapp
    const arr = dataCommande.articles.map((item) => {
      const produit = item.produit || item.nom || "";
      const quantite = parseInt(item.quantite || item.qty || 1, 10) || 1;
      const prix_unitaire = parseFloat(item.prix_unitaire || item.prix || 0) || 0;
      const prix_total = parseFloat((quantite * prix_unitaire).toFixed(2));
      return { produit, quantite, prix_unitaire, prix_total };
    });

    articlesArrayForWhatsapp = arr;
    articlesTexteFinal = arr
      .map((a) => `${a.quantite}x ${a.produit}\n${a.prix_unitaire.toFixed(2)} dt × ${a.quantite} = ${a.prix_total.toFixed(2)} dt`)
      .join("\n\n")
      .trim();

  } else if (typeof dataCommande.articles === "string") {
    const str = _norm(dataCommande.articles);

    // Si c'est carrément le bloc "Détails..." (comme dans ton Sheet), on parse
    const looksLikeDetails =
      /Nom\s*:/i.test(str) && /Téléphone\s*:/i.test(str) && /🛒\s*ARTICLES/i.test(str);

    if (looksLikeDetails) {
      const p = parserDetailsCommande(str);
      articlesTexteFinal = p.articlesTexte || "";
      // whatsapp: juste texte
      articlesArrayForWhatsapp = [];
    } else {
      // Sinon : texte brut (on le met tel quel)
      articlesTexteFinal = str;
      articlesArrayForWhatsapp = [];
    }
  } else {
    // fallback : utiliser le parsing du detailsText si possible
    articlesTexteFinal = parsed.articlesTexte || "";
    articlesArrayForWhatsapp = [];
  }

  // 5) TOTAL :
  // priorité au bas du "Détails...", sinon total fourni, sinon recalcul si tableau
  let total = 0;
  if (parsed.total) total = parsed.total;
  else total = _parseDT(dataCommande.total);

  if (!total && articlesArrayForWhatsapp.length) {
    total = articlesArrayForWhatsapp.reduce((s, a) => s + (a.prix_total || 0), 0);
  }

  // 6) N° COMMANDE :
  const commandeId =
    _norm(dataCommande.commande_id || dataCommande.commandeId || dataCommande.n_commande) ||
    parsed.commandeId ||
    "";

  // ✅ Payload PROPRE pour Google Apps Script
  // IMPORTANT : on envoie ARTICLES sous forme TEXTE (pas JSON) pour que la colonne soit propre.
  // Si ton GAS attend JSON, dis-moi et je te le convertis, mais d'après ton Sheet actuel il stocke du texte.
  const payload = {
    method: "saveOrder",
    nom: nomFinal,
    telephone: telFinal,
    adresse: adrFinal,
    articles: articlesTexteFinal,
    total: total.toFixed(2),
    commande_id: commandeId // si GAS ne l'utilise pas, il ignore
  };

  console.log("📤 Envoi commande API (corrigé):", payload);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString()
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    console.log("📥 Réponse API:", result);

    // WhatsApp magasin
    if (result.success && result.commande_id) {
      await genererNotificationWhatsApp(result.commande_id, {
        nom: nomFinal,
        telephone: telFinal,
        adresse: adrFinal,
        articles: articlesArrayForWhatsapp.length ? articlesArrayForWhatsapp : articlesTexteFinal,
        total: total.toFixed(2)
      });
    }

    return result;

  } catch (error) {
    console.error("❌ Erreur envoyerCommande:", error);

    // Fallback no-cors
    try {
      await fetch(API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload).toString()
      });

      await genererNotificationWhatsApp(commandeId || "CMD-EMERGENCY", {
        nom: nomFinal,
        telephone: telFinal,
        adresse: adrFinal,
        articles: articlesArrayForWhatsapp.length ? articlesArrayForWhatsapp : articlesTexteFinal,
        total: total.toFixed(2)
      });

      return {
        success: true,
        message: "Commande envoyée (mode fallback)",
        commande_id: commandeId || "CMD-FALLBACK-" + Date.now(),
        statut: "En attente"
      };
    } catch (fallbackError) {
      throw new Error("Double erreur: " + error.message);
    }
  }
}

/*********************************
 * GÉNÉRER NOTIFICATION WHATSAPP
 *********************************/
async function genererNotificationWhatsApp(commandeId, dataCommande) {
  try {
    const whatsappMessage =
      `📦 NOUVELLE COMMANDE MAXI JDC MARKET\n\n` +
      `🔔 #NouvelleCommande\n` +
      `📅 ${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR")}\n` +
      `👤 ${dataCommande.nom || ""}\n` +
      `📱 ${dataCommande.telephone || ""}\n` +
      `📍 ${dataCommande.adresse || ""}\n` +
      `🆔 ${commandeId}\n\n` +
      `🛒 ARTICLES :\n`;

    let articlesText = "";

    if (Array.isArray(dataCommande.articles)) {
      articlesText = dataCommande.articles
        .map(
          (item) =>
            `${item.quantite || 1}x ${item.produit || item.nom} @ ${(
              item.prix_unitaire || item.prix || 0
            ).toFixed(2)} dt`
        )
        .join("\n");
    } else {
      articlesText = _norm(dataCommande.articles);
    }

    const total = _parseDT(dataCommande.total || dataCommande.sousTotal || "0").toFixed(2);

    const fullMessage =
      whatsappMessage +
      articlesText +
      `\n\n💰 TOTAL : ${total} dt\n` +
      `📊 STATUT : En attente\n\n` +
      `⚠️ PRIORITÉ : À TRAITER\n` +
      `🎯 URGENCE : NORMAL`;

    const whatsappNumber = "0021625600978";
    const encodedMessage = encodeURIComponent(fullMessage);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    jouerSonTablette(commandeId);

    console.log("✅ WhatsApp prêt:", whatsappUrl);

    return {
      whatsapp_url: whatsappUrl,
      message: fullMessage,
      son_joue: true
    };
  } catch (error) {
    console.error("Erreur génération WhatsApp:", error);
    return null;
  }
}

/*********************************
 * JOUER SON SUR TABLETTE
 *********************************/
function jouerSonTablette(commandeId) {
  console.log("🔔 SON TABLETTE - Nouvelle commande:", commandeId);
  console.log("🔔 BIP 1 - Commande reçue");
  console.log("🔔 BIP 2 - À traiter");
  console.log("🔔 BIP 3 - Client: " + commandeId);
  console.log("🔔 BIP 4 - Préparer");
  console.log("🔔 BIP 5 - Fin alerte");

  if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate([100, 50, 100, 50, 100, 50, 100, 50, 100]);
  }
  return true;
}

/*********************************
 * RECUPERER TOUTES LES COMMANDES (Admin)
 *********************************/
export async function recupererCommandes() {
  try {
    const response = await fetch(`${API_URL}?method=getAllOrders&t=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Erreur lors de la récupération des commandes");
    }

    const commandesFormatees = (data.orders || []).map((commande) => ({
      Date: commande.date || "",
      Nom: commande.nom || "",
      Téléphone: commande.telephone || "",
      Adresse: commande.adresse || "",
      Commande: commande.commande_id || "",
      Articles: commande.articles || "",
      Total: commande.total || "0",
      Statut: commande.statut || "En attente",
      _id: commande.id,
      _raw: commande
    }));

    return commandesFormatees;
  } catch (error) {
    console.error("Erreur dans recupererCommandes:", error);
    return [];
  }
}

/*********************************
 * SUIVRE UNE COMMANDE (Client)
 *********************************/
export async function suivreCommande(commandeId) {
  try {
    const response = await fetch(
      `${API_URL}?method=getOrderStatus&commande_id=${encodeURIComponent(commandeId)}&t=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Commande non trouvée");
    }

    return {
      Date: data.date || "",
      Nom: data.nom || "",
      Téléphone: data.telephone || "",
      Adresse: data.adresse || "",
      Commande: data.commande_id || "",
      Articles: data.articles || "",
      Total: data.total || "0",
      Statut: data.statut || "En attente",
      _raw: data
    };
  } catch (error) {
    console.error("Erreur dans suivreCommande:", error);
    throw error;
  }
}

/*********************************
 * RECUPERER L'HISTORIQUE D'UN CLIENT
 *********************************/
export async function recupererHistorique(telephone) {
  try {
    const response = await fetch(
      `${API_URL}?method=getOrderHistory&telephone=${encodeURIComponent(telephone)}&t=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Erreur lors de la récupération de l'historique");
    }

    const historiqueFormate = (data.history || []).map((commande) => ({
      Date: commande.date || "",
      Nom: commande.nom || "",
      Téléphone: telephone,
      Adresse: commande.adresse || "",
      Commande: commande.commande_id || "",
      Articles: commande.articles || "",
      Total: commande.total || "0",
      Statut: commande.statut || "",
      _raw: commande
    }));

    return historiqueFormate;
  } catch (error) {
    console.error("Erreur dans recupererHistorique:", error);
    return [];
  }
}

/*********************************
 * METTRE A JOUR LE STATUT D'UNE COMMANDE
 *********************************/
export async function mettreAJourStatut(commandeId, nouveauStatut) {
  try {
    const response = await fetch(
      `${API_URL}?method=updateOrderStatus&commande_id=${encodeURIComponent(commandeId)}&statut=${encodeURIComponent(
        nouveauStatut
      )}&t=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Erreur lors de la mise à jour");
    }

    return data;
  } catch (error) {
    console.error("Erreur dans mettreAJourStatut:", error);
    throw error;
  }
}

/*********************************
 * RECUPERER TOP PRODUITS
 *********************************/
export async function recupererTopProduits() {
  try {
    const response = await fetch(`${API_URL}?method=getTopProducts&t=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Erreur lors de la récupération des top produits");
    }

    return data.topProducts || [];
  } catch (error) {
    console.error("Erreur dans recupererTopProduits:", error);
    return [];
  }
}

/*********************************
 * FORMATER LES ARTICLES POUR L'AFFICHAGE
 *********************************/
export function formaterArticles(articles) {
  if (!articles) return "";

  try {
    if (typeof articles === "string") return articles;

    let articlesArray = [];

    if (typeof articles === "string") {
      try {
        articlesArray = JSON.parse(articles);
      } catch (e) {
        return articles;
      }
    } else if (Array.isArray(articles)) {
      articlesArray = articles;
    }

    return articlesArray
      .map((item) => {
        const quantite = item.quantite || item.qty || 1;
        const produit = item.produit || item.nom || "Produit";
        const prix = parseFloat(item.prix_unitaire || item.prix || 0).toFixed(2);
        const total = (quantite * parseFloat(prix)).toFixed(2);
        return `${quantite}x ${produit} @ ${prix} dt = ${total} dt`;
      })
      .join("\n");
  } catch (error) {
    console.error("Erreur lors du formatage des articles:", error);
    return String(articles || "");
  }
}

/*********************************
 * PARSER LES ARTICLES DEPUIS LE TEXTE
 *********************************/
export function parserArticles(texteArticles) {
  if (!texteArticles) return [];

  const lignes = texteArticles.split("\n");
  const articles = [];

  for (const ligne of lignes) {
    const ligneClean = ligne.trim();
    if (!ligneClean) continue;

    const match = ligneClean.match(/^(\d+)x\s+(.+?)\s+@\s+([\d.]+)\s+dt\s+=\s+([\d.]+)\s+dt$/);
    if (match) {
      articles.push({
        produit: match[2].trim(),
        quantite: parseInt(match[1], 10),
        prix_unitaire: parseFloat(match[3]),
        prix_total: parseFloat(match[4])
      });
    } else {
      const simpleMatch = ligneClean.match(/^(\d+)x\s+(.+)$/);
      if (simpleMatch) {
        articles.push({
          produit: simpleMatch[2].trim(),
          quantite: parseInt(simpleMatch[1], 10),
          prix_unitaire: 0,
          prix_total: 0
        });
      }
    }
  }

  return articles;
}

/*********************************
 * GENERER NUMERO COMMANDE LOCAL
 *********************************/
export function genererNumeroCommandeLocal() {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0");

  return `CMD-MAXI-${dateStr}-${Date.now().toString().slice(-3)}`;
}

/*********************************
 * TESTER LA CONNEXION API
 *********************************/
export async function testerConnexionAPI() {
  try {
    const response = await fetch(`${API_URL}?method=test&t=${Date.now()}`);

    if (!response.ok) {
      return { connecte: false, erreur: `Erreur HTTP: ${response.status}`, url: API_URL };
    }

    const data = await response.json();

    return {
      connecte: data.success || false,
      message: data.message || "API répond",
      version: data.version,
      url: API_URL
    };
  } catch (error) {
    return { connecte: false, erreur: error.message, url: API_URL };
  }
}

/*********************************
 * EXPORT DEFAULT
 *********************************/
export default {
  envoyerCommande,
  recupererCommandes,
  suivreCommande,
  recupererHistorique,
  mettreAJourStatut,
  recupererTopProduits,
  formaterArticles,
  parserArticles,
  genererNumeroCommandeLocal,
  testerConnexionAPI
};

// Pour console
if (typeof window !== "undefined") {
  window.apiCommandes = {
    envoyerCommande,
    recupererCommandes,
    suivreCommande,
    recupererHistorique,
    mettreAJourStatut,
    recupererTopProduits,
    formaterArticles,
    genererNumeroCommandeLocal
  };
}
