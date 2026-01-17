/*********************************
 * CONFIG
 *********************************/

// 1) URL pour ECRIRE (Apps Script Web App /exec)
const WRITE_API_URL =
  "https://script.google.com/macros/s/AKfycbyMa4TcmjykCb_O3VvjaakExOTfXk369B4FZ318WK4TC6jK50Qq9c7gaSuYUB-DS1yY/exec";

// 2) URL pour LIRE (Google Sheet publié en CSV)
// IMPORTANT: mets ici l'URL "pub?gid=...&single=true&output=csv"
const READ_CSV_URL =
  "COLLE_ICI_TON_URL_CSV_PUB"; // ex: https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv


/*********************************
 * 1) ENVOYER UNE COMMANDE (ECRITURE)
 * Compatible GitHub Pages (anti-CORS)
 *********************************/
export function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // POST no-cors (on ne peut pas lire la réponse, c'est normal)
  return fetch(WRITE_API_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      nom: dataCommande.nom || "",
      telephone: dataCommande.telephone || "",
      adresse: dataCommande.adresse || "",
      articles: dataCommande.articles || [],
      sousTotal: Number(dataCommande.sousTotal || 0),
      livraison: Number(dataCommande.livraison || 0),
      total: Number(dataCommande.total || 0),
    }),
  });
}


/*********************************
 * 2) RECUPERER LES COMMANDES (LECTURE)
 * Lit le CSV public du Google Sheet et retourne un tableau d'objets
 *********************************/
export async function recupererCommandes() {
  if (!READ_CSV_URL || READ_CSV_URL.includes("COLLE_ICI")) {
    throw new Error("READ_CSV_URL n'est pas configurée (URL CSV pub manquante).");
  }

  const res = await fetch(READ_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de lire le CSV (HTTP " + res.status + ")");

  const csvText = await res.text();
  const rows = parseCsv(csvText);

  if (!rows.length) return [];

  // 1ère ligne = entêtes
  const headers = rows[0].map(h => (h || "").trim());

  // Les lignes suivantes = données
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every(cell => String(cell || "").trim() === "")) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c] || `col_${c}`] = r[c] ?? "";
    }
    data.push(obj);
  }

  return data;
}


/*********************************
 * CSV PARSER (simple + robuste)
 *********************************/
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      // double quote -> " داخل قيمة quoted
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }

  // dernier champ
  row.push(cur);
  rows.push(row);

  return rows;
}
