/*********************************
 * CONFIG (TES 2 ADRESSES)
 *********************************/

// ✅ ECRITURE (Apps Script /exec) - NOUVELLE URL
const WRITE_API_URL =
  "https://script.google.com/macros/s/AKfycby13uH-kh7WG7nquS9RR7Wuv6k5fAs3SZYS_Vn8gECM_-F-anZY0K6n1PqZXMncXCoM/exec";

// ✅ LECTURE (CSV Google Sheet publié)
const READ_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSnzZS17O7qIf35FOQHZfOXRDS-tZDCBmze4FkEEfw2kY5KdEj4Kj9ycv-1J4y_i-2_YKKnp9P48MFy/pub?gid=1804772268&single=true&output=csv";

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export function envoyerCommande(dataCommande) {
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // no-cors = indispensable sur GitHub Pages (sinon CORS)
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
 * RECUPERER LES COMMANDES (LECTURE CSV)
 *********************************/
export async function recupererCommandes() {
  const res = await fetch(READ_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de lire le CSV (HTTP " + res.status + ")");

  const csvText = await res.text();
  const rows = parseCsv(csvText);
  if (!rows.length) return [];

  const headers = rows[0].map((h) => (h || "").trim());
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((cell) => String(cell || "").trim() === "")) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c] || `col_${c}`] = r[c] ?? "";
    }
    data.push(obj);
  }

  return data;
}

/*********************************
 * CSV PARSER (robuste)
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

  row.push(cur);
  rows.push(row);

  return rows;
}

/*********************************
 * BONUS: test depuis Console
 *********************************/
window.apiCommandes = { envoyerCommande, recupererCommandes };
