// api-commandes.js - Version finale pour MAXI JDC MARKET
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwfTa_rv1nOi0kMT_RtjfD_Q0syweIhWxSRCRREZFz-yQYmgXKHNupfzpe3W3-ap7Pe/exec";

class GestionCommandes {
    constructor() {
        this.initialiserEvenements();
    }

    initialiserEvenements() {
        document.addEventListener('DOMContentLoaded', () => {
            // Événement formulaire de commande
            const formulaireCommande = document.getElementById('formulaire-commande');
            if (formulaireCommande) {
                formulaireCommande.addEventListener('submit', (e) => this.creerCommande(e));
            }
            
            // Charger les commandes si sur page de suivi
            if (window.location.pathname.includes('suivi-commandes.html')) {
                this.chargerCommandes();
            }
            
            // Gestion recherche
            const searchBtn = document.getElementById('search-btn');
            if (searchBtn) {
                searchBtn.addEventListener('click', () => this.rechercherCommandes());
            }
            
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.rechercherCommandes();
                });
            }
        });
    }

    async creerCommande(e) {
        if (e) e.preventDefault();
        
        // Récupérer données formulaire
        const nom = document.getElementById('nom')?.value.trim() || '';
        const telephone = document.getElementById('telephone')?.value.trim() || '';
        const adresse = document.getElementById('adresse')?.value.trim() || '';
        const notes = document.getElementById('notes')?.value.trim() || '';
        
        // Récupérer panier
        const panier = JSON.parse(localStorage.getItem('panier')) || [];
        
        // Validation
        if (panier.length === 0) {
            this.afficherMessage("❌ Votre panier est vide !", 'error');
            return;
        }
        
        if (!nom || !telephone || !adresse) {
            this.afficherMessage("❌ Veuillez remplir tous les champs obligatoires", 'error');
            return;
        }
        
        // Formater les articles pour Google Sheets
        const articlesText = panier.map(item => {
            return `${item.quantite}x ${item.nom} - ${item.prix.toFixed(3)} DT`;
        }).join('\n');
        
        // Calculer total
        const totalArticles = panier.reduce((sum, item) => sum + (item.prix * item.quantite), 0);
        const totalFinal = totalArticles + 3.000; // Frais livraison
        
        // Préparer données pour Google Script
        const commandeData = {
            nom: nom,
            telephone: telephone,
            adresse: adresse,
            notes: notes,
            articles: articlesText,
            total: totalFinal.toFixed(3)
        };
        
        console.log('📤 Envoi vers Google Sheets:', commandeData);
        
        try {
            this.afficherMessage("📤 Envoi de la commande...", 'info');
            
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this.objectToFormData(commandeData)
            });
            
            const result = await response.json();
            console.log('📥 Réponse Google Sheets:', result);
            
            if (result.success) {
                // Sauvegarder localement pour affichage immédiat
                const commandeLocale = {
                    numero: result.commande_id || this.genererNumeroLocal(),
                    date: new Date().toISOString(),
                    client: { nom, telephone, adresse, notes },
                    articles: panier,
                    total: totalFinal,
                    statut: 'EN ATTENTE'
                };
                
                this.enregistrerCommandeLocal(commandeLocale);
                
                // Vider panier
                localStorage.removeItem('panier');
                
                this.afficherMessage("✅ Commande enregistrée avec succès !", 'success');
                
                // Redirection après 2 secondes
                setTimeout(() => {
                    window.location.href = 'suivi-commandes.html?commande=' + commandeLocale.numero;
                }, 2000);
                
            } else {
                this.afficherMessage("❌ Erreur: " + (result.message || result.error), 'error');
            }
            
        } catch (error) {
            console.error('❌ Erreur réseau:', error);
            this.afficherMessage("❌ Erreur de connexion au serveur", 'error');
        }
    }

    objectToFormData(obj) {
        return Object.keys(obj)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
            .join('&');
    }

    genererNumeroLocal() {
        const now = new Date();
        return `LOCAL-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
    }

    enregistrerCommandeLocal(commande) {
        let commandes = JSON.parse(localStorage.getItem('commandes')) || [];
        commandes.push(commande);
        localStorage.setItem('commandes', JSON.stringify(commandes));
        console.log('💾 Commande sauvegardée localement:', commande.numero);
    }

    async chargerCommandes() {
        try {
            console.log('🔄 Chargement des commandes depuis Google Sheets...');
            
            // Charger depuis Google Sheets
            const response = await fetch(GOOGLE_SCRIPT_URL + '?method=getOrders');
            const result = await response.json();
            
            let toutesCommandes = [];
            
            if (result.success && result.orders) {
                console.log(`✅ ${result.orders.length} commandes depuis Google Sheets`);
                
                // Convertir format Google Sheets en format local
                const commandesGoogle = result.orders.map(order => {
                    const articlesArray = this.parseArticlesText(order.articles);
                    
                    return {
                        numero: order.numero || '',
                        date: order.date || new Date().toISOString(),
                        client: {
                            nom: order.nom || '',
                            telephone: order.telephone || '',
                            adresse: order.adresse || ''
                        },
                        articles: articlesArray,
                        total: parseFloat(order.total) || 0,
                        statut: order.statut || 'EN ATTENTE',
                        source: 'google'
                    };
                });
                
                toutesCommandes = commandesGoogle;
                
                // Sauvegarder dans localStorage pour cache
                localStorage.setItem('commandes_google', JSON.stringify(commandesGoogle));
            }
            
            // Ajouter commandes locales (en attente)
            const commandesLocales = JSON.parse(localStorage.getItem('commandes')) || [];
            commandesLocales.forEach(commande => {
                if (!toutesCommandes.find(c => c.numero === commande.numero)) {
                    commandesLocales.source = 'local';
                    toutesCommandes.push(commande);
                }
            });
            
            // Trier par date (plus récent en premier)
            toutesCommandes.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            console.log(`📊 Total commandes à afficher: ${toutesCommandes.length}`);
            this.afficherCommandes(toutesCommandes);
            
        } catch (error) {
            console.error('❌ Erreur chargement Google:', error);
            // Fallback sur localStorage
            const commandes = JSON.parse(localStorage.getItem('commandes')) || [];
            this.afficherCommandes(commandes);
            this.afficherMessage("⚠️ Mode hors ligne - Commandes locales seulement", 'warning');
        }
    }

    parseArticlesText(text) {
        if (!text || text.includes("Aucun article")) return [];
        
        const articles = [];
        const lines = text.split('\n');
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            // Pattern: "2x Produit A - 10.500 DT"
            const match = trimmed.match(/(\d+)\s*x\s*([^-]+)-\s*(\d+\.?\d*)\s*DT?/i);
            if (match) {
                articles.push({
                    nom: match[2].trim(),
                    quantite: parseInt(match[1]),
                    prix: parseFloat(match[3])
                });
            }
        });
        
        return articles;
    }

    afficherCommandes(commandes) {
        const tbody = document.getElementById('liste-commandes');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (commandes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 48px; margin-bottom: 20px;">📦</div>
                            <h3 style="color: #666; margin-bottom: 10px;">Aucune commande trouvée</h3>
                            <p style="color: #888;">Les commandes apparaîtront ici</p>
                            <button onclick="window.location.href='index.html'" 
                                    style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                Passer une commande
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        commandes.forEach(commande => {
            // Formater date
            let dateFormatee;
            try {
                const date = new Date(commande.date);
                if (isNaN(date.getTime())) {
                    dateFormatee = commande.date;
                } else {
                    dateFormatee = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                }
            } catch (e) {
                dateFormatee = commande.date;
            }
            
            // Formater articles
            let articlesTexte = "Aucun article";
            if (commande.articles && Array.isArray(commande.articles) && commande.articles.length > 0) {
                articlesTexte = commande.articles.map(a => `${a.quantite} x ${a.nom}`).join(', ');
            } else if (typeof commande.articles === 'string' && commande.articles.length > 5) {
                articlesTexte = commande.articles.substring(0, 100) + (commande.articles.length > 100 ? '...' : '');
            }
            
            // Déterminer classe CSS pour statut
            const statutClass = this.getStatutClass(commande.statut);
            
            const ligne = `
                <tr>
                    <td>${dateFormatee}</td>
                    <td>${commande.client.nom || 'Non spécifié'}</td>
                    <td>${commande.client.telephone || ''}</td>
                    <td>${commande.client.adresse || ''}</td>
                    <td><strong>${commande.numero || 'N/A'}</strong></td>
                    <td title="${commande.articles || ''}">${articlesTexte}</td>
                    <td>${commande.total.toFixed(3)} DT</td>
                    <td>
                        <span class="statut ${statutClass}">
                            ${commande.statut || 'EN ATTENTE'}
                        </span>
                    </td>
                </tr>
            `;
            
            tbody.innerHTML += ligne;
        });
    }

    getStatutClass(statut) {
        if (!statut) return 'en-attente';
        
        const statutLower = statut.toLowerCase();
        if (statutLower.includes('livré')) return 'livree';
        if (statutLower.includes('préparation')) return 'traitement';
        if (statutLower.includes('attente')) return 'en-attente';
        if (statutLower.includes('annulé')) return 'annulee';
        if (statutLower.includes('nouvelle')) return 'nouvelle';
        if (statutLower.includes('livraison')) return 'en-livraison';
        return 'en-attente';
    }

    rechercherCommandes() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return;
        
        const terme = searchInput.value.trim().toLowerCase();
        const tbody = document.getElementById('liste-commandes');
        
        if (!tbody || tbody.children.length === 0) return;
        
        const lignes = tbody.getElementsByTagName('tr');
        
        for (let ligne of lignes) {
            const cells = ligne.getElementsByTagName('td');
            let visible = false;
            
            if (terme === '') {
                visible = true;
            } else {
                // Chercher dans chaque cellule
                for (let cell of cells) {
                    if (cell.textContent.toLowerCase().includes(terme)) {
                        visible = true;
                        break;
                    }
                }
            }
            
            ligne.style.display = visible ? '' : 'none';
        }
    }

    afficherMessage(message, type = 'info') {
        // Supprimer messages existants
        const existingMessages = document.querySelectorAll('.message-floating');
        existingMessages.forEach(msg => msg.remove());
        
        // Créer nouveau message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-floating ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${this.getMessageColor(type)};
            color: white;
            border-radius: 8px;
            z-index: 9999;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            font-weight: 500;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(messageDiv);
        
        // Auto-suppression après 5 secondes
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        document.body.removeChild(messageDiv);
                    }
                }, 300);
            }
        }, 5000);
        
        // Ajouter animations CSS si pas déjà présentes
        if (!document.querySelector('#message-animations')) {
            const style = document.createElement('style');
            style.id = 'message-animations';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    getMessageColor(type) {
        switch(type) {
            case 'success': return '#27ae60';
            case 'error': return '#e74c3c';
            case 'warning': return '#f39c12';
            case 'info': 
            default: return '#3498db';
        }
    }

    // Fonction de test pour vérifier la connexion
    async testerConnexion() {
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL + '?method=test');
            const data = await response.json();
            console.log('Test connexion:', data);
            return data.success;
        } catch (error) {
            console.error('Test connexion échoué:', error);
            return false;
        }
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    window.gestionCommandes = new GestionCommandes();
    
    // Tester la connexion au chargement
    setTimeout(() => {
        window.gestionCommandes.testerConnexion().then(connected => {
            if (!connected) {
                console.warn('⚠️ Connexion Google Sheets non disponible');
            }
        });
    }, 1000);
});
