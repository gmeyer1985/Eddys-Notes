// License Library Functions

var fishingLicenses = [];
var currentLicenseDocument = null;

function showLicenseLibraryModal() {
    loadFishingLicenses();
    var modal = document.getElementById('licenseLibraryModal');
    modal.style.display = 'block';
    renderLicenses();
    updateStateFilter();
}

function closeLicenseLibraryModal() {
    var modal = document.getElementById('licenseLibraryModal');
    modal.style.display = 'none';
    document.getElementById('addLicenseForm').style.display = 'none';
}

// License API Functions
async function loadFishingLicenses() {
    try {
        const licenses = await apiRequest('/licenses');
        fishingLicenses = licenses.map(license => ({
            id: license.id,
            state: license.state,
            type: license.type,
            startDate: license.start_date,
            endDate: license.end_date,
            notifications: license.notifications,
            documentData: license.document_path ? `/uploads/${license.document_path.split('/').pop()}` : null,
            documentType: license.document_type
        }));
    } catch (error) {
        console.error('Error loading licenses:', error);
        fishingLicenses = [];
    }
}

async function saveFishingLicense(licenseData) {
    try {
        const data = {
            state: licenseData.state,
            type: licenseData.type,
            start_date: licenseData.startDate,
            end_date: licenseData.endDate,
            notifications: licenseData.notifications,
            document_data: licenseData.documentData,
            document_type: licenseData.documentType
        };

        const result = await apiRequest('/licenses', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        return result;
    } catch (error) {
        console.error('Error saving license:', error);
        throw error;
    }
}

async function deleteFishingLicense(licenseId) {
    try {
        await apiRequest(`/licenses/${licenseId}`, { method: 'DELETE' });
    } catch (error) {
        console.error('Error deleting license:', error);
        throw error;
    }
}

function showAddLicenseForm() {
    document.getElementById('addLicenseForm').style.display = 'block';
    document.getElementById('licenseForm').reset();
    resetLicenseDocumentPreview();
    currentLicenseDocument = null;
}

function cancelAddLicense() {
    document.getElementById('addLicenseForm').style.display = 'none';
    document.getElementById('licenseForm').reset();
    resetLicenseDocumentPreview();
    currentLicenseDocument = null;
}

function updateStateFilter() {
    var stateFilter = document.getElementById('stateFilter');
    var uniqueStates = [];
    
    fishingLicenses.forEach(function(license) {
        if (uniqueStates.indexOf(license.state) === -1) {
            uniqueStates.push(license.state);
        }
    });
    
    if (stateFilter) {
        stateFilter.innerHTML = '<option value="">All States</option>';
        uniqueStates.sort().forEach(function(state) {
            stateFilter.innerHTML += '<option value="' + state + '">' + state + '</option>';
        });
    }
}

function filterLicensesByState() {
    var selectedState = document.getElementById('stateFilter').value;
    renderLicenses(selectedState);
}

function renderLicenses(filterState) {
    var container = document.getElementById('licenseContainer');
    
    if (!container) return;
    
    var filteredLicenses = filterState ? 
        fishingLicenses.filter(function(license) { return license.state === filterState; }) : 
        fishingLicenses;
    
    if (filteredLicenses.length === 0) {
        var message = filterState ? 
            'No licenses found for ' + filterState + '.' : 
            'No licenses added yet.';
        container.innerHTML = '<p style="text-align: center; color: rgba(255, 255, 255, 0.6);">' + message + '</p>';
        return;
    }
    
    var html = '';
    filteredLicenses.forEach(function(license, index) {
        html += createLicenseCard(license, fishingLicenses.indexOf(license));
    });
    
    container.innerHTML = html;
}

function createLicenseCard(license, index) {
    var isExpiringSoon = isLicenseExpiringSoon(license.endDate);
    var daysUntilExpiration = getDaysUntilExpiration(license.endDate);
    var cardClass = isExpiringSoon ? 'license-card expiring-soon' : 'license-card';
    
    var notificationHtml = '';
    if (isExpiringSoon && license.notifications) {
        notificationHtml = '<span class="expiration-notification">Expires in ' + daysUntilExpiration + ' days!</span>';
    }
    
    var documentPreview = '';
    if (license.documentData) {
        if (license.documentType === 'pdf') {
            documentPreview = '<div style="text-align: center; color: rgba(255, 255, 255, 0.7); font-size: 12px; cursor: pointer;" onclick="openDocument(\'' + license.documentData + '\', \'pdf\')">📄 PDF Document (Click to view)</div>';
        } else {
            documentPreview = '<img src="' + license.documentData + '" class="license-document-preview" alt="License" style="cursor: pointer;" onclick="openDocument(\'' + license.documentData + '\', \'image\')">';
        }
    }
    
    return '<div class="' + cardClass + '">' +
        '<div class="license-header">' +
            '<h4 class="license-title">' + license.state + ' ' + (license.type || 'Fishing License') + '</h4>' +
            notificationHtml +
        '</div>' +
        '<div class="license-details">' +
            '<div class="license-detail">' +
                '<span class="license-detail-value">' + new Date(license.startDate).toLocaleDateString() + '</span>' +
                '<div class="license-detail-label">Start Date</div>' +
            '</div>' +
            '<div class="license-detail">' +
                '<span class="license-detail-value">' + new Date(license.endDate).toLocaleDateString() + '</span>' +
                '<div class="license-detail-label">End Date</div>' +
            '</div>' +
            '<div class="license-detail">' +
                '<span class="license-detail-value">' + (license.notifications ? 'ON' : 'OFF') + '</span>' +
                '<div class="license-detail-label">Notifications</div>' +
            '</div>' +
        '</div>' +
        (documentPreview ? '<div style="text-align: center; margin: 10px 0;">' + documentPreview + '</div>' : '') +
        '<div class="license-actions">' +
            '<button class="btn btn-primary" onclick="editLicense(' + index + ')">Edit</button>' +
            '<button class="btn btn-danger" onclick="deleteLicense(' + index + ')">Delete</button>' +
        '</div>' +
    '</div>';
}

function isLicenseExpiringSoon(endDate) {
    var today = new Date();
    var expiration = new Date(endDate);
    var timeDiff = expiration.getTime() - today.getTime();
    var daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff <= 30 && daysDiff >= 0;
}

function getDaysUntilExpiration(endDate) {
    var today = new Date();
    var expiration = new Date(endDate);
    var timeDiff = expiration.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

function handleLicenseDocumentUpload(event) {
    var file = event.target.files[0];
    if (file) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showLicenseStatusMessage('File must be smaller than 10MB', 'error');
            return;
        }
        
        var reader = new FileReader();
        reader.onload = function(e) {
            currentLicenseDocument = {
                data: e.target.result,
                type: file.type.includes('pdf') ? 'pdf' : 'image',
                name: file.name
            };
            displayLicenseDocument();
        };
        reader.readAsDataURL(file);
    }
}

