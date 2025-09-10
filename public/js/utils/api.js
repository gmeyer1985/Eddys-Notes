// API Utilities
class ApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Check if response has content
            const text = await response.text();
            return text ? JSON.parse(text) : {};
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async get(endpoint, params = {}) {
        const searchParams = new URLSearchParams(params);
        const queryString = searchParams.toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, {
            method: 'GET',
        });
    }

    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    // Specific methods for the fishing log app
    async getFishingEntries() {
        return this.get('/api/entries');
    }

    async createFishingEntry(entry) {
        return this.post('/api/entries', entry);
    }

    async updateFishingEntry(id, entry) {
        return this.put(`/api/entries/${id}`, entry);
    }

    async deleteFishingEntry(id) {
        return this.delete(`/api/entries/${id}`);
    }

    async uploadPhoto(file) {
        const formData = new FormData();
        formData.append('photo', file);

        return fetch('/api/upload/photo', {
            method: 'POST',
            body: formData,
        }).then(response => response.json());
    }

    // Authentication methods
    async login(credentials) {
        return this.post('/api/auth/login', credentials);
    }

    async logout() {
        return this.post('/api/auth/logout');
    }

    async checkAuthStatus() {
        return this.get('/api/auth/status');
    }

    // Export data
    async exportData(format = 'csv') {
        return this.get(`/api/export/${format}`);
    }

    // Import data
    async importData(file) {
        const formData = new FormData();
        formData.append('data', file);

        return fetch('/api/import', {
            method: 'POST',
            body: formData,
        }).then(response => response.json());
    }
}

// Create a global instance
const api = new ApiClient();

// Export for use in other modules
window.api = api;
window.ApiClient = ApiClient;