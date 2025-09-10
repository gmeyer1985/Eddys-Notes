// Authentication handling for login overlay
function showLoginTab() {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    // Find and activate the login tab button
    const loginTabButton = document.querySelector('.tab-button[onclick*="showLoginTab"]') || 
                          Array.from(document.querySelectorAll('.tab-button')).find(btn => btn.textContent.includes('Login'));
    if (loginTabButton) {
        loginTabButton.classList.add('active');
    }
    
    document.getElementById('loginForm').classList.add('active');
    clearAuthMessage();
}

function showSignupTab() {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    // Find and activate the signup tab button
    const signupTabButton = document.querySelector('.tab-button[onclick*="showSignupTab"]') || 
                           Array.from(document.querySelectorAll('.tab-button')).find(btn => btn.textContent.includes('Sign Up'));
    if (signupTabButton) {
        signupTabButton.classList.add('active');
    }
    
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
                credentials: 'include',
                body: JSON.stringify({ username, password })
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
        
        // Prevent double submission
        const submitButton = this.querySelector('button[type="submit"]');
        if (submitButton.disabled) {
            console.log('Signup already in progress, ignoring duplicate submission');
            return;
        }
        
        const username = document.getElementById('signupUsername').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const firstName = document.getElementById('signupFirstName').value.trim();
        const lastName = document.getElementById('signupLastName').value.trim();
        const state = document.getElementById('signupState').value.trim();
        
        console.log('Signup form submission:', { username, email, firstName, lastName, state });
        
        if (!username || !email || !password) {
            showAuthMessage('Username, email, and password are required');
            return;
        }
        
        if (password.length < 6) {
            showAuthMessage('Password must be at least 6 characters long');
            return;
        }
        
        // Disable submit button to prevent double submission
        submitButton.disabled = true;
        submitButton.textContent = 'Creating Account...';
        
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
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
                let errorMessage = data.error || 'Signup failed';
                
                // If it's a duplicate account error, suggest login
                if (errorMessage.includes('already exists') || errorMessage.includes('already in use')) {
                    errorMessage += ' You can try logging in instead.';
                    
                    // Auto-switch to login tab after showing error
                    setTimeout(() => {
                        if (errorMessage.includes('email')) {
                            // If email exists, pre-fill login form
                            document.getElementById('loginUsername').value = email;
                        }
                        showLoginTab();
                    }, 3000);
                }
                
                showAuthMessage(errorMessage);
            }
        } catch (error) {
            console.error('Signup error:', error);
            showAuthMessage('Network error. Please try again.');
        } finally {
            // Re-enable submit button
            submitButton.disabled = false;
            submitButton.textContent = 'Create Account';
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