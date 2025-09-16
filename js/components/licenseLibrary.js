// License Library Functions

var fishingLicenses = [];
var currentLicenseDocument = null;

function showLicenseLibraryModal() {
    loadFishingLicenses();
    var modal = document.getElementById('licenseLibraryModal');
    modal.style.display = 'block';
    renderLicenses();
    updateStateFilter();
    updateLicenseStatistics();
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

async function updateFishingLicense(licenseData) {
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

        const result = await apiRequest(`/licenses/${licenseData.id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });

        return result;
    } catch (error) {
        console.error('Error updating license:', error);
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
    editingLicenseIndex = null;
    document.getElementById('addLicenseForm').style.display = 'block';
    document.getElementById('licenseForm').reset();
    resetLicenseDocumentPreview();
    currentLicenseDocument = null;

    // Reset form title and button text for adding
    document.querySelector('#addLicenseForm h3').textContent = 'Add New Fishing License';
    document.querySelector('#licenseForm button[type="submit"]').textContent = 'Save License';
}

function cancelAddLicense() {
    editingLicenseIndex = null;
    document.getElementById('addLicenseForm').style.display = 'none';
    document.getElementById('licenseForm').reset();
    resetLicenseDocumentPreview();
    currentLicenseDocument = null;

    // Reset form title and button text
    document.querySelector('#addLicenseForm h3').textContent = 'Add New Fishing License';
    document.querySelector('#licenseForm button[type="submit"]').textContent = 'Save License';
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


function renderLicenses(filterState, searchTerm) {
    var container = document.getElementById('licenseContainer');

    if (!container) return;

    var filteredLicenses = fishingLicenses;

    // Apply state filter
    if (filterState) {
        filteredLicenses = filteredLicenses.filter(function(license) {
            return license.state === filterState;
        });
    }

    // Apply search filter
    if (searchTerm) {
        var searchLower = searchTerm.toLowerCase();
        filteredLicenses = filteredLicenses.filter(function(license) {
            return license.state.toLowerCase().includes(searchLower) ||
                   (license.type && license.type.toLowerCase().includes(searchLower)) ||
                   license.startDate.includes(searchTerm) ||
                   license.endDate.includes(searchTerm);
        });
    }

    if (filteredLicenses.length === 0) {
        var message = 'No licenses found matching your criteria.';
        if (filterState && searchTerm) {
            message = 'No licenses found for "' + searchTerm + '" in ' + filterState + '.';
        } else if (filterState) {
            message = 'No licenses found for ' + filterState + '.';
        } else if (searchTerm) {
            message = 'No licenses found matching "' + searchTerm + '".';
        } else {
            message = 'No licenses added yet.';
        }
        container.innerHTML = '<p style="text-align: center; color: rgba(255, 255, 255, 0.6);">' + message + '</p>';
        return;
    }

    var html = '';
    filteredLicenses.forEach(function(license, index) {
        html += createLicenseCard(license, fishingLicenses.indexOf(license));
    });

    container.innerHTML = html;
}

function searchLicenses() {
    var searchTerm = document.getElementById('licenseSearch').value;
    var filterState = document.getElementById('stateFilter').value;
    renderLicenses(filterState, searchTerm);
}

function filterLicensesByState() {
    var selectedState = document.getElementById('stateFilter').value;
    var searchTerm = document.getElementById('licenseSearch').value;
    renderLicenses(selectedState, searchTerm);
}

function createLicenseCard(license, index) {
    var expirationStatus = getLicenseExpirationStatus(license.endDate);
    var cardClass = 'license-card';

    var notificationHtml = '';
    var statusMessage = '';

    if (expirationStatus.status === 'expired') {
        statusMessage = 'Expired ' + expirationStatus.days + ' days ago';
        cardClass += ' expired';
    } else if (expirationStatus.status === 'critical') {
        statusMessage = 'Expires in ' + expirationStatus.days + ' days - URGENT!';
        cardClass += ' critical';
    } else if (expirationStatus.status === 'warning') {
        statusMessage = 'Expires in ' + expirationStatus.days + ' days';
        cardClass += ' warning';
    } else {
        statusMessage = 'Valid for ' + expirationStatus.days + ' more days';
        cardClass += ' valid';
    }

    if (license.notifications && expirationStatus.status !== 'valid') {
        notificationHtml = '<span class="expiration-notification" style="background-color: ' + expirationStatus.bgColor + '; color: ' + expirationStatus.color + '; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid ' + expirationStatus.color + '30;">' + statusMessage + '</span>';
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
            '<button class="btn btn-sm btn-success" onclick="editLicense(' + index + ')" title="Edit License" style="margin-right: 8px; padding: 6px 12px; font-size: 12px;">✏️ Edit</button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteLicense(' + index + ')" title="Delete License" style="padding: 6px 12px; font-size: 12px;">🗑️ Delete</button>' +
        '</div>' +
    '</div>';
    
    // Initialize Lucide icons after content is added
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 100);
}

function isLicenseExpiringSoon(endDate) {
    var today = new Date();
    var expiration = new Date(endDate);
    var timeDiff = expiration.getTime() - today.getTime();
    var daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff <= 30 && daysDiff >= 0;
}

function getLicenseExpirationStatus(endDate) {
    var today = new Date();
    var expiration = new Date(endDate);
    var timeDiff = expiration.getTime() - today.getTime();
    var daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
        return { status: 'expired', days: Math.abs(daysDiff), color: '#F44336', bgColor: 'rgba(244, 67, 54, 0.2)' };
    } else if (daysDiff <= 7) {
        return { status: 'critical', days: daysDiff, color: '#F44336', bgColor: 'rgba(244, 67, 54, 0.2)' };
    } else if (daysDiff <= 30) {
        return { status: 'warning', days: daysDiff, color: '#FF9800', bgColor: 'rgba(255, 152, 0, 0.2)' };
    } else {
        return { status: 'valid', days: daysDiff, color: '#4CAF50', bgColor: 'rgba(76, 175, 80, 0.1)' };
    }
}

function getDaysUntilExpiration(endDate) {
    var today = new Date();
    var expiration = new Date(endDate);
    var timeDiff = expiration.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

function updateLicenseStatistics() {
    var totalCount = fishingLicenses.length;
    var expiringSoonCount = 0;
    var expiredCount = 0;

    fishingLicenses.forEach(function(license) {
        var expirationStatus = getLicenseExpirationStatus(license.endDate);

        if (expirationStatus.status === 'expired') {
            expiredCount++;
        } else if (expirationStatus.status === 'critical' || expirationStatus.status === 'warning') {
            expiringSoonCount++;
        }
    });

    // Update statistics display
    document.getElementById('totalLicensesCount').textContent = totalCount;
    document.getElementById('expiringSoonCount').textContent = expiringSoonCount;
    document.getElementById('expiredCount').textContent = expiredCount;
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

    var licenseData = {
        state: document.getElementById('licenseState').value,
        type: document.getElementById('licenseType').value || 'Fishing License',
        startDate: document.getElementById('licenseStartDate').value,
        endDate: document.getElementById('licenseEndDate').value,
        notifications: document.getElementById('enableNotifications').checked,
        documentData: currentLicenseDocument ? currentLicenseDocument.data : null,
        documentType: currentLicenseDocument ? currentLicenseDocument.type : null
    };

    try {
        if (editingLicenseIndex !== null) {
            // Update existing license
            var existingLicense = fishingLicenses[editingLicenseIndex];
            licenseData.id = existingLicense.id;
            await updateFishingLicense(licenseData);
            showLicenseStatusMessage('License updated successfully!', 'success');
        } else {
            // Add new license
            await saveFishingLicense(licenseData);
            showLicenseStatusMessage('License added successfully!', 'success');
        }

        await loadFishingLicenses(); // Reload from database
        cancelAddLicense();
        renderLicenses();
        updateStateFilter();
        updateLicenseStatistics();
    } catch (error) {
        showLicenseStatusMessage('Error saving license: ' + error.message, 'error');
        console.error('License save error:', error);
    }
}

var editingLicenseIndex = null;

function editLicense(index) {
    editingLicenseIndex = index;
    var license = fishingLicenses[index];

    // Show the form
    showAddLicenseForm();

    // Change form title and button text
    document.querySelector('#addLicenseForm h3').textContent = 'Edit Fishing License';
    document.querySelector('#licenseForm button[type="submit"]').textContent = 'Update License';

    // Populate form with existing data
    document.getElementById('licenseState').value = license.state;
    document.getElementById('licenseType').value = license.type || '';
    document.getElementById('licenseStartDate').value = license.startDate;
    document.getElementById('licenseEndDate').value = license.endDate;
    document.getElementById('enableNotifications').checked = license.notifications;

    // Load existing document if available
    if (license.documentData) {
        currentLicenseDocument = {
            data: license.documentData,
            type: license.documentType,
            name: 'Existing Document'
        };
        displayLicenseDocument();
    }
}

async function deleteLicense(index) {
    var license = fishingLicenses[index];
    if (confirm('Delete ' + license.state + ' license?')) {
        try {
            await deleteFishingLicense(license.id);
            await loadFishingLicenses(); // Reload from database
            renderLicenses();
            updateStateFilter();
            updateLicenseStatistics();
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

var currentZoomLevel = 100;
var currentDocumentPath = '';
var currentDocumentType = '';

function openDocument(documentPath, documentType) {
    if (!documentPath) {
        showLicenseStatusMessage('Document not available', 'error');
        return;
    }

    currentDocumentPath = documentPath;
    currentDocumentType = documentType;
    currentZoomLevel = 100;

    // Show the modal
    var modal = document.getElementById('documentViewerModal');
    var imageViewer = document.getElementById('documentViewerImage');
    var pdfViewer = document.getElementById('documentViewerPdf');
    var loading = document.getElementById('documentViewerLoading');
    var title = document.getElementById('documentViewerTitle');
    var typeLabel = document.getElementById('documentViewerType');
    var zoomLevel = document.getElementById('documentZoomLevel');

    // Reset viewers
    imageViewer.style.display = 'none';
    pdfViewer.style.display = 'none';
    loading.style.display = 'block';

    // Set title and type
    title.textContent = 'Fishing License Document';
    typeLabel.textContent = documentType.toUpperCase();
    zoomLevel.textContent = '100%';

    // Show modal
    modal.style.display = 'block';

    // Load document
    if (documentType === 'pdf') {
        pdfViewer.src = documentPath;
        pdfViewer.onload = function() {
            loading.style.display = 'none';
            pdfViewer.style.display = 'block';
        };
    } else {
        imageViewer.src = documentPath;
        imageViewer.onload = function() {
            loading.style.display = 'none';
            imageViewer.style.display = 'block';
            updateImageZoom();
            addTouchGestures(imageViewer);
        };
    }
}

function closeDocumentViewer() {
    var modal = document.getElementById('documentViewerModal');
    modal.style.display = 'none';

    // Reset
    document.getElementById('documentViewerImage').src = '';
    document.getElementById('documentViewerPdf').src = '';
    currentZoomLevel = 100;
}

function updateImageZoom() {
    var imageViewer = document.getElementById('documentViewerImage');
    var zoomLevel = document.getElementById('documentZoomLevel');

    if (currentDocumentType !== 'pdf') {
        imageViewer.style.transform = `scale(${currentZoomLevel / 100})`;
        imageViewer.style.cursor = currentZoomLevel < 200 ? 'zoom-in' : 'zoom-out';
        zoomLevel.textContent = currentZoomLevel + '%';
    }
}

// Add event listeners for zoom controls and keyboard support
document.addEventListener('DOMContentLoaded', function() {
    var zoomInBtn = document.getElementById('documentZoomIn');
    var zoomOutBtn = document.getElementById('documentZoomOut');
    var downloadBtn = document.getElementById('documentDownload');

    // Keyboard support
    document.addEventListener('keydown', function(event) {
        var modal = document.getElementById('documentViewerModal');
        if (modal && modal.style.display === 'block') {
            if (event.key === 'Escape') {
                closeDocumentViewer();
            } else if (event.key === '=' || event.key === '+') {
                if (currentZoomLevel < 200) {
                    currentZoomLevel += 25;
                    updateImageZoom();
                }
            } else if (event.key === '-') {
                if (currentZoomLevel > 50) {
                    currentZoomLevel -= 25;
                    updateImageZoom();
                }
            }
        }
    });

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', function() {
            if (currentZoomLevel < 200) {
                currentZoomLevel += 25;
                updateImageZoom();
            }
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', function() {
            if (currentZoomLevel > 50) {
                currentZoomLevel -= 25;
                updateImageZoom();
            }
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            if (currentDocumentPath) {
                var link = document.createElement('a');
                link.href = currentDocumentPath;
                link.download = 'license-document.' + (currentDocumentType === 'pdf' ? 'pdf' : 'jpg');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });
    }
});

// Mobile touch gestures for image viewer
function addTouchGestures(imageElement) {
    if (!('ontouchstart' in window)) return; // Skip if not touch device

    let initialDistance = 0;
    let initialZoom = currentZoomLevel;
    let isPinching = false;

    imageElement.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            isPinching = true;
            initialDistance = getTouchDistance(e.touches[0], e.touches[1]);
            initialZoom = currentZoomLevel;
            e.preventDefault();
        }
    }, { passive: false });

    imageElement.addEventListener('touchmove', function(e) {
        if (isPinching && e.touches.length === 2) {
            const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
            const scaleChange = currentDistance / initialDistance;
            let newZoom = Math.round(initialZoom * scaleChange);

            // Constrain zoom level
            newZoom = Math.max(50, Math.min(200, newZoom));

            if (newZoom !== currentZoomLevel) {
                currentZoomLevel = newZoom;
                updateImageZoom();
            }
            e.preventDefault();
        }
    }, { passive: false });

    imageElement.addEventListener('touchend', function(e) {
        if (e.touches.length < 2) {
            isPinching = false;
        }
    });

    // Double tap to reset zoom
    let lastTap = 0;
    imageElement.addEventListener('touchend', function(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 500 && tapLength > 0 && !isPinching) {
            // Double tap detected
            currentZoomLevel = currentZoomLevel === 100 ? 150 : 100;
            updateImageZoom();
            e.preventDefault();
        }
        lastTap = currentTime;
    });
}

function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}