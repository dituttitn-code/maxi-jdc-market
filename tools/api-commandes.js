// ✅ CORRECTION CRITIQUE : Utiliser le numéro retourné par le SERVEUR
// Le serveur peut avoir modifié le numéro, on utilise le sien
let vraiNumeroCommande = "";

if (data && data.success) {
  // Récupérer le numéro depuis la réponse du serveur (tous les formats possibles)
  vraiNumeroCommande = data.commande_id || data.numero_commande || data.orderId || data.id || data.numero || "";
  
  console.log("📦 Réponse du serveur - brute:", data);
  console.log("📦 Numéro retourné par le serveur:", vraiNumeroCommande);
  console.log("📦 Numéro que nous avons envoyé:", numeroCommande);
  
  // Si le serveur n'a pas retourné de numéro (cas improbable), utiliser le nôtre
  if (!vraiNumeroCommande || vraiNumeroCommande === "") {
    console.warn("⚠️ Serveur n'a pas retourné de numéro, utilisation du nôtre");
    vraiNumeroCommande = numeroCommande;
  }
  
  // Normalisation - garder le numéro EXACT retourné par le serveur
  data.commande_id = vraiNumeroCommande;
  data.commandeId = vraiNumeroCommande;
  data.orderId = vraiNumeroCommande;
  data.id = vraiNumeroCommande;
  
  // ✅ CRUCIAL: Ajouter le numéro à la racine de l'objet pour qu'il soit accessible
  data.numero_commande = vraiNumeroCommande;
  data.numero = vraiNumeroCommande;
  
  // Ajouter le message de confirmation avec le BON numéro
  if (!data.client_message) {
    data.client_message = `✅ Votre commande ${vraiNumeroCommande} a été enregistrée avec succès !`;
  }
  data.message = data.client_message;
  
  console.log("✅ Numéro FINAL transmis à la page:", vraiNumeroCommande);
}
