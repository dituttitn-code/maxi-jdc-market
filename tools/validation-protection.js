// ===================================================
// Gestion de la confirmation de commande et WhatsApp
// ===================================================

// Fonction pour générer un numéro de commande (exemple)
// À remplacer par la récupération du vrai numéro depuis la réponse serveur
function generateOrderNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CMD-MAXI-${yyyy}${mm}${dd}-${random}`;
}

// Fonction pour afficher la notification et gérer la copie
function showConfirmation(orderNumber) {
    // Éviter les doublons
    if (document.getElementById('confirmationModal')) return;

    const modal = document.createElement('div');
    modal.id = 'confirmationModal';
    modal.className = 'confirmation-modal';
    modal.innerHTML = `
        <div class="header">
            <i class="fas fa-check-circle"></i>
            <span>✅ Commande Enregistrée</span>
        </div>
        <div class="message">
            Merci pour votre commande chez MAXI JDC MARKET.<br>
            📦 Votre commande, référencée sous le numéro <strong>${orderNumber}</strong>, a bien été enregistrée.<br>
            ⏳ Elle est actuellement en cours de préparation.<br>
            📞 Nous vous contacterons prochainement pour la livraison.<br>
            Pour suivre votre commande, accédez à Panier > Espace Client > Suivi & Historique.
        </div>
        <div class="order-number">
            <span>⚠️ ${orderNumber}</span>
            <i class="fas fa-copy" style="cursor: pointer; color: #555;" id="copyOrderNumber" title="Copier"></i>
        </div>
        <div class="actions">
            <button class="copy-btn" id="copyBtn"><i class="fas fa-clipboard"></i> Copier</button>
            <button class="ok-btn" id="okBtn"><i class="fas fa-check"></i> OK</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Fonction de copie
    const copy = () => {
        navigator.clipboard.writeText(orderNumber).then(() => {
            alert('Numéro copié !');
        }).catch(err => console.error('Erreur de copie :', err));
    };

    document.getElementById('copyBtn').addEventListener('click', copy);
    document.getElementById('copyOrderNumber').addEventListener('click', copy);
    document.getElementById('okBtn').addEventListener('click', () => {
        modal.remove();
    });

    // Auto-disparition après 15 secondes
    setTimeout(() => {
        if (modal) modal.remove();
    }, 15000);
}

// Fonction pour envoyer le message WhatsApp aux deux numéros
function sendWhatsAppMessages(orderNumber) {
    const message = `✅ Commande Enregistrée
Merci pour votre commande chez MAXI JDC MARKET. 
📦 Votre commande, référencée sous le numéro ${orderNumber}, a bien été enregistrée. 
⏳ Elle est actuellement en cours de préparation.
📞 Nous vous contacterons prochainement pour la livraison.
Pour suivre votre commande, accédez à Panier > Espace Client > Suivi & Historique
⚠️ CONSERVEZ CE NUMÉRO : ${orderNumber}`;

    const encodedMessage = encodeURIComponent(message);
    const numbers = ['0015145860453', '0021625600978']; // Les deux numéros

    // Ouvre WhatsApp pour chaque numéro (avec un délai pour éviter le blocage pop-up)
    numbers.forEach((num, index) => {
        setTimeout(() => {
            window.open(`https://wa.me/${num}?text=${encodedMessage}`, '_blank');
        }, index * 800); // 800ms d'intervalle
    });
}

// === Intégration avec le bouton "Valider et envoyer" ===
// On va intercepter le clic pour exécuter notre code après la validation existante.
// Méthode : on ajoute un écouteur qui s'exécute après le traitement original.
// Pour cela, on suppose que le bouton a l'ID "validateSendBtn" et que le traitement original est asynchrone.
// On va surveiller les changements dans le DOM ou utiliser un délai, mais mieux : étendre la fonction de succès AJAX.

// Si vous avez accès au code source, insérez l'appel à ces fonctions dans le callback de réussite de l'AJAX.
// Exemple :
/*
$.post('votre-url', data, function(response) {
    // Code existant...
    
    // Récupérer le numéro de commande depuis la réponse
    const orderNumber = response.numero_commande || generateOrderNumber();
    showConfirmation(orderNumber);
    sendWhatsAppMessages(orderNumber);
});
*/

// Si vous ne pouvez pas modifier l'existant, voici une approche de contournement :
// On écoute le clic et on attend que le message de succès habituel apparaisse (à adapter selon votre interface).
document.getElementById('validateSendBtn')?.addEventListener('click', function() {
    // On utilise un délai pour laisser le temps à la requête AJAX de se terminer
    // Attention : cette méthode n'est pas fiable à 100% car le délai peut être trop court ou trop long.
    setTimeout(() => {
        // Vérifier si la commande a bien été validée (par exemple présence d'un élément de succès)
        // Ici on se base sur l'apparition d'un éventuel message "Commande validée"
        if (document.querySelector('.success-message') || confirm("La commande a-t-elle été validée ?")) {
            const orderNumber = generateOrderNumber(); // À remplacer par le vrai numéro
            showConfirmation(orderNumber);
            sendWhatsAppMessages(orderNumber);
        }
    }, 2000); // Délai arbitraire de 2 secondes
});

// Note : La méthode la plus propre est d'ajouter l'appel directement dans le callback AJAX existant.
// Veuillez localiser dans validation-protection.js la fonction appelée après validation et y ajouter :
// showConfirmation(response.numero_commande);
// sendWhatsAppMessages(response.numero_commande);