function displayLicenseDocument() {
    var img = document.getElementById('licenseDocumentImg');
    var placeholder = document.getElementById('licensePlaceholder');
    var removeBtn = document.getElementById('removeLicenseBtn');
    
    if (!img || !placeholder || !removeBtn) return;
    
    if (currentLicenseDocument.type === 'pdf') {
        placeholder.innerHTML = '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline></svg><p>PDF: ' + currentLicenseDocument.name + '</p>';
        img.style.display = 'none';
    } else {
        img.src = currentLicenseDocument.data;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    }
    
    removeBtn.style.display = 'inline-block';
}

function removeLicenseDocument() {
    if (confirm('Remove document?')) {
        currentLicenseDocument = null;
        resetLicenseDocumentPreview();
    }
}

function resetLicenseDocumentPreview() {
    var img = document.getElementById('licenseDocumentImg');
    var placeholder = document.getElementById('licensePlaceholder');
    var removeBtn = document.getElementById('removeLicenseBtn');
    
    if (!img || !placeholder || !removeBtn) return;
    
    img.style.display = 'none';
    img.src = '';
    placeholder.style.display = 'block';
    placeholder.innerHTML = '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline></svg><p>No document selected</p>';
    removeBtn.style.display = 'none';
}

async function saveLicense() {
    var form = document.getElementById('licenseForm');
    if (!form || !form.checkValidity()) {
        showLicenseStatusMessage('Please fill in all required fields.', 'error');
        return;
    }

    var startDate = new Date(document.getElementById('licenseStartDate').value);
    var endDate = new Date(document.getElementById('licenseEndDate').value);
    
    if (startDate >= endDate) {
        showLicenseStatusMessage('End date must be after start date.', 'error');
        return;
    }

    var newLicense = {
        state: document.getElementById('licenseState').value,
        type: document.getElementById('licenseType').value || 'Fishing License',
        startDate: document.getElementById('licenseStartDate').value,
        endDate: document.getElementById('licenseEndDate').value,
        notifications: document.getElementById('enableNotifications').checked,
        documentData: currentLicenseDocument ? currentLicenseDocument.data : null,
        documentType: currentLicenseDocument ? currentLicenseDocument.type : null
    };
    
    try {
        await saveFishingLicense(newLicense);
        await loadFishingLicenses(); // Reload from database
        showLicenseStatusMessage('License added successfully!', 'success');
        cancelAddLicense();
        renderLicenses();
        updateStateFilter();
    } catch (error) {
        showLicenseStatusMessage('Error saving license: ' + error.message, 'error');
        console.error('License save error:', error);
    }
}

