// Authentication handling for login overlay
function showLoginTab() {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById('loginForm').classList.add('active');
    clearAuthMessage();
}

function showSignupTab() {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById('signupForm').classList.add('active');
    clearAuthMessage();
}

function showAuthMessage(message, type = 'error') {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.textContent = message;
    messageDiv.className = `auth-message ${type}`;
}

function clearAuthMessage() {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.className = 'auth-message';
    messageDiv.textContent = '';
}

function hideLoginOverlay() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
}

function showLoginOverlay() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// Handle login form submission
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Login form handler
    document.getElementById('loginFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            showAuthMessage('Please enter both username and password');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showAuthMessage('Login successful!', 'success');
                setTimeout(() => {
                    hideLoginOverlay();
                    // Initialize the main application
                    if (typeof initializeAppData === 'function') {
                        initializeAppData();
                    }
                    updateUIForLoggedInUser(data);
                }, 1000);
            } else {
                showAuthMessage(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAuthMessage('Network error. Please try again.');
        }
    });
    
    // Signup form handler
    document.getElementById('signupFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('signupUsername').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const firstName = document.getElementById('signupFirstName').value.trim();
        const lastName = document.getElementById('signupLastName').value.trim();
        const state = document.getElementById('signupState').value.trim();
        
        if (!username || !email || !password) {
            showAuthMessage('Username, email, and password are required');
            return;
        }
        
        if (password.length < 6) {
            showAuthMessage('Password must be at least 6 characters long');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username, 
                    email, 
                    password, 
                    firstName, 
                    lastName, 
                    state 
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showAuthMessage('Account created successfully!', 'success');
                setTimeout(() => {
                    hideLoginOverlay();
                    // Initialize the main application
                    if (typeof initializeAppData === 'function') {
                        initializeAppData();
                    }
                    updateUIForLoggedInUser(data);
                }, 1000);
            } else {
                showAuthMessage(data.error || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            showAuthMessage('Network error. Please try again.');
        }
    });
});

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/user', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const userData = await response.json();
            hideLoginOverlay();
            updateUIForLoggedInUser(userData);
            // Initialize the main application
            if (typeof initializeAppData === 'function') {
                initializeAppData();
            }
        } else {
            showLoginOverlay();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showLoginOverlay();
    }
}

function updateUIForLoggedInUser(userData) {
    // Update navigation links
    const loginLink = document.getElementById('loginLink');
    const logoutLink = document.getElementById('logoutLink');
    const adminLink = document.getElementById('adminLink');
    
    if (loginLink) loginLink.style.display = 'none';
    if (logoutLink) {
        logoutLink.style.display = 'block';
        logoutLink.innerHTML = `Logout (${userData.username})`;
    }
    if (adminLink && userData.is_admin) {
        adminLink.style.display = 'block';
    }
    
    // Store user data globally if needed
    window.currentUser = userData;
}

// Update the existing handleLogout function to show login overlay
function handleLogout() {
    fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
        showLoginOverlay();
        // Reset UI
        document.getElementById('loginLink').style.display = 'block';
        document.getElementById('logoutLink').style.display = 'none';
        document.getElementById('adminLink').style.display = 'none';
        window.currentUser = null;
    })
    .catch(error => {
        console.error('Logout error:', error);
        showLoginOverlay(); // Show login overlay even if logout fails
    });
}