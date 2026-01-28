// api-commandes.js
// Gestion des commandes pour MAXI JDC MARKET

const API_URL = 'http://localhost:3000/api'; // Adaptez selon votre backend

class GestionCommandes {
    constructor() {
        this.initialiserEvenements();
        this.chargerCommandes();
    }

    initialiserEvenements() {
        // Événement pour soumettre le formulaire de commande
        document.addEventListener('DOMContentLoaded', () => {
            const formulaireCommande = document.getElementById('formulaire-commande');
            if (formulaireCommande) {
                formulaireCommande.addEventListener('submit', (e) => this.creerCommande(e));
            }
        });
    }

    async creerCommande(e) {
        e.preventDefault();
        
        // Récupérer les données du formulaire
        const nom = document.getElementById('nom').value.trim();
        const telephone = document.getElementById('telephone').value.trim();
        const adresse = document.getElementById('adresse').value.trim();
        const notes = document.getElementById('notes').value.trim();
        
        // Récupérer le panier depuis localStorage
        const panier = JSON.parse(localStorage.getItem('panier')) || [];
        
        // Vérifier si le panier n'est pas vide
        if (panier.length === 0) {
            this.afficherErreur("Votre panier est vide !");
            return;
        }

        // Vérifier les informations client
        if (!nom || !telephone || !adresse) {
            this.afficherErreur("Veuillez remplir tous les champs obligatoires");
            return;
        }

        // Calculer le total
        const total = panier.reduce((sum, article) => {
            return sum + (article.prix * article.quantite);
        }, 0);

        // Générer un numéro de commande
        const numeroCommande = this.genererNumeroCommande();

        // Préparer les données de la commande
        const commande = {
            numero: numeroCommande,
            date: new Date().toISOString(),
            client: {
                nom: nom,
                telephone: telephone,
                adresse: adresse,
                notes: notes
            },
            articles: panier,
            total: total,
            statut: 'EN ATTENTE'
        };

        try {
            // Afficher un message de chargement
            this.afficherMessage("Traitement de votre commande...", 'info');

            // Simuler un appel API (remplacez par un vrai appel fetch)
            await this.simulerAPICall(commande);
            
            // Enregistrer en localStorage pour le suivi
            this.enregistrerCommandeLocal(commande);
            
            // Vider le panier
            localStorage.removeItem('panier');
            
            // Rediriger vers la page de suivi
            window.location.href = 'suivi-commandes.html?commande=' + numeroCommande;
            
        } catch (erreur) {
            console.error('Erreur création commande:', erreur);
            this.afficherErreur("Erreur lors de la création de la commande: " + erreur.message);
        }
    }

    simulerAPICall(commande) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulation de succès
                console.log('Commande créée:', commande);
                resolve({ success: true, data: commande });
            }, 1000);
        });
    }

    enregistrerCommandeLocal(commande) {
        // Récupérer les commandes existantes
        let commandes = JSON.parse(localStorage.getItem('commandes')) || [];
        
        // Ajouter la nouvelle commande
        commandes.push(commande);
        
        // Sauvegarder
        localStorage.setItem('commandes', JSON.stringify(commandes));
    }

    async chargerCommandes() {
        // Cette fonction charge les commandes pour la page de suivi
        const page = window.location.pathname;
        
        if (page.includes('suivi-commandes.html')) {
            try {
                // Récupérer les commandes depuis localStorage
                const commandes = JSON.parse(localStorage.getItem('commandes')) || [];
                
                // Récupérer le numéro de commande depuis l'URL si présent
                const params = new URLSearchParams(window.location.search);
                const numCommandeRecherche = params.get('commande');
                
                // Afficher les commandes
                this.afficherCommandes(commandes, numCommandeRecherche);
                
            } catch (erreur) {
                console.error('Erreur chargement commandes:', erreur);
                this.afficherErreur("Erreur lors du chargement des commandes");
            }
        }
    }

    afficherCommandes(commandes, filtreNumero = null) {
        const tbody = document.getElementById('liste-commandes');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Filtrer si un numéro est spécifié
        const commandesAAfficher = filtreNumero 
            ? commandes.filter(c => c.numero === filtreNumero)
            : commandes;
        
        if (commandesAAfficher.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 20px;">
                        Aucune commande trouvée
                    </td>
                </tr>
            `;
            return;
        }
        
        commandesAAfficher.forEach(commande => {
            const date = new Date(commande.date);
            const dateFormatee = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            
            // Formater les articles
            const articlesTexte = commande.articles.map(a => 
                `${a.quantite} x ${a.nom}`
            ).join(', ');
            
            const ligne = `
                <tr>
                    <td>${dateFormatee}</td>
                    <td>${commande.client.nom}</td>
                    <td>${commande.client.telephone}</td>
                    <td>${commande.client.adresse}</td>
                    <td>${commande.numero}</td>
                    <td>${articlesTexte || 'Aucun article'}</td>
                    <td>${commande.total.toFixed(3)} DT</td>
                    <td>
                        <span class="statut ${commande.statut.toLowerCase().replace(' ', '-')}">
                            ${commande.statut}
                        </span>
                    </td>
                </tr>
            `;
            
            tbody.innerHTML += ligne;
        });
    }

    genererNumeroCommande() {
        const date = new Date();
        const annee = date.getFullYear();
        const mois = (date.getMonth() + 1).toString().padStart(2, '0');
        const jour = date.getDate().toString().padStart(2, '0');
        const heure = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        
        // Générer un identifiant aléatoire
        const randomId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        return `MAXI-${annee}${mois}${jour}-${heure}${minute}-${randomId}`;
    }

    afficherMessage(message, type = 'info') {
        // Créer un élément de message temporaire
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px;
            background: ${type === 'error' ? '#f44336' : '#4CAF50'};
            color: white;
            border-radius: 5px;
            z-index: 1000;
        `;
        
        document.body.appendChild(messageDiv);
        
        // Supprimer après 3 secondes
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 3000);
    }

    afficherErreur(message) {
        this.afficherMessage(message, 'error');
    }
}

// Initialiser quand la page est chargée
document.addEventListener('DOMContentLoaded', () => {
    window.gestionCommandes = new GestionCommandes();
});
