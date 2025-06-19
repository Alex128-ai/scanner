let timer = null;
let currentIndex = 0;
let friendLinks = [];
let tabId = null;
let allProfiles = [];
let originalFriendLinks = []; // Liste originale pour le mode boucle
let loopCycles = 0; // Compteur de boucles
let isLoopMode = false; // État du mode boucle
let lastScannedFriend = null; // Dernier ami scanné pour éviter les doublons
let isBackgroundTab = false; // Si le scan s'exécute dans un onglet en arrière-plan
let backgroundTabId = null; // ID de l'onglet en arrière-plan
// Statistiques globales pour le mode boucle
let globalStats = {
  totalScans: 0,
  totalCasesFound: 0,
  totalCasesValue: 0,
  profilesWithCases: 0
};
const APP_ID = 730; // CS2 (anciennement 'csgo')

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start") {
    tabId = message.tabId;
    isBackgroundTab = message.isBackgroundTab || false;
    if (isBackgroundTab) {
      backgroundTabId = tabId;
      logMessage("🌐 Mode arrière-plan activé - Le scan s'exécute dans un onglet séparé");
    }
    chrome.storage.local.get(['delay'], (result) => {
      const delay = parseInt(result.delay) || 5000;
      console.log(`[Background] Démarrage du scan avec délai: ${delay}ms`);
      logMessage(`⏱️ Délai entre les scans: ${delay}ms`);
      startProcess(tabId, delay);
    });
  } else if (message.action === "stop") {
    stopProcess();
  } else if (message.action === "skip") {
    // Passer au profil suivant de manière sécurisée
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    
    // Vérifier si on est en mode boucle
    if (isLoopMode) {
      // Sélectionner un nouvel ami au hasard
      if (originalFriendLinks.length > 0) {
        let randomFriend;
        let attempts = 0;
        do {
          const randomIndex = Math.floor(Math.random() * originalFriendLinks.length);
          randomFriend = originalFriendLinks[randomIndex];
          attempts++;
        } while (randomFriend === lastScannedFriend && attempts < 10 && originalFriendLinks.length > 1);
        
        lastScannedFriend = randomFriend;
        friendLinks = [randomFriend];
        currentIndex = 0;
        logMessage(`🎲 Nouvel ami sélectionné: ${randomFriend.split('/').pop()}`);
      }
    } else {
      // Mode normal - passer au profil suivant
      currentIndex++;
    }
    
    // Vérifier si on a atteint la fin de la liste
    if (currentIndex >= friendLinks.length) {
      if (isLoopMode) {
        logMessage("🔄 Fin de la liste atteinte - Sélection d'un nouvel ami...");
      } else {
        logMessage("✅ Scan terminé - Tous les profils ont été analysés");
        stopProcess();
        return;
      }
    }
    
    // Mettre à jour la progression
    chrome.runtime.sendMessage({ 
      action: "progress", 
      current: currentIndex, 
      total: friendLinks.length 
    });
    
    // Continuer avec le prochain profil
    processNextFriend(tabId, delay);
    logMessage("⏭️ Passage au profil suivant...");
  } else if (message.action === "resetData") {
    allProfiles = [];
    chrome.storage.local.set({ allProfiles });
  } else if (message.action === "log") {
    chrome.runtime.sendMessage(message);
  } else if (message.action === "check_status") {
    // Répondre avec l'état actuel du scan
    sendResponse({
      isScanning: friendLinks.length > 0 || timer !== null,
      loopCycles: loopCycles
    });
    return true; // Indique que la réponse sera asynchrone
  }
});

