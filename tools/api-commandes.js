/* maxi-jdc-market/tools/api-commandes.js
   API FRONT (GitHub Pages) — MAXI JDC MARKET

   ✅ Lit Google Sheet (gviz JSON)
   ✅ NORMALISE + GROUPE : 1 commande = 1 objet (même si la sheet a 1 ligne par article)
   ✅ Recherche commandes (ID / téléphone)
   ✅ Génère nouvel ID CMD-MAXI-YYYYMMDD-XXX
   ✅ WhatsApp confirmation

   ✅ Parse articles => items {name, qty}
   ✅ Dashboard Stats (sur commandes groupées):
      - chiffre d'affaires total
      - commandes totales
      - panier moyen
      - répartition par statut
      - ventes par jour (N jours)
      - commandes par heure
      - top 10 produits
      - produit le + vendu
*/

(function (global) {
  "use strict";

  // =========================
  // CONFIG
  // =========================
  const CONFIG = {
    SHEET_ID: "17PwAQa9UkPZnPRPPDr2wYdnxkUOj2-IRTYwTNId9cew",
    GID_COMMANDES: "1804772268",

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

    DEFAULT_COUNTRY_CODE: "216",

    WHATSAPP_TEMPLATE: (commandeId) =>
      `✅ Merci pour votre commande MAXI JDC MARKET.\n` +
      `📦 Votre commande est bien reçue sous le numero ${commandeId}\n` +
      `⏳ Elle est en cours de préparation.\n` +
      `Nous vous contacterons pour la livraison.`,

    // Si tu as un Apps Script WebApp pour ajouter une ligne
    APPS_SCRIPT_WEBAPP_URL: "",

    // Cache mémoire
    CACHE_TTL_MS: 20_000
  };

  // =========================
  // CACHE
  // =========================
  const _cache = {
    at: 0,
    commandes: null,          // commandes groupées
    commandesRaw: null        // lignes raw si besoin
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
    let p = String(phone).replace(/[^\d]/g, "");
    if (p.startsWith("00")) p = p.slice(2);
    if (p.startsWith("0") && p.length > 8) p = p.replace(/^0+/, "");
    return p;
  }

  function ensureE164(phoneDigits, defaultCountryCode) {
    const p = normalizePhone(phoneDigits);
    if (!p) return "";
    if (p.startsWith(defaultCountryCode) && p.length > defaultCountryCode.length) return p;
    if (p.length <= 10) return `${defaultCountryCode}${p}`;
    return p;
  }

  function isLikelyOrderId(v) {
    return /^CMD-MAXI-\d{8}-\d{3}$/i.test(String(v || "").trim());
  }

  function buildGvizUrl(sheetId, gid) {
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(
      gid
    )}`;
  }

  function parseGviz(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Réponse gviz invalide.");
    return JSON.parse(text.slice(start, end + 1));
  }

  function gvizToRows(gvizJson) {
    const table = gvizJson && gvizJson.table;
    const rows = (table && table.rows) || [];
    return rows.map((r) => (r.c || []).map((cell) => (cell ? cell.v : "")));
  }

  function safeNumber(v) {
    if (v == null) return 0;
    const s = String(v).replace(/\s/g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function parseDateLoose(v) {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v.getTime())) return v;

    const s = String(v).trim();

    // "Date(2025,0,24,12,30,0)"
    const m = s.match(/Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})(?:,\s*(\d{1,2}),\s*(\d{1,2}),\s*(\d{1,2}))?\)/i);
    if (m) {
      const yyyy = Number(m[1]);
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      const hh = Number(m[4] || 0);
      const mi = Number(m[5] || 0);
      const ss = Number(m[6] || 0);
      const d = new Date(yyyy, mm, dd, hh, mi, ss);
      return isNaN(d.getTime()) ? null : d;
    }

    // "dd/mm/yyyy" ou "dd-mm-yyyy"
    let m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (m2) {
      const dd = Number(m2[1]);
      const mm = Number(m2[2]) - 1;
      const yyyy = Number(m2[3]);
      const hh = Number(m2[4] || 0);
      const mi = Number(m2[5] || 0);
      const d = new Date(yyyy, mm, dd, hh, mi, 0);
      return isNaN(d.getTime()) ? null : d;
    }

    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t);

    return null;
  }

  function formatYMD(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function normalizeStatut(s) {
    const v = String(s || "").trim().toLowerCase();
    if (!v) return "inconnu";
    if (v.includes("att")) return "en attente";
    if (v.includes("cour")) return "en cours";
    if (v.includes("liv")) return "livrée";
    if (v.includes("ann")) return "annulée";
    return v;
  }

  function pickFirstNonEmpty(...vals) {
    for (const v of vals) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s !== "") return v;
    }
    return "";
  }

  // =========================
  // PARSE ARTICLES => ITEMS
  // =========================
  function parseArticlesToItems(articlesText) {
    const txt = String(articlesText || "").trim();
    if (!txt) return [];

    // JSON
    if ((txt.startsWith("[") && txt.endsWith("]")) || (txt.startsWith("{") && txt.endsWith("}"))) {
      try {
        const json = JSON.parse(txt);
        const arr = Array.isArray(json) ? json : (json.items || json.articles || []);
        if (Array.isArray(arr)) {
          return arr
            .map((it) => ({
              name: String(it.name || it.product || it.title || "").trim(),
              qty: Number(it.qty ?? it.quantity ?? it.qte ?? 1)
            }))
            .filter((it) => it.name && Number.isFinite(it.qty) && it.qty > 0);
        }
      } catch (_) {
        // fallback texte
      }
    }

    // Texte libre : split par , ; | ou retour ligne
    const parts = txt.split(/[,;|\n]+/).map((s) => s.trim()).filter(Boolean);

    const items = [];
    for (const p of parts) {
      // "Produit x2" / "Produit ×2" / "3x Produit" (ton format)
      let m = p.match(/^(\d+)\s*[x×]\s*(.*)$/i);
      if (m) {
        const qty = Number(m[1]);
        const name = String(m[2] || "").trim();
        if (name && Number.isFinite(qty) && qty > 0) items.push({ name, qty });
        continue;
      }

      // "Produit x2" (qty à la fin)
      m = p.match(/^(.*?)(?:\s*[x×]\s*(\d+))$/i);
      if (m) {
        const name = m[1].trim();
        const qty = Number(m[2]);
        if (name && Number.isFinite(qty) && qty > 0) items.push({ name, qty });
        continue;
      }

      // "2 Produit"
      m = p.match(/^(\d+)\s+(.*)$/);
      if (m) {
        const qty = Number(m[1]);
        const name = m[2].trim();
        if (name && Number.isFinite(qty) && qty > 0) items.push({ name, qty });
        continue;
      }

      // "Produit (2)"
      m = p.match(/^(.*)\((\d+)\)\s*$/);
      if (m) {
        const name = m[1].trim();
        const qty = Number(m[2]);
        if (name && Number.isFinite(qty) && qty > 0) items.push({ name, qty });
        continue;
      }

      items.push({ name: p, qty: 1 });
    }
    return items;
  }

  function mergeItems(itemsList) {
    // itemsList: array of arrays of {name, qty}
    const map = new Map();
    for (const arr of (itemsList || [])) {
      for (const it of (arr || [])) {
        const name = String(it.name || "").trim();
        const qty = Number(it.qty);
        if (!name || !Number.isFinite(qty) || qty <= 0) continue;
        map.set(name, (map.get(name) || 0) + qty);
      }
    }
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty }));
  }

  function guessTotalPerOrder(totals) {
    // totals: numbers from lines of same order
    const nums = (totals || []).map(safeNumber).filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return 0;

    // si la majorité a la même valeur => c'est le total de commande répété
    const freq = new Map();
    for (const n of nums) freq.set(n, (freq.get(n) || 0) + 1);

    let bestVal = nums[0], bestCount = 0;
    for (const [val, count] of freq.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestVal = val;
      }
    }

    // si valeur la plus fréquente représente au moins 60% des lignes => on la prend
    if (bestCount / nums.length >= 0.6) return bestVal;

    // sinon on additionne (cas où G = prix par article)
    const sum = nums.reduce((a, b) => a + b, 0);
    return Number(sum.toFixed(2));
  }

  // =========================
  // ROW -> OBJ (ligne)
  // =========================
  function rowToLineObj(row, map) {
    const get = (key) => {
      const idx = map[key];
      return idx == null ? "" : (row[idx] ?? "");
    };

    const dateRaw = get("date");
    const dateObj = parseDateLoose(dateRaw);

    return {
      date: dateRaw,
      dateObj,
      dateYMD: dateObj ? formatYMD(dateObj) : "",

      nom: get("nom"),
      telephone: String(get("telephone") ?? ""),
      adresse: get("adresse"),

      commandeId: String(get("commandeId") ?? "").trim(),
      articles: get("articles"),
      items: parseArticlesToItems(get("articles")),

      total: get("total"),
      totalNum: safeNumber(get("total")),

      statut: get("statut"),
      statutNorm: normalizeStatut(get("statut")),

      _raw: row
    };
  }

  // =========================
  // GROUP : lignes -> commandes
  // =========================
  function groupLinesToOrders(lines) {
    const groups = new Map(); // commandeId -> array lines

    for (const l of (lines || [])) {
      const cid = String(l.commandeId || "").trim();
      if (!cid) continue;
      if (cid.toLowerCase() === "commandes") continue; // header éventuel
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid).push(l);
    }

    const orders = [];
    for (const [commandeId, arr] of groups.entries()) {
      // date = plus ancienne
      const dates = arr.map(a => a.dateObj).filter(Boolean).sort((a,b)=>a-b);
      const dateObj = dates.length ? dates[0] : null;
      const dateYMD = dateObj ? formatYMD(dateObj) : "";

      const nom = pickFirstNonEmpty(...arr.map(a => a.nom));
      const telephone = pickFirstNonEmpty(...arr.map(a => a.telephone));
      const adresse = pickFirstNonEmpty(...arr.map(a => a.adresse));

      // statut : on prend le dernier non vide (ou le plus fréquent)
      const statuts = arr.map(a => a.statutNorm).filter(Boolean);
      let statutNorm = "inconnu";
      if (statuts.length) {
        const freq = new Map();
        for (const s of statuts) freq.set(s, (freq.get(s) || 0) + 1);
        // meilleur = plus fréquent ; en cas d'égalité on préfère le dernier
        let best = statuts[statuts.length - 1], bestCount = 0;
        for (const [s, c] of freq.entries()) {
          if (c > bestCount) { bestCount = c; best = s; }
        }
        statutNorm = best;
      }

      // articles texte : concat " | "
      const articlesConcat = arr
        .map(a => String(a.articles || "").trim())
        .filter(Boolean)
        .join(" | ");

      // items : merge
      const items = mergeItems(arr.map(a => a.items));

      // total par commande
      const totalNum = guessTotalPerOrder(arr.map(a => a.totalNum));

      orders.push({
        commandeId,

        dateObj,
        dateYMD,
        date: dateObj ? dateObj.toISOString() : pickFirstNonEmpty(...arr.map(a => a.date)),

        nom,
        telephone,
        adresse,

        // compat (si ton UI affiche articles)
        articles: articlesConcat,
        items,

        totalNum,
        total: Number(totalNum.toFixed(2)),

        statutNorm,
        statut: statutNorm,

        // debug
        _linesCount: arr.length,
        _lines: arr
      });
    }

    // tri par date décroissante si possible
    orders.sort((a, b) => {
      const ta = a.dateObj ? a.dateObj.getTime() : 0;
      const tb = b.dateObj ? b.dateObj.getTime() : 0;
      return tb - ta;
    });

    return orders;
  }

  // =========================
  // API : COMMANDES (groupées)
  // =========================
  async function getCommandes(options = {}) {
    const { force = false } = options;
    const now = Date.now();

    if (!force && _cache.commandes && now - _cache.at < CONFIG.CACHE_TTL_MS) {
      return _cache.commandes;
    }

    const url = buildGvizUrl(CONFIG.SHEET_ID, CONFIG.GID_COMMANDES);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Impossible de lire la feuille Google (gviz).");

    const text = await res.text();
    const gviz = parseGviz(text);
    const rows = gvizToRows(gviz);

    const lines = rows
      .map((row) => rowToLineObj(row, CONFIG.COLUMN_MAP))
      .filter((l) => l.commandeId && String(l.commandeId).trim() !== "" && l.commandeId.toLowerCase() !== "commandes");

    const grouped = groupLinesToOrders(lines);

    _cache.at = now;
    _cache.commandesRaw = lines;
    _cache.commandes = grouped;

    return grouped;
  }

  async function findCommande(identifier) {
    const id = String(identifier || "").trim();
    if (!id) return null;

    const commandes = await getCommandes();

    if (isLikelyOrderId(id)) {
      const target = id.toUpperCase();
      return commandes.find((c) => String(c.commandeId || "").toUpperCase().trim() === target) || null;
    }

    const targetPhone = normalizePhone(id);
    return commandes.find((c) => normalizePhone(c.telephone) === targetPhone) || null;
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
    return `${prefix}${pad3(maxSeq + 1)}`;
  }

  // =========================
  // WHATSAPP
  // =========================
  function buildWhatsAppLink(phone, commandeId) {
    const e164 = ensureE164(phone, CONFIG.DEFAULT_COUNTRY_CODE);
    const msg = CONFIG.WHATSAPP_TEMPLATE(commandeId);
    const encoded = encodeURIComponent(msg);
    return `https://wa.me/${e164}?text=${encoded}`;
  }

  function openWhatsApp(phone, commandeId) {
    const link = buildWhatsAppLink(phone, commandeId);
    window.open(link, "_blank");
    return link;
  }

  // =========================
  // SUBMIT (optionnel)
  // =========================
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
    if (!res.ok || data.ok === false) throw new Error(data.error || "Erreur lors de l’enregistrement de la commande.");
    return data;
  }

  // =========================
  // STATS DASHBOARD (sur commandes groupées)
  // =========================
  function computeStatusCounts(commandes) {
    const counts = {};
    for (const c of (commandes || [])) {
      const s = c.statutNorm || "inconnu";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }

  function computeTopProducts(commandes, limit = 10) {
    const map = new Map(); // name -> qty
    for (const c of (commandes || [])) {
      for (const it of (c.items || [])) {
        if (!it.name || !Number.isFinite(it.qty)) continue;
        map.set(it.name, (map.get(it.name) || 0) + it.qty);
      }
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, Math.max(0, limit));
  }

  function computeTopProduct(commandes) {
    const top = computeTopProducts(commandes, 1);
    return top.length ? top[0] : null;
  }

  function computeSalesByDay(commandes, days = 30) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const map = new Map();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      map.set(formatYMD(d), { revenue: 0, orders: 0 });
    }

    for (const c of (commandes || [])) {
      if (!c.dateObj) continue;
      if (c.dateObj < start || c.dateObj > end) continue;

      const ymd = c.dateYMD || formatYMD(c.dateObj);
      const cur = map.get(ymd) || { revenue: 0, orders: 0 };
      cur.revenue += safeNumber(c.totalNum);
      cur.orders += 1;
      map.set(ymd, cur);
    }

    return Array.from(map.entries()).map(([date, v]) => ({
      date,
      revenue: Number(v.revenue.toFixed(2)),
      orders: v.orders
    }));
  }

  function computeOrdersByHour(commandes, days = 30) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }));

    for (const c of (commandes || [])) {
      if (!c.dateObj) continue;
      if (c.dateObj < start || c.dateObj > end) continue;

      const h = c.dateObj.getHours();
      buckets[h].orders += 1;
      buckets[h].revenue += safeNumber(c.totalNum);
    }

    return buckets.map((b) => ({
      hour: b.hour,
      orders: b.orders,
      revenue: Number(b.revenue.toFixed(2))
    }));
  }

  async function getDashboardStats(options = {}) {
    const { days = 30, topLimit = 10, force = false } = options;

    const commandes = await getCommandes({ force });

    const totalRevenue = commandes.reduce((sum, c) => sum + safeNumber(c.totalNum), 0);
    const totalOrders = commandes.length;
    const avgBasket = totalOrders ? totalRevenue / totalOrders : 0;

    const statusCounts = computeStatusCounts(commandes);
    const topProducts = computeTopProducts(commandes, topLimit);
    const topProduct = computeTopProduct(commandes);
    const salesByDay = computeSalesByDay(commandes, days);
    const ordersByHour = computeOrdersByHour(commandes, days);

    return {
      totals: {
        revenue: Number(totalRevenue.toFixed(2)),
        orders: totalOrders,
        avgBasket: Number(avgBasket.toFixed(2))
      },
      statusCounts,
      topProducts,
      topProduct,
      salesByDay,
      ordersByHour,
      raw: {
        count: commandes.length
      }
    };
  }

  // =========================
  // EXPORT
  // =========================
  global.ApiCommandes = {
    CONFIG,

    // commandes (GROUPÉES)
    getCommandes,
    findCommande,
    findCommandesByPhone,
    generateNextCommandeId,

    // whatsapp
    buildWhatsAppLink,
    openWhatsApp,

    // submit
    submitCommandeToSheet,

    // parsing & stats
    parseArticlesToItems,
    getDashboardStats,
    computeTopProduct,
    computeTopProducts,
    computeStatusCounts,
    computeSalesByDay,
    computeOrdersByHour
  };
})(window);
