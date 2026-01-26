// api-commandes.js - FICHIER COMPLET CORRIGÉ
const API_URL = "https://script.google.com/macros/s/AKfycbzcDRrT5tGfh9cyX8Pw3DwpSzOj781QGsSxyLrZT-b_v-xi4dmMbCZxAZqQDMjy4Tx0/exec";

export async function envoyerCommande(dataCommande) {
    console.log("📤 Données reçues:", dataCommande);
    
    // FORMATAGE CORRECT des articles
    let articlesFormat = "";
    if (Array.isArray(dataCommande.articles)) {
        articlesFormat = dataCommande.articles.map(item => 
            `${item.quantite || 1}x ${item.produit || item.nom || "Produit"}`
        ).join('\n');
    } else {
        articlesFormat = dataCommande.articles || "";
    }
    
    // CALCUL des totaux
    const sousTotal = parseFloat(dataCommande.sous_total || dataCommande.subtotal || 0);
    const livraison = parseFloat(dataCommande.livraison || 3);
    const total = sousTotal + livraison;
    
    // PAYLOAD CORRECT pour votre Sheet actuel (8 colonnes)
    const payload = {
        method: "saveOrderSimple",
        nom: (dataCommande.nom || "").trim().toUpperCase(),
        telephone: (dataCommande.telephone || "").toString().trim(),
        adresse: dataCommande.adresse || "",
        articles: articlesFormat,
        sous_total: sousTotal.toFixed(2),
        livraison: livraison.toFixed(2),
        total: total.toFixed(2),
        economie: "0.00",
        statut: "En attente",
        notes: "Commande depuis l'application mobile MAXI JDC"
    };
    
    console.log("📤 Données envoyées:", payload);
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(payload).toString()
        });
        
        const result = await response.json();
        console.log("📥 Réponse API:", result);
        
        if (result.success) {
            // Générer le lien WhatsApp
            await genererNotificationWhatsApp(result.commande_id, dataCommande);
        }
        
        return result;
        
    } catch (error) {
        console.error("❌ Erreur:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function genererNotificationWhatsApp(commandeId, dataCommande) {
    const whatsappNumber = "21625600978";
    
    // Formater les articles
    let articlesText = "";
    if (Array.isArray(dataCommande.articles)) {
        articlesText = dataCommande.articles.map(item => 
            `${item.quantite || 1}x ${item.produit || item.nom}`
        ).join('\n');
    }
    
    const message = `📦 NOUVELLE COMMANDE #${commandeId}\n\n` +
                   `👤 ${dataCommande.nom || ''}\n` +
                   `📱 ${dataCommande.telephone || ''}\n` +
                   `📍 ${dataCommande.adresse || ''}\n\n` +
                   `🛒 ARTICLES:\n${articlesText}\n\n` +
                   `💰 TOTAL: ${dataCommande.total || '0'} DT`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    // Ouvrir WhatsApp
    window.open(whatsappUrl, '_blank');
    
    return { whatsapp_url: whatsappUrl };
}

// Fonctions utilitaires
export async function recupererCommandes() {
    try {
        const response = await fetch(`${API_URL}?method=getOrders`);
        return await response.json();
    } catch (error) {
        console.error("Erreur:", error);
        return { success: false, orders: [] };
    }
}

export function formaterArticles(articles) {
    if (!articles) return "";
    if (Array.isArray(articles)) {
        return articles.map(item => 
            `${item.quantite || 1}x ${item.produit || item.nom}`
        ).join('\n');
    }
    return articles.toString();
}

export default {
    envoyerCommande,
    recupererCommandes,
    formaterArticles
};
