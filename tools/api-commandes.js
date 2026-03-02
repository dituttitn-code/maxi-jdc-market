/*********************************
 * CONFIGURATION API - MAXI JDC MARKET
 * ✅ CORRECTION FINALE: Gestion correcte de la réponse JSON
 *********************************/

// ✅ URL OK (mettez votre nouvelle URL ici)
export const API_URL =
  "https://script.google.com/macros/s/AKfycbwT2liu35iSJkwGsWMI9kogMRocSAsWv3BABjJzps3i4WG8pMN5sU8AFsyeqmPZhbCF/exec";

/*********************************
 * ENVOYER UNE COMMANDE (ECRITURE)
 *********************************/
export async function envoyerCommande(dataCommande) {
  console.log("🚀 DÉBUT: Envoi de commande", dataCommande);
  
  if (!dataCommande || typeof dataCommande !== "object") {
    throw new Error("Données de commande invalides.");
  }

  // ✅ CORRECTION TÉLÉPHONE
  let telephone = "";
  const telephoneAliases = [
    dataCommande.telephone,
    dataCommande.Téléphone,
    dataCommande.Telephone,
    dataCommande.TELEPHONE,
    dataCommande.tel,
    dataCommande.Tel,
    dataCommande.TEL,
    dataCommande.phone,
    dataCommande.Phone,
    dataCommande.PHONE,
    dataCommande["📞 TÉLÉPHONE"],
    dataCommande.clientInfo?.telephone,
    dataCommande.clientInfo?.Téléphone,
    dataCommande.clientInfo?.phone,
    dataCommande.utilisateur?.telephone
  ];

  for (const alias of telephoneAliases) {
    if (alias && typeof alias === "string" && alias.trim() !== "" && alias !== "#ERROR!") {
      telephone = alias.trim();
      break;
    }
  }

  if (!telephone || telephone === "#ERROR!") {
    for (const key in dataCommande) {
      if (key.toLowerCase().includes("tel") || key.toLowerCase().includes("phone")) {
        const val = dataCommande[key];
        if (val && typeof val === "string" && val.trim() !== "" && val !== "#ERROR!") {
          telephone = val.trim();
          break;
        }
      }
    }
  }

  if (!telephone || telephone === "" || telephone === "#ERROR!") {
    telephone = "Non fourni";
  }

  // ✅ Normaliser les articles
  let articlesFormat = [];
  let articlesText = dataCommande.articles || "";

  if (Array.isArray(dataCommande.articles)) {
    articlesFormat = dataCommande.articles.map((item) => {
      const q = parseInt(item.quantite || item.qty || item.quantity || 1, 10);
      const pu = parseFloat(item.prix_unitaire || item.prix || item.price || 0);
      const quantite = isNaN(q) ? 1 : q;
      const prix_unitaire = isNaN(pu) ? 0 : pu;
      return {
        produit: item.produit || item.nom || item.name || "",
        quantite,
        prix_unitaire,
        prix_total: parseFloat((quantite * prix_unitaire).toFixed(3)),
      };
    });
    
    articlesText = articlesFormat.map(a => 
      `${a.quantite}x ${a.produit}`
    ).join("\n");
  } else if (typeof dataCommande.articles === "string") {
    try {
      const parsed = JSON.parse(dataCommande.articles);
      if (Array.isArray(parsed)) {
        articlesFormat = parsed;
        articlesText = parsed.map(a => 
          `${a.quantite || 1}x ${a.produit || a.nom || a.name || ""}`
        ).join("\n");
      }
    } catch (_) {}
  }

  // ✅ Total avec 3 décimales
  let total = parseFloat(dataCommande.total || 0);
  if ((!total || isNaN(total)) && articlesFormat.length) {
    total = articlesFormat.reduce(
      (sum, it) => sum + (Number(it.prix_total) || 0),
      0
    );
  }

  // ✅ PAYLOAD - Envoi à Google Sheets
  const payload = {
    method: "saveOrder",
    nom_client: dataCommande.nom_client || dataCommande.nom || dataCommande.Nom_Client || dataCommande.clientInfo?.nom || "Client",
    telephone: telephone,
    adresse: dataCommande.adresse || dataCommande.Adresse || dataCommande.address || dataCommande.clientInfo?.adresse || "",
    articles: articlesText || "AUCUN ARTICLE",
    total: total ? Number(total).toFixed(3) : "0.000",
    _t: Date.now()
  };

  console.log("📤 ÉTAPE 1: Envoi à Google Sheets...", payload);

  try {
    // ✅ ÉTAPE 1: Envoyer à Google Sheets
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload).toString(),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }
    
    // ✅ ÉTAPE 2: Récupérer la réponse TEXTE d'abord
    const responseText = await response.text();
    console.log("📦 Réponse brute:", responseText);
    
    // ✅ ÉTAPE 3: Parser le JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("❌ Erreur parsing JSON:", responseText);
      throw new Error("Réponse invalide du serveur");
    }
    
    console.log("📦 ÉTAPE 2: Réponse parsée:", data);

    // ✅ ÉTAPE 4: Vérifier le succès
    if (data && data.success) {
      let numeroSheets = data.commande_id || data.numero_commande || data.orderId || data.id || data.numero || "";
      
      if (!numeroSheets || numeroSheets === "") {
        // Générer un ID local si pas reçu
        numeroSheets = `CMD-${Date.now()}`;
      }
      
      console.log("✅ ÉTAPE 3: Numéro de commande:", numeroSheets);
      
      // ✅ ÉTAPE 5: Message client
      data.client_message = `✅ Commande Enregistrée

Merci pour votre commande chez MAXI JDC MARKET.

📦 Votre commande, référencée sous le numéro ${numeroSheets}, a bien été enregistrée.

⏳ Elle est actuellement en cours de préparation.
📞 Nous vous contacterons prochainement pour la livraison.

Pour suivre votre commande, accédez à Panier > Espace Client > Suivi de commande, puis saisissez le numéro ${numeroSheets} et votre numéro de téléphone.

⚠️ CONSERVEZ CE NUMÉRO : ${numeroSheets}`;
      
      data.message = data.client_message;
      data.commande_id = numeroSheets;
      data.numero_commande = numeroSheets;
      
      return data;
    } else {
      console.error("❌ ÉCHEC: Google Sheets n'a pas confirmé:", data);
      throw new Error(data.error || "Erreur lors de l'enregistrement");
    }
  } catch (error) {
    console.error("❌ ERREUR:", error);
    throw error;
  }
}

/*********************************
 * TEST DE CONNEXION
 *********************************/
export async function testConnexion() {
  try {
    const response = await fetch(`${API_URL}?method=test&_t=${Date.now()}`);
    const text = await response.text();
    console.log("Test réponse brute:", text);
    return JSON.parse(text);
  } catch (error) {
    console.error("Erreur test:", error);
    return { success: false, error: error.toString() };
  }
}