function startProcess(tabId, delay) {
  stopProcess();
  
  // Récupérer l'état du mode boucle
  chrome.storage.local.get('loopMode', (data) => {
    isLoopMode = data.loopMode || false;
    if (isLoopMode && loopCycles > 0) {
      logMessage(`🔄 Cycle de boucle #${loopCycles + 1} - Sélection d'un ami au hasard...`);
    } else {
      logMessage("🔍 Chargement de la liste complète d'amis...");
      logMessage("⏳ Cette opération peut prendre quelques secondes pour charger tous vos amis...");
    }
  });
  
  chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      console.log('[Steam Scanner] Début de la récupération de tous les amis...');
      
      // Vérifier qu'on est bien sur une page de liste d'amis
      const currentUrl = window.location.href;
      console.log('[Steam Scanner] URL actuelle:', currentUrl);
      
      if (!currentUrl.includes('/friends') && !currentUrl.includes('/contacts')) {
        console.error('[Steam Scanner] Cette page n\'est pas une liste d\'amis! URL:', currentUrl);
        // Mais on continue quand même au cas où
      }
      
      // Fonction pour faire défiler jusqu'en bas
              async function scrollToBottom() {
          // Créer un indicateur visuel
          const indicator = document.createElement('div');
          indicator.id = 'steam-scanner-loading';
          indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: #0f0;
            padding: 20px;
            border: 2px solid #0f0;
            border-radius: 5px;
            font-family: monospace;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 0 10px #0f0;
          `;
          indicator.innerHTML = '🔄 Chargement de tous les amis...<br>0 amis détectés';
          document.body.appendChild(indicator);
          
          return new Promise((resolve) => {
            let lastHeight = document.body.scrollHeight;
            let lastFriendCount = 0;
            let noChangeCount = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = 100; // Augmenté pour être sûr
            const maxNoChange = 5; // Nombre de fois sans changement avant d'arrêter
          
            const scrollInterval = setInterval(() => {
              // Sélecteurs améliorés pour tous les types d'interfaces Steam
              const friendSelectors = [
                '.friend_block_v2',
                '.friendBlock',
                '.selectable_overlay',
                '.friend_block_content',
                '.friendListItemContainer',
                'a[href*="/profiles/"]',
                'a[href*="/id/"]',
                '.friend_small_avatar_holder',
                '.playerAvatar',
                '.friendBlockLinkOverlay',
                '[data-miniprofile]',
                '.friend_block_link',
                '.friend_relationship_request_block',
                // Nouveaux sélecteurs pour différentes vues
                '.profile_friends_list .friend_block',
                '.profile_friends .friend_block',
                '.friends_content .friend_block',
                '.friendslist_entry',
                '.friend_activity',
                '.friendPlayerLevelNum'
              ];
              
              // Compter avec tous les sélecteurs
              let currentFriendCount = 0;
              friendSelectors.forEach(selector => {
                currentFriendCount += document.querySelectorAll(selector).length;
              });
              
              // Aussi compter les liens uniques
              const uniqueProfileLinks = new Set();
              document.querySelectorAll('a[href*="/profiles/"], a[href*="/id/"]').forEach(link => {
                const href = link.href || link.getAttribute('href');
                if (href && (href.includes('/profiles/') || href.includes('/id/'))) {
                  const cleanUrl = href.split('?')[0].split('#')[0];
                  uniqueProfileLinks.add(cleanUrl);
                }
              });
              currentFriendCount = Math.max(currentFriendCount, uniqueProfileLinks.size);
            
              // Faire défiler jusqu'en bas
              window.scrollTo(0, document.body.scrollHeight);
              
              // Chercher TOUS les boutons de chargement possibles
                             const loadMoreSelectors = [
                 'button[onclick*="LoadMoreFriends"]',
                 '.load_more_button',
                 '.pagebtn',
                 '.pagebtn_next',
                 '.friends_paging_controls button',
                 '.see_all_friends_btn',
                 'a[onclick*="LoadFriends"]',
                 '.friends_nav button',
                 '.profile_friends .pagelink',
                 '.friends_grid_loadmore',
                 '.Load_more_friends_btn'
               ];
              
                             loadMoreSelectors.forEach(selector => {
                 const buttons = document.querySelectorAll(selector);
                 buttons.forEach(button => {
                   if (button && button.offsetParent !== null) { // Vérifier que le bouton est visible
                     button.click();
                     console.log(`[Steam Scanner] Bouton trouvé et cliqué: ${selector}`);
                   }
                 });
               });
               
               // Chercher aussi les boutons par texte
               document.querySelectorAll('button, a.btn, a.pagelink').forEach(button => {
                 const text = button.textContent.toLowerCase();
                 if ((text.includes('load more') || text.includes('charger plus') || 
                      text.includes('show more') || text.includes('voir plus') ||
                      text.includes('next') || text.includes('suivant')) && 
                     button.offsetParent !== null) {
                   button.click();
                   console.log(`[Steam Scanner] Bouton cliqué par texte: "${button.textContent.trim()}"`);
                 }
               });
              
              // Vérifier s'il y a un indicateur de chargement
              const loadingIndicators = document.querySelectorAll('.loading, .throbber, .LoadingWrapper, .profile_friends_loading');
              const isLoading = Array.from(loadingIndicators).some(el => el.offsetParent !== null);
              
              if (isLoading) {
                console.log('[Steam Scanner] Chargement en cours détecté, attente...');
              }
            
              // Attendre plus longtemps pour que le contenu se charge
              setTimeout(() => {
                const currentHeight = document.body.scrollHeight;
                const newFriendCount = Math.max(currentFriendCount, uniqueProfileLinks.size);
                scrollAttempts++;
              
                // Mettre à jour l'indicateur
                indicator.innerHTML = `🔄 Chargement de tous les amis...<br>🎯 ${newFriendCount} amis détectés<br>⏳ Tentative ${scrollAttempts}/${maxScrollAttempts}<br>${isLoading ? '⌛ Chargement en cours...' : ''}`;
                
                console.log(`[Steam Scanner] Tentative ${scrollAttempts} - ${newFriendCount} amis visibles (hauteur: ${currentHeight})`);
                
                // Vérifier si on n'a pas de changement
                if (currentHeight === lastHeight && newFriendCount === lastFriendCount && !isLoading) {
                  noChangeCount++;
                  console.log(`[Steam Scanner] Pas de changement détecté (${noChangeCount}/${maxNoChange})`);
                } else {
                  noChangeCount = 0; // Réinitialiser si on a un changement
                  lastHeight = currentHeight;
                  lastFriendCount = newFriendCount;
                }
                
                // Arrêter si : pas de changement plusieurs fois OU max attempts atteint
                if (noChangeCount >= maxNoChange || scrollAttempts >= maxScrollAttempts) {
                  clearInterval(scrollInterval);
                  
                  // Faire un dernier check après un délai
                  setTimeout(() => {
                    const finalCount = uniqueProfileLinks.size;
                    console.log(`[Steam Scanner] Scroll terminé - ${finalCount} amis uniques trouvés`);
                    
                    // Retirer l'indicateur
                    indicator.remove();
                    // Remonter en haut
                    window.scrollTo(0, 0);
                    resolve();
                  }, 2000);
                }
              }, 2500); // Augmenté à 2.5 secondes
            }, 3000); // Augmenté à 3 secondes entre chaque scroll
          });
      }
      
      // D'abord essayer de récupérer les amis sans scroll
      let initialFriendCount = document.querySelectorAll('a[href*="/profiles/"], a[href*="/id/"]').length;
      console.log(`[Steam Scanner] ${initialFriendCount} amis visibles avant scroll`);
      
      // Débugger: afficher quelques exemples de liens trouvés
      const exampleLinks = document.querySelectorAll('a[href*="/profiles/"], a[href*="/id/"]');
      if (exampleLinks.length > 0) {
        console.log('[Steam Scanner] Exemples de liens trouvés:');
        [...exampleLinks].slice(0, 3).forEach((link, i) => {
          console.log(`  ${i+1}. ${link.href || link.getAttribute('href')}`);
        });
      }
      
      // TOUJOURS faire défiler pour charger tous les amis
      console.log('[Steam Scanner] Chargement de tous les amis...');
      await scrollToBottom();
      
      // Attendre un peu que tout soit stabilisé
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Essayer de charger plus d'amis si possible
      console.log('[Steam Scanner] Vérification finale des amis...');
      
      // Cliquer sur tous les boutons "Voir plus" possibles
      const viewAllSelectors = ['.see_all_link', '.view_all_friends_link', '.view_all', '.see_all_friends'];
      viewAllSelectors.forEach(selector => {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach(button => {
          if (button && button.offsetParent !== null) {
            button.click();
            console.log(`[Steam Scanner] Bouton "Voir tous" cliqué: ${selector}`);
          }
        });
      });
      
      // Chercher aussi par texte
      document.querySelectorAll('a').forEach(link => {
        const text = link.textContent.toLowerCase();
        if ((text.includes('view all friends') || text.includes('voir tous les amis') || 
             text.includes('see all') || text.includes('voir tout')) && 
            link.offsetParent !== null) {
          link.click();
          console.log('[Steam Scanner] Lien "Voir tous les amis" cliqué');
        }
      });
      
      // Attendre encore un peu après avoir cliqué
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Debug : afficher tous les éléments trouvés
      console.log('[Steam Scanner] Recherche des liens d\'amis...');
      console.log('[Steam Scanner] Page actuelle:', window.location.href);
      
      // Maintenant récupérer tous les liens
      const links = [];
      const processedUrls = new Set();
      
      // Récupérer notre propre profil pour l'exclure
      let myProfileUrl = '';
      const myProfileLink = document.querySelector('#global_header .user_avatar')?.parentElement?.href;
      if (myProfileLink) {
        myProfileUrl = myProfileLink.split('?')[0].split('#')[0];
      }
      
      // Essayer plusieurs sélecteurs pour les amis - liste complète
      const friendSelectors = [
        // Sélecteurs standards
        '.selectable_overlay',
        '.friend_block_v2',
        '.friendBlockLinkOverlay',
        '.friend_block_link',
        '.friendBlock',
        '.friend_block_content',
        '.miniprofile_hover',
        '.friend_avatar a',
        'a[data-miniprofile]',
        'a[href*="/profiles/"]',
        'a[href*="/id/"]',
        '.friend_small_avatar_holder a',
        '.playerAvatar a',
        // Sélecteurs pour la nouvelle interface
        '.friend_relationship_request_block a',
        '[class*="friend"] a[href*="steamcommunity.com"]',
        // Sélecteurs additionnels
        '.friendListItemContainer a',
        '.profile_friends_list .friend_block a',
        '.profile_friends .friend_block a',
        '.friends_content .friend_block a',
        '.friendslist_entry a',
        '.friend_activity a',
        '.friendPlayerLevelNum',
        // Sélecteurs pour différentes vues Steam
        '.persona a',
        '.friend_info_block a',
        '.friend_block_holder a',
        '.compact_friend_block a',
        '.friend_block_avatar a',
        '.friend_status_block a',
        '.friend_small_text a',
        // Sélecteurs basés sur les attributs
        '[data-steamid]',
        '[data-accountid]',
        'a[data-search-page]',
        // Recherche plus large
        'div[onclick*="ShowProfileURL"] a',
        'div[onclick*="location.href"] a'
      ];
      
      // Méthode 1: Recherche par sélecteurs
      friendSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        console.log(`[Steam Scanner] Sélecteur "${selector}": ${elements.length} éléments trouvés`);
        
        elements.forEach(el => {
          let href = el.getAttribute('href') || el.href;
          
          // Si pas de href direct, chercher dans les parents ou enfants
          if (!href) {
            const parentLink = el.closest('a[href]');
            if (parentLink) href = parentLink.href;
          }
          
          if (!href) {
            const childLink = el.querySelector('a[href]');
            if (childLink) href = childLink.href;
          }
          
          // Nettoyer l'URL
          if (href) {
            // Enlever les paramètres et les ancres
            href = href.split('?')[0].split('#')[0];
            
            // Vérifier que c'est un profil d'ami valide
            if ((href.includes('/profiles/') || href.includes('/id/')) && 
                !processedUrls.has(href)) {
              
              // Vérifier que ce n'est pas notre propre profil
              if (myProfileUrl && (href.includes(myProfileUrl) || href === myProfileUrl)) {
                return;
              }
              
              // Vérifier que ce n'est pas une sous-page d'un profil
              const urlParts = href.split('/');
              const profileIndex = urlParts.findIndex(part => part === 'profiles' || part === 'id');
              
              // S'assurer qu'il n'y a rien après l'ID du profil (pas de /friends, /games, etc.)
              if (profileIndex >= 0 && urlParts.length > profileIndex + 2) {
                const afterProfile = urlParts[profileIndex + 2];
                if (afterProfile && afterProfile !== '') {
                  return; // C'est une sous-page, on l'ignore
                }
              }
              
              const fullUrl = href.startsWith('https://') ? href : `https://steamcommunity.com${href}`;
              processedUrls.add(href);
              links.push(fullUrl);
            }
          }
        });
      });
      
      // Méthode 2: Recherche générale de tous les liens
      if (links.length === 0) {
        console.log('[Steam Scanner] Aucun ami trouvé avec les sélecteurs spécifiques, recherche générale...');
        
        const allLinks = document.querySelectorAll('a[href]');
        console.log(`[Steam Scanner] ${allLinks.length} liens trouvés sur la page`);
        
        allLinks.forEach(link => {
          let href = link.href || link.getAttribute('href');
          if (href) {
            href = href.split('?')[0].split('#')[0];
            
            if ((href.includes('steamcommunity.com/profiles/') || href.includes('steamcommunity.com/id/')) && 
                !processedUrls.has(href)) {
              
              // Vérifier que ce n'est pas notre propre profil
              if (myProfileUrl && (href.includes(myProfileUrl) || href === myProfileUrl)) {
                return;
              }
              
              // Vérifier que ce n'est pas une sous-page
              const urlParts = href.split('/');
              const profileIndex = urlParts.findIndex(part => part === 'profiles' || part === 'id');
              if (profileIndex >= 0 && urlParts.length > profileIndex + 2) {
                const afterProfile = urlParts[profileIndex + 2];
                if (afterProfile && afterProfile !== '') {
                  return;
                }
              }
              
              const fullUrl = href.startsWith('https://') ? href : `https://steamcommunity.com${href}`;
              processedUrls.add(href);
              links.push(fullUrl);
              console.log(`[Steam Scanner] Ami trouvé: ${fullUrl}`);
            }
          }
        });
      }
      
      console.log(`[Steam Scanner] ${links.length} amis trouvés après recherche complète`);
      
      // Méthode 3: Si toujours rien, essayer une approche plus agressive
      if (links.length === 0) {
        console.log('[Steam Scanner] Dernière tentative - recherche agressive...');
        
        // Chercher tous les éléments qui pourraient contenir des profils
        const allElements = document.querySelectorAll('*');
        allElements.forEach(elem => {
          // Chercher dans le texte des attributs
          const attributes = ['href', 'data-href', 'data-link', 'data-profile'];
          attributes.forEach(attr => {
            const value = elem.getAttribute(attr);
            if (value && (value.includes('/profiles/') || value.includes('/id/'))) {
              const href = value.split('?')[0].split('#')[0];
              if (!processedUrls.has(href)) {
                const fullUrl = href.startsWith('https://') ? href : `https://steamcommunity.com${href}`;
                processedUrls.add(href);
                links.push(fullUrl);
                console.log(`[Steam Scanner] Ami trouvé (méthode agressive): ${fullUrl}`);
              }
            }
          });
        });
      }
      
      console.log(`[Steam Scanner] ${links.length} amis trouvés au total`);
      
      // Méthode 4: Recherche dans les éléments avec des données Steam
      if (links.length < 50) { // Si on a moins de 50 amis, chercher plus agressivement
        console.log('[Steam Scanner] Recherche approfondie des profils...');
        
        // Chercher tous les éléments avec des IDs Steam
        document.querySelectorAll('[data-steamid], [data-accountid], [data-miniprofile]').forEach(elem => {
          const steamId = elem.getAttribute('data-steamid') || elem.getAttribute('data-accountid') || elem.getAttribute('data-miniprofile');
          if (steamId) {
            // Chercher un lien associé
            const link = elem.querySelector('a') || elem.closest('a') || elem.parentElement?.querySelector('a');
            if (link && link.href) {
              const href = link.href.split('?')[0].split('#')[0];
              if ((href.includes('/profiles/') || href.includes('/id/')) && !processedUrls.has(href)) {
                const fullUrl = href.startsWith('https://') ? href : `https://steamcommunity.com${href}`;
                processedUrls.add(href);
                links.push(fullUrl);
                console.log(`[Steam Scanner] Ami trouvé via data-steamid: ${fullUrl}`);
              }
            } else if (steamId.match(/^\d+$/)) {
              // Si on a juste un ID numérique, construire l'URL
              const profileUrl = `https://steamcommunity.com/profiles/${steamId}`;
              if (!processedUrls.has(profileUrl)) {
                processedUrls.add(profileUrl);
                links.push(profileUrl);
                console.log(`[Steam Scanner] Profil construit depuis steamid: ${profileUrl}`);
              }
            }
          }
        });
      }
      
      // Retirer les doublons et filtrer les URLs invalides
      const uniqueLinks = [...new Set(links)].filter(url => {
        // Vérifier que l'URL est valide
        return url && 
               url.includes('steamcommunity.com') && 
               (url.includes('/profiles/') || url.includes('/id/')) &&
               !url.includes('/inventory') &&
               !url.includes('/games') &&
               !url.includes('/screenshots') &&
               !url.includes('/videos') &&
               !url.includes('/workshop') &&
               !url.includes('/market') &&
               !url.includes('/edit');
      });
      
      console.log(`[Steam Scanner] ${uniqueLinks.length} amis uniques après dédoublonnage et filtrage`);
      
      // Afficher le nombre d'amis sur la page selon Steam
      const friendCountSelectors = [
        '.profile_friend_count',
        '.friendBlockCount', 
        '.friend_count',
        '.profile_count_link_total',
        '.profile_header_summary a[href*="/friends"]',
        '.profile_item_links a[href*="/friends"]',
        '.profile_in_game_header',
        '.friendPlayerLevelNum',
        '.friends_nav_selected_count',
        '.friendslist_count',
        '#friends_list_count'
      ];
      
      let expectedCount = 0;
      for (const selector of friendCountSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const elem of elements) {
          const match = elem.textContent.match(/(\d+)/);
          if (match) {
            const count = parseInt(match[1]);
            if (count > expectedCount) {
              expectedCount = count;
              console.log(`[Steam Scanner] Nombre d'amis trouvé dans ${selector}: ${count}`);
            }
          }
        }
      }
      
      if (expectedCount > 0) {
        console.log(`[Steam Scanner] Steam indique ${expectedCount} amis sur le profil`);
        if (uniqueLinks.length < expectedCount * 0.8) { // Si on a moins de 80% des amis attendus
          console.warn(`[Steam Scanner] ⚠️ Seulement ${uniqueLinks.length}/${expectedCount} amis trouvés !`);
        } else if (uniqueLinks.length >= expectedCount) {
          console.log(`[Steam Scanner] ✅ Tous les amis semblent avoir été trouvés !`);
        }
      }
      
      // Limiter à un nombre raisonnable d'amis si nécessaire
      const MAX_FRIENDS = 1000; // Augmenté à 1000
      if (uniqueLinks.length > MAX_FRIENDS) {
        console.log(`[Steam Scanner] Limitation à ${MAX_FRIENDS} amis sur ${uniqueLinks.length} pour éviter un scan trop long`);
        return uniqueLinks.slice(0, MAX_FRIENDS);
      }
      
      return uniqueLinks;
    }
  }, (results) => {
    if (chrome.runtime.lastError) {
      logMessage("❌ Erreur lors de la récupération des amis: " + chrome.runtime.lastError.message);
      return;
    }
    
    if (results?.[0]?.result) {
      // Si c'est le premier cycle, sauvegarder la liste originale
      if (loopCycles === 0) {
        originalFriendLinks = results[0].result;
        friendLinks = [...originalFriendLinks];
      } else if (isLoopMode) {
        // En mode boucle, sélectionner un ami au hasard
        let randomFriend;
        let attempts = 0;
        do {
          const randomIndex = Math.floor(Math.random() * originalFriendLinks.length);
          randomFriend = originalFriendLinks[randomIndex];
          attempts++;
        } while (randomFriend === lastScannedFriend && attempts < 10 && originalFriendLinks.length > 1);
        
        lastScannedFriend = randomFriend;
        friendLinks = [randomFriend];
        logMessage(`🎲 Ami sélectionné au hasard: ${randomFriend.split('/').pop()}`);
      } else {
        friendLinks = results[0].result;
      }
      
      currentIndex = 0;
      
      // Ne pas réinitialiser allProfiles en mode boucle pour garder l'historique
      if (!isLoopMode || loopCycles === 0) {
        allProfiles = [];
      }
      
      if (friendLinks.length > 0) {
        if (loopCycles === 0) {
          logMessage(`✅ ${originalFriendLinks.length} amis trouvés ! Démarrage du scan...`);
          const totalTimeSeconds = originalFriendLinks.length * (delay/1000 + 3); // Délai + 3s pour charger inventaire
          logMessage(`📊 Temps estimé: environ ${Math.ceil(totalTimeSeconds / 60)} minutes`);
          
          // Informer si on a limité le nombre d'amis
          if (originalFriendLinks.length === 1000) {
            logMessage(`⚠️ Scan limité aux 1000 premiers amis pour éviter un temps de scan trop long.`);
          }
        }
        
        chrome.runtime.sendMessage({ 
          action: "progress", 
          current: 0, 
          total: friendLinks.length 
        });
        // Petit délai avant de commencer le scan
        setTimeout(() => {
          processNextFriend(tabId, delay);
        }, 2000);
      } else {
        logMessage("❌ Aucun profil trouvé.");
        logMessage("💡 Solutions possibles:");
        logMessage("   1. Vérifiez que vous êtes sur votre liste d'amis Steam");
        logMessage("   2. URL correcte: steamcommunity.com/id/VOTRE_ID/friends/");
        logMessage("   3. Si vous avez une interface Steam différente, essayez:");
        logMessage("      - La vue classique: steamcommunity.com/id/VOTRE_ID/friends?l=french");
        logMessage("      - Ou en anglais: steamcommunity.com/id/VOTRE_ID/friends?l=english");
        logMessage("   4. Rechargez la page (F5) et réessayez");
        logMessage("   5. Vérifiez que votre liste d'amis est publique");
      }
    } else {
      logMessage("❌ Impossible de récupérer la liste d'amis.");
      logMessage("💡 Vérifiez que vous êtes bien sur Steam et que la page est complètement chargée.");
    }
  });
}

