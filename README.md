# Steam Inventory Scanner - Extension Chrome

Cette extension Chrome permet de scanner les inventaires CS2 de vos amis Steam pour détecter les caisses et leurs valeurs.

## 📦 Fonctionnalités

- ✅ Scan automatique des inventaires CS2 de vos amis
- ✅ Détection des vraies données : nombre de caisses, valeurs, icônes
- ✅ Calcul de la valeur totale des caisses
- ✅ Affichage détaillé avec icônes Steam originales
- ✅ Export des données en CSV
- ✅ Interface Matrix (thème vert sur noir)

## 🚀 Installation

1. Téléchargez les fichiers de l'extension
2. Ouvrez Chrome et allez sur `chrome://extensions/`
3. Activez le "Mode développeur" en haut à droite
4. Cliquez sur "Charger l'extension non empaquetée"
5. Sélectionnez le dossier contenant les fichiers de l'extension

## 📖 Utilisation

1. **Allez sur votre liste d'amis Steam** : `https://steamcommunity.com/id/VOTRE_ID/friends/`
2. **Ouvrez l'extension** en cliquant sur son icône
3. **Ajustez le délai** entre chaque scan (5000ms minimum recommandé)
4. **Cliquez sur "DÉMARRER LE SCAN"**

L'extension va alors :
- Ouvrir chaque inventaire CS2 de vos amis
- Extraire les vraies données depuis Steam
- Afficher le nombre de caisses et leur valeur
- Sauvegarder les résultats

## 🔍 Fonctions détaillées

### Tableau des profils
- **Profil** : Lien vers le profil Steam
- **Caisses** : Nombre total de caisses CS2 (cliquez sur 🔍 pour voir les détails)
- **Valeur Caisses** : Valeur totale des caisses en euros
- **Valeur Inventaire** : Valeur totale de l'inventaire

### Détails des caisses
En cliquant sur 🔍, vous verrez :
- L'icône de chaque caisse
- Le nom exact de la caisse
- La quantité possédée
- Le prix unitaire
- La valeur totale

### Export CSV
Le bouton "EXPORTER CSV" génère un fichier avec toutes les données incluant :
- URL du profil
- Valeur de l'inventaire
- Nombre de caisses
- Valeur des caisses
- SteamID
- Détails complets de chaque caisse

## ⚙️ Comment ça marche ?

L'extension utilise une technique d'injection de script pour accéder aux vraies données JavaScript de Steam :

1. **inject-steam-data.js** est injecté dans le contexte principal de la page
2. Ce script peut accéder aux variables globales Steam (`g_ActiveInventory`, etc.)
3. Les données sont extraites et envoyées à l'extension via `window.postMessage`
4. L'extension traite et stocke les données pour l'affichage

## 🛡️ Sécurité

- L'extension ne collecte aucune donnée personnelle
- Les données restent stockées localement dans votre navigateur
- Aucune communication avec des serveurs externes
- Code source ouvert et vérifiable

## 🐛 Résolution de problèmes

**Les données ne se chargent pas ?**
- Augmentez le délai entre les scans (10000ms ou plus)
- Vérifiez que les inventaires ne sont pas privés
- Rafraîchissez la page Steam et réessayez

**Pas de prix affichés ?**
- Steam ne fournit pas toujours les prix en temps réel
- Les prix peuvent mettre du temps à se charger
- Certains items peuvent ne pas avoir de prix sur le marché

## 📝 Notes

- Cette extension n'est pas affiliée à Valve ou Steam
- Respectez les limites de taux de Steam pour éviter les restrictions temporaires
- Les prix affichés sont indicatifs et peuvent varier 