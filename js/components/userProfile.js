// User Profile Functions

var userProfile = {};
var profilePhotoData = null;

function showProfileModal() {
    loadUserProfile();
    var modal = document.getElementById('profileModal');
    modal.style.display = 'block';
}

function closeProfileModal() {
    var modal = document.getElementById('profileModal');
    modal.style.display = 'none';
    hideProfileStatusMessage();
}

async function loadUserProfile() {
    try {
        const profile = await apiRequest('/profile');

        // Parse the address field if it exists (backward compatibility)
        let street = '', city = '', state = '', zip = '';
        if (profile.address) {
            const addressParts = parseAddress(profile.address);
            street = addressParts.street;
            city = addressParts.city;
            state = addressParts.state;
            zip = addressParts.zip;
        }

        userProfile = {
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            street: street,
            city: city,
            state: state,
            zip: zip,
            phone: profile.phone || '',
            email: profile.email || '',
            photoData: profile.photo_path ? `/uploads/${profile.photo_path.split('/').pop()}` : null
        };

        document.getElementById('profileFirstName').value = userProfile.firstName;
        document.getElementById('profileLastName').value = userProfile.lastName;
        document.getElementById('profileStreet').value = userProfile.street;
        document.getElementById('profileCity').value = userProfile.city;
        document.getElementById('profileState').value = userProfile.state;
        document.getElementById('profileZip').value = userProfile.zip;
        document.getElementById('profilePhone').value = formatPhoneNumber(userProfile.phone);
        document.getElementById('profileEmail').value = userProfile.email;

        // Load profile photo
        if (userProfile.photoData) {
            displayProfilePhoto(userProfile.photoData);
        } else {
            resetPhotoPreview();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        userProfile = {};
    }
}

async function saveUserProfile() {
    var form = document.getElementById('profileForm');
    if (!form.checkValidity()) {
        showProfileStatusMessage('Please fill in all required fields.', 'error');
        return;
    }

    try {
        // Combine address fields into a single address string for backend compatibility
        const street = document.getElementById('profileStreet').value;
        const city = document.getElementById('profileCity').value;
        const state = document.getElementById('profileState').value;
        const zip = document.getElementById('profileZip').value;

        const addressParts = [street, city, state, zip].filter(part => part.trim() !== '');
        const combinedAddress = addressParts.join(', ');

        const profileData = {
            first_name: document.getElementById('profileFirstName').value,
            last_name: document.getElementById('profileLastName').value,
            address: combinedAddress,
            phone: unformatPhoneNumber(document.getElementById('profilePhone').value),
            photo_data: profilePhotoData
        };

        await apiRequest('/profile', {
            method: 'POST',
            body: JSON.stringify(profileData)
        });

        showProfileStatusMessage('Profile saved successfully!', 'success');
        profilePhotoData = null;
        await loadUserProfile(); // Reload from database

        // Auto-close modal after successful save
        setTimeout(() => {
            closeProfileModal();
        }, 1500);
    } catch (error) {
        showProfileStatusMessage('Error saving profile: ' + error.message, 'error');
        console.error('Profile save error:', error);
    }

    // Update header if needed (could show user name)
    updateHeaderWithProfile();
}

function updateHeaderWithProfile() {
    // Future enhancement: Could show user name in header
}

function showProfileStatusMessage(message, type) {
    var statusDiv = document.getElementById('profileStatusMessage');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'status-message status-' + type;
        statusDiv.style.display = 'block';
    }
}

function hideProfileStatusMessage() {
    var statusDiv = document.getElementById('profileStatusMessage');
    if (statusDiv) statusDiv.style.display = 'none';
}

// Profile Photo Functions
function handleProfilePhotoUpload(event) {
    var file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showProfileStatusMessage('Photo must be smaller than 5MB', 'error');
            return;
        }
        
        var reader = new FileReader();
        reader.onload = function(e) {
            profilePhotoData = e.target.result;
            displayProfilePhoto(e.target.result);
            showProfileStatusMessage('Photo uploaded. Click Save Profile to save changes.', 'success');
        };
        reader.readAsDataURL(file);
    }
}

function displayProfilePhoto(dataUrl) {
    var img = document.getElementById('profilePhotoImg');
    var placeholder = document.getElementById('photoPlaceholder');
    var removeBtn = document.getElementById('removePhotoBtn');
    
    if (img && placeholder && removeBtn) {
        img.src = dataUrl;
        img.style.display = 'block';
        placeholder.style.display = 'none';
        removeBtn.style.display = 'inline-block';
    }
}

function removeProfilePhoto() {
    if (confirm('Remove profile photo?')) {
        profilePhotoData = null;
        resetPhotoPreview();
        showProfileStatusMessage('Photo removed. Click Save Profile to save changes.', 'success');
    }
}

function resetPhotoPreview() {
    var img = document.getElementById('profilePhotoImg');
    var placeholder = document.getElementById('photoPlaceholder');
    var removeBtn = document.getElementById('removePhotoBtn');
    
    if (img && placeholder && removeBtn) {
        img.style.display = 'none';
        img.src = '';
        placeholder.style.display = 'block';
        removeBtn.style.display = 'none';
    }
}

