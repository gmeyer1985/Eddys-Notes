// Fishing Entry Management Functions

var fishingData = [];
var currentEditIndex = -1;

function showAddModal() {
    currentEditIndex = -1;
    var modalTitle = document.getElementById('modalTitle');
    var fishingForm = document.getElementById('fishingForm');
    var entryModal = document.getElementById('entryModal');
    
    if (modalTitle) modalTitle.textContent = 'Add New Fishing Entry';
    if (fishingForm) fishingForm.reset();
    if (entryModal) entryModal.style.display = 'block';
    
    // Initialize map after modal is shown
    setTimeout(function() {
        initializeFishingLocationMap();
    }, 100);
}

function editEntry(index) {
    currentEditIndex = index;
    var entry = fishingData[index];
    
    var modalTitle = document.getElementById('modalTitle');
    var entryModal = document.getElementById('entryModal');
    
    if (modalTitle) modalTitle.textContent = 'Edit Fishing Entry';
    
    var entryDate = document.getElementById('entryDate');
    var cityState = document.getElementById('cityState');
    var selectedLat = document.getElementById('selectedLat');
    var selectedLon = document.getElementById('selectedLon');
    var startTime = document.getElementById('startTime');
    var endTime = document.getElementById('endTime');
    var waterTemp = document.getElementById('waterTemp');
    var waterFlow = document.getElementById('waterFlow');
    var targetSpecies = document.getElementById('targetSpecies');
    var angler = document.getElementById('angler');
    var fliesUsed = document.getElementById('fliesUsed');
    var notes = document.getElementById('notes');
    
    if (entryDate) entryDate.value = entry.date || '';
    if (cityState) cityState.value = entry.cityState || '';
    if (selectedLat) selectedLat.value = entry.selectedLat || '';
    if (selectedLon) selectedLon.value = entry.selectedLon || '';
    if (startTime) startTime.value = entry.startTime || '';
    if (endTime) endTime.value = entry.endTime || '';
    if (waterTemp) waterTemp.value = entry.waterTemp || '';
    if (waterFlow) waterFlow.value = entry.waterFlow || '';
    if (targetSpecies) targetSpecies.value = entry.targetSpecies || '';
    if (angler) angler.value = entry.angler || '';
    if (fliesUsed) fliesUsed.value = entry.fliesUsed || '';
    if (notes) notes.value = entry.notes || '';
    
    // Set river search fields
    var riverSearch = document.getElementById('riverSearch');
    var selectedSiteNumber = document.getElementById('selectedSiteNumber');
    if (riverSearch) riverSearch.value = entry.riverName || '';
    if (selectedSiteNumber) selectedSiteNumber.value = entry.siteNumber || '';
    
    // Set location fields
    var fishingLat = document.getElementById('fishingLat');
    var fishingLon = document.getElementById('fishingLon');
    var fishingAddress = document.getElementById('fishingAddress');
    if (fishingLat) fishingLat.value = entry.fishingLat || '';
    if (fishingLon) fishingLon.value = entry.fishingLon || '';
    if (fishingAddress) fishingAddress.value = entry.fishingAddress || '';
    
    if (entryModal) entryModal.style.display = 'block';
    
    // Initialize map and set existing location
    setTimeout(function() {
        initializeFishingLocationMap();
        if (entry.fishingLat && entry.fishingLon) {
            var lat = parseFloat(entry.fishingLat);
            var lon = parseFloat(entry.fishingLon);
            fishingLocationMap.setView([lat, lon], 15);
            dropFishingPin(lat, lon);
            if (entry.fishingAddress) {
                currentMarker.setPopupContent('Fishing Location<br>' + entry.fishingAddress);
            }
        }
    }, 100);
}

async function deleteEntry(index) {
    if (confirm('Are you sure you want to delete this entry?')) {
        try {
            await deleteFishingEntry(index);
            await loadData(); // Reload data from database
            renderTable();
            updateFilterOptions();
            showStatusMessage('Entry deleted successfully!', 'success');
        } catch (error) {
            showStatusMessage('Error deleting entry: ' + error.message, 'error');
            console.error('Delete error:', error);
        }
    }
}

function closeModal() {
    var entryModal = document.getElementById('entryModal');
    if (entryModal) entryModal.style.display = 'none';
    hideStatusMessage();
}

