// Mapping and Location Functions

var fishingLocationMap;
var currentMarker;
var citySearchTimeout;

function initializeFishingLocationMap() {
    if (fishingLocationMap) {
        fishingLocationMap.remove();
    }
    
    // Default to Minnesota center (can be changed based on zipcode)
    var defaultLat = 44.9537;
    var defaultLon = -93.0900;
    
    // Initialize the map
    fishingLocationMap = L.map('fishingLocationMap').setView([defaultLat, defaultLon], 10);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(fishingLocationMap);
    
    // Add click event to drop pin
    fishingLocationMap.on('click', function(e) {
        dropFishingPin(e.latlng.lat, e.latlng.lng);
    });
}

function dropFishingPin(lat, lon) {
    // Remove existing marker if any
    if (currentMarker) {
        fishingLocationMap.removeLayer(currentMarker);
    }

    // Add new marker
    currentMarker = L.marker([lat, lon]).addTo(fishingLocationMap);

    // Save coordinates to hidden fields
    document.getElementById('fishingLat').value = lat.toFixed(6);
    document.getElementById('fishingLon').value = lon.toFixed(6);

    // Get address from coordinates (reverse geocoding)
    reverseGeocode(lat, lon);

    // Add popup with coordinates
    currentMarker.bindPopup('Fishing Location<br>Lat: ' + lat.toFixed(6) + '<br>Lon: ' + lon.toFixed(6)).openPopup();

    // Populate environmental data with new coordinates
    if (typeof populateEnvironmentalData === 'function') {
        populateEnvironmentalData();
    }
}

function reverseGeocode(lat, lon) {
    // Use OpenStreetMap Nominatim for reverse geocoding (free)
    var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&zoom=18&addressdetails=1';
    
    fetch(url)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data && data.display_name) {
                document.getElementById('fishingAddress').value = data.display_name;
                // Update popup with address
                if (currentMarker) {
                    currentMarker.setPopupContent('Fishing Location<br>' + data.display_name);
                }
            }
        })
        .catch(function(error) {
            console.log('Reverse geocoding error:', error);
        });
}

function centerMapOnLocation(lat, lon) {
    if (!fishingLocationMap) return;
    fishingLocationMap.setView([lat, lon], 12);
}

// City/State Search Functions
function searchCityState() {
    var searchTerm = document.getElementById('cityState').value.trim();
    var resultsDiv = document.getElementById('cityStateResults');
    
    if (searchTerm.length < 3) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    // Debounce search
    clearTimeout(citySearchTimeout);
    citySearchTimeout = setTimeout(function() {
        performCityStateSearch(searchTerm);
    }, 500);
}

function performCityStateSearch(searchTerm) {
    var resultsDiv = document.getElementById('cityStateResults');
    resultsDiv.innerHTML = '<div style="padding: 10px; color: rgba(255, 255, 255, 0.7);">Searching...</div>';
    resultsDiv.style.display = 'block';
    
    // Use OpenStreetMap Nominatim for city search
    var url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&countrycodes=us&q=' + encodeURIComponent(searchTerm);
    
    fetch(url)
        .then(function(response) {
            if (!response.ok) throw new Error('City search failed');
            return response.json();
        })
        .then(function(data) {
            if (data && data.length > 0) {
                displayCityStateResults(data);
            } else {
                resultsDiv.innerHTML = '<div style="padding: 10px; color: #666;">No cities found matching "' + searchTerm + '"</div>';
            }
        })
        .catch(function(error) {
            console.error('City search error:', error);
            resultsDiv.innerHTML = '<div style="padding: 10px; color: #e74c3c;">Error searching cities. Please try again.</div>';
        });
}

function displayCityStateResults(results) {
    var resultsDiv = document.getElementById('cityStateResults');
    
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 10px; color: rgba(255, 255, 255, 0.6);">No cities found</div>';
        return;
    }
    
    var html = '';
    results.forEach(function(result) {
        var displayName = result.display_name;
        var city = result.address ? (result.address.city || result.address.town || result.address.village) : '';
        var state = result.address ? result.address.state : '';
        var shortName = city && state ? city + ', ' + state : displayName.split(',').slice(0, 2).join(',');
        
        html += '<div style="padding: 8px; border-bottom: 1px solid rgba(139, 69, 19, 0.2); cursor: pointer;" ' +
            'onmouseover="this.style.backgroundColor=\'rgba(139, 69, 19, 0.1)\'" ' +
            'onmouseout="this.style.backgroundColor=\'transparent\'" ' +
            'onclick="selectCityState(\'' + result.lat + '\', \'' + result.lon + '\', \'' + shortName.replace(/'/g, "\\'") + '\')">' +
            '<div style="font-weight: bold; color: #CD853F;">' + shortName + '</div>' +
            '<div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">(' + (result.display_name.split(',').slice(-1)[0].trim() || 'Location') + ')</div>' +
            '</div>';
    });
    
    resultsDiv.innerHTML = html;
}

function selectCityState(lat, lon, cityStateName) {
    document.getElementById('cityState').value = cityStateName;
    document.getElementById('selectedLat').value = lat;
    document.getElementById('selectedLon').value = lon;
    document.getElementById('cityStateResults').style.display = 'none';

    // Center map on selected location
    centerMapOnLocation(parseFloat(lat), parseFloat(lon));

    // Populate environmental data with new coordinates
    if (typeof populateEnvironmentalData === 'function') {
        populateEnvironmentalData();
    }
}