/* maxi-jdc-market/tools/api-commandes.js
   API front (GitHub Pages) :
   - Lire Google Sheet (gviz JSON)
   - Trouver commande par ID ou téléphone
   - Générer nouvel ID CMD-MAXI-YYYYMMDD-XXX
   - Préparer / ouvrir WhatsApp avec message de confirmation
*/

(function (global) {
  "use strict";

  // =========================
  // CONFIG À MODIFIER
  // =========================
  const CONFIG = {
    // ID du Google Sheet (dans l’URL)
    SHEET_ID: "17PwAQa9UkPZnPRPPDr2wYdnxkUOj2-IRTYwTNId9cew",

    // gid de l’onglet COMMANDES (dans l’URL: ...?gid=XXXX)
    GID_COMMANDES: "1804772268",

    // Colonnes attendues (selon votre capture)
    // A: Date | B: Nom | C: Téléphone | D: Adresse | E: Commandes | F: Articles | G: Total | H: Statut
    COLUMN_MAP: {
      date: 0,
      nom: 1,
      telephone: 2,
      adresse: 3,
      commandeId: 4,
      articles: 5,
      total: 6,
      statut: 7
    },

    // WhatsApp : mettez le code pays par défaut (Tunisie = 216)
    DEFAULT_COUNTRY_CODE: "216",

    // Message WhatsApp (vous pouvez modifier)
    WHATSAPP_TEMPLATE: (commandeId) =>
      `✅ Merci pour votre commande MAXI JDC MARKET.\n` +
      `📦 Votre commande est bien reçue sous le numero ${commandeId}\n` +
      `⏳ Elle est en cours de préparation.\n` +
      `Nous vous contacterons pour la livraison.`,

    // OPTIONNEL (si vous avez un Google Apps Script WebApp pour APPEND la commande)
    // Ex: "https://script.google.com/macros/s/XXXX/exec"
    APPS_SCRIPT_WEBAPP_URL: ""
  };

  // =========================
  // UTILS
  // =========================
  function pad3(n) {
    const s = String(n);
    return s.length >= 3 ? s : ("000" + s).slice(-3);
  }

  function yyyymmddFromDate(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  }

  function normalizePhone(phone) {
    if (phone == null) return "";
    // garde chiffres uniquement
    let p = String(phone).replace(/[^\d]/g, "");

    // si commence par 00 -> enlever 00
    if (p.startsWith("00")) p = p.slice(2);

    // si commence par 0 et longueur locale (ex: 8) -> enlever 0
    // (optionnel : selon votre format)
    if (p.startsWith("0") && p.length > 8) p = p.replace(/^0+/, "");

    return p;
  }

  function ensureE164(phoneDigits, defaultCountryCode) {
    const p = normalizePhone(phoneDigits);
    if (!p) return "";

    // Si déjà commence par code pays (ex: 216xxxxxxxx), on garde
    // Sinon on préfixe par DEFAULT_COUNTRY_CODE
    if (p.startsWith(defaultCountryCode) && p.length > defaultCountryCode.length) return p;

    // cas téléphone local 8 chiffres -> +216 + local
    if (p.length <= 10) return `${defaultCountryCode}${p}`;

    return p; // fallback
  }

  function isLikelyOrderId(v) {
    return /^CMD-MAXI-\d{8}-\d{3}$/i.test(String(v || "").trim());
  }

  function buildGvizUrl(sheetId, gid) {
    // gviz renvoie du "JSON encapsulé" : google.visualization.Query.setResponse(...)
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;
  }

  function parseGviz(text) {
    // extrait l’objet JSON dans setResponse(...)
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Réponse gviz invalide.");
    const json = JSON.parse(text.slice(start, end + 1));
    return json;
  }

  function gvizToRows(gvizJson) {
    const table = gvizJson && gvizJson.table;
    const rows = (table && table.rows) || [];
    // Chaque row.c[i].v
    return rows.map((r) => (r.c || []).map((cell) => (cell ? cell.v : "")));
  }

  function rowToCommandeObj(row, map) {
    const get = (key) => {
      const idx = map[key];
      return idx == null ? "" : (row[idx] ?? "");
    };

    return {
      date: get("date"),
      nom: get("nom"),
      telephone: String(get("telephone") ?? ""),
      adresse: get("adresse"),
      commandeId: String(get("commandeId") ?? ""),
      articles: get("articles"),
      total: get("total"),
      statut: get("statut"),
      _raw: row
    };
  }

  // =========================
  // API PUBLIC
  // =========================
  async function getCommandes() {
    const url = buildGvizUrl(CONFIG.SHEET_ID, CONFIG.GID_COMMANDES);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Impossible de lire la feuille Google (gviz).");
    const text = await res.text();
    const gviz = parseGviz(text);
    const rows = gvizToRows(gviz);

    // retire lignes vides / en-tête si besoin
    const commandes = rows
      .map((row) => rowToCommandeObj(row, CONFIG.COLUMN_MAP))
      .filter((c) => c.commandeId && String(c.commandeId).trim() !== "" && c.commandeId !== "Commandes");

    return commandes;
  }

  async function findCommande(identifier) {
    const id = String(identifier || "").trim();
    if (!id) return null;

    const commandes = await getCommandes();

    if (isLikelyOrderId(id)) {
      const target = id.toUpperCase();
      return commandes.find((c) => String(c.commandeId || "").toUpperCase().trim() === target) || null;
    }

    // sinon téléphone
    const targetPhone = normalizePhone(id);
    return (
      commandes.find((c) => normalizePhone(c.telephone) === targetPhone) || null
    );
  }

  async function findCommandesByPhone(phone) {
    const targetPhone = normalizePhone(phone);
    if (!targetPhone) return [];
    const commandes = await getCommandes();
    return commandes.filter((c) => normalizePhone(c.telephone) === targetPhone);
  }

  async function generateNextCommandeId(dateObj = new Date()) {
    const ymd = yyyymmddFromDate(dateObj);
    const prefix = `CMD-MAXI-${ymd}-`;

    const commandes = await getCommandes();
    const sameDay = commandes
      .map((c) => String(c.commandeId || "").trim())
      .filter((cid) => cid.startsWith(prefix));

    let maxSeq = 0;
    for (const cid of sameDay) {
      const m = cid.match(/-(\d{3})$/);
      if (m) {
        const seq = parseInt(m[1], 10);
        if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }

    const nextSeq = maxSeq + 1;
    return `${prefix}${pad3(nextSeq)}`;
  }

  function buildWhatsAppLink(phone, commandeId) {
    const e164 = ensureE164(phone, CONFIG.DEFAULT_COUNTRY_CODE);
    const msg = CONFIG.WHATSAPP_TEMPLATE(commandeId);
    const encoded = encodeURIComponent(msg);
    // wa.me ne prend que les chiffres (sans +)
    return `https://wa.me/${e164}?text=${encoded}`;
  }

  function openWhatsApp(phone, commandeId) {
    const link = buildWhatsAppLink(phone, commandeId);
    window.open(link, "_blank");
    return link;
  }

  // OPTIONNEL : si vous avez un Apps Script webapp pour enregistrer la commande
  async function submitCommandeToSheet(payload) {
    if (!CONFIG.APPS_SCRIPT_WEBAPP_URL) {
      throw new Error("APPS_SCRIPT_WEBAPP_URL est vide. Ajoutez votre WebApp Apps Script pour enregistrer la commande.");
    }
    const res = await fetch(CONFIG.APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Erreur lors de l’enregistrement de la commande.");
    }
    return data;
  }

  // =========================
  // EXPORT
  // =========================
  global.ApiCommandes = {
    CONFIG,
    getCommandes,
    findCommande,
    findCommandesByPhone,
    generateNextCommandeId,
    buildWhatsAppLink,
    openWhatsApp,
    submitCommandeToSheet
  };
})(window);