function saveEntry() {
    var form = document.getElementById('fishingForm');
    if (!form || !form.checkValidity()) {
        showStatusMessage('Please fill in all required fields.', 'error');
        return;
    }

    showStatusMessage('Fetching weather data...', 'success');
    
    var cityState = document.getElementById('cityState').value;
    var lat = document.getElementById('selectedLat').value;
    var lon = document.getElementById('selectedLon').value;
    var date = document.getElementById('entryDate').value;
    
    // Use coordinates if available, otherwise fallback
    if (lat && lon) {
        getWeatherData(lat, lon, date, cityState).then(function(weatherData) {
            showStatusMessage('Weather data received, saving entry...', 'success');
            var moonPhase = getMoonPhase(date);
            var moonPhaseString = moonPhase.emoji + ' ' + moonPhase.name + ' (' + moonPhase.illumination + ')';
            saveEntryWithData(weatherData, moonPhaseString, cityState, date);
        }).catch(function(error) {
            showStatusMessage('Weather API failed, using simulated data...', 'error');
            console.error('Weather API error:', error);
            // Continue with simulated data
            var moonPhase = getMoonPhase(date);
            var moonPhaseString = moonPhase.emoji + ' ' + moonPhase.name + ' (' + moonPhase.illumination + ')';
            getSimulatedWeatherData(lat, lon, date, cityState).then(function(simulatedWeather) {
                saveEntryWithData(simulatedWeather, moonPhaseString, cityState, date);
            });
        });
    } else {
        showStatusMessage('Please select a city from the dropdown first.', 'error');
        return;
    }
}

async function saveEntryWithData(weatherData, moonPhase, cityState, date) {
    console.log('Starting saveEntryWithData with weather data:', weatherData);
    
    var entry = {
        date: date,
        cityState: cityState,
        latitude: document.getElementById('fishingLat').value || document.getElementById('selectedLat').value,
        longitude: document.getElementById('fishingLon').value || document.getElementById('selectedLon').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        weatherTemp: weatherData.airTemp,
        barometricPressure: weatherData.barometricPressure,
        windSpeed: weatherData.windSpeed,
        windDirection: weatherData.windDirection,
        moonPhase: moonPhase,
        riverName: document.getElementById('riverSearch').value,
        siteNumber: document.getElementById('selectedSiteNumber').value,
        waterFlow: document.getElementById('waterFlow').value,
        notes: document.getElementById('notes').value,
        species: document.getElementById('targetSpecies').value,
        angler: document.getElementById('angler').value,
        fliesUsed: document.getElementById('fliesUsed').value,
        photoData: null  // No photo field in current form
    };

    console.log('Entry data prepared:', entry);

    try {
        if (currentEditIndex >= 0) {
            // For now, we'll treat updates as new entries since we need to implement update API
            showStatusMessage('Updating existing entries not yet supported. Creating new entry.', 'error');
        }
        
        console.log('Calling saveFishingEntry...');
        await saveFishingEntry(entry);
        console.log('saveFishingEntry completed, loading data...');
        
        await loadData(); // Reload data from database
        console.log('Data loaded, rendering table...');
        
        renderTable();
        updateFilterOptions();
        closeModal();
        showStatusMessage('Entry saved successfully!', 'success');
        console.log('Entry save process completed successfully');
    } catch (error) {
        showStatusMessage('Error saving entry: ' + error.message, 'error');
        console.error('Save error:', error);
    }
}

function showStatusMessage(message, type) {
    var statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'status-message status-' + type;
        statusDiv.style.display = 'block';
    }
}

function hideStatusMessage() {
    var statusDiv = document.getElementById('statusMessage');
    if (statusDiv) statusDiv.style.display = 'none';
}

