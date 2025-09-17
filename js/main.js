// Main Application Initialization and Global Functions

// Hamburger Menu Functions
function toggleMenu() {
    var hamburger = document.querySelector('.hamburger-menu');
    var navMenu = document.getElementById('navMenu');
    
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
}

function closeMenu() {
    var hamburger = document.querySelector('.hamburger-menu');
    var navMenu = document.getElementById('navMenu');
    
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}

// Flag to track if event listeners have been set up
let eventListenersSetup = false;

function setupEventListeners() {
    // Prevent duplicate event listeners
    if (eventListenersSetup) {
        console.log('Event listeners already set up, skipping...');
        return;
    }

    console.log('Setting up event listeners');
    eventListenersSetup = true;

    var filterDate = document.getElementById('filterDate');
    var filterAngler = document.getElementById('filterAngler');
    var filterSpecies = document.getElementById('filterSpecies');
    var searchNotes = document.getElementById('searchNotes');
    var fishingForm = document.getElementById('fishingForm');
    
    if (filterDate) {
        filterDate.addEventListener('change', applyFilters);
    }
    
    if (filterAngler) {
        filterAngler.addEventListener('change', applyFilters);
    }
    
    if (filterSpecies) {
        filterSpecies.addEventListener('change', applyFilters);
    }
    
    if (searchNotes) {
        searchNotes.addEventListener('input', applyFilters);
    }
    
    if (fishingForm) {
        fishingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveEntry();
        });
    }
    
    // Auto-refresh flow data when date changes
    var entryDateInput = document.getElementById('entryDate');
    if (entryDateInput) {
        entryDateInput.addEventListener('change', function() {
            var selectedSiteNumber = document.getElementById('selectedSiteNumber').value;
            if (selectedSiteNumber && this.value) {
                getCurrentFlowData(selectedSiteNumber);
            }
        });
    }
    
    // Profile form event listeners
    var profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveUserProfile();
        });
    }
    
    var profilePhotoInput = document.getElementById('profilePhoto');
    if (profilePhotoInput) {
        profilePhotoInput.addEventListener('change', handleProfilePhotoUpload);
    }

    var profilePhoneInput = document.getElementById('profilePhone');
    if (profilePhoneInput) {
        profilePhoneInput.addEventListener('input', handlePhoneNumberInput);
    }
    
    // License form event listeners
    var licenseForm = document.getElementById('licenseForm');
    if (licenseForm) {
        licenseForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveLicense();
        });
    }
    
    var licenseDocumentInput = document.getElementById('licenseDocument');
    if (licenseDocumentInput) {
        licenseDocumentInput.addEventListener('change', handleLicenseDocumentUpload);
    }
    
    // Setup authentication form handlers
    var loginFormElement = document.getElementById('loginFormElement');
    var signupFormElement = document.getElementById('signupFormElement');
    
    // Temporarily disabled to let auth.js handle form submissions
    // if (loginFormElement) {
    //     loginFormElement.addEventListener('submit', handleLogin);
    // }
    
    // if (signupFormElement) {
    //     signupFormElement.addEventListener('submit', handleSignup);
    // }
}

// Initialize app data after authentication
async function initializeAppData() {
    try {
        await loadData();
        await loadFishingLicenses();
        await loadUserProfile();
        await loadSavedRivers();
        renderTable();
        updateFilterOptions();
    } catch (error) {
        console.error('Error initializing app data:', error);
    }
}

// Initialize the application (will be called after authentication)
async function initializeApplication() {
    try {
        setupEventListeners();
        // Data loading is now handled by initializeAppData() after authentication
    } catch (error) {
        console.error('Error initializing application:', error);
        showStatusMessage('Error initializing application. Some features may not work properly.', 'error');
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    var entryModal = document.getElementById('entryModal');
    var flowGraphModal = document.getElementById('flowGraphModal');
    var profileModal = document.getElementById('profileModal');
    var riverFlowModal = document.getElementById('riverFlowModal');
    var licenseLibraryModal = document.getElementById('licenseLibraryModal');
    var documentViewerModal = document.getElementById('documentViewerModal');
    var authModal = document.getElementById('authModal');
    var navMenu = document.getElementById('navMenu');
    var hamburgerMenu = document.querySelector('.hamburger-menu');
    
    if (event.target === entryModal) {
        closeModal();
    }
    if (event.target === flowGraphModal) {
        closeFlowGraph();
    }
    if (event.target === profileModal) {
        closeProfileModal();
    }
    if (event.target === riverFlowModal) {
        closeRiverFlowModal();
    }
    if (event.target === licenseLibraryModal) {
        closeLicenseLibraryModal();
    }
    if (event.target === documentViewerModal) {
        closeDocumentViewer();
    }
    if (event.target === authModal) {
        // Don't allow closing auth modal by clicking outside
        // User must authenticate or use close button
    }
    
    // Close hamburger menu when clicking outside
    if (hamburgerMenu && navMenu && !hamburgerMenu.contains(event.target) && !navMenu.contains(event.target)) {
        closeMenu();
    }
};

// Application startup - check authentication on page load
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApplication(); // Setup event listeners first
    checkAuthStatus(); // Then check authentication
});