// Password Change Function
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        showProfileStatusMessage('All password fields are required.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showProfileStatusMessage('New password must be at least 6 characters long.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showProfileStatusMessage('New passwords do not match.', 'error');
        return;
    }

    if (currentPassword === newPassword) {
        showProfileStatusMessage('New password must be different from current password.', 'error');
        return;
    }

    try {
        const result = await apiRequest('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });

        if (result.error) {
            throw new Error(result.error);
        }

        // Clear password fields
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        showProfileStatusMessage('Password changed successfully!', 'success');
    } catch (error) {
        showProfileStatusMessage(error.message || 'Failed to change password.', 'error');
    }
}

// Account Deletion Function
async function deleteAccount() {
    const password = document.getElementById('deleteAccountPassword').value;

    // Validation
    if (!password) {
        showProfileStatusMessage('Please enter your password to confirm account deletion.', 'error');
        return;
    }

    // Multiple confirmation steps
    const confirmStep1 = confirm(
        'Are you absolutely sure you want to delete your account?\n\n' +
        'This will permanently delete:\n' +
        '• All your fishing entries\n' +
        '• All your licenses\n' +
        '• All your river data\n' +
        '• Your profile information\n' +
        '• All uploaded photos and documents\n\n' +
        'This action cannot be undone!'
    );

    if (!confirmStep1) return;

    const confirmStep2 = confirm(
        'FINAL CONFIRMATION\n\n' +
        'This is your last chance to cancel. Are you 100% certain you want to permanently delete your account and all associated data?\n\n' +
        'Type "DELETE" in the next prompt to confirm.'
    );

    if (!confirmStep2) return;

    const finalConfirm = prompt(
        'Please type "DELETE" (in all caps) to confirm account deletion:'
    );

    if (finalConfirm !== 'DELETE') {
        showProfileStatusMessage('Account deletion cancelled. You must type "DELETE" exactly to confirm.', 'error');
        return;
    }

    try {
        showProfileStatusMessage('Deleting account... Please wait.', 'info');
        
        const result = await apiRequest('/auth/delete-account', {
            method: 'POST',
            body: JSON.stringify({
                password: password
            })
        });

        if (result.error) {
            throw new Error(result.error);
        }

        // Clear password field
        document.getElementById('deleteAccountPassword').value = '';

        // Show success message briefly
        showProfileStatusMessage('Account deleted successfully. You will be redirected to the login page.', 'success');

        // Redirect to login after a brief delay
        setTimeout(() => {
            // Reset authentication state
            isAuthenticated = false;
            currentUser = null;
            
            // Close profile modal
            closeProfileModal();
            
            // Show auth modal
            showAuthModal();
        }, 2000);

    } catch (error) {
        showProfileStatusMessage(error.message || 'Failed to delete account.', 'error');
    }
}

// Phone number formatting functions
function formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';

    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Apply formatting based on length
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    return phoneNumber; // Return original if it doesn't match expected formats
}

function unformatPhoneNumber(formattedPhone) {
    if (!formattedPhone) return '';
    // Remove all non-digit characters for storage
    return formattedPhone.replace(/\D/g, '');
}

function handlePhoneNumberInput(event) {
    const input = event.target;
    const cursorPosition = input.selectionStart;
    const originalLength = input.value.length;

    // Format the phone number
    input.value = formatPhoneNumber(input.value);

    // Adjust cursor position after formatting
    const newLength = input.value.length;
    const lengthDiff = newLength - originalLength;
    const newCursorPosition = cursorPosition + lengthDiff;

    // Set cursor position (with some delay to ensure it's applied)
    setTimeout(() => {
        input.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
}

// Address parsing function to split combined address into components
function parseAddress(addressString) {
    if (!addressString) {
        return { street: '', city: '', state: '', zip: '' };
    }

    // Split by commas and trim whitespace
    const parts = addressString.split(',').map(part => part.trim());

    // Try to identify components based on patterns
    let street = '', city = '', state = '', zip = '';

    if (parts.length === 1) {
        // Only one part - treat as street
        street = parts[0];
    } else if (parts.length === 2) {
        // Two parts - street, city or city, state
        street = parts[0];
        const lastPart = parts[1];
        // Check if last part looks like "State ZIP" pattern
        const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
        if (stateZipMatch) {
            state = stateZipMatch[1];
            zip = stateZipMatch[2];
        } else {
            city = lastPart;
        }
    } else if (parts.length === 3) {
        // Three parts - street, city, state or street, city, zip
        street = parts[0];
        city = parts[1];
        const lastPart = parts[2];
        // Check if it's a ZIP code pattern
        if (/^\d{5}(?:-\d{4})?$/.test(lastPart)) {
            zip = lastPart;
        } else {
            state = lastPart;
        }
    } else if (parts.length >= 4) {
        // Four or more parts - street, city, state, zip
        street = parts[0];
        city = parts[1];
        state = parts[2];
        zip = parts[3];
    }

    return { street, city, state, zip };
}