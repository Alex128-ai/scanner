// Ce script s'exécute dans le contexte de la page Steam (MAIN world)
// Il peut accéder aux variables globales de Steam

(function() {
  'use strict';
  
  console.log('[Steam Scanner] Script d\'injection chargé');
  
  // Fonction pour simuler un clic réel
  function simulateRealClick(element) {
    if (!element) return false;
    
    console.log('[Automation] Clic automatique sur:', element.outerHTML ? element.outerHTML.substring(0, 100) : element);
    
    // Faire défiler l'élément dans la vue si nécessaire
    element.scrollIntoView({ behavior: 'instant', block: 'center' });
    
    // Créer et dispatcher plusieurs événements pour un clic complet
    const mousedownEvent = new MouseEvent('mousedown', {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1
    });
    
    const mouseupEvent = new MouseEvent('mouseup', {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 0
    });
    
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    
    element.dispatchEvent(mousedownEvent);
    element.dispatchEvent(mouseupEvent);
    element.dispatchEvent(clickEvent);
    
    // Forcer le clic avec la méthode native si disponible
    if (element.click) {
      element.click();
    }
    
    return true;
  }
  
  // Fonction pour cliquer sur les filtres
  function applyFilters(callback) {
    console.log('[Steam Scanner] Début de l\'application des filtres...');
    
    // Étape 1: Cliquer sur "Filtrage avancé"
    setTimeout(() => {
      console.log('[Steam Scanner] Recherche du bouton "Filtrage avancé"...');
      
      let filterButton = null;
      
      // Méthode 1: Recherche par texte exact
      const allElements = document.querySelectorAll('span, div, a, button');
      for (let elem of allElements) {
        const text = elem.textContent.trim();
        if (text === 'Filtrage avancé' || 
            text === 'Advanced filtering' ||
            text === 'Show advanced filters' || 
            text === 'Afficher les filtres avancés') {
          filterButton = elem;
          console.log('[Steam Scanner] Bouton trouvé par texte:', text);
          break;
        }
      }
      
      // Méthode 2: Recherche par contenu partiel
      if (!filterButton) {
        for (let elem of allElements) {
          const text = elem.textContent.toLowerCase().trim();
          // Vérifier que c'est bien le bouton et pas un autre élément
          if ((text.includes('filtrage') && text.includes('avancé')) ||
              (text.includes('advanced') && text.includes('filter'))) {
            // Vérifier que ce n'est pas un élément trop grand (qui contiendrait tout le formulaire)
            if (elem.children.length < 3 && text.length < 50) {
              filterButton = elem;
              console.log('[Steam Scanner] Bouton trouvé par texte partiel:', elem.textContent.trim());
              break;
            }
          }
        }
      }
      
      // Méthode 3: Recherche dans la zone de l'inventaire
      if (!filterButton) {
        const inventoryAreas = document.querySelectorAll('.inventory_filters, .filter_section, #inventories');
        for (let area of inventoryAreas) {
          const links = area.querySelectorAll('a, span, div');
          for (let link of links) {
            const text = link.textContent.trim();
            if (text === 'Filtrage avancé' || text.includes('filtrage avancé')) {
              filterButton = link;
              console.log('[Steam Scanner] Bouton trouvé dans zone inventaire');
              break;
            }
          }
          if (filterButton) break;
        }
      }
      
      if (filterButton) {
        console.log('[Steam Scanner] Clic sur "Filtrage avancé"');
        simulateRealClick(filterButton);
        
        // Étape 2: Attendre puis cliquer sur "Montrer plus" si présent
        setTimeout(() => {
          console.log('[Steam Scanner] Recherche du bouton "Montrer plus"...');
          
          // Chercher et cliquer sur "Montrer plus" / "Show more"
          const showMoreSelectors = [
            'span:contains("Montrer plus")',
            'span:contains("Show more")',
            'div:contains("Montrer plus")',
            'div:contains("Show more")',
            '.filter_tag_show_more',
            '.show_more_tags',
            '[onclick*="ShowMore"]',
            '[onclick*="ExpandFilters"]'
          ];
          
          let showMoreButton = null;
          
          // Méthode 1: Recherche par texte
          const allSpans = document.querySelectorAll('span, div, a, button');
          for (let elem of allSpans) {
            const text = elem.textContent.trim();
            const lowerText = text.toLowerCase();
            
            // Vérifier différents patterns de "Montrer plus"
            if ((text === 'Montrer plus' || text === 'Show more' || 
                 text === '+ Montrer plus' || text === '+ Show more' ||
                 text.includes('Montrer plus') || text.includes('Show more') ||
                 lowerText.includes('montrer plus') || lowerText.includes('show more') ||
                 (text.includes('Push') && text.includes('(') && text.includes('+')) ||
                 text.includes('▼') || text.includes('▾') || text.includes('⌄')) &&
                elem.children.length < 3) {
              
              // Vérifier que ce n'est pas un élément trop grand
              if (elem.offsetWidth < 300 && elem.offsetHeight < 100) {
                showMoreButton = elem;
                console.log('[Steam Scanner] Bouton "Montrer plus" trouvé:', text);
                break;
              }
            }
          }
          
          // Méthode 2: Recherche par classe et attributs
          if (!showMoreButton) {
            // Chercher par classes CSS
            const classSelectors = [
              '.filter_tag_show_more',
              '.show_more_tags',
              '.econ_tag_filter_category_show_more',
              '.filter_control_show',
              '.filter_more_button'
            ];
            
            for (let selector of classSelectors) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                showMoreButton = elements[0];
                console.log('[Steam Scanner] Bouton "Montrer plus" trouvé par classe:', selector);
                break;
              }
            }
          }
          
          // Méthode 3: Recherche dans la zone des filtres
          if (!showMoreButton) {
            const filterAreas = document.querySelectorAll('.econ_tag_filter_category, .filter_ctn, .filter_options');
            for (let area of filterAreas) {
              const buttons = area.querySelectorAll('span, div, a');
              for (let button of buttons) {
                const text = button.textContent;
                if (text && (text.includes('plus') || text.includes('more') || text.includes('Plus') || text.includes('More'))) {
                  showMoreButton = button;
                  console.log('[Steam Scanner] Bouton trouvé dans zone de filtre:', text);
                  break;
                }
              }
              if (showMoreButton) break;
            }
          }
          
          // Si trouvé, cliquer dessus
          if (showMoreButton) {
            console.log('[Steam Scanner] Clic sur "Montrer plus"');
            simulateRealClick(showMoreButton);
            
            // Attendre un peu après le clic
            setTimeout(() => {
              searchForContainerCheckbox(1);
            }, 1500);
          } else {
            console.log('[Steam Scanner] Pas de bouton "Montrer plus" trouvé, recherche directe de la checkbox');
            
            // Debug: afficher les éléments qui pourraient être le bouton
            console.log('[Steam Scanner] Éléments contenant "plus" ou "more":');
            document.querySelectorAll('span, div, a, button').forEach(elem => {
              const text = elem.textContent.trim();
              if (text && (text.toLowerCase().includes('plus') || text.toLowerCase().includes('more')) && 
                  text.length < 100 && elem.offsetParent !== null) {
                console.log(`[Steam Scanner] - "${text}" (${elem.tagName}, visible: ${elem.offsetWidth}x${elem.offsetHeight})`);
              }
            });
            
            searchForContainerCheckbox(1);
          }
          
          function searchForContainerCheckbox(attempt = 1) {
            console.log(`[Automation] Tentative ${attempt} de recherche de la checkbox Conteneur...`);
            let containerCheckbox = null;
            
            // Chercher toutes les checkboxes
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            console.log(`[Steam Scanner] ${checkboxes.length} checkboxes trouvées`);
            
            for (let checkbox of checkboxes) {
              // Chercher le texte associé
              let labelText = '';
              
              // Vérifier le label parent
              const parentLabel = checkbox.closest('label');
              if (parentLabel) {
                labelText = parentLabel.textContent.trim();
              }
              
              // Vérifier le span suivant
              if (!labelText) {
                const nextSpan = checkbox.nextElementSibling;
                if (nextSpan && nextSpan.tagName === 'SPAN') {
                  labelText = nextSpan.textContent.trim();
                }
              }
              
              // Vérifier le texte du parent
              if (!labelText && checkbox.parentElement) {
                labelText = checkbox.parentElement.textContent.trim();
              }
              
              // Log pour debug
              if (labelText) {
                console.log(`[Steam Scanner] Checkbox avec texte: "${labelText}"`);
              }
              
              // Vérifier si c'est Conteneur
              const lowerText = labelText.toLowerCase();
              if (lowerText.includes('conteneur') || lowerText.includes('container')) {
                containerCheckbox = checkbox;
                console.log(`[Steam Scanner] Checkbox Conteneur trouvée ! Texte: "${labelText}"`);
                
                // Extraire le nombre entre parenthèses
                const match = labelText.match(/\((\d+)\)/);
                if (match) {
                  const containerCount = parseInt(match[1]);
                  console.log(`[Steam Scanner] Nombre de conteneurs détecté: ${containerCount}`);
                  
                  // Stocker cette valeur pour l'utiliser plus tard
                  containerCheckbox.dataset.containerCount = containerCount;
                }
                
                break;
              }
            }
            
            if (containerCheckbox) {
              // Vérifier si elle est déjà cochée
              if (!containerCheckbox.checked) {
                console.log('[Automation] Checkbox Conteneur cochée automatiquement');
                console.log('[Steam Scanner] Cochage de la checkbox Conteneur...');
                
                // Cocher la checkbox
                containerCheckbox.checked = true;
                
                // Simuler le clic
                simulateRealClick(containerCheckbox);
                
                // Déclencher les événements
                const changeEvent = new Event('change', { bubbles: true });
                containerCheckbox.dispatchEvent(changeEvent);
                
                const inputEvent = new Event('input', { bubbles: true });
                containerCheckbox.dispatchEvent(inputEvent);
                
                console.log('[Steam Scanner] Checkbox cochée !');
              } else {
                console.log('[Automation] Checkbox Conteneur déjà cochée (aucune action)');
              }
              
              // Optimisation : attendre que les items CS2 apparaissent, mais pas plus de 3s
              const start = Date.now();
              let lastCount = 0;
              function waitForItems() {
                const visibleItems = document.querySelectorAll('.item.app730:not([style*="display: none"])');
                if (visibleItems.length > 0 && visibleItems.length !== lastCount) {
                  console.log(`[Automation] ${visibleItems.length} items CS2 détectés, on continue. (attente rapide)`);
                  callback();
                } else if (Date.now() - start > 3000) {
                  console.log('[Automation] Timeout d\'attente items CS2 (3s), on continue.');
                  callback();
                } else {
                  lastCount = visibleItems.length;
                  setTimeout(waitForItems, 200);
                }
              }
              waitForItems();
            } else if (attempt < 5) {
              setTimeout(() => searchForContainerCheckbox(attempt + 1), 300);
            } else {
              console.log('[Automation] Checkbox Conteneur non trouvée après 5 tentatives : skip automatique du profil.');
              window.postMessage({ type: 'STEAM_SCANNER_SKIP_PROFILE' }, '*');
            }
          } // Fin de searchForContainerCheckbox
        }, 3000); // Attendre que les filtres s'ouvrent complètement
      } else {
        console.log('[Steam Scanner] Bouton "Filtrage avancé" non trouvé !');
        
        // Logger les éléments qui pourraient être le bouton
        console.log('[Steam Scanner] Éléments contenant "filtr":');
        allElements.forEach(elem => {
          const text = elem.textContent.toLowerCase();
          if (text.includes('filtr') && elem.children.length < 3) {
            console.log(`[Steam Scanner] - "${elem.textContent.trim()}" (${elem.tagName})`);
          }
        });
        
        callback();
      }
    }, 2500); // Augmenté pour s'assurer que la page est bien chargée
  }
  
  // Fonction pour attendre que les données Steam soient disponibles
  function waitForSteamData(callback, maxAttempts = 50) {
    let attempts = 0;
    
    function checkData() {
      attempts++;
      
      // Vérifier les différentes variables Steam possibles
      const hasActiveInventory = typeof g_ActiveInventory !== 'undefined' && g_ActiveInventory;
      const hasInventory = typeof CInventory !== 'undefined' && CInventory;
      const hasAppData = typeof g_rgAppContextData !== 'undefined' && g_rgAppContextData;
      
      // Vérifier aussi que la page est bien chargée
      const inventoryLoaded = document.querySelector('.inventory_page') !== null;
      
      if ((hasActiveInventory || hasInventory || hasAppData) && inventoryLoaded) {
        console.log('[Steam Scanner] Données Steam et page détectées');
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(checkData, 200);
      } else {
        console.log('[Steam Scanner] Timeout - données Steam non trouvées');
        callback();
      }
    }
    
    checkData();
  }
  
  // Fonction pour extraire les données d'inventaire
  function extractInventoryData() {
    const result = {
      found: false,
      steamID: null,
      personaName: null,  // Nouvelle propriété pour le pseudo
      isPrivate: false,  // Nouvelle propriété pour indiquer si l'inventaire est privé
      inventory: {
        total_value: 0,
        total_cases: 0,
        cases: [],
        expected_containers: 0  // Nouvelle propriété pour stocker le nombre attendu
      }
    };
    
    try {
      // Vérifier d'abord si l'inventaire est privé
      const privateIndicators = [
        '.inventory_load_fail_reason',
        '.inventory_load_fail',
        '.profile_private_info',
        '.private_profile',
        '.error_ctn',
        '#errortext'
      ];
      
      let isPrivate = false;
      
      // Méthode 1: Chercher les éléments indiquant un inventaire privé
      privateIndicators.forEach(selector => {
        const elem = document.querySelector(selector);
        if (elem && elem.offsetParent !== null) { // Vérifier que l'élément est visible
          const text = elem.textContent.toLowerCase();
          if (text.includes('private') || text.includes('privé') || 
              text.includes('not available') || text.includes('pas disponible') ||
              text.includes('failed') || text.includes('échoué')) {
            isPrivate = true;
            console.log(`[Steam Scanner] Inventaire privé détecté via ${selector}: ${text}`);
          }
        }
      });
      
      // Méthode 2: Chercher des messages d'erreur génériques
      if (!isPrivate) {
        const errorMessages = document.querySelectorAll('.inventory_page_right');
        errorMessages.forEach(elem => {
          const text = elem.textContent.toLowerCase();
          if ((text.includes('inventory') || text.includes('inventaire')) && 
              (text.includes('private') || text.includes('privé'))) {
            isPrivate = true;
            console.log('[Steam Scanner] Inventaire privé détecté via message d\'erreur');
          }
        });
      }
      
      // Méthode 3: Vérifier si on a accès aux données de l'inventaire
      if (!isPrivate && typeof g_ActiveInventory !== 'undefined' && g_ActiveInventory) {
        if (g_ActiveInventory.m_bPrivate || g_ActiveInventory.bPrivate) {
          isPrivate = true;
          console.log('[Steam Scanner] Inventaire privé détecté via g_ActiveInventory');
        }
      }
      
      // Si l'inventaire est privé, retourner directement
      if (isPrivate) {
        result.isPrivate = true;
        result.found = false;
        console.log('[Steam Scanner] Inventaire privé - arrêt de l\'analyse');
        return result;
      }
      
      // D'abord, essayer de récupérer la valeur totale depuis l'inventaire Steam
      // Méthode 1: Chercher dans tous les éléments qui contiennent un prix en euros
      const allPriceElements = document.querySelectorAll('*');
      const pricePattern = /([0-9]+[,.]?[0-9]*)\s*€/;
      
      allPriceElements.forEach(elem => {
        // Seulement les éléments avec peu ou pas d'enfants (éléments de texte)
        if (elem.childElementCount <= 1) {
          const text = elem.textContent || '';
          if (text && text.includes('€') && !text.includes('Vendre') && !text.includes('Acheter')) {
            const match = text.match(pricePattern);
            if (match) {
              const price = parseFloat(match[1].replace(',', '.'));
              // Si c'est un prix raisonnable et supérieur à ce qu'on a déjà
              if (price > result.inventory.total_value && price < 100000) {
                // Vérifier que ce n'est pas un prix unitaire d'item
                const parent = elem.parentElement;
                const grandParent = parent?.parentElement;
                const context = (parent?.className || '') + ' ' + (grandParent?.className || '');
                
                // Éviter les prix unitaires d'items
                if (!context.includes('item_market_action') && !context.includes('item_price')) {
                  result.inventory.total_value = price;
                  console.log(`[Steam Scanner] Prix potentiel trouvé: ${price}€ dans ${elem.tagName}.${elem.className || 'no-class'}`);
                }
              }
            }
          }
        }
      });
      
      console.log(`[Steam Scanner] Valeur totale après recherche générale: ${result.inventory.total_value}€`);
      
      // Les heures CS2 sont maintenant récupérées depuis la page de profil avant de naviguer vers l'inventaire
      
      // 0. Récupérer le nombre attendu de conteneurs depuis la checkbox
      const containerCheckbox = document.querySelector('input[type="checkbox"][data-container-count]');
      if (containerCheckbox && containerCheckbox.dataset.containerCount) {
        result.inventory.expected_containers = parseInt(containerCheckbox.dataset.containerCount);
        console.log(`[Steam Scanner] Nombre attendu de conteneurs: ${result.inventory.expected_containers}`);
      }
      
      // 1. Récupérer le SteamID
      if (typeof g_steamID !== 'undefined' && g_steamID) {
        result.steamID = g_steamID;
      } else if (typeof UserYou !== 'undefined' && UserYou && UserYou.strSteamId) {
        result.steamID = UserYou.strSteamId;
      } else if (typeof g_ActiveUser !== 'undefined' && g_ActiveUser && g_ActiveUser.strSteamId) {
        result.steamID = g_ActiveUser.strSteamId;
      }
      
      // 2. D'abord essayer de récupérer les items visibles dans le DOM
      const visibleItems = document.querySelectorAll('.item.app730.context2:not([style*="display: none"])');
      console.log(`[Steam Scanner] ${visibleItems.length} items visibles trouvés dans le DOM`);
      
      // Calculer la valeur totale de tous les items visibles
      let domTotalValue = 0;
      
      if (visibleItems.length > 0) {
        result.found = true;
        const casesMap = new Map();
        
        visibleItems.forEach(item => {
          try {
            // Récupérer les infos depuis les attributs data
            const classid = item.getAttribute('data-classid') || item.getAttribute('classid');
            const instanceid = item.getAttribute('data-instanceid') || item.getAttribute('instanceid');
            const amount = parseInt(item.getAttribute('data-amount') || item.getAttribute('amount') || '1');
            
            // Récupérer le nom - chercher dans plusieurs endroits possibles
            let itemName = '';
            const nameSelectors = [
              '.item_desc_game_info',
              '.hover_item_name', 
              '.item_desc_name',
              '.economy_item_name',
              'h1'
            ];
            
            for (let selector of nameSelectors) {
              const nameElem = item.querySelector(selector);
              if (nameElem && nameElem.textContent.trim()) {
                itemName = nameElem.textContent.trim();
                break;
              }
            }
            
            // Si toujours pas de nom, essayer dans le hover
            if (!itemName) {
              const hoverContent = item.getAttribute('data-hover-content');
              if (hoverContent) {
                const match = hoverContent.match(/<h1[^>]*>([^<]+)<\/h1>/);
                if (match) itemName = match[1];
              }
            }
            
            // Récupérer le prix de l'item pour le total
            let itemPrice = 0;
            const priceElem = item.querySelector('.item_market_action_button_contents');
            if (priceElem) {
              const priceMatch = priceElem.textContent.match(/([0-9.,]+)/);
              if (priceMatch) {
                itemPrice = parseFloat(priceMatch[1].replace(',', '.'));
                domTotalValue += itemPrice * amount;
              }
            }
            
            // Vérifier si c'est une caisse
            const lowerName = itemName.toLowerCase();
            if ((lowerName.includes('case') || lowerName.includes('caisse') || 
                 lowerName.includes('capsule') || lowerName.includes('container')) && 
                !lowerName.includes('key') && !lowerName.includes('clé') && 
                !lowerName.includes('badge') && !lowerName.includes('sticker')) {
              
              console.log(`[Steam Scanner] Caisse trouvée: ${itemName}`);
              
              // Récupérer l'icône
              let icon = '';
              const imgElem = item.querySelector('img');
              if (imgElem && imgElem.src) {
                const iconMatch = imgElem.src.match(/economy\/image\/([^\/]+)/);
                if (iconMatch) {
                  icon = iconMatch[1];
                }
              }
              
              // Ajouter ou mettre à jour la caisse
              if (casesMap.has(itemName)) {
                const existing = casesMap.get(itemName);
                existing.amount += amount;
                existing.totalValue = existing.price * existing.amount;
              } else {
                casesMap.set(itemName, {
                  name: itemName,
                  amount: amount,
                  price: itemPrice, // Utiliser itemPrice déjà calculé
                  totalValue: itemPrice * amount,
                  icon: icon,
                  classid: classid,
                  instanceid: instanceid
                });
              }
            }
          } catch (e) {
            console.error('[Steam Scanner] Erreur lors de l\'analyse d\'un item DOM:', e);
          }
        });
        
        // Convertir en tableau
        result.inventory.cases = Array.from(casesMap.values());
        result.inventory.total_cases = result.inventory.cases.reduce((sum, c) => sum + c.amount, 0);
        
        console.log(`[Steam Scanner] ${result.inventory.total_cases} caisses trouvées via DOM`);
        
        // Utiliser la valeur totale calculée depuis le DOM
        if (domTotalValue > 0) {
          result.inventory.total_value = domTotalValue;
          console.log(`[Steam Scanner] Valeur totale calculée depuis le DOM: ${domTotalValue}€`);
        }
        
        // Vérifier si on a trouvé le bon nombre
        if (result.inventory.expected_containers > 0) {
          if (result.inventory.total_cases === result.inventory.expected_containers) {
            console.log('[Steam Scanner] ✓ Le nombre de caisses trouvées correspond au nombre attendu !');
          } else {
            console.log(`[Steam Scanner] ⚠️ Différence détectée: ${result.inventory.total_cases} trouvées vs ${result.inventory.expected_containers} attendues`);
          }
        }
      }
      
      // 3. Si pas assez de données, essayer les variables JavaScript
      if (result.inventory.total_cases === 0) {
        console.log('[Steam Scanner] Pas de caisses dans le DOM, essai via JavaScript...');
        
        let inventory = null;
        let descriptions = null;
        let assets = null;
        
        if (typeof g_ActiveInventory !== 'undefined' && g_ActiveInventory) {
          inventory = g_ActiveInventory;
          if (inventory.m_rgAssets) assets = inventory.m_rgAssets;
          if (inventory.rgInventory) assets = inventory.rgInventory;
          if (inventory.m_rgDescriptions) descriptions = inventory.m_rgDescriptions;
          if (inventory.rgDescriptions) descriptions = inventory.rgDescriptions;
        }
        
        if (assets && descriptions) {
          result.found = true;
          const assetsArray = Array.isArray(assets) ? assets : Object.values(assets);
          const casesMap = new Map();
          
          // Calculer la valeur totale de tous les items marketable
          let inventoryTotalValue = 0;
          
          assetsArray.forEach(asset => {
            try {
              const key = asset.classid + '_' + asset.instanceid;
              const description = descriptions[key];
              
              if (!description) return;
              
              const itemName = description.market_name || description.name || '';
              const amount = parseInt(asset.amount) || 1;
              
                          // Calculer la valeur de chaque item marketable
            if (description.marketable) {
              let itemPrice = 0;
              
              // Essayer différentes sources de prix
              if (description.price && typeof description.price === 'number') {
                itemPrice = description.price;
              } else if (description.market_price && typeof description.market_price === 'number') {
                itemPrice = description.market_price;
              } else if (description.price_text) {
                const match = description.price_text.match(/([0-9.,]+)/);
                if (match) {
                  itemPrice = parseFloat(match[1].replace(',', '.'));
                }
              } else if (description.market_price_text) {
                const match = description.market_price_text.match(/([0-9.,]+)/);
                if (match) {
                  itemPrice = parseFloat(match[1].replace(',', '.'));
                }
              }
              
              // Si on a trouvé un prix, l'ajouter au total
              if (itemPrice > 0) {
                inventoryTotalValue += itemPrice * amount;
                console.log(`[Steam Scanner] Item: ${description.name || 'Unknown'} - Prix: ${itemPrice}€ x ${amount} = ${itemPrice * amount}€`);
              }
            }
              
              // Détecter les caisses
              const lowerName = itemName.toLowerCase();
              if ((lowerName.includes('case') || lowerName.includes('caisse') || 
                   lowerName.includes('capsule') || lowerName.includes('container')) && 
                  !lowerName.includes('key') && !lowerName.includes('clé') && 
                  !lowerName.includes('badge') && !lowerName.includes('sticker')) {
                
                let price = 0;
                if (description.market_price) {
                  price = parseFloat(description.market_price);
                } else if (description.price) {
                  price = parseFloat(description.price);
                }
                
                if (casesMap.has(itemName)) {
                  const existing = casesMap.get(itemName);
                  existing.amount += amount;
                  existing.totalValue = existing.price * existing.amount;
                } else {
                  casesMap.set(itemName, {
                    name: itemName,
                    amount: amount,
                    price: price,
                    totalValue: price * amount,
                    icon: description.icon_url || ''
                  });
                }
              }
            } catch (e) {
              console.error('[Steam Scanner] Erreur lors de l\'analyse JavaScript:', e);
            }
          });
          
          result.inventory.cases = Array.from(casesMap.values());
          result.inventory.total_cases = result.inventory.cases.reduce((sum, c) => sum + c.amount, 0);
          
          // Calculer la valeur totale des caisses
          const totalCasesValue = result.inventory.cases.reduce((sum, c) => sum + (c.totalValue || 0), 0);
          console.log(`[Steam Scanner] Valeur totale des caisses: ${totalCasesValue}€`);
          
          // Utiliser la valeur calculée si on en a une
          if (inventoryTotalValue > 0) {
            result.inventory.total_value = inventoryTotalValue;
          }
        }
      }
      
      // 4. Récupérer la valeur totale depuis les éléments spécifiques de Steam
      // Méthode prioritaire : chercher les inputs/textboxes avec les valeurs
      const priceInputs = document.querySelectorAll('input[type="text"], .price_input, .market_dialog_input');
      priceInputs.forEach(input => {
        const value = input.value || input.textContent || '';
        if (value && (value.includes('€') || value.includes('$'))) {
          const match = value.match(/([0-9]+[.,]?[0-9]*)/);
          if (match) {
            const price = parseFloat(match[1].replace(',', '.'));
            if (price > result.inventory.total_value) {
              result.inventory.total_value = price;
              console.log(`[Steam Scanner] Valeur trouvée dans input: ${price}€`);
            }
          }
        }
      });
      
      // Chercher aussi dans les divs qui ressemblent à des inputs
      const priceDisplays = document.querySelectorAll('.market_dialog_input_wrapper input, .market_listing_price_input, .item_market_value');
      priceDisplays.forEach(elem => {
        const text = elem.value || elem.textContent || '';
        if (text && (text.includes('€') || text.includes('$'))) {
          const match = text.match(/([0-9]+[.,]?[0-9]*)/);
          if (match) {
            const price = parseFloat(match[1].replace(',', '.'));
            if (price > result.inventory.total_value) {
              result.inventory.total_value = price;
              console.log(`[Steam Scanner] Valeur trouvée dans élément prix: ${price}€`);
            }
          }
        }
      });
      
      // Si toujours pas trouvé, chercher dans les zones de marché
      if (result.inventory.total_value === 0) {
        // Chercher spécifiquement dans la zone des prix du marché
        const marketPriceElements = document.querySelectorAll('.market_commodity_orders_table td, .market_listing_their_price span');
        marketPriceElements.forEach(elem => {
          const text = elem.textContent || '';
          if (text && (text.includes('€') || text.includes('$'))) {
            const match = text.match(/([0-9]+[.,]?[0-9]*)/);
            if (match) {
              const price = parseFloat(match[1].replace(',', '.'));
              if (price > result.inventory.total_value) {
                result.inventory.total_value = price;
                console.log(`[Steam Scanner] Valeur trouvée dans tableau marché: ${price}€`);
              }
            }
          }
        });
      }
      
      // Méthode spécifique pour les textboxes Steam
      if (result.inventory.total_value === 0) {
        // Chercher dans les zones spécifiques où Steam affiche les prix
        const steamPriceElements = document.querySelectorAll(
          '.market_listing_price_without_fee, .market_listing_price_with_fee, ' +
          '.market_commodity_order_summary span, .market_commodity_orders_header_text, ' +
          '.normal_price, .sale_price, .your_price span'
        );
        
        steamPriceElements.forEach(elem => {
          const text = elem.textContent || '';
          if (text && (text.includes('€') || text.includes('$'))) {
            const match = text.match(/([0-9]+[.,]?[0-9]*)/);
            if (match) {
              const price = parseFloat(match[1].replace(',', '.'));
              if (price > result.inventory.total_value) {
                result.inventory.total_value = price;
                console.log(`[Steam Scanner] Valeur trouvée dans zone prix Steam: ${price}€`);
              }
            }
          }
        });
      }
      
      // Si toujours pas de valeur et qu'on a trouvé des items, mettre au moins la valeur des caisses
      if (result.inventory.total_value === 0 && result.inventory.cases.length > 0) {
        result.inventory.total_value = result.inventory.cases.reduce((sum, c) => sum + (c.totalValue || 0), 0);
        console.log(`[Steam Scanner] Utilisation de la valeur des caisses comme valeur totale: ${result.inventory.total_value}€`);
      }
      
      console.log(`[Steam Scanner] Valeur totale finale de l'inventaire: ${result.inventory.total_value}€`);
      
    } catch (e) {
      console.error('[Steam Scanner] Erreur lors de l\'extraction des données:', e);
    }
    
    return result;
  }
  
  // Fonction pour attendre et récupérer la valeur totale avec plusieurs tentatives
  function waitForTotalValue(existingData, callback, attempts = 0) {
    const maxAttempts = 15;
    
    if (attempts >= maxAttempts) {
      console.log('[Steam Scanner] Impossible de trouver la valeur totale après ' + maxAttempts + ' tentatives');
      callback(existingData);
      return;
    }
    
    console.log(`[Steam Scanner] Recherche de la valeur totale - Tentative ${attempts + 1}/${maxAttempts}`);
    
    // Chercher la valeur totale dans différents endroits
    let totalValue = existingData.inventory.total_value || 0;
    
    // Méthode 1: Chercher dans les éléments qui ressemblent à des totaux
    const potentialTotalElements = document.querySelectorAll('*');
    potentialTotalElements.forEach(elem => {
      // Seulement les éléments sans beaucoup d'enfants (texte direct)
      if (elem.childElementCount <= 1) {
        const text = elem.textContent || '';
        // Pattern pour détecter un prix total (éviter les prix unitaires)
        if (text.match(/^\s*([0-9]+[,.]?[0-9]*)\s*€\s*$/) && 
            !text.includes('par') && !text.includes('each') && 
            !elem.closest('.item') && !elem.closest('.item_market_action')) {
          const match = text.match(/([0-9]+[,.]?[0-9]*)/);
          if (match) {
            const price = parseFloat(match[1].replace(',', '.'));
            // Prendre le prix le plus élevé qui semble raisonnable
            if (price > totalValue && price < 100000 && price > 0.5) {
              totalValue = price;
              console.log(`[Steam Scanner] Valeur potentielle trouvée: ${price}€ dans ${elem.tagName}`);
            }
          }
        }
      }
    });
    
    // Méthode 2: Calculer depuis la somme des items si on n'a rien trouvé
    if (totalValue === 0) {
      const allItems = document.querySelectorAll('.item.app730.context2');
      let calculatedTotal = 0;
      
      allItems.forEach(item => {
        const priceElem = item.querySelector('.item_market_action_button_contents');
        if (priceElem) {
          const priceMatch = priceElem.textContent.match(/([0-9.,]+)/);
          if (priceMatch) {
            const itemPrice = parseFloat(priceMatch[1].replace(',', '.'));
            const amount = parseInt(item.getAttribute('data-amount') || '1');
            calculatedTotal += itemPrice * amount;
          }
        }
      });
      
      if (calculatedTotal > 0) {
        totalValue = calculatedTotal;
        console.log(`[Steam Scanner] Valeur calculée depuis la somme des items: ${calculatedTotal}€`);
      }
    }
    
    if (totalValue > existingData.inventory.total_value) {
      existingData.inventory.total_value = totalValue;
      console.log(`[Steam Scanner] Nouvelle valeur totale trouvée: ${totalValue}€`);
    }
    
    // Si on n'a toujours pas de valeur, réessayer après un délai
    if (existingData.inventory.total_value === 0 && attempts < maxAttempts - 1) {
      setTimeout(() => waitForTotalValue(existingData, callback, attempts + 1), 1000);
    } else {
      callback(existingData);
    }
  }

  // Écouter les messages de l'extension
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'STEAM_SCANNER_REQUEST') return;
    
    console.log('[Steam Scanner] Requête reçue');
    
    // Attendre que les données soient chargées
    waitForSteamData(() => {
      // Appliquer les filtres puis extraire les données
      applyFilters(() => {
        const data = extractInventoryData();
        
        // Si pas de valeur totale, essayer de la récupérer avec plusieurs tentatives
        if (data.inventory.total_value === 0) {
          console.log('[Steam Scanner] Pas de valeur totale trouvée, lancement de la recherche approfondie...');
          waitForTotalValue(data, (finalData) => {
            // Envoyer les données finales
            window.postMessage({
              type: 'STEAM_SCANNER_RESPONSE',
              data: finalData
            }, '*');
          });
        } else {
          // Envoyer les données directement
          window.postMessage({
            type: 'STEAM_SCANNER_RESPONSE',
            data: data
          }, '*');
        }
      });
    });
  });
  
  // Signaler que le script est prêt
  window.postMessage({
    type: 'STEAM_SCANNER_READY'
      }, '*');
    
  })(); 