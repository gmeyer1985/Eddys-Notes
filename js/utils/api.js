// API Configuration and Helper Functions
const API_BASE_URL = '/api';

// Authentication variables
let currentUser = null;
let isAuthenticated = false;

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    try {
        console.log(`Making API request to: ${API_BASE_URL}${endpoint}`);
        console.log('Request options:', options);
        
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include', // Include cookies for authentication
            ...options
        });

        console.log(`API response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error Response: ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('API response data:', result);
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication functions
async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            currentUser = await response.json();
            isAuthenticated = true;
            updateUIForAuthenticatedUser();
        } else {
            isAuthenticated = false;
            showAuthModal();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        isAuthenticated = false;
        showAuthModal();
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data;
            isAuthenticated = true;
            closeAuthModal();
            updateUIForAuthenticatedUser();
            await initializeAppData();
        } else {
            showAuthStatusMessage('loginStatusMessage', data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showAuthStatusMessage('loginStatusMessage', 'Network error: ' + error.message, 'error');
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const firstName = document.getElementById('signupFirstName').value;
    const lastName = document.getElementById('signupLastName').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ 
                username, 
                email, 
                password, 
                firstName, 
                lastName 
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = data;
            isAuthenticated = true;
            closeAuthModal();
            updateUIForAuthenticatedUser();
            await initializeAppData();
        } else {
            showAuthStatusMessage('signupStatusMessage', data.error || 'Signup failed', 'error');
        }
    } catch (error) {
        showAuthStatusMessage('signupStatusMessage', 'Network error: ' + error.message, 'error');
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });

        currentUser = null;
        isAuthenticated = false;
        showAuthModal();
        clearAppData();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function updateUIForAuthenticatedUser() {
    // Show logout option in hamburger menu
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.style.display = 'block';
    }
    
    // Show admin link if user is admin
    const adminLink = document.getElementById('adminLink');
    if (adminLink && currentUser && currentUser.is_admin) {
        adminLink.style.display = 'block';
    }
    
    // Could add welcome message or user info to header if desired
    console.log('Welcome back, ' + (currentUser.username || 'User') + '!');
}

function clearAppData() {
    fishingData = [];
    if (typeof fishingLicenses !== 'undefined') fishingLicenses = [];
    if (typeof savedRivers !== 'undefined') savedRivers = [];
    if (typeof userProfile !== 'undefined') userProfile = {};
    renderTable();
}

// Authentication Modal Functions
function showAuthModal() {
    document.getElementById('authModal').style.display = 'block';
    showLoginForm();
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('loginFormElement').reset();
    hideAuthStatusMessages();
}

function showSignupForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('signupFormElement').reset();
    hideAuthStatusMessages();
}

function hideAuthStatusMessages() {
    document.getElementById('loginStatusMessage').style.display = 'none';
    document.getElementById('signupStatusMessage').style.display = 'none';
}

function showAuthStatusMessage(elementId, message, type) {
    const statusDiv = document.getElementById(elementId);
    statusDiv.textContent = message;
    statusDiv.className = 'status-message status-' + type;
    statusDiv.style.display = 'block';
}

// Fishing Entries API Functions
async function loadData() {
    try {
        const entries = await apiRequest('/fishing-entries');
        fishingData = entries.map(entry => ({
            id: entry.id, // Include database ID for deletions
            date: entry.date,
            startTime: entry.start_time,
            endTime: entry.end_time,
            angler: entry.angler,
            targetSpecies: entry.species,
            length: entry.length,
            weight: entry.weight,
            cityState: entry.city_state,
            latitude: entry.latitude,
            longitude: entry.longitude,
            siteNumber: entry.site_number,
            riverName: entry.river_name,
            waterFlow: entry.water_flow,
            weatherTemp: entry.weather_temp,
            barometricPressure: entry.barometric_pressure,
            windSpeed: entry.wind_speed,
            windDirection: entry.wind_direction,
            moonPhase: entry.moon_phase,
            notes: entry.notes,
            fliesUsed: entry.flies_used,
            photoData: entry.photo_path ? `/uploads/${entry.photo_path.split('/').pop()}` : null
        }));
    } catch (error) {
        console.error('Error loading fishing entries:', error);
        fishingData = [];
    }
}

async function saveFishingEntry(entryData) {
    try {
        console.log('saveFishingEntry called with:', entryData);
        
        // Fetch and cache flow data if site number and date are available
        let cachedFlowData = null;
        if (entryData.siteNumber && entryData.date) {
            console.log('Fetching flow data for caching...');
            try {
                const flowData = await getHourlyFlowData(entryData.siteNumber, entryData.date);
                if (flowData && flowData.length > 0) {
                    cachedFlowData = JSON.stringify(flowData);
                    console.log('Successfully cached flow data:', flowData.length, 'data points');
                }
            } catch (error) {
                console.warn('Failed to cache flow data:', error.message);
                // Continue without cached data - it will fetch on demand
            }
        }

        const data = {
            date: entryData.date,
            start_time: entryData.startTime,
            end_time: entryData.endTime,
            angler: entryData.angler,
            species: entryData.species,
            length: entryData.length,
            weight: entryData.weight,
            city_state: entryData.cityState,
            latitude: entryData.latitude,
            longitude: entryData.longitude,
            site_number: entryData.siteNumber,
            river_name: entryData.riverName,
            water_flow: entryData.waterFlow,
            weather_temp: entryData.weatherTemp,
            barometric_pressure: entryData.barometricPressure,
            wind_speed: entryData.windSpeed,
            wind_direction: entryData.windDirection,
            moon_phase: entryData.moonPhase,
            notes: entryData.notes,
            flies_used: entryData.fliesUsed,
            photo_data: entryData.photoData,
            cached_flow_data: cachedFlowData
        };

        console.log('Prepared data for API:', data);
        console.log('Making API request to /fishing-entries');

        const result = await apiRequest('/fishing-entries', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        console.log('API request completed with result:', result);
        return result;
    } catch (error) {
        console.error('Error saving fishing entry:', error);
        throw error;
    }
}

async function updateFishingEntry(entryId, entryData) {
    try {
        console.log('updateFishingEntry called with ID:', entryId, 'and data:', entryData);

        const result = await apiRequest(`/fishing-entries/${entryId}`, {
            method: 'PUT',
            body: JSON.stringify(entryData)
        });

        console.log('Entry updated successfully:', result);
        return result;
    } catch (error) {
        console.error('Error updating fishing entry:', error);
        throw error;
    }
}

async function deleteFishingEntry(index) {
    try {
        const entry = fishingData[index];
        if (entry && entry.id) {
            await apiRequest(`/fishing-entries/${entry.id}`, { method: 'DELETE' });
        } else {
            throw new Error('Entry not found or missing ID');
        }
    } catch (error) {
        console.error('Error deleting fishing entry:', error);
        throw error;
    }
}