function editLicense(index) {
    // For now, just show alert - full edit functionality can be added later
    alert('Edit functionality - coming soon!');
}

async function deleteLicense(index) {
    var license = fishingLicenses[index];
    if (confirm('Delete ' + license.state + ' license?')) {
        try {
            await deleteFishingLicense(license.id);
            await loadFishingLicenses(); // Reload from database
            renderLicenses();
            updateStateFilter();
            showLicenseStatusMessage('License deleted.', 'success');
        } catch (error) {
            showLicenseStatusMessage('Error deleting license: ' + error.message, 'error');
            console.error('License delete error:', error);
        }
    }
}

function showLicenseStatusMessage(message, type) {
    var statusDiv = document.getElementById('licenseStatusMessage');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'status-message status-' + type;
        statusDiv.style.display = 'block';
        setTimeout(function() {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

function openDocument(documentPath, documentType) {
    if (!documentPath) {
        showLicenseStatusMessage('Document not available', 'error');
        return;
    }
    
    // For DNR wardens, open document in a new window/tab
    var newWindow = window.open('', '_blank');
    
    if (documentType === 'pdf') {
        // For PDFs, show in iframe or direct link
        newWindow.document.write(`
            <html>
                <head>
                    <title>Fishing License Document</title>
                    <style>
                        body { margin: 0; padding: 20px; background: #f0f0f0; font-family: Arial, sans-serif; }
                        iframe { width: 100%; height: 80vh; border: none; }
                        .info { text-align: center; margin-bottom: 20px; }
                    </style>
                </head>
                <body>
                    <div class="info">
                        <h2>Fishing License Document</h2>
                        <p>Official license document for DNR verification</p>
                    </div>
                    <iframe src="${documentPath}"></iframe>
                </body>
            </html>
        `);
    } else {
        // For images, show with zoom capability
        newWindow.document.write(`
            <html>
                <head>
                    <title>Fishing License Document</title>
                    <style>
                        body { margin: 0; padding: 20px; background: #000; text-align: center; }
                        img { max-width: 100%; max-height: 90vh; cursor: zoom-in; }
                        .info { color: white; margin-bottom: 20px; }
                        .zoomed { cursor: zoom-out; max-width: none; max-height: none; }
                    </style>
                </head>
                <body>
                    <div class="info">
                        <h2 style="color: white;">Fishing License Document</h2>
                        <p style="color: white;">Click image to zoom. Official license document for DNR verification.</p>
                    </div>
                    <img src="${documentPath}" alt="License Document" onclick="this.classList.toggle('zoomed')">
                </body>
            </html>
        `);
    }
    
    newWindow.document.close();
}