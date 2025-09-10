// Main JavaScript - Eddy's Notes Application
class App {
    constructor() {
        this.navigation = null;
        this.modals = {};
        this.currentUser = null;
        this.data = {
            entries: [],
            filters: {
                date: '',
                species: '',
                location: '',
                bait: ''
            }
        };
        
        this.init();
    }

    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bootstrap());
        } else {
            this.bootstrap();
        }
    }

    async bootstrap() {
        try {
            // Initialize components
            this.initializeComponents();
            
            // Check authentication status
            await this.checkAuth();
            
            // Load initial data
            await this.loadData();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize page
            this.initializePage();
            
            console.log('Eddy\'s Notes application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            Utils.showNotification('Failed to load application', 'error');
        }
    }

    initializeComponents() {
        // Initialize navigation
        this.navigation = new Navigation();
        
        // Initialize modals
        const modalIds = [
            'entryModal', 
            'profileModal', 
            'riverFlowModal', 
            'licenseLibraryModal',
            'aboutModal'
        ];
        
        modalIds.forEach(id => {
            const modalElement = document.getElementById(id);
            if (modalElement) {
                this.modals[id] = new Modal(id);
            }
        });
    }

    async checkAuth() {
        try {
            const status = await api.checkAuthStatus();
            this.currentUser = status.user || null;
            this.updateUIForAuth();
        } catch (error) {
            console.log('Not authenticated');
            this.currentUser = null;
        }
    }

    updateUIForAuth() {
        const adminLink = document.getElementById('adminLink');
        const logoutLink = document.getElementById('logoutLink');
        
        if (this.currentUser) {
            if (adminLink) adminLink.style.display = 'block';
            if (logoutLink) logoutLink.style.display = 'block';
        } else {
            if (adminLink) adminLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'none';
        }
    }

    async loadData() {
        try {
            this.data.entries = await api.getFishingEntries();
            this.renderTable();
            this.updateFilters();
        } catch (error) {
            console.error('Failed to load data:', error);
            Utils.showNotification('Failed to load fishing entries', 'error');
        }
    }

    setupEventListeners() {
        // Filter changes
        const filterInputs = document.querySelectorAll('.filter-group input, .filter-group select');
        filterInputs.forEach(input => {
            input.addEventListener('change', Utils.debounce(() => {
                this.applyFilters();
            }, 300));
        });

        // Export button
        const exportBtn = document.querySelector('[onclick="exportData()"]');
        if (exportBtn) {
            exportBtn.removeAttribute('onclick');
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Import button
        const importBtn = document.querySelector('[onclick="importData()"]');
        if (importBtn) {
            importBtn.removeAttribute('onclick');
            importBtn.addEventListener('click', () => this.showImportModal());
        }

        // Add new entry button
        const addBtn = document.querySelector('[onclick="showAddModal()"]');
        if (addBtn) {
            addBtn.removeAttribute('onclick');
            addBtn.addEventListener('click', () => this.showAddModal());
        }
    }

    initializePage() {
        // Initialize any page-specific functionality
        this.initializeMap();
        this.setupFormValidation();
    }

    renderTable() {
        const tableBody = document.querySelector('#fishingTable tbody');
        if (!tableBody) return;

        const filteredEntries = this.getFilteredEntries();
        
        tableBody.innerHTML = filteredEntries.map(entry => `
            <tr onclick="editEntry(${entry.id})">
                <td>${Utils.formatDate(entry.date)}</td>
                <td>${Utils.formatTime(entry.time)}</td>
                <td>${Utils.escapeHtml(entry.species || '')}</td>
                <td>${entry.length || ''}</td>
                <td>${entry.weight || ''}</td>
                <td>${Utils.escapeHtml(entry.location || '')}</td>
                <td>${Utils.escapeHtml(entry.bait || '')}</td>
                <td>${Utils.escapeHtml(entry.weather || '')}</td>
                <td class="moon-phase">${Utils.getMoonPhase(entry.date)}</td>
                <td>
                    <button onclick="event.stopPropagation(); editEntry(${entry.id})" 
                            class="btn btn-sm btn-primary">Edit</button>
                    <button onclick="event.stopPropagation(); deleteEntry(${entry.id})" 
                            class="btn btn-sm btn-danger">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    getFilteredEntries() {
        return this.data.entries.filter(entry => {
            const filters = this.data.filters;
            
            if (filters.date && entry.date !== filters.date) return false;
            if (filters.species && !entry.species?.toLowerCase().includes(filters.species.toLowerCase())) return false;
            if (filters.location && !entry.location?.toLowerCase().includes(filters.location.toLowerCase())) return false;
            if (filters.bait && !entry.bait?.toLowerCase().includes(filters.bait.toLowerCase())) return false;
            
            return true;
        });
    }

    applyFilters() {
        // Update filter values
        this.data.filters.date = document.getElementById('filterDate')?.value || '';
        this.data.filters.species = document.getElementById('filterSpecies')?.value || '';
        this.data.filters.location = document.getElementById('filterLocation')?.value || '';
        this.data.filters.bait = document.getElementById('filterBait')?.value || '';

        // Re-render table
        this.renderTable();
    }

    updateFilters() {
        // Update filter dropdowns with unique values from data
        this.updateFilterDropdown('filterSpecies', 'species');
        this.updateFilterDropdown('filterLocation', 'location');
        this.updateFilterDropdown('filterBait', 'bait');
    }

    updateFilterDropdown(selectId, field) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const uniqueValues = [...new Set(
            this.data.entries
                .map(entry => entry[field])
                .filter(value => value && value.trim())
        )].sort();

        // Keep the current selection
        const currentValue = select.value;
        
        // Clear and repopulate
        select.innerHTML = `<option value="">All ${field.charAt(0).toUpperCase() + field.slice(1)}</option>`;
        
        uniqueValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });

        // Restore selection
        select.value = currentValue;
    }

    showAddModal() {
        if (this.modals.entryModal) {
            this.clearEntryForm();
            this.modals.entryModal.setTitle('Add New Entry');
            this.modals.entryModal.open();
        }
    }

    clearEntryForm() {
        const form = document.getElementById('entryForm');
        if (form) {
            form.reset();
            // Set default date to today
            const dateInput = form.querySelector('input[type="date"]');
            if (dateInput) {
                dateInput.value = Utils.formatDate(new Date());
            }
        }
    }

    async exportData() {
        try {
            Utils.showNotification('Exporting data...', 'info');
            const data = await api.exportData('csv');
            
            // Create and trigger download
            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fishing-log-${Utils.formatDate(new Date())}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            Utils.showNotification('Data exported successfully!', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            Utils.showNotification('Failed to export data', 'error');
        }
    }

    initializeMap() {
        // Initialize map if element exists
        const mapElement = document.getElementById('fishingLocationMap');
        if (mapElement && typeof L !== 'undefined') {
            // Leaflet map initialization would go here
            console.log('Map element found, would initialize Leaflet map');
        }
    }

    setupFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                if (!this.validateForm(form)) {
                    e.preventDefault();
                }
            });
        });
    }

    validateForm(form) {
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!Utils.validation.isRequired(field.value)) {
                this.showFieldError(field, 'This field is required');
                isValid = false;
            } else {
                this.clearFieldError(field);
            }
        });

        return isValid;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        
        field.classList.add('error');
        field.parentNode.appendChild(errorElement);
    }

    clearFieldError(field) {
        field.classList.remove('error');
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }
}

// Global functions that were in the original table.html
window.toggleMenu = function() {
    if (window.app && window.app.navigation) {
        window.app.navigation.toggleMenu();
    }
};

window.closeMenu = function() {
    if (window.app && window.app.navigation) {
        window.app.navigation.closeMenu();
    }
};

window.showAddModal = function() {
    if (window.app) {
        window.app.showAddModal();
    }
};

window.exportData = function() {
    if (window.app) {
        window.app.exportData();
    }
};

window.clearFilters = function() {
    if (window.app) {
        // Clear all filter inputs
        document.querySelectorAll('.filter-group input, .filter-group select').forEach(input => {
            input.value = '';
        });
        window.app.applyFilters();
    }
};

// Initialize the application when this script loads
window.app = new App();