function renderTable() {
    var tbody = document.getElementById('fishingTableBody');
    var mobileContainer = document.getElementById('mobileEntriesContainer');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (mobileContainer) {
        mobileContainer.innerHTML = '';
    }

    for (var i = 0; i < fishingData.length; i++) {
        var entry = fishingData[i];
        var row = document.createElement('tr');
        
        var timeOnWater = entry.startTime && entry.endTime ? entry.startTime + ' - ' + entry.endTime : 'Not specified';
        // Format wind data
        var windInfo = 'N/A';
        if (entry.windSpeed && entry.windDirection) {
            windInfo = entry.windDirection + ' ' + entry.windSpeed + ' mph';
        } else if (entry.windSpeed) {
            windInfo = entry.windSpeed + ' mph';
        } else if (entry.windDirection) {
            windInfo = entry.windDirection;
        }
        // Handle moon phase - it could be an object or string
        var moonTitle = 'Unknown';
        var moonEmoji = '🌙';
        
        // Debug: log the moonPhase data
        console.log('Moon phase data for entry', entry.id, ':', entry.moonPhase, 'Type:', typeof entry.moonPhase);
        
        if (entry.moonPhase) {
            if (typeof entry.moonPhase === 'object' && entry.moonPhase !== null) {
                // If it's an object with emoji property
                moonEmoji = entry.moonPhase.emoji || '🌙';
                moonTitle = (entry.moonPhase.name || 'Unknown') + ' (' + (entry.moonPhase.illumination || '0%') + ')';
            } else if (typeof entry.moonPhase === 'string') {
                // Try to parse if it's a JSON string
                try {
                    var parsedPhase = JSON.parse(entry.moonPhase);
                    if (parsedPhase.emoji) {
                        moonEmoji = parsedPhase.emoji;
                        moonTitle = (parsedPhase.name || 'Unknown') + ' (' + (parsedPhase.illumination || '0%') + ')';
                    } else {
                        // If it's a regular string, extract first part as emoji
                        moonEmoji = entry.moonPhase.split(' ')[0];
                        moonTitle = entry.moonPhase;
                    }
                } catch (e) {
                    // If parsing fails, treat as regular string
                    moonEmoji = entry.moonPhase.split(' ')[0];
                    moonTitle = entry.moonPhase;
                }
            }
        } else {
            console.log('No moon phase data for entry:', entry.id);
        }

        // Format location display - show city/state primarily
        var locationDisplay = 'Not set';
        if (entry.cityState) {
            locationDisplay = entry.cityState;
        } else if (entry.fishingAddress) {
            // Shorten address for table display
            var shortAddress = entry.fishingAddress.split(',')[0];
            locationDisplay = '<span title="' + entry.fishingAddress + '">' + shortAddress + '</span>';
        } else if (entry.latitude && entry.longitude) {
            locationDisplay = entry.latitude + ', ' + entry.longitude;
        }

        // Format CFS display with graph icon
        var cfsDisplay = (entry.waterFlow || 'N/A');
        if (entry.siteNumber && entry.riverName && entry.date) {
            cfsDisplay += ' <button type="button" onclick="showTableFlowGraph(' + i + ')" style="background: #3498db; border: none; border-radius: 3px; padding: 4px; cursor: pointer; margin-left: 5px;" title="Show Flow Graph">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="white">' +
                '<path d="M3,13H5V19H3V13M7,9H9V19H7V9M11,5H13V19H11V5M15,9H17V19H15V9M19,13H21V19H19V13Z"/>' +
                '</svg>' +
                '</button>';
        }
        
        row.innerHTML = '<td>' + (entry.cityState || entry.zipcode || 'N/A') + '</td>' +
            '<td>' + new Date(entry.date).toLocaleDateString() + '</td>' +
            '<td>' + timeOnWater + '</td>' +
            '<td>' + locationDisplay + '</td>' +
            '<td>' + (entry.weatherTemp || 'N/A') + '</td>' +
            '<td>' + (entry.barometricPressure || 'N/A') + '</td>' +
            '<td>' + (entry.waterTemp || 'N/A') + '</td>' +
            '<td class="moon-phase" title="' + moonTitle + '">' + moonEmoji + '</td>' +
            '<td>' + (entry.riverName || 'Not specified') + '</td>' +
            '<td>' + cfsDisplay + '</td>' +
            '<td>' + windInfo + '</td>' +
            '<td>' + (entry.notes || 'No notes') + '</td>' +
            '<td>' + (entry.fliesUsed || 'Not specified') + '</td>' +
            '<td>' + (entry.targetSpecies || 'Not specified') + '</td>' +
            '<td>' + (entry.angler || 'Unknown') + '</td>' +
            '<td class="actions-cell">' +
            '<button class="icon-btn icon-btn-edit" onclick="editEntry(' + i + ')" title="Edit Entry">' +
            '<i data-lucide="edit-3"></i>' +
            '</button>' +
            '<button class="icon-btn icon-btn-delete" onclick="deleteEntry(' + i + ')" title="Delete Entry">' +
            '<i data-lucide="trash-2"></i>' +
            '</button>' +
            '</td>';
        
        tbody.appendChild(row);
        
        // Create mobile card
        if (mobileContainer) {
            var card = document.createElement('div');
            card.className = 'mobile-entry-card';
            
            card.innerHTML = 
                '<div class="card-header">' +
                    '<h3>' + (entry.cityState || entry.zipcode || 'Unknown Location') + '</h3>' +
                    '<span class="date">' + new Date(entry.date).toLocaleDateString() + '</span>' +
                '</div>' +
                '<div class="card-body">' +
                    '<div class="card-section">' +
                        '<div class="card-row">' +
                            '<span class="label">Time:</span>' +
                            '<span class="value">' + timeOnWater + '</span>' +
                        '</div>' +
                        '<div class="card-row">' +
                            '<span class="label">Location:</span>' +
                            '<span class="value">' + locationDisplay + '</span>' +
                        '</div>' +
                        '<div class="card-row">' +
                            '<span class="label">River/Stream:</span>' +
                            '<span class="value">' + (entry.riverName || 'Not specified') + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="card-section">' +
                        '<div class="card-row">' +
                            '<span class="label">Air Temp:</span>' +
                            '<span class="value">' + (entry.weatherTemp || 'N/A') + '°F</span>' +
                        '</div>' +
                        '<div class="card-row">' +
                            '<span class="label">Water Temp:</span>' +
                            '<span class="value">' + (entry.waterTemp || 'N/A') + '°F</span>' +
                        '</div>' +
                        '<div class="card-row">' +
                            '<span class="label">Pressure:</span>' +
                            '<span class="value">' + (entry.barometricPressure || 'N/A') + ' inHg</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="card-section">' +
                        '<div class="card-row">' +
                            '<span class="label">Moon Phase:</span>' +
                            '<span class="value moon-phase" title="' + moonTitle + '">' + moonEmoji + '</span>' +
                        '</div>' +
                        '<div class="card-row">' +
                            '<span class="label">Flow:</span>' +
                            '<span class="value">' + (entry.waterFlow || 'N/A') + ' CFS' + 
                            (entry.siteNumber && entry.riverName && entry.date ? 
                                ' <button type="button" onclick="showTableFlowGraph(' + i + ')" style="background: #3498db; border: none; border-radius: 4px; padding: 6px 8px; cursor: pointer; margin-left: 8px; color: white; font-size: 12px;" title="Show Flow Graph">' +
                                '<svg width="12" height="12" viewBox="0 0 24 24" fill="white">' +
                                '<path d="M3,13H5V19H3V13M7,9H9V19H7V9M11,5H13V19H11V5M15,9H17V19H15V9M19,13H21V19H19V13Z"/>' +
                                '</svg> Graph' +
                                '</button>' : '') + '</span>' +
                        '</div>' +
                        '<div class="card-row">' +
                            '<span class="label">Wind:</span>' +
                            '<span class="value">' + windInfo + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="card-section">' +
                        '<div class="card-row">' +
                            '<span class="label">Target Species:</span>' +
                            '<span class="value">' + (entry.targetSpecies || 'Not specified') + '</span>' +
                        '</div>' +
                        '<div class="card-row">' +
                            '<span class="label">Flies Used:</span>' +
                            '<span class="value">' + (entry.fliesUsed || 'Not specified') + '</span>' +
                        '</div>' +
                        '<div class="card-row">' +
                            '<span class="label">Angler:</span>' +
                            '<span class="value">' + (entry.angler || 'Unknown') + '</span>' +
                        '</div>' +
                    '</div>' +
                    (entry.notes ? '<div class="card-section"><div class="notes"><span class="label">Notes:</span><p>' + entry.notes + '</p></div></div>' : '') +
                '</div>' +
                '<div class="card-actions">' +
                    '<button class="icon-btn icon-btn-edit" onclick="editEntry(' + i + ')" title="Edit Entry">' +
                    '<i data-lucide="edit-3"></i>' +
                    '</button>' +
                    '<button class="icon-btn icon-btn-delete" onclick="deleteEntry(' + i + ')" title="Delete Entry">' +
                    '<i data-lucide="trash-2"></i>' +
                    '</button>' +
                '</div>';
                
            mobileContainer.appendChild(card);
        }
    }
    
    // Initialize Lucide icons after table is populated
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function updateFilterOptions() {
    var anglerSelect = document.getElementById('filterAngler');
    var speciesSelect = document.getElementById('filterSpecies');
    
    if (!anglerSelect || !speciesSelect) return;
    
    anglerSelect.innerHTML = '<option value="">All Anglers</option>';
    speciesSelect.innerHTML = '<option value="">All Species</option>';
    
    var anglers = [];
    var species = [];
    
    for (var i = 0; i < fishingData.length; i++) {
        if (fishingData[i].angler && anglers.indexOf(fishingData[i].angler) === -1) {
            anglers.push(fishingData[i].angler);
        }
        if (fishingData[i].targetSpecies && species.indexOf(fishingData[i].targetSpecies) === -1) {
            species.push(fishingData[i].targetSpecies);
        }
    }
    
    for (var j = 0; j < anglers.length; j++) {
        var option = document.createElement('option');
        option.value = anglers[j];
        option.textContent = anglers[j];
        anglerSelect.appendChild(option);
    }
    
    for (var k = 0; k < species.length; k++) {
        var option = document.createElement('option');
        option.value = species[k];
        option.textContent = species[k];
        speciesSelect.appendChild(option);
    }
}

function clearFilters() {
    var filterDate = document.getElementById('filterDate');
    var filterAngler = document.getElementById('filterAngler');
    var filterSpecies = document.getElementById('filterSpecies');
    var searchNotes = document.getElementById('searchNotes');
    
    if (filterDate) filterDate.value = '';
    if (filterAngler) filterAngler.value = '';
    if (filterSpecies) filterSpecies.value = '';
    if (searchNotes) searchNotes.value = '';
    
    applyFilters();
}

function applyFilters() {
    var dateFilter = document.getElementById('filterDate');
    var anglerFilter = document.getElementById('filterAngler');
    var speciesFilter = document.getElementById('filterSpecies');
    var notesFilter = document.getElementById('searchNotes');
    
    var dateValue = dateFilter ? dateFilter.value : '';
    var anglerValue = anglerFilter ? anglerFilter.value : '';
    var speciesValue = speciesFilter ? speciesFilter.value : '';
    var notesValue = notesFilter ? notesFilter.value.toLowerCase() : '';
    
    var rows = document.querySelectorAll('#fishingTableBody tr');
    
    for (var i = 0; i < rows.length; i++) {
        var entry = fishingData[i];
        if (!entry) continue;
        
        var show = true;
        
        if (dateValue && entry.date !== dateValue) show = false;
        if (anglerValue && entry.angler !== anglerValue) show = false;
        if (speciesValue && entry.targetSpecies !== speciesValue) show = false;
        if (notesValue && (!entry.notes || entry.notes.toLowerCase().indexOf(notesValue) === -1)) show = false;
        
        rows[i].style.display = show ? '' : 'none';
    }
}

// Menu Action Functions
function exportData() {
    var dataStr = JSON.stringify(fishingData, null, 2);
    var dataBlob = new Blob([dataStr], {type: 'application/json'});
    var url = URL.createObjectURL(dataBlob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'fishing-log-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importData() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var importedData = JSON.parse(e.target.result);
                    if (Array.isArray(importedData)) {
                        if (confirm('This will replace all existing data. Continue?')) {
                            fishingData = importedData;
                            saveToLocalStorage();
                            renderTable();
                            updateFilterOptions();
                            alert('Data imported successfully!');
                        }
                    } else {
                        alert('Invalid file format. Please select a valid fishing log JSON file.');
                    }
                } catch (error) {
                    alert('Error reading file. Please ensure it\'s a valid JSON file.');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function showAbout() {
    alert('Fishing Log v2.0\n\nA comprehensive fishing log application with:\n• USGS stream flow data integration\n• Interactive mapping with location pins\n• Weather data and moon phase tracking\n• Export/import functionality\n• Flow rate graphing\n\nBuilt with modern web technologies for serious anglers.');
}