function stopProcess() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  friendLinks = [];
  currentIndex = 0;
  chrome.runtime.sendMessage({ 
    action: "progress", 
    current: 0, 
    total: 0 
  });
  
  // Fermer l'onglet en arrière-plan s'il existe
  if (isBackgroundTab && backgroundTabId) {
    chrome.tabs.remove(backgroundTabId, () => {
      console.log('[Background] Onglet en arrière-plan fermé');
      logMessage("🌐 Onglet en arrière-plan fermé");
    });
    isBackgroundTab = false;
    backgroundTabId = null;
  }
  
  // Réinitialiser les stats globales
  globalStats = {
    totalScans: 0,
    totalCasesFound: 0,
    totalCasesValue: 0,
    profilesWithCases: 0
  };
}

function processNextFriend(tabId, delay) {
  // Timeout global pour éviter les blocages
  if (typeof processNextFriend.globalTimeout !== 'undefined' && processNextFriend.globalTimeout) {
    clearTimeout(processNextFriend.globalTimeout);
  }
  processNextFriend.globalTimeout = setTimeout(() => {
    logMessage('[Automation] Timeout global atteint, skip du profil.');
    chrome.runtime.sendMessage({ action: 'skip' });
  }, 10000); // 10 secondes max par profil

  if (currentIndex >= friendLinks.length || !tabId) {
    // Si on est en mode boucle et qu'on vient de scanner un ami aléatoire
    if (isLoopMode && loopCycles > 0) {
      const profile = allProfiles[allProfiles.length - 1]; // Le dernier profil scanné
      if (profile) {
        globalStats.totalScans++;
        if (profile.cases > 0) {
          globalStats.totalCasesFound += profile.cases;
          globalStats.totalCasesValue += profile.casesValue;
          globalStats.profilesWithCases++;
          logMessage(`✅ Scan de ${profile.url.split('/').pop()} terminé: ${profile.cases} caisses (${profile.casesValue.toFixed(2)}€)`);
        } else {
          logMessage(`❌ Scan de ${profile.url.split('/').pop()} terminé: Aucune caisse trouvée`);
        }
        
        // Afficher les statistiques globales
        logMessage(`📊 Stats globales: ${globalStats.totalScans} scans, ${globalStats.totalCasesFound} caisses (${globalStats.totalCasesValue.toFixed(2)}€) chez ${globalStats.profilesWithCases} amis`);
      }
    }
    
    // Si c'est la fin du premier cycle ou pas en mode boucle
    if (loopCycles === 0 || !isLoopMode) {
      // Calcul du nombre total de caisses et de leur valeur
      let totalCases = 0;
      let totalCasesValue = 0;
      let totalAllInventoryValue = 0;
      let profilesWithCases = 0;
      let totalProfiles = allProfiles.length;
      
      allProfiles.forEach(profile => {
        // Compter tous les inventaires
        totalAllInventoryValue += profile.value || 0;
        
        // Compter spécifiquement ceux avec des caisses
        if (profile.cases > 0) {
          profilesWithCases++;
          totalCases += profile.cases || 0;
          totalCasesValue += profile.casesValue || 0;
        }
      });
      
      if (totalCases > 0) {
        logMessage(`✅ Scan terminé ! ${totalCases} caisses (${totalCasesValue.toFixed(2)}€) chez ${profilesWithCases} amis`);
      } else {
        logMessage(`❌ Scan terminé - Aucune caisse CS2 trouvée`);
      }
      
      if (totalProfiles > 0) {
        logMessage(`💰 Valeur totale de ${totalProfiles} inventaires scannés: ${totalAllInventoryValue.toFixed(2)}€`);
      }
    }
    
    chrome.runtime.sendMessage({ 
      action: "progress", 
      current: friendLinks.length, 
      total: friendLinks.length 
    });
    
    // Si mode boucle activé, relancer avec un ami au hasard
    if (isLoopMode) {
      chrome.storage.local.get('loopMode', (data) => {
        if (data.loopMode) {
          loopCycles++;
          logMessage(`🔄 Relancement automatique du scan (Cycle #${loopCycles + 1})...`);
          
          // Envoyer un message pour garder le bouton sur "ARRÊTER"
          chrome.runtime.sendMessage({ 
            action: "keep_scanning",
            loopCycles: loopCycles
          });
          
          // Attendre un peu avant de relancer
          setTimeout(() => {
            // Utiliser la liste originale pour sélectionner un nouvel ami
            if (originalFriendLinks.length > 0) {
              let randomFriend;
              let attempts = 0;
              do {
                const randomIndex = Math.floor(Math.random() * originalFriendLinks.length);
                randomFriend = originalFriendLinks[randomIndex];
                attempts++;
              } while (randomFriend === lastScannedFriend && attempts < 10 && originalFriendLinks.length > 1);
              
              lastScannedFriend = randomFriend;
              friendLinks = [randomFriend];
              currentIndex = 0;
              
              logMessage(`🎲 Nouvel ami sélectionné: ${randomFriend.split('/').pop()}`);
              processNextFriend(tabId, delay);
            }
          }, 5000); // Attendre 5 secondes avant de relancer
        } else {
          logMessage("⏹️ Mode boucle désactivé - Arrêt du scan");
          stopProcess();
        }
      });
    } else {
      // Si c'est un onglet en arrière-plan et que le scan est terminé, fermer l'onglet après un petit délai
      if (isBackgroundTab && backgroundTabId) {
        logMessage("🌐 Scan terminé - Fermeture de l'onglet en arrière-plan dans 5 secondes...");
        setTimeout(() => {
          stopProcess();
        }, 5000); // Attendre 5 secondes avant de fermer pour permettre à l'utilisateur de voir le résultat
      } else {
        stopProcess();
      }
    }
    if (typeof processNextFriend.globalTimeout !== 'undefined' && processNextFriend.globalTimeout) {
      clearTimeout(processNextFriend.globalTimeout);
      processNextFriend.globalTimeout = null;
    }
    return;
  }
  
  const baseUrl = friendLinks[currentIndex].split('/inventory')[0];
  const profileUrl = baseUrl; // D'abord charger la page de profil
  
  // Ne pas logger chaque profil scanné pour éviter le spam
  // logMessage(`Scan du profil ${currentIndex + 1}/${friendLinks.length}: ${baseUrl}`);
  
  // D'abord charger la page de profil pour récupérer les heures CS2
  chrome.tabs.update(tabId, { url: profileUrl }, () => {
    // Attendre que la page de profil soit chargée
    timer = setTimeout(() => {
      // Étape 1: Récupérer les heures CS2 depuis la page de profil
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Fonction pour extraire les heures CS2 et le pseudo depuis la page de profil
          let cs2Hours = 0;
          let personaName = null;
          
          console.log('[Steam Scanner] Page actuelle:', window.location.href);
          console.log('[Steam Scanner] Recherche des heures CS2 et du pseudo...');
          
          // Récupérer le pseudo du profil
          const personaSelectors = [
            '.actual_persona_name',
            '.persona_name',
            '.profile_header_name',
            '.playerNickname',
            'h1.header_real_name',
            '.profile_header .persona',
            '.profile_header_centered_persona .actual_persona_name',
            '.profile_header_summary .actual_persona_name',
            '.profile_header_summary .persona_name_text_content',
            '[data-miniprofile] .player_nickname',
            '.profile_header_bg_texture .persona_name'
          ];
          
          personaSelectors.forEach(selector => {
            if (!personaName) {
              const elem = document.querySelector(selector);
              if (elem && elem.textContent.trim()) {
                personaName = elem.textContent.trim();
                console.log(`[Steam Scanner] Pseudo trouvé: "${personaName}" via ${selector}`);
              }
            }
          });
          
          // Si toujours pas trouvé, chercher plus largement
          if (!personaName) {
            const headerElem = document.querySelector('.profile_header, .profile_header_bg, .profile_header_content');
            if (headerElem) {
              const h1Elements = headerElem.querySelectorAll('h1, .persona_name');
              h1Elements.forEach(elem => {
                if (!personaName && elem.textContent.trim() && elem.textContent.trim().length < 100) {
                  personaName = elem.textContent.trim();
                  console.log(`[Steam Scanner] Pseudo trouvé dans header: "${personaName}"`);
                }
              });
            }
          }
          
          if (!personaName) {
            console.log('[Steam Scanner] ⚠️ Pseudo non trouvé sur la page de profil');
          }
          
          // Méthode 1: Chercher dans "Recent Activity"
          const recentActivitySelectors = [
            '.recent_game_content',
            '.game_info_cap',
            '.recent_game',
            '.profile_recentgame',
            '.game_info'
          ];
          
          recentActivitySelectors.forEach(selector => {
            if (cs2Hours > 0) return; // Si déjà trouvé, pas besoin de continuer
            
            const items = document.querySelectorAll(selector);
            items.forEach(item => {
              const text = item.textContent;
              if ((text.includes('Counter-Strike 2') || text.includes('CS:GO') || text.includes('Counter-Strike: Global Offensive'))) {
                // Patterns pour les heures en plusieurs langues
                const patterns = [
                  /([0-9\s\u00A0.,]+)\s*(?:hrs?|hours?)\s*(?:on\s*record|played)/i,
                  /([0-9\s\u00A0.,]+)\s*(?:heures?)\s*(?:en\s*jeu|jouées?)/i,
                  /([0-9\s\u00A0.,]+)\s*(?:h)\s*(?:on\s*record|played|en\s*jeu)/i
                ];
                
                for (let pattern of patterns) {
                  const match = text.match(pattern);
                  if (match) {
                    cs2Hours = parseFloat(match[1].replace(/\s|\u00A0/g, '').replace(/\./g, '').replace(/,/g, ''));
                    console.log(`[Steam Scanner] Heures CS2 trouvées: ${cs2Hours}h dans ${selector}`);
                    break;
                  }
                }
              }
            });
          });
          
          // Méthode 2: Chercher dans les badges et achievements
          if (cs2Hours === 0) {
            // Chercher dans les badges CS2
            const badgeSelectors = [
              '.badge_info',
              '.badge_row',
              '.badge_detail_tasks',
              '.badge_progress_tasks',
              '.achievement_showcase'
            ];
            
            badgeSelectors.forEach(selector => {
              if (cs2Hours > 0) return;
              
              const badges = document.querySelectorAll(selector);
              badges.forEach(badge => {
                const text = badge.textContent;
                if (text.includes('Counter-Strike') || text.includes('CS:GO') || text.includes('CS2')) {
                  const hoursMatch = text.match(/([0-9\s\u00A0.,]+)\s*(?:hours?|hrs?|heures?)/i);
                  if (hoursMatch) {
                    cs2Hours = parseFloat(hoursMatch[1].replace(/\s|\u00A0/g, '').replace(/\./g, '').replace(/,/g, ''));
                    console.log(`[Steam Scanner] Heures CS2 trouvées dans les badges: ${cs2Hours}h`);
                  }
                }
              });
            });
          }
          
          // Méthode 2b: Chercher dans la liste complète des jeux
          if (cs2Hours === 0) {
            // Chercher directement dans la page si visible
            const gameRows = document.querySelectorAll('.game_info, .gameListRow, .games_list_row, .gameLogo');
            gameRows.forEach(row => {
              const parent = row.parentElement || row;
              const text = parent.textContent;
              
              if ((text.includes('Counter-Strike 2') || text.includes('Counter-Strike: Global Offensive') || text.includes('CS:GO'))) {
                const hoursMatch = text.match(/([0-9\s\u00A0.,]+)\s*(?:hrs?|hours?|heures?|h)\s*(?:on\s*record|played|en\s*jeu)?/i);
                if (hoursMatch) {
                  const hours = parseFloat(hoursMatch[1].replace(/\s|\u00A0/g, '').replace(/\./g, '').replace(/,/g, ''));
                  if (hours > 10 && hours < 50000) { // Au moins 10h pour éviter les faux positifs
                    cs2Hours = hours;
                    console.log(`[Steam Scanner] Heures CS2 trouvées dans la liste des jeux: ${cs2Hours}h`);
                  }
                }
              }
            });
          }
          
          // Méthode 3: Chercher dans les showcases et favorite game
          if (cs2Hours === 0) {
            // Chercher dans le "Favorite Game" showcase
            const favoriteGameSelectors = [
              '.favoritegame_showcase',
              '.showcase_content_bg',
              '.showcase_stat',
              '.value',
              '.showcase_slot',
              '.game_capsule',
              '.showcase_item_detail',
              '.favorite_game_cap'
            ];
            
            favoriteGameSelectors.forEach(selector => {
              if (cs2Hours > 0) return;
              
              const elements = document.querySelectorAll(selector);
              elements.forEach(elem => {
                const parent = elem.closest('.showcase_content_bg, .favoritegame_showcase');
                if (parent && parent.textContent.includes('Counter-Strike')) {
                  // Chercher spécifiquement la valeur des heures
                  const valueElems = parent.querySelectorAll('.value, .showcase_stat_value');
                  valueElems.forEach(valueElem => {
                    const valueText = valueElem.textContent.trim();
                    const hoursMatch = valueText.match(/^([0-9\s\u00A0.,]+)\s*$/);
                    if (hoursMatch) {
                      const hours = parseFloat(hoursMatch[1].replace(/\s|\u00A0/g, '').replace(/\./g, '').replace(/,/g, ''));
                      if (hours > 100 && hours < 50000) { // Filtrer les valeurs probables d'heures
                        cs2Hours = hours;
                        console.log(`[Steam Scanner] Heures CS2 trouvées dans Favorite Game: ${cs2Hours}h`);
                      }
                    }
                  });
                }
              });
            });
          }
          
          // Méthode 4: Chercher partout sur la page
          if (cs2Hours === 0) {
            const allElements = document.querySelectorAll('*');
            allElements.forEach(elem => {
              if (elem.childElementCount <= 2) { // Éléments avec peu d'enfants
                const text = elem.textContent;
                if ((text.includes('Counter-Strike 2') || text.includes('Counter-Strike: Global Offensive') || text.includes('CS:GO')) &&
                    (text.includes('record') || text.includes('played') || text.includes('jeu'))) {
                  const hoursMatch = text.match(/([0-9\s\u00A0.,]+)\s*(?:hrs?|hours?|heures?|h)\s*(?:on\s*record|en\s*jeu|played)?/i);
                  if (hoursMatch) {
                    const hours = parseFloat(hoursMatch[1].replace(/\s|\u00A0/g, '').replace(/\./g, '').replace(/,/g, ''));
                    if (hours > cs2Hours && hours < 50000) { // Limite raisonnable
                      cs2Hours = hours;
                      console.log(`[Steam Scanner] Heures CS2 trouvées: ${cs2Hours}h`);
                    }
                  }
                }
              }
            });
          }
          
          // Vérifier si le profil est privé
          const privateProfile = document.querySelector('.profile_private_info, .private_profile');
          if (privateProfile) {
            console.log('[Steam Scanner] ⚠️ Profil privé détecté - les heures peuvent ne pas être visibles');
          }
          
          if (cs2Hours === 0) {
            console.log('[Steam Scanner] ⚠️ Aucune heure CS2 trouvée sur la page de profil');
            // Debug: afficher quelques éléments de jeu trouvés
            const gameElements = document.querySelectorAll('.game_name, .gameListRowItemName');
            console.log(`[Steam Scanner] ${gameElements.length} jeux trouvés sur la page`);
            gameElements.forEach((elem, idx) => {
              if (idx < 5) console.log(`[Steam Scanner] Jeu ${idx + 1}: ${elem.textContent.trim()}`);
            });
          }
          
          return { cs2Hours, personaName };
        }
      }, (results) => {
        const profileData = results[0]?.result || { cs2Hours: 0, personaName: null };
        const cs2Hours = profileData.cs2Hours;
        const personaName = profileData.personaName;
        console.log(`[Steam Scanner] Heures CS2 récupérées: ${cs2Hours}`);
        console.log(`[Steam Scanner] Pseudo récupéré: ${personaName}`);
        
        // Étape 2: Maintenant naviguer vers l'inventaire
        const inventoryUrl = `${baseUrl}/inventory/#730`;
        chrome.tabs.update(tabId, { url: inventoryUrl }, () => {
          setTimeout(() => {
            // Injecter le script pour récupérer les données d'inventaire
            chrome.scripting.executeScript({
              target: { tabId },
              files: ['inject-steam-data.js'],
              world: 'MAIN'
            }, () => {
              chrome.scripting.executeScript({
                target: { tabId },
                func: (savedCs2Hours, savedPersonaName) => {
                  return new Promise((resolve) => {
                    let responseReceived = false;
                    let timeoutId;
                    
                    // Écouter la réponse du script injecté
                    const messageHandler = (event) => {
                      if (event.source !== window) return;
                      
                      if (event.data && event.data.type === 'STEAM_SCANNER_RESPONSE') {
                        responseReceived = true;
                        window.removeEventListener('message', messageHandler);
                        clearTimeout(timeoutId);
                        // Ajouter les heures CS2 et le pseudo sauvegardés aux données
                        const dataWithHours = {
                          ...event.data.data,
                          cs2Hours: savedCs2Hours,
                          personaName: savedPersonaName
                        };
                        resolve(dataWithHours);
                      }
                    };
                    
                    window.addEventListener('message', messageHandler);
                    
                    // Timeout après 25 secondes
                    timeoutId = setTimeout(() => {
                      if (!responseReceived) {
                        window.removeEventListener('message', messageHandler);
                        resolve({ found: false, error: 'Timeout', cs2Hours: savedCs2Hours, personaName: savedPersonaName });
                      }
                    }, 25000);
                    
                    // Envoyer la requête au script injecté
                    setTimeout(() => {
                      window.postMessage({ type: 'STEAM_SCANNER_REQUEST' }, '*');
                    }, 3000);
                  });
                },
                args: [cs2Hours, personaName] // Passer les heures CS2 et le pseudo comme arguments
              }, (results) => {
                const data = results[0]?.result || { found: false };
                
                // Traiter les données reçues
                let profile = {
                  url: baseUrl,
                  steamID: data.steamID || 'inconnu',
                  personaName: data.personaName || null,  // Ajouter le pseudo
                  value: 0,
                  cases: 0,
                  casesValue: 0,
                  casesDetails: [],
                  expectedCases: 0,
                  cs2Hours: 0,  // Ajouter les heures CS2
                  isPrivate: false  // Ajouter le statut privé
                };
                
                // Vérifier si l'inventaire est privé
                if (data.isPrivate) {
                  profile.isPrivate = true;
                  console.log(`[Steam Scanner] Inventaire privé pour ${baseUrl}`);
                } else if (data.found && data.inventory) {
                  profile.value = data.inventory.total_value || 0;
                  profile.casesDetails = data.inventory.cases || [];
                  profile.expectedCases = data.inventory.expected_containers || 0;
                  // Calculer la valeur totale des caisses
                  profile.casesValue = profile.casesDetails.reduce((sum, c) => sum + (c.totalValue || 0), 0);
                  // Correction : calculer le vrai nombre de caisses (max entre cases, expectedCases, somme des quantités)
                  let n1 = data.inventory.total_cases || 0;
                  let n2 = profile.expectedCases || 0;
                  let n3 = Array.isArray(profile.casesDetails) ? profile.casesDetails.reduce((sum, c) => sum + (c.amount || c.count || 0), 0) : 0;
                  profile.cases = Math.max(n1, n2, n3);
                }
                
                // Les heures CS2 viennent maintenant directement de data
                profile.cs2Hours = data.cs2Hours || 0;
                
                allProfiles.push(profile);
                chrome.storage.local.set({ allProfiles });
                
                // Notifier que les profils ont été mis à jour
                chrome.runtime.sendMessage({
                  action: "profile_updated"
                });
                
                // Mettre à jour la progression
                chrome.runtime.sendMessage({ 
                  action: "progress", 
                  current: currentIndex + 1, 
                  total: friendLinks.length 
                });
                
                // Log des résultats avec heures CS2
                const displayName = profile.personaName || baseUrl.split('/').pop();
                
                if (profile.isPrivate) {
                  // Logger les inventaires privés
                  let message = `🔒 ${displayName} → Inventaire privé`;
                  if (profile.cs2Hours > 0) {
                    message += ` | ${profile.cs2Hours.toFixed(0)}h CS2`;
                  }
                  logMessage(message);
                } else if (data.found) {
                  // Ne logger que si des caisses sont trouvées
                  if (profile.cases > 0) {
                    let message = `✅ ${displayName} → ${profile.cases} caisses`;
                    if (profile.cs2Hours > 0) {
                      message += ` | ${profile.cs2Hours.toFixed(0)}h CS2`;
                    }
                    if (profile.expectedCases > 0 && profile.expectedCases !== profile.cases) {
                      message += ` (attendu: ${profile.expectedCases})`;
                    }
                    message += ` | ${profile.casesValue.toFixed(2)}€`;
                    logMessage(message);
                  } else {
                    // Ne pas logger les profils sans caisses
                  }
                } else {
                  // Ne pas logger les inventaires non chargés pour éviter le spam
                }
                
                // Passer au profil suivant
                currentIndex++;
                processNextFriend(tabId, delay);
              });
            });
          }, 2000); // Réduit de 3000 à 2000
        });
      });
    }, 2000); // Réduit de 3000 à 2000
  });
}

function logMessage(message) {
  chrome.runtime.sendMessage({ 
    action: "log", 
    text: message,
    timestamp: new Date().toLocaleTimeString()
  });
}