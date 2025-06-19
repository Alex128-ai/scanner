document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggleButton');
  const delaySlider = document.getElementById('delay');
  const delayValue = document.getElementById('delayValue');
  const exportButton = document.getElementById('exportButton');
  const resetButton = document.getElementById('resetButton');
  const debugButton = document.getElementById('debugButton');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const allCount = document.getElementById('allCount');
  const totalCases = document.getElementById('totalCases');
  const consoleOutput = document.getElementById('consoleOutput');
  const profileTableBody = document.getElementById('profileTableBody');
  const showAllCheckbox = document.getElementById('showAllProfiles');
const loopModeCheckbox = document.getElementById('loopMode');
const loopStatus = document.getElementById('loopStatus');
const cycleCount = document.getElementById('cycleCount');
const backgroundModeCheckbox = document.getElementById('backgroundMode');
const skipButton = document.getElementById('skipButton');
const skipHelp = document.getElementById('skipHelp');
const consoleTechOutput = document.getElementById('consoleTechOutput');
  
  // Gestion des onglets Scan / Historique
  const tabScan = document.getElementById('tabScan');
  const tabHistory = document.getElementById('tabHistory');
  const scanSection = document.getElementById('scanSection');
  const historySection = document.getElementById('historySection');

  tabScan.addEventListener('click', () => {
    tabScan.classList.add('active');
    tabHistory.classList.remove('active');
    scanSection.style.display = '';
    historySection.style.display = 'none';
  });
  tabHistory.addEventListener('click', () => {
    tabHistory.classList.add('active');
    tabScan.classList.remove('active');
    scanSection.style.display = 'none';
    historySection.style.display = '';
    renderHistoryTable();

    // (Ré)attacher l'event du bouton Importer CSV à chaque affichage de l'onglet Historique
    const importCsvBtn = document.getElementById('importCsvBtn');
    const importCsvInput = document.getElementById('importCsvInput');
    if (importCsvBtn && importCsvInput && !importCsvBtn.dataset.listenerAttached) {
      importCsvBtn.addEventListener('click', () => {
        importCsvInput.value = '';
        importCsvInput.click();
        addTechLog('Clic sur le bouton : importCsvBtn (ouverture de la fenêtre de sélection CSV)');
      });
      importCsvInput.addEventListener('change', (e) => {
        const file = importCsvInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
          const text = event.target.result;
          // Ignorer les lignes de commentaire (commençant par #)
          const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
          if (lines.length < 2) {
            alert('Le fichier CSV est vide ou mal formaté.');
            return;
          }
          const header = lines[0].split(',');
          // Index des colonnes principales
          const idxPseudo = header.findIndex(h => h.toLowerCase().includes('pseudo'));
          const idxUrl = header.findIndex(h => h.toLowerCase().includes('url'));
          const idxHeures = header.findIndex(h => h.toLowerCase().includes('heure'));
          const idxCaisses = header.findIndex(h => h.toLowerCase().includes('caisse'));
          const idxValeurCaisses = header.findIndex(h => h.toLowerCase().includes('valeur caisse'));
          const idxValeurInv = header.findIndex(h => h.toLowerCase().includes('valeur inventaire'));
          const idxDetails = header.findIndex(h => h.toLowerCase().includes('détail'));
          if (idxUrl === -1 || idxCaisses === -1) {
            alert('Le fichier CSV ne contient pas les colonnes attendues.');
            return;
          }
          const importedProfiles = [];
          for (let i = 1; i < lines.length; i++) {
            const row = lines[i].match(/("[^"]*"|[^,]+)/g)?.map(cell => cell.replace(/^"|"$/g, ''));
            if (!row || row.length < header.length) continue;
            const profile = {
              url: row[idxUrl],
              personaName: idxPseudo !== -1 ? row[idxPseudo] : '',
              cs2Hours: idxHeures !== -1 ? parseFloat(row[idxHeures]) || 0 : 0,
              cases: idxCaisses !== -1 ? parseInt(row[idxCaisses]) || 0 : 0,
              casesValue: idxValeurCaisses !== -1 ? parseFloat(row[idxValeurCaisses]) || 0 : 0,
              value: idxValeurInv !== -1 ? parseFloat(row[idxValeurInv]) || 0 : 0,
              casesDetails: idxDetails !== -1 ? (row[idxDetails] ? row[idxDetails].split(';').map(s => ({ name: s.trim() })) : []) : [],
              isPrivate: false
            };
            if (profile.url && profile.cases > 0) importedProfiles.push(profile);
          }
          if (!importedProfiles.length) {
            alert('Aucun profil avec des caisses trouvé dans le CSV.');
            return;
          }
          // Fusionner avec les profils existants
          chrome.storage.local.get('allProfiles', (data) => {
            const existing = data.allProfiles || [];
            // Remplacer ou ajouter les profils importés (par URL)
            const merged = [...existing];
            importedProfiles.forEach(p => {
              const idx = merged.findIndex(e => e.url === p.url);
              if (idx !== -1) {
                // Garder le profil avec le plus de caisses
                merged[idx] = (p.cases > (merged[idx].cases || 0)) ? p : merged[idx];
              } else {
                merged.push(p);
              }
            });
            chrome.storage.local.set({ allProfiles: merged }, () => {
              addLog(`✅ ${importedProfiles.length} profils importés depuis le CSV !`);
              renderHistoryTable();
            });
          });
        };
        reader.readAsText(file);
      });
      importCsvBtn.dataset.listenerAttached = 'true';
    }
  });

  // Historique fusionné, triable
  const searchHistoryInput = document.getElementById('searchHistoryInput');
  const historyTableBody = document.getElementById('historyTableBody');
  const sortHistoryCaisses = document.getElementById('sortHistoryCaisses');
  const sortHistoryHeures = document.getElementById('sortHistoryHeures');
  const sortHistoryValeur = document.getElementById('sortHistoryValeur');
  const sortHistoryPseudo = document.getElementById('sortHistoryPseudo');
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');
  let historySortKey = 'cases';
  let historySortDesc = true;
  let allHistoryProfiles = [];

  function getBestCasesCount(profile) {
    let n1 = profile.cases || 0;
    let n2 = profile.expectedCases || 0;
    let n3 = 0;
    if (Array.isArray(profile.casesDetails)) {
      n3 = profile.casesDetails.reduce((sum, c) => sum + (c.amount || c.count || 0), 0);
    }
    return Math.max(n1, n2, n3);
  }

  function renderHistoryTable() {
    chrome.storage.local.get('allProfiles', (data) => {
      const existing = data.allProfiles || [];
      // Afficher tous les profils scannés avec au moins une caisse (aucune déduplication)
      allHistoryProfiles = existing.filter(p => getBestCasesCount(p) > 0);
      updateHistoryTable();
    });
  }

  function updateHistoryTable() {
    let profiles = allHistoryProfiles.slice();
    const query = searchHistoryInput.value.trim().toLowerCase();
    if (query) {
      profiles = profiles.filter(p =>
        (p.url && p.url.toLowerCase().includes(query)) ||
        (p.steamID && String(p.steamID).toLowerCase().includes(query)) ||
        (p.personaName && p.personaName.toLowerCase().includes(query))
      );
    }
    profiles.sort((a, b) => {
      let aVal, bVal;
      if (historySortKey === 'personaName') {
        aVal = (a.personaName || '').toLowerCase();
        bVal = (b.personaName || '').toLowerCase();
        return historySortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      } else if (historySortKey === 'cases') {
        aVal = getBestCasesCount(a);
        bVal = getBestCasesCount(b);
        return historySortDesc ? bVal - aVal : aVal - bVal;
      } else {
        aVal = a[historySortKey] || 0;
        bVal = b[historySortKey] || 0;
        return historySortDesc ? bVal - aVal : aVal - bVal;
      }
    });
    // Ajout de la flèche sur la colonne triée
    document.querySelectorAll('#historyTable th').forEach(th => {
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '');
    });
    let arrow = historySortDesc ? ' ▼' : ' ▲';
    if (historySortKey === 'cases') sortHistoryCaisses.innerHTML = 'CAISSES' + arrow;
    if (historySortKey === 'cs2Hours') sortHistoryHeures.innerHTML = 'HEURES CS2' + arrow;
    if (historySortKey === 'value') sortHistoryValeur.innerHTML = 'VALEUR TOTALE' + arrow;
    if (historySortKey === 'personaName') sortHistoryPseudo.innerHTML = 'PSEUDO' + arrow;
    let html = '';
    for (const p of profiles) {
      html += '<tr>' +
        `<td><a href="${p.url || '#'}" target="_blank" style="color:#4fc3f7;">${p.url ? (p.url.split('/').pop() || p.url) : ''}</a></td>` +
        `<td>${p.personaName || ''}</td>` +
        `<td>${getBestCasesCount(p)}</td>` +
        `<td>${p.cs2Hours || 0}</td>` +
        `<td>${p.value || 0}</td>` +
        '</tr>';
    }
    historyTableBody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:#aaa;">Aucun profil scanné pour le moment.</td></tr>';
  }

  searchHistoryInput.addEventListener('input', updateHistoryTable);
  sortHistoryCaisses.addEventListener('click', () => {
    historySortKey = 'cases';
    historySortDesc = !historySortDesc;
    updateHistoryTable();
  });
  sortHistoryHeures.addEventListener('click', () => {
    historySortKey = 'cs2Hours';
    historySortDesc = !historySortDesc;
    updateHistoryTable();
  });
  sortHistoryValeur.addEventListener('click', () => {
    historySortKey = 'value';
    historySortDesc = !historySortDesc;
    updateHistoryTable();
  });
  sortHistoryPseudo.addEventListener('click', () => {
    historySortKey = 'personaName';
    historySortDesc = !historySortDesc;
    updateHistoryTable();
  });
  
  // Vérifier si un scan est en cours au chargement
  chrome.runtime.sendMessage({ action: "check_status" }, (response) => {
    if (response && response.isScanning) {
      toggleButton.textContent = 'ARRÊTER LE SCAN';
      showSkipButton();
      if (response.loopCycles > 0) {
        cycleCount.textContent = response.loopCycles;
        loopStatus.style.display = 'block';
      }
    } else {
      hideSkipButton();
    }
  });
  
  // Initialiser le délai
  delayValue.textContent = `${delaySlider.value} ms`;
  delaySlider.addEventListener('input', () => {
    delayValue.textContent = `${delaySlider.value} ms`;
    // Sauvegarder immédiatement la valeur dans le storage
    chrome.storage.local.set({ delay: delaySlider.value });
    console.log(`[Popup] Délai changé: ${delaySlider.value}ms`);
    addTechLog(`Changement du slider délai : ${delaySlider.value} ms`);
  });
  
  // Charger le délai sauvegardé
  chrome.storage.local.get('delay', (data) => {
    if (data.delay) {
      delaySlider.value = data.delay;
      delayValue.textContent = `${delaySlider.value} ms`;
      console.log(`[Popup] Délai chargé: ${data.delay}ms`);
    }
  });
  
  // Gérer la checkbox pour afficher tous les profils
  showAllCheckbox.addEventListener('change', () => {
    chrome.storage.local.get('allProfiles', (data) => {
      const profiles = data.allProfiles || [];
      console.log(`[Popup] Checkbox changée: ${showAllCheckbox.checked}, ${profiles.length} profils trouvés`);
      updateProfileTable(profiles, showAllCheckbox.checked);
      
      // Log dans la console de l'extension
      if (showAllCheckbox.checked) {
        addLog(`📊 Affichage de tous les profils (${profiles.length} total)`);
      } else {
        const profilesWithCases = profiles.filter(p => p.cases > 0);
        addLog(`📦 Affichage des profils avec caisses uniquement (${profilesWithCases.length} profils)`);
      }
      addTechLog(`Changement de l'option : ${showAllCheckbox.id} => ${showAllCheckbox.checked}`);
    });
  });
  
  // Gérer la checkbox pour le mode boucle
  loopModeCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ loopMode: loopModeCheckbox.checked });
    if (loopModeCheckbox.checked) {
      addLog("🔄 Mode boucle activé - Le scan continuera indéfiniment");
      toggleButton.style.backgroundColor = '#440000';
      toggleButton.style.borderColor = '#ff7';
    } else {
      addLog("⏹️ Mode boucle désactivé");
      loopStatus.style.display = 'none'; // Masquer le statut de boucle
      toggleButton.style.backgroundColor = '#002200';
      toggleButton.style.borderColor = '#0f0';
    }
    addTechLog(`Changement de l'option : ${loopModeCheckbox.id} => ${loopModeCheckbox.checked}`);
  });
  
  // Charger l'état du mode boucle
  chrome.storage.local.get('loopMode', (data) => {
    loopModeCheckbox.checked = data.loopMode || false;
    if (loopModeCheckbox.checked) {
      toggleButton.style.backgroundColor = '#440000';
      toggleButton.style.borderColor = '#ff7';
    }
  });
  
  // Gérer le bouton de démarrage/arrêt
  toggleButton.addEventListener('click', async () => {
    const isRunning = toggleButton.textContent === 'DÉMARRER LE SCAN';
    toggleButton.textContent = isRunning ? 'ARRÊTER LE SCAN' : 'DÉMARRER LE SCAN';
    
    if (isRunning) {
      clearConsole();
      chrome.storage.local.set({ delay: delaySlider.value });
      hideSkipButton();
      
      // Mode normal - utiliser l'onglet actif
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url?.includes('steamcommunity.com')) {
        alert("Veuillez d'abord ouvrir votre liste d'amis Steam.\nExemple: https://steamcommunity.com/id/votrepseudo/friends/");
        toggleButton.textContent = 'DÉMARRER LE SCAN';
        return;
      }
      
      // Vérifier plus spécifiquement si on est sur la page d'amis
      if (!tab.url.includes('/friends') && !tab.url.includes('/contacts')) {
        const confirmScan = confirm(
          "⚠️ Attention: Vous ne semblez pas être sur votre page d'amis.\n\n" +
          "Pour scanner vos amis, allez sur:\n" +
          "https://steamcommunity.com/id/VOTRE_ID/friends/\n\n" +
          "Voulez-vous continuer quand même?"
        );
        if (!confirmScan) {
          toggleButton.textContent = 'DÉMARRER LE SCAN';
          return;
        }
      }
      
      chrome.runtime.sendMessage({ action: "start", tabId: tab.id });
      showSkipButton();
      
      if (loopModeCheckbox.checked) {
        addLog("🚀 Scan démarré en MODE BOUCLE - Scan infini activé!");
        addLog("💡 Le scan sélectionnera un ami au hasard après chaque cycle");
      } else {
        addLog("🚀 Scan démarré - Recherche de caisses CS2...");
      }
      addLog(`⏱️ Délai entre les scans: ${delaySlider.value}ms`);
    } else {
      chrome.runtime.sendMessage({ action: "stop" });
      addLog("⏹️ Scan arrêté");
      loopStatus.style.display = 'none'; // Masquer le statut de boucle
    }
    addTechLog(`Clic sur le bouton : ${toggleButton.id}`);
  });
  
  // Gérer le bouton SKIP
  skipButton.addEventListener('click', () => {
    // Désactiver le bouton pendant un court instant pour éviter les clics multiples
    skipButton.disabled = true;
    skipButton.style.opacity = '0.5';
    
    chrome.runtime.sendMessage({ action: "skip" });
    addLog("⏭️ Passage au profil suivant...");
    
    // Réactiver le bouton après 1 seconde
    setTimeout(() => {
      skipButton.disabled = false;
      skipButton.style.opacity = '1';
    }, 1000);
    addTechLog(`Clic sur le bouton : ${skipButton.id}`);
  });
  
  // Mettre à jour le tableau des profils
  function updateProfileTable(profiles, showAll = false) {
    console.log(`[UpdateProfileTable] Mise à jour avec ${profiles.length} profils, showAll=${showAll}`);
    
    // Vider le tableau
    clearProfileTable();
    
    // Dédoublonnage par URL (on garde le profil avec le plus de caisses, puis la plus grande valeur)
    const uniqueProfilesMap = new Map();
    for (const profile of profiles) {
      const key = profile.url;
      if (!key) continue;
      if (!uniqueProfilesMap.has(key)) {
        uniqueProfilesMap.set(key, profile);
      } else {
        const existing = uniqueProfilesMap.get(key);
        // On garde le profil avec le plus de caisses, puis la plus grande valeur
        if ((profile.cases || 0) > (existing.cases || 0) || ((profile.cases || 0) === (existing.cases || 0) && (profile.value || 0) > (existing.value || 0))) {
          uniqueProfilesMap.set(key, profile);
        }
      }
    }
    const uniqueProfiles = Array.from(uniqueProfilesMap.values());
    
    // Filtrer pour ne garder que les profils avec des caisses (ou tous si showAll est true)
    const profilesToShow = showAll ? uniqueProfiles : uniqueProfiles.filter(profile => profile.cases > 0);
    console.log(`[UpdateProfileTable] ${profilesToShow.length} profils à afficher (après dédoublonnage)`);
    
    // Tri des profils: d'abord par valeur des caisses (décroissant), puis par nombre de caisses
    profilesToShow.sort((a, b) => {
      const aValue = a.casesValue || 0;
      const bValue = b.casesValue || 0;
      if (bValue !== aValue) {
        return bValue - aValue;
      }
      return (b.cases || 0) - (a.cases || 0);
    });
    
    // Remplir le tableau avec les données de chaque profil
    profilesToShow.forEach(profile => {
      const row = document.createElement('tr');
      
      // URL du profil
      const urlCell = document.createElement('td');
      urlCell.className = 'profile-url';
      
      // Utiliser le pseudo ou extraire depuis l'URL
      let profileName = profile.personaName || "";
      if (!profileName) {
        try {
          const profileUrl = new URL(profile.url);
          const pathParts = profileUrl.pathname.split('/').filter(Boolean);
          profileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : profile.url;
        } catch (e) {
          profileName = profile.url.split('/').pop() || profile.url;
        }
      }
      
      // Créer un lien vers le profil
      const link = document.createElement('a');
      link.href = profile.url;
      link.textContent = profileName;
      // Couleur différente selon si le profil a des caisses ou non
      link.style.color = profile.cases > 0 ? "#ff7" : "#888";
      link.style.textDecoration = "none";
      link.target = "_blank";
      link.addEventListener('mouseenter', () => {
        link.style.textDecoration = 'underline';
      });
      link.addEventListener('mouseleave', () => {
        link.style.textDecoration = 'none';
      });
      urlCell.appendChild(link);
      row.appendChild(urlCell);
      
      // Nombre de caisses
      const casesCell = document.createElement('td');
      casesCell.style.textAlign = 'center';
      
      // Vérifier si l'inventaire est privé
      if (profile.isPrivate) {
        casesCell.innerHTML = '<span style="color: #f77; font-style: italic;">Inventaire privé 🔒</span>';
      } else {
        casesCell.style.color = '#ff7';
        casesCell.style.fontWeight = 'bold';
        
        // Ajouter l'info du nombre attendu et la valeur
        if (profile.expectedCases && profile.expectedCases !== profile.cases) {
          casesCell.innerHTML = `${profile.cases || 0} <small style="color: #f77;">(/${profile.expectedCases})</small><br><small style="color: #ff7;">${(profile.casesValue || 0).toFixed(2)}€</small>`;
        } else if (profile.casesValue > 0) {
          casesCell.innerHTML = `${profile.cases || 0}<br><small style="color: #ff7;">${(profile.casesValue || 0).toFixed(2)}€</small>`;
        } else {
          casesCell.innerHTML = `${profile.cases || 0}`;
        }
        
        // Ajouter un bouton pour voir les détails des caisses
        if (profile.cases > 0) {
          const detailsButton = document.createElement('span');
          detailsButton.textContent = ' 🔍';
          detailsButton.style.cursor = 'pointer';
          detailsButton.title = 'Voir les détails des caisses';
          detailsButton.onclick = (e) => {
            e.preventDefault();
            showCasesDetails(profile);
          };
          casesCell.appendChild(detailsButton);
        }
      }
      
      row.appendChild(casesCell);
      
      // Heures CS2
      const hoursCell = document.createElement('td');
      hoursCell.style.textAlign = 'center';
      
      if (profile.isPrivate) {
        hoursCell.innerHTML = '<span style="color: #777;">-</span>';
      } else if (profile.cs2Hours && profile.cs2Hours > 0) {
        hoursCell.textContent = `${profile.cs2Hours.toFixed(1)}h`;
        hoursCell.style.color = '#0f0';
        hoursCell.style.fontWeight = 'bold';
      } else {
        hoursCell.textContent = '-';
        hoursCell.style.color = '#666';
      }
      row.appendChild(hoursCell);
      
      // Valeur totale de l'inventaire
      const valueCell = document.createElement('td');
      valueCell.style.textAlign = 'right';
      
      let inventoryValue = 0; // Déclarer la variable en dehors du bloc if
      
      if (profile.isPrivate) {
        valueCell.innerHTML = '<span style="color: #777;">-</span>';
      } else {
        inventoryValue = parseFloat(profile.value || 0);
        valueCell.textContent = `${inventoryValue.toFixed(2)}€`;
        valueCell.style.color = "#f77";
        valueCell.style.fontWeight = inventoryValue > 0 ? "bold" : "normal";
      }
      
      // Debug - afficher la valeur dans la console si elle est 0
      if (!profile.isPrivate && inventoryValue === 0 && profile.cases > 0) {
        console.log(`Attention: Profil ${profile.url} a des caisses mais valeur inventaire = 0`);
      }
      
      row.appendChild(valueCell);
      
      profileTableBody.appendChild(row);
    });
    
    // Si aucun profil à afficher
    if (profilesToShow.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;  // Changé de 3 à 4 pour la nouvelle colonne
      cell.textContent = showAll ? 'Aucun profil trouvé' : 'Aucune caisse trouvée';
      cell.style.textAlign = 'center';
      cell.style.padding = '10px';
      cell.style.color = '#666';
      row.appendChild(cell);
      profileTableBody.appendChild(row);
    }
  }
  
  // Afficher les détails des caisses dans une popup
  function showCasesDetails(profile) {
    // Créer une modal pour les détails
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.9)';
    modal.style.zIndex = '1000';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '20px';
    
    // Entête avec nom du profil
    const header = document.createElement('div');
    header.style.color = '#0f0';
    header.style.fontSize = '16px';
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '15px';
    
    // Créer un en-tête plus détaillé
    const profileName = profile.personaName || profile.url.split('/').pop();
    header.innerHTML = `
      <div style="color: #ff7; font-size: 18px; margin-bottom: 5px;">📦 Caisses de ${profileName}</div>
      <div style="font-size: 14px; color: #f77;">
        Total: ${profile.cases} caisses
        ${profile.expectedCases && profile.expectedCases !== profile.cases ? ` (attendu: ${profile.expectedCases})` : ''}
      </div>
      <div style="font-size: 14px; margin-top: 5px;">
        <span style="color: #ff7;">💰 Valeur des caisses: ${(profile.casesValue || 0).toFixed(2)}€</span>
        <span style="color: #f77; margin-left: 15px;">📊 Inventaire total: ${(profile.value || 0).toFixed(2)}€</span>
      </div>
      ${profile.value > 0 ? `<div style="font-size: 12px; color: #999; margin-top: 5px;">
        Ratio caisses/inventaire: ${((profile.casesValue / profile.value) * 100).toFixed(1)}%
      </div>` : ''}
    `;
    
    modal.appendChild(header);
    
    // Contenu de la modal
    const content = document.createElement('div');
    content.style.backgroundColor = '#001100';
    content.style.border = '1px solid #0a0';
    content.style.padding = '15px';
    content.style.maxHeight = '400px';
    content.style.width = '90%';
    content.style.overflowY = 'auto';
    content.style.boxShadow = '0 0 15px #0f0';
    
    // Tableau des caisses
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.color = '#0f0';
    
    // Entête du tableau
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const iconHeader = document.createElement('th');
    iconHeader.textContent = 'Icône';
    iconHeader.style.textAlign = 'center';
    iconHeader.style.padding = '5px';
    iconHeader.style.width = '50px';
    headerRow.appendChild(iconHeader);
    
    const nameHeader = document.createElement('th');
    nameHeader.textContent = 'Nom de la caisse';
    nameHeader.style.textAlign = 'left';
    nameHeader.style.padding = '5px';
    headerRow.appendChild(nameHeader);
    
    const countHeader = document.createElement('th');
    countHeader.textContent = 'Quantité';
    countHeader.style.textAlign = 'center';
    countHeader.style.padding = '5px';
    headerRow.appendChild(countHeader);
    
    const priceHeader = document.createElement('th');
    priceHeader.textContent = 'Prix unitaire';
    priceHeader.style.textAlign = 'right';
    priceHeader.style.padding = '5px';
    headerRow.appendChild(priceHeader);
    
    const totalHeader = document.createElement('th');
    totalHeader.textContent = 'Valeur totale';
    totalHeader.style.textAlign = 'right';
    totalHeader.style.padding = '5px';
    headerRow.appendChild(totalHeader);
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Corps du tableau
    const tbody = document.createElement('tbody');
    
    if (profile.casesDetails && profile.casesDetails.length > 0) {
      profile.casesDetails.forEach(caseItem => {
        const caseRow = document.createElement('tr');
        
        // Icône de la caisse
        const iconCell = document.createElement('td');
        iconCell.style.padding = '5px';
        iconCell.style.textAlign = 'center';
        iconCell.style.borderBottom = '1px solid #030';
        
        if (caseItem.icon) {
          const img = document.createElement('img');
          img.src = `https://community.cloudflare.steamstatic.com/economy/image/${caseItem.icon}/40fx40f`;
          img.style.width = '40px';
          img.style.height = '40px';
          img.style.border = '1px solid #0a0';
          img.style.borderRadius = '4px';
          iconCell.appendChild(img);
        } else {
          iconCell.textContent = '📦';
        }
        
        caseRow.appendChild(iconCell);
        
        const nameCell = document.createElement('td');
        nameCell.textContent = caseItem.name || 'Caisse CS2';
        nameCell.style.padding = '5px';
        nameCell.style.borderBottom = '1px solid #030';
        caseRow.appendChild(nameCell);
        
        const countCell = document.createElement('td');
        countCell.textContent = caseItem.amount || caseItem.count || 1;
        countCell.style.padding = '5px';
        countCell.style.textAlign = 'center';
        countCell.style.borderBottom = '1px solid #030';
        countCell.style.color = '#ff7';
        countCell.style.fontWeight = 'bold';
        caseRow.appendChild(countCell);
        
        const priceCell = document.createElement('td');
        priceCell.textContent = `${(caseItem.price || 0).toFixed(2)}€`;
        priceCell.style.padding = '5px';
        priceCell.style.textAlign = 'right';
        priceCell.style.borderBottom = '1px solid #030';
        caseRow.appendChild(priceCell);
        
        const totalCell = document.createElement('td');
        totalCell.textContent = `${(caseItem.totalValue || (caseItem.price || 0) * (caseItem.amount || 1)).toFixed(2)}€`;
        totalCell.style.padding = '5px';
        totalCell.style.textAlign = 'right';
        totalCell.style.borderBottom = '1px solid #030';
        totalCell.style.color = '#ff7';
        totalCell.style.fontWeight = 'bold';
        caseRow.appendChild(totalCell);
        
        tbody.appendChild(caseRow);
      });
    } else {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 5; // Changé de 4 à 5 pour inclure la colonne d'icône
      emptyCell.textContent = 'Aucun détail disponible';
      emptyCell.style.padding = '10px';
      emptyCell.style.textAlign = 'center';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }
    
    table.appendChild(tbody);
    content.appendChild(table);
    modal.appendChild(content);
    
    // Bouton pour fermer
    const closeButton = document.createElement('button');
    closeButton.textContent = 'FERMER';
    closeButton.style.backgroundColor = '#002200';
    closeButton.style.color = '#0f0';
    closeButton.style.border = '1px solid #0f0';
    closeButton.style.padding = '8px 15px';
    closeButton.style.margin = '15px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontFamily = 'Courier New';
    closeButton.style.boxShadow = '0 0 5px #0f0';
    closeButton.addEventListener('click', () => document.body.removeChild(modal));
    modal.appendChild(closeButton);
    
    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
      if (e.target === modal) document.body.removeChild(modal);
    });
    
    document.body.appendChild(modal);
  }
  
  function clearProfileTable() {
    profileTableBody.innerHTML = '';
  }
  
  // Mettre à jour le compteur de profils et de caisses
  function updateCount() {
    chrome.storage.local.get('allProfiles', (data) => {
      const all = data.allProfiles || [];
      
      // Calculer le nombre total de caisses et leur valeur
      let casesCount = 0;
      let totalCasesValue = 0;
      let totalAllInventoryValue = 0; // Valeur de TOUS les inventaires
      let profilesWithCases = 0;
      let totalProfiles = 0;
      
      all.forEach(profile => {
        // Compter tous les profils et leur valeur totale
        totalProfiles++;
        
        // Ne pas inclure la valeur des inventaires privés
        if (!profile.isPrivate) {
          totalAllInventoryValue += profile.value || 0;
        }
        
        // Compter spécifiquement ceux avec des caisses
        if (!profile.isPrivate && profile.cases > 0) {
          profilesWithCases++;
          casesCount += profile.cases || 0;
          totalCasesValue += profile.casesValue || 0;
        }
      });
      
      // Toujours afficher la valeur totale des inventaires si on a scanné des profils
      if (totalProfiles > 0) {
        allCount.style.display = 'block';
        allCount.innerHTML = `<span style="color: #f77;">💰 Valeur totale de ${totalProfiles} inventaires: ${totalAllInventoryValue.toFixed(2)}€</span>`;
      } else {
        allCount.style.display = 'none';
      }
      
      // Afficher les caisses
      if (casesCount === 0) {
        totalCases.innerHTML = `<span style="color: #666;">EN ATTENTE DE DÉTECTION...</span>`;
      } else {
        totalCases.innerHTML = `<span style="color: #ff7; font-size: 16px; font-weight: bold;">🎯 ${casesCount} CAISSES CS2</span> <span style="color: #ff7; font-size: 14px;">(${totalCasesValue.toFixed(2)}€)</span>`;
      }
      
      // Mettre à jour le tableau des profils
      updateProfileTable(all, showAllCheckbox.checked);
    });
  }
  
  // Écouter les changements de stockage
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.allProfiles) {
      updateCount();
    }
  });
  
  // Écouter les mises à jour de progression
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "progress") {
      const percent = Math.round((message.current / message.total) * 100);
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${message.current}/${message.total} (${percent}%)`;
      
      if (message.current === message.total) {
        progressText.textContent = "Terminé !";
      }
    }
    else if (message.action === "log") {
      addLog(message.text, message.timestamp);
      
      // Mettre à jour le compteur de cycles si nécessaire
      if (message.text.includes("Cycle #")) {
        const match = message.text.match(/Cycle #(\d+)/);
        if (match) {
          cycleCount.textContent = match[1];
          loopStatus.style.display = 'block';
        }
      }
    }
    else if (message.action === "profile_updated") {
      // Mise à jour en temps réel du tableau quand un nouveau profil est analysé
      updateCount();
    }
    else if (message.action === "loop_status") {
      // Mise à jour du statut de boucle
      if (message.cycles > 0) {
        cycleCount.textContent = message.cycles;
        loopStatus.style.display = 'block';
      } else {
        loopStatus.style.display = 'none';
      }
    }
    else if (message.action === "keep_scanning") {
      // Garder le bouton sur "ARRÊTER" en mode boucle
      toggleButton.textContent = 'ARRÊTER LE SCAN';
      cycleCount.textContent = message.loopCycles;
      loopStatus.style.display = 'block';
    }
  });
  
  // Bouton d'export
  exportButton.addEventListener('click', () => {
    chrome.storage.local.get('allProfiles', (data) => {
      const profiles = data.allProfiles || [];
      
      // Filtrer pour ne garder que les profils avec des caisses (excluant les privés)
      const profilesWithCases = profiles.filter(p => !p.isPrivate && p.cases > 0);
      
      if (profilesWithCases.length === 0) {
        alert("Aucune caisse trouvée à exporter !");
        return;
      }
      
      // Export avec toutes les informations pertinentes
      let csv = 'Pseudo,URL Profil,Heures CS2,Nombre Caisses,Valeur Caisses,Valeur Inventaire,Ratio,Statut,Détails des Caisses\n';
      profilesWithCases.forEach(profile => {
        const casesDetails = profile.casesDetails ? 
          profile.casesDetails.map(item => `${item.name}(x${item.amount} @ ${(item.price || 0).toFixed(2)}€)`).join('; ') : '';
        
        const ratio = profile.value > 0 ? ((profile.casesValue / profile.value) * 100).toFixed(1) : '0';
        const cs2Hours = profile.cs2Hours || 0;
        const status = profile.isPrivate ? 'Privé' : 'Public';
        const displayName = profile.personaName || profile.url.split('/').pop();
        
        csv += `"${displayName}","${profile.url}",${cs2Hours.toFixed(1)}h,${profile.cases},${(profile.casesValue || 0).toFixed(2)}€,${(profile.value || 0).toFixed(2)}€,${ratio}%,${status},"${casesDetails}"\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `caisses_cs2_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addLog(`📄 Export de ${profilesWithCases.length} profils avec caisses`);
    });
    addTechLog(`Clic sur le bouton : ${exportButton.id}`);
  });
  
  // Bouton de réinitialisation
  resetButton.addEventListener('click', () => {
    if (confirm("Effacer toutes les données de scan ?")) {
      chrome.runtime.sendMessage({ action: "resetData" });
      clearProfileTable();
      clearConsole();
      updateCount();
      progressBar.style.width = `0%`;
      progressText.textContent = "EN ATTENTE...";
      
      // Réinitialiser l'affichage
      totalCases.innerHTML = `<span style="color: #666;">EN ATTENTE DE DÉTECTION...</span>`;
      allCount.style.display = 'none';
      allCount.innerHTML = '';
    }
    addTechLog(`Clic sur le bouton : ${resetButton.id}`);
  });
  
  // Bouton de debug
  debugButton.addEventListener('click', () => {
    chrome.storage.local.get('allProfiles', (data) => {
      const profiles = data.allProfiles || [];
      console.log('DEBUG - Données stockées:', profiles);
      
      if (profiles.length === 0) {
        addLog("❌ Aucune donnée trouvée dans le stockage");
        
        // Créer des données d'exemple pour tester
        const exampleProfiles = [
          {
            url: "https://steamcommunity.com/id/example1",
            steamID: "12345",
            personaName: "PlayerOne",
            value: 150.50,
            cases: 5,
            casesValue: 25.75,
            cs2Hours: 1250.5,
            casesDetails: [
              { name: "Horizon Case", amount: 3, price: 5.25, totalValue: 15.75, icon: "icon1" },
              { name: "Prisma Case", amount: 2, price: 5.00, totalValue: 10.00, icon: "icon2" }
            ],
            expectedCases: 5,
            isPrivate: false
          },
          {
            url: "https://steamcommunity.com/id/example2",
            steamID: "67890",
            personaName: "ProGamer2023",
            value: 320.00,
            cases: 8,
            casesValue: 48.50,
            cs2Hours: 876.3,
            casesDetails: [
              { name: "Danger Zone Case", amount: 4, price: 8.00, totalValue: 32.00, icon: "icon3" },
              { name: "Spectrum 2 Case", amount: 4, price: 4.125, totalValue: 16.50, icon: "icon4" }
            ],
            expectedCases: 10,
            isPrivate: false
          },
          {
            url: "https://steamcommunity.com/id/example3",
            steamID: "11111",
            personaName: "CS2Master",
            value: 850.25,
            cases: 15,
            casesValue: 125.50,
            cs2Hours: 2430.8,
            casesDetails: [
              { name: "Fracture Case", amount: 10, price: 10.00, totalValue: 100.00, icon: "icon5" },
              { name: "Clutch Case", amount: 5, price: 5.10, totalValue: 25.50, icon: "icon6" }
            ],
            expectedCases: 15,
            isPrivate: false
          },
          {
            url: "https://steamcommunity.com/id/privateplayer",
            steamID: "99999",
            personaName: "SecretPlayer",
            value: 0,
            cases: 0,
            casesValue: 0,
            cs2Hours: 543.2,
            casesDetails: [],
            expectedCases: 0,
            isPrivate: true
          }
        ];
        
        // Demander à l'utilisateur s'il veut charger des données d'exemple
        if (confirm("Aucune donnée trouvée. Voulez-vous charger des données d'exemple pour tester ?")) {
          chrome.storage.local.set({ allProfiles: exampleProfiles }, () => {
            addLog("✅ Données d'exemple chargées");
            updateProfileTable(exampleProfiles, showAllCheckbox.checked);
            updateCount();
          });
        }
      } else {
        addLog(`📊 ${profiles.length} profils trouvés dans le stockage`);
        
        const profilesWithCases = profiles.filter(p => p.cases > 0);
        addLog(`✅ ${profilesWithCases.length} profils avec des caisses`);
        
        // Afficher quelques exemples
        profilesWithCases.slice(0, 3).forEach((profile, idx) => {
          const displayName = profile.personaName || profile.url.split('/').pop();
          addLog(`  ${idx + 1}. ${displayName}: ${profile.cases} caisses (${profile.casesValue}€)`);
        });
        
        // Forcer la mise à jour du tableau
        updateProfileTable(profiles, showAllCheckbox.checked);
        updateCount();
      }
    });
    addTechLog(`Clic sur le bouton : ${debugButton.id}`);
  });
  
  // Ajouter un message à la console
  function addLog(message, timestamp = new Date().toLocaleTimeString()) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
    consoleOutput.appendChild(logEntry);
    
    // Effet Matrix
    logEntry.style.opacity = '0';
    setTimeout(() => {
      logEntry.style.opacity = '1';
      logEntry.style.textShadow = '0 0 5px #00ff00';
    }, 10);
    
    setTimeout(() => {
      logEntry.style.textShadow = 'none';
    }, 500);
    
    // Défilement automatique
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }
  
  // Effacer la console
  function clearConsole() {
    consoleOutput.innerHTML = '';
  }
  
  // Initialiser le compteur
  updateCount();
  
  // Forcer le chargement des données existantes au démarrage
  chrome.storage.local.get('allProfiles', (data) => {
    const profiles = data.allProfiles || [];
    if (profiles.length > 0) {
      const profilesWithCases = profiles.filter(p => p.cases > 0);
      if (profilesWithCases.length > 0) {
        updateProfileTable(profiles, showAllCheckbox.checked);
        addLog(`📦 ${profilesWithCases.length} profils avec caisses trouvés dans les données sauvegardées`);
      } else if (profiles.length > 0) {
        // S'il y a des profils mais pas de caisses, les afficher quand même
        updateProfileTable(profiles, true);
        showAllCheckbox.checked = true;
        addLog(`📊 ${profiles.length} profils trouvés (aucune caisse détectée)`);
      }
    } else {
      // Message de bienvenue si aucune donnée
      addLog("👋 Bienvenue ! Pour commencer:");
      addLog("1️⃣ Allez sur votre liste d'amis Steam");
      addLog("2️⃣ Cliquez sur 'DÉMARRER LE SCAN'");
      addLog("💡 URL: steamcommunity.com/id/VOTRE_ID/friends/");
      addLog("📌 Le scanner va charger TOUS vos amis automatiquement");
    }
  });

  function showSkipButton() {
    skipButton.style.display = 'block';
    skipButton.disabled = false;
    skipButton.style.opacity = '1';
    if (skipHelp) skipHelp.style.display = 'block';
  }
  function hideSkipButton() {
    skipButton.style.display = 'none';
    skipButton.disabled = false;
    skipButton.style.opacity = '1';
    if (skipHelp) skipHelp.style.display = 'none';
  }

  function addTechLog(message) {
    if (!consoleTechOutput) return;
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${message}\n`;
    consoleTechOutput.textContent += entry;
    consoleTechOutput.scrollTop = consoleTechOutput.scrollHeight;
  }

  // Rediriger tous les console.log/debug/warn/error vers la console technique
  ['log', 'debug', 'warn', 'error'].forEach(type => {
    const orig = console[type];
    console[type] = function(...args) {
      addTechLog(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
      orig.apply(console, args);
    };
  });

  // Log tous les clics sur les boutons principaux
  ['toggleButton', 'skipButton', 'exportButton', 'resetButton', 'debugButton'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', (e) => {
        addTechLog(`Clic sur le bouton : ${id}`);
      });
    }
  });

  // Log les changements de slider
  if (delaySlider) {
    delaySlider.addEventListener('input', () => {
      addTechLog(`Changement du slider délai : ${delaySlider.value} ms`);
    });
  }

  // Log les changements de checkbox
  ['showAllProfiles', 'loopMode'].forEach(id => {
    const cb = document.getElementById(id);
    if (cb) {
      cb.addEventListener('change', () => {
        addTechLog(`Changement de l'option : ${id} => ${cb.checked}`);
      });
    }
  });

  // Bouton d'export de l'onglet Historique
  exportHistoryBtn.addEventListener('click', () => {
    if (!allHistoryProfiles.length) return;
    const headers = ['Profil', 'Pseudo', 'Caisses', 'Heures CS2', 'Valeur', 'Inventaire privé'];
    const rows = allHistoryProfiles.map(p => [
      p.url || '',
      p.personaName || '',
      p.cases || 0,
      p.cs2Hours || 0,
      p.value || 0,
      p.isPrivate ? 'Oui' : 'Non'
    ]);
    let csv = headers.join(',') + '\n';
    csv += rows.map(r => '"' + r.join('","') + '"').join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const filename = `profils_scannes_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}.csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  });

  // Gestion du bouton d'import CSV
  const importCsvBtn = document.getElementById('importCsvBtn');
  const importCsvInput = document.getElementById('importCsvInput');
  if (importCsvBtn && importCsvInput) {
    importCsvBtn.addEventListener('click', () => {
      importCsvInput.value = '';
      importCsvInput.click();
      addTechLog('Clic sur le bouton : importCsvBtn (ouverture de la fenêtre de sélection CSV)');
    });
  }
});