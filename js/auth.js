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

    // Show header login form if it exists, otherwise show modal login form
    const headerLoginForm = document.getElementById('loginForm');
    if (headerLoginForm) {
        headerLoginForm.classList.add('active');
    }
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

    // Show header signup form if it exists, otherwise show modal signup form
    const headerSignupForm = document.getElementById('headerSignupFormDiv');
    const modalSignupForm = document.getElementById('signupForm');

    if (headerSignupForm) {
        headerSignupForm.classList.add('active');
    } else if (modalSignupForm) {
        modalSignupForm.classList.add('active');
    }
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
    console.log('hideLoginOverlay called');
    
    // Hide both login overlay and auth modal
    const loginOverlay = document.getElementById('loginOverlay');
    const authModal = document.getElementById('authModal');
    const mainApp = document.getElementById('mainApp');
    
    console.log('Found elements:', { loginOverlay: !!loginOverlay, authModal: !!authModal, mainApp: !!mainApp });
    
    if (loginOverlay) {
        loginOverlay.style.display = 'none';
        console.log('Hidden loginOverlay');
    }
    if (authModal) {
        authModal.style.display = 'none';
        console.log('Hidden authModal');
    }
    if (mainApp) {
        mainApp.style.display = 'block';
        console.log('Shown mainApp');
    }
}

function showLoginOverlay() {
    const loginOverlay = document.getElementById('loginOverlay');
    const authModal = document.getElementById('authModal');
    const mainApp = document.getElementById('mainApp');
    
    if (loginOverlay) loginOverlay.style.display = 'flex';
    if (authModal) authModal.style.display = 'block';
    if (mainApp) mainApp.style.display = 'none';
}

// Handle login form submission
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Login form handler
    document.getElementById('loginFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopImmediatePropagation(); // Stop other listeners from executing
        console.log('Login form submitted!');
        
        // Check if already submitting to prevent double submissions
        if (this.dataset.submitting === 'true') {
            console.log('Already submitting login, ignoring duplicate event');
            return;
        }
        this.dataset.submitting = 'true';
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        console.log('Login attempt:', { username, passwordLength: password.length });
        
        if (!username || !password) {
            console.log('Validation failed: missing username or password');
            showAuthMessage('Please enter both username and password');
            this.dataset.submitting = 'false';
            return;
        }
        
        console.log('Validation passed, making API request...');
        
        try {
            console.log('Making fetch request to /api/auth/login');
            console.log('Request body:', JSON.stringify({ username, password: '***' }));
            
            const fetchPromise = fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });
            
            console.log('Fetch promise created, waiting for response...');
            
            // Add a timeout to detect hanging requests
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
            });
            
            console.log('Starting race between fetch and timeout...');
            
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            console.log('Response received:', response.status, response.statusText);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            
            const responseText = await response.text();
            console.log('Raw response text:', responseText);
            
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('Parsed response data:', data);
            } catch (parseError) {
                console.error('Failed to parse JSON response:', parseError);
                console.log('Response was not valid JSON');
                throw new Error('Server returned invalid JSON response');
            }
            
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
            console.error('Error details:', error.message, error.stack);
            showAuthMessage('Network error. Please try again.');
        } finally {
            // Reset submitting flag
            this.dataset.submitting = 'false';
        }
    });
    
    // Signup form handler
    document.getElementById('signupFormElement').addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopImmediatePropagation(); // Stop other listeners from executing
        
        // Check if already submitting to prevent double submissions
        if (this.dataset.submitting === 'true') {
            console.log('Already submitting signup, ignoring duplicate event');
            return;
        }
        this.dataset.submitting = 'true';
        
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
            
            // Reset submitting flag
            this.dataset.submitting = 'false';
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
    console.log('Updating UI for logged in user:', userData);
    
    // Update navigation links
    const loginLink = document.getElementById('loginLink');
    const logoutLink = document.getElementById('logoutLink');
    const adminLink = document.getElementById('adminLink');
    
    console.log('Found UI elements:', { loginLink: !!loginLink, logoutLink: !!logoutLink, adminLink: !!adminLink });
    
    if (loginLink) {
        loginLink.style.display = 'none';
        console.log('Hidden login link');
    }
    if (logoutLink) {
        logoutLink.style.display = 'block';
        logoutLink.innerHTML = `Logout (${userData.username})`;
        console.log('Shown logout link with username:', userData.username);
    }
    if (adminLink && userData.is_admin) {
        adminLink.style.display = 'block';
        console.log('Shown admin link for admin user');
    }
    
    // Store user data globally if needed
    window.currentUser = userData;
    console.log('Stored current user data globally');
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