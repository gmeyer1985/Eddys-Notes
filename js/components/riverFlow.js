// River Flow and Search Functions

// USGS Water Services API endpoints
var USGS_SITE_SERVICE = 'https://waterservices.usgs.gov/nwis/site/';
var USGS_INSTANTANEOUS_SERVICE = 'https://waterservices.usgs.gov/nwis/iv/';

var riverSearchTimeout;
var entryRiverSearchTimeout;
var selectedEntryRiver = null;
var flowChart;
var savedRivers = [];
var selectedRiver = null;
var riverFlowSearchTimeout;

// Popular rivers data
var popularRivers = [
    {site_no: '05331000', site_name: 'Mississippi River at St. Paul, MN', state: 'MN'},
    {site_no: '05330000', site_name: 'Minnesota River at Jordan, MN', state: 'MN'},
    {site_no: '05340500', site_name: 'St. Croix River at Stillwater, MN', state: 'MN'},
    {site_no: '05288500', site_name: 'Mississippi River at Fridley, MN', state: 'MN'},
    {site_no: '05366800', site_name: 'Chippewa River at Grand Ave at Eau Claire, WI', state: 'WI'},
    {site_no: '05365500', site_name: 'Chippewa River at Chippewa Falls, WI', state: 'WI'},
    {site_no: '05370000', site_name: 'Eau Galle River at Spring Valley, WI', state: 'WI'},
    {site_no: '05345000', site_name: 'Vermillion River Near Empire, MN', state: 'MN'},
    {site_no: '05342000', site_name: 'Kinnickinnic River Near River Falls, WI', state: 'WI'},
    {site_no: '05362000', site_name: 'Jump River at Sheldon, WI', state: 'WI'},
    {site_no: '05359500', site_name: 'South Fork Flambeau River Near Phillips, WI', state: 'WI'},
    {site_no: '05356000', site_name: 'Chippewa River Near Bruce, WI', state: 'WI'},
    {site_no: '05394500', site_name: 'Prairie River Near Merrill, WI', state: 'WI'},
    {site_no: '05395000', site_name: 'Wisconsin River at Merrill, WI', state: 'WI'},
    {site_no: '05393700', site_name: 'Spirit River at Spirit Falls, WI', state: 'WI'},
    {site_no: '09380000', site_name: 'Colorado River at Lees Ferry, AZ', state: 'AZ'},
    {site_no: '06191500', site_name: 'Yellowstone River at Corwin Springs, MT', state: 'MT'},
    {site_no: '12358500', site_name: 'Clark Fork at Deer Lodge, MT', state: 'MT'},
    {site_no: '13337000', site_name: 'Snake River at Anatone, WA', state: 'WA'},
    {site_no: '14211720', site_name: 'Sandy River below Bull Run River, OR', state: 'OR'},
    {site_no: '01463500', site_name: 'Delaware River at Trenton, NJ', state: 'NJ'},
    {site_no: '03086000', site_name: 'Beaver River at Beaver Falls, PA', state: 'PA'},
    {site_no: '01632000', site_name: 'South Fork Shenandoah River at Front Royal, VA', state: 'VA'},
    {site_no: '02102908', site_name: 'Haw River at Bynum, NC', state: 'NC'},
    {site_no: '02334430', site_name: 'Chattahoochee River at Buford Dam, GA', state: 'GA'},
    {site_no: '08158000', site_name: 'Colorado River at Austin, TX', state: 'TX'}
];

function searchRiversForEntry() {
    var searchTerm = document.getElementById('riverSearch').value.trim();
    var resultsDiv = document.getElementById('riverResults');
    
    if (searchTerm.length < 3) {
        resultsDiv.style.display = 'none';
        selectedEntryRiver = null;
        return;
    }
    
    clearTimeout(entryRiverSearchTimeout);
    entryRiverSearchTimeout = setTimeout(function() {
        performEntryRiverSearch(searchTerm);
    }, 500);
}

function performEntryRiverSearch(searchTerm) {
    var resultsDiv = document.getElementById('riverResults');
    resultsDiv.innerHTML = '<div style="padding: 10px; color: rgba(255, 255, 255, 0.7);">Searching...</div>';
    resultsDiv.style.display = 'block';
    
    // Filter rivers based on search term
    var matchingRivers = popularRivers.filter(function(river) {
        return river.site_name.toLowerCase().includes(searchTerm.toLowerCase());
    }).slice(0, 10);
    
    if (matchingRivers.length > 0) {
        displayEntrySearchResults(matchingRivers);
    } else {
        resultsDiv.innerHTML = '<div style="padding: 10px; color: rgba(255, 255, 255, 0.6);">No rivers found matching "' + searchTerm + '"</div>';
    }
}

function displayEntrySearchResults(rivers) {
    var resultsDiv = document.getElementById('riverResults');
    
    var html = '';
    rivers.forEach(function(river) {
        html += '<div style="padding: 8px; border-bottom: 1px solid rgba(139, 69, 19, 0.2); cursor: pointer;" ' +
            'onmouseover="this.style.backgroundColor=\'rgba(139, 69, 19, 0.1)\'" ' +
            'onmouseout="this.style.backgroundColor=\'transparent\'" ' +
            'onclick="selectRiverForEntry(\'' + river.site_no + '\', \'' + river.site_name.replace(/'/g, "\\'") + '\')">' +
            '<div style="font-weight: bold; color: #CD853F;">' + river.site_no + ' - ' + river.site_name + '</div>' +
            '<div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">(' + river.state + ')</div>' +
            '</div>';
    });
    
    resultsDiv.innerHTML = html;
}

function selectRiverForEntry(siteNumber, siteName) {
    selectedEntryRiver = {
        siteNumber: siteNumber,
        siteName: siteName
    };
    
    document.getElementById('riverSearch').value = siteName;
    document.getElementById('selectedSiteNumber').value = siteNumber;
    document.getElementById('riverResults').style.display = 'none';
    
    // Get current flow data
    getCurrentFlowData(siteNumber);
}

function getCurrentFlowData(siteNumber) {
    var flowInput = document.getElementById('waterFlow');
    var selectedDate = document.getElementById('entryDate').value;
    
    if (!selectedDate) {
        flowInput.value = 'Please select a date first';
        return;
    }
    
    flowInput.value = 'Loading flow data...';
    
    // Get flow data for the specific date selected
    console.log('Fetching flow data for site:', siteNumber, 'date:', selectedDate);
    getFlowDataForDate(siteNumber, selectedDate)
        .then(function(flowData) {
            console.log('Flow data received:', flowData);
            if (flowData && flowData.flowRate !== null) {
                flowInput.value = Math.round(flowData.flowRate) + ' CFS';
            } else {
                flowInput.value = 'No data for ' + selectedDate;
            }
        })
        .catch(function(error) {
            console.error('Flow data error:', error);
            // Check if it's a CORS error and provide fallback
            if (error.message && (error.message.includes('CORS') || error.message.includes('fetch') || error.message.includes('NetworkError'))) {
                console.log('CORS/Network error detected, using simulated flow data');
                var simulatedFlow = getSimulatedFlowData(siteNumber);
                flowInput.value = simulatedFlow + ' CFS (simulated - run from web server for real data)';
            } else {
                flowInput.value = 'Error: ' + (error.message || 'Unknown error');
            }
        });
}

function getSimulatedFlowData(siteNumber) {
    // Generate realistic flow data based on site number
    var baseFlow = 500; // Base flow in CFS
    var siteVariation = (parseInt(siteNumber) % 1000) / 10; // Site-specific variation
    var seasonalVariation = Math.sin(new Date().getMonth() * Math.PI / 6) * 200; // Seasonal variation
    var randomVariation = (Math.random() - 0.5) * 100; // Random daily variation
    
    return Math.round(Math.max(50, baseFlow + siteVariation + seasonalVariation + randomVariation));
}

function getFlowDataForDate(siteNumber, date) {
    return new Promise(function(resolve, reject) {
        var selectedDate = new Date(date);
        var today = new Date();
        
        // Check if date is today or recent (use instantaneous data)
        var daysDiff = Math.floor((today - selectedDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 3) {
            // Use instantaneous data for recent dates
            getInstantaneousFlowData(siteNumber, date).then(resolve).catch(reject);
        } else {
            // Use daily values for historical dates
            getHistoricalFlowData(siteNumber, date).then(resolve).catch(reject);
        }
    });
}

function getInstantaneousFlowData(siteNumber, date) {
    return new Promise(function(resolve, reject) {
        var params = new URLSearchParams({
            format: 'json',
            sites: siteNumber,
            parameterCd: '00060', // Stream flow in CFS
            startDT: date,
            endDT: date
        });
        
        fetch(USGS_INSTANTANEOUS_SERVICE + '?' + params.toString())
            .then(function(response) {
                if (!response.ok) throw new Error('USGS API request failed: ' + response.status + ' ' + response.statusText);
                return response.json();
            })
            .then(function(data) {
                if (data.value && data.value.timeSeries && data.value.timeSeries.length > 0) {
                    var timeSeries = data.value.timeSeries[0];
                    var values = timeSeries.values[0].value;
                    
                    if (values && values.length > 0) {
                        // Get average flow for the day
                        var totalFlow = 0;
                        var validReadings = 0;
                        
                        values.forEach(function(reading) {
                            var flow = parseFloat(reading.value);
                            if (!isNaN(flow)) {
                                totalFlow += flow;
                                validReadings++;
                            }
                        });
                        
                        if (validReadings > 0) {
                            resolve({ flowRate: totalFlow / validReadings });
                        } else {
                            resolve({ flowRate: null });
                        }
                    } else {
                        resolve({ flowRate: null });
                    }
                } else {
                    resolve({ flowRate: null });
                }
            })
            .catch(function(error) {
                console.error('Instantaneous flow data fetch error:', error);
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    reject(new Error('CORS: Cannot access USGS API from local file. Please run from a web server.'));
                } else {
                    reject(new Error('Failed to fetch instantaneous flow data: ' + error.message));
                }
            });
    });
}

function getHistoricalFlowData(siteNumber, date) {
    return new Promise(function(resolve, reject) {
        // Use USGS Daily Values Service for historical data
        var dailyValuesService = 'https://waterservices.usgs.gov/nwis/dv/';
        
        var params = new URLSearchParams({
            format: 'json',
            sites: siteNumber,
            parameterCd: '00060', // Stream flow in CFS
            startDT: date,
            endDT: date,
            statCd: '00003' // Mean daily flow
        });
        
        fetch(dailyValuesService + '?' + params.toString())
            .then(function(response) {
                if (!response.ok) throw new Error('USGS Daily Values API request failed: ' + response.status + ' ' + response.statusText);
                return response.json();
            })
            .then(function(data) {
                if (data.value && data.value.timeSeries && data.value.timeSeries.length > 0) {
                    var timeSeries = data.value.timeSeries[0];
                    var values = timeSeries.values[0].value;
                    
                    if (values && values.length > 0) {
                        var flowValue = parseFloat(values[0].value);
                        if (!isNaN(flowValue)) {
                            resolve({ flowRate: flowValue });
                        } else {
                            resolve({ flowRate: null });
                        }
                    } else {
                        resolve({ flowRate: null });
                    }
                } else {
                    resolve({ flowRate: null });
                }
            })
            .catch(function(error) {
                console.error('Historical flow data fetch error:', error);
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    reject(new Error('CORS: Cannot access USGS API from local file. Please run from a web server.'));
                } else {
                    reject(new Error('Failed to fetch historical flow data: ' + error.message));
                }
            });
    });
}

// Flow Graph Functions
function showFlowGraph() {
    var selectedSiteNumber = document.getElementById('selectedSiteNumber').value;
    var selectedDate = document.getElementById('entryDate').value;
    var riverName = document.getElementById('riverSearch').value;
    
    if (!selectedSiteNumber || !selectedDate) {
        alert('Please select both a river and a date first.');
        return;
    }
    
    var modal = document.getElementById('flowGraphModal');
    var title = document.getElementById('graphTitle');
    title.textContent = 'Flow Rate Graph - ' + riverName + ' (' + selectedDate + ')';
    modal.style.display = 'block';
    
    // Fetch and display hourly data
    getHourlyFlowData(selectedSiteNumber, selectedDate)
        .then(function(hourlyData) {
            displayFlowChart(hourlyData, riverName, selectedDate);
        })
        .catch(function(error) {
            console.error('Error fetching hourly flow data:', error);
            alert('Error loading flow data. Please try again.');
            closeFlowGraph();
        });
}

function showTableFlowGraph(entryIndex) {
    var entry = fishingData[entryIndex];
    
    if (!entry.siteNumber || !entry.date) {
        alert('Missing river or date information for this entry.');
        return;
    }
    
    var modal = document.getElementById('flowGraphModal');
    var title = document.getElementById('graphTitle');
    title.textContent = 'Flow Rate Graph - ' + (entry.riverName || 'Unknown River') + ' (' + entry.date + ')';
    modal.style.display = 'block';
    
    // Fetch and display hourly data using entry data
    getHourlyFlowData(entry.siteNumber, entry.date)
        .then(function(hourlyData) {
            displayFlowChart(hourlyData, entry.riverName || 'Unknown River', entry.date);
        })
        .catch(function(error) {
            console.error('Error fetching hourly flow data:', error);
            alert('Error loading flow data. Please try again.');
            closeFlowGraph();
        });
}

function closeFlowGraph() {
    var modal = document.getElementById('flowGraphModal');
    modal.style.display = 'none';
    
    // Destroy existing chart
    if (flowChart) {
        flowChart.destroy();
        flowChart = null;
    }
}

function getHourlyFlowData(siteNumber, date) {
    return new Promise(function(resolve, reject) {
        var selectedDate = new Date(date);
        var today = new Date();
        var daysDiff = Math.floor((today - selectedDate) / (1000 * 60 * 60 * 24));
        
        // For recent dates (≤7 days), fetch instantaneous data with hourly intervals
        if (daysDiff <= 7) {
            var params = new URLSearchParams({
                format: 'json',
                sites: siteNumber,
                parameterCd: '00060',
                startDT: date + 'T00:00',
                endDT: date + 'T23:59'
            });
            
            fetch(USGS_INSTANTANEOUS_SERVICE + '?' + params.toString())
                .then(function(response) {
                    if (!response.ok) throw new Error('Hourly flow request failed');
                    return response.json();
                })
                .then(function(data) {
                    if (data.value && data.value.timeSeries && data.value.timeSeries.length > 0) {
                        var timeSeries = data.value.timeSeries[0];
                        var values = timeSeries.values[0].value;
                        
                        if (values && values.length > 0) {
                            // Process data to hourly intervals
                            var hourlyData = processToHourlyData(values, date);
                            resolve(hourlyData);
                        } else {
                            resolve([]);
                        }
                    } else {
                        resolve([]);
                    }
                })
                .catch(function(error) {
                    reject(error);
                });
        } else {
            // For historical dates, use daily values (single point)
            getHistoricalFlowData(siteNumber, date)
                .then(function(flowData) {
                    if (flowData && flowData.flowRate !== null) {
                        // Create mock hourly data from daily average
                        var hourlyData = [];
                        for (var hour = 0; hour < 24; hour++) {
                            hourlyData.push({
                                time: hour.toString().padStart(2, '0') + ':00',
                                flow: flowData.flowRate
                            });
                        }
                        resolve(hourlyData);
                    } else {
                        resolve([]);
                    }
                })
                .catch(reject);
        }
    });
}

function processToHourlyData(values, date) {
    var hourlyData = [];
    var hourlyAverages = {};
    
    // Group values by hour
    values.forEach(function(reading) {
        var dateTime = new Date(reading.dateTime);
        var hour = dateTime.getHours();
        var flow = parseFloat(reading.value);
        
        if (!isNaN(flow)) {
            if (!hourlyAverages[hour]) {
                hourlyAverages[hour] = { total: 0, count: 0 };
            }
            hourlyAverages[hour].total += flow;
            hourlyAverages[hour].count++;
        }
    });
    
    // Create hourly averages
    for (var hour = 0; hour < 24; hour++) {
        var timeStr = hour.toString().padStart(2, '0') + ':00';
        if (hourlyAverages[hour]) {
            hourlyData.push({
                time: timeStr,
                flow: Math.round(hourlyAverages[hour].total / hourlyAverages[hour].count * 100) / 100
            });
        } else {
            // No data for this hour
            hourlyData.push({
                time: timeStr,
                flow: null
            });
        }
    }
    
    return hourlyData;
}

function displayFlowChart(hourlyData, riverName, date) {
    var ctx = document.getElementById('flowChart').getContext('2d');
    
    // Destroy existing chart
    if (flowChart) {
        flowChart.destroy();
    }
    
    var labels = hourlyData.map(function(d) { return d.time; });
    var data = hourlyData.map(function(d) { return d.flow; });
    
    flowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Flow Rate (CFS)',
                data: data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (24-hour format)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Flow Rate (CFS)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: riverName + ' - ' + date
                },
                legend: {
                    display: true
                }
            },
            elements: {
                point: {
                    backgroundColor: '#3498db'
                }
            }
        }
    });
}

// River Flow Modal Functions
function showRiverFlowModal() {
    loadSavedRivers();
    var modal = document.getElementById('riverFlowModal');
    modal.style.display = 'block';
    renderSavedRivers();
}

function closeRiverFlowModal() {
    var modal = document.getElementById('riverFlowModal');
    modal.style.display = 'none';
    hideRiverFlowStatusMessage();
    
    // Clear search
    document.getElementById('riverFlowSearch').value = '';
    document.getElementById('riverFlowSearchResults').style.display = 'none';
    selectedRiver = null;
}

// Rivers API Functions
async function loadSavedRivers() {
    try {
        const rivers = await apiRequest('/rivers');
        savedRivers = rivers.map(river => ({
            id: river.id,
            siteNumber: river.site_number,
            riverName: river.river_name,
            location: river.location,
            currentFlow: river.current_flow,
            lastUpdated: river.last_updated
        }));
    } catch (error) {
        console.error('Error loading rivers:', error);
        savedRivers = [];
    }
}

async function saveRiver(riverData) {
    try {
        const data = {
            site_number: riverData.siteNumber,
            river_name: riverData.riverName,
            location: riverData.location,
            current_flow: riverData.currentFlow
        };

        await apiRequest('/rivers', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Error saving river:', error);
        throw error;
    }
}

async function deleteRiver(riverId) {
    try {
        await apiRequest(`/rivers/${riverId}`, { method: 'DELETE' });
    } catch (error) {
        console.error('Error deleting river:', error);
        throw error;
    }
}

function searchRiversForFlow() {
    var searchTerm = document.getElementById('riverFlowSearch').value.trim();
    var resultsDiv = document.getElementById('riverFlowSearchResults');
    
    if (searchTerm.length < 3) {
        resultsDiv.style.display = 'none';
        selectedRiver = null;
        return;
    }
    
    clearTimeout(riverFlowSearchTimeout);
    riverFlowSearchTimeout = setTimeout(function() {
        performRiverFlowSearch(searchTerm);
    }, 500);
}

function performRiverFlowSearch(searchTerm) {
    var resultsDiv = document.getElementById('riverFlowSearchResults');
    resultsDiv.innerHTML = '<div style="padding: 10px;">Searching...</div>';
    resultsDiv.style.display = 'block';
    
    var matchingRivers = popularRivers.filter(function(river) {
        return river.site_name.toLowerCase().includes(searchTerm.toLowerCase());
    }).slice(0, 8);
    
    if (matchingRivers.length > 0) {
        displayRiverFlowSearchResults(matchingRivers);
    } else {
        resultsDiv.innerHTML = '<div style="padding: 10px; color: #666;">No rivers found matching "' + searchTerm + '"</div>';
    }
}

function displayRiverFlowSearchResults(rivers) {
    var resultsDiv = document.getElementById('riverFlowSearchResults');
    
    var html = '';
    rivers.forEach(function(river) {
        html += '<div style="padding: 8px; border-bottom: 1px solid rgba(139, 69, 19, 0.2); cursor: pointer;" ' +
            'onmouseover="this.style.backgroundColor=\'rgba(139, 69, 19, 0.1)\'" ' +
            'onmouseout="this.style.backgroundColor=\'transparent\'" ' +
            'onclick="selectRiverForFlow(\'' + river.site_no + '\', \'' + river.site_name.replace(/'/g, "\\'") + '\')">' +
            '<div style="font-weight: bold; color: #CD853F;">' + river.site_no + ' - ' + river.site_name + '</div>' +
            '<div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">(' + river.state + ')</div>' +
            '</div>';
    });
    
    resultsDiv.innerHTML = html;
}

function selectRiverForFlow(siteNumber, siteName) {
    selectedRiver = {
        siteNumber: siteNumber,
        siteName: siteName
    };
    
    document.getElementById('riverFlowSearch').value = siteName;
    document.getElementById('riverFlowSearchResults').style.display = 'none';
}

async function addSelectedRiver() {
    if (!selectedRiver) {
        showRiverFlowStatusMessage('Please select a river from the search results first.', 'error');
        return;
    }
    
    // Check if river is already saved
    var existingRiver = savedRivers.find(function(r) {
        return r.siteNumber === selectedRiver.siteNumber;
    });
    
    if (existingRiver) {
        showRiverFlowStatusMessage('This river is already in your saved list.', 'error');
        return;
    }
    
    try {
        await saveRiver({
            siteNumber: selectedRiver.siteNumber,
            riverName: selectedRiver.siteName,
            location: '',
            currentFlow: null
        });
        await loadSavedRivers(); // Reload from database
        showRiverFlowStatusMessage('River added successfully!', 'success');
    } catch (error) {
        showRiverFlowStatusMessage('Error adding river: ' + error.message, 'error');
        console.error('River add error:', error);
        return;
    }
    
    // Clear search
    document.getElementById('riverFlowSearch').value = '';
    selectedRiver = null;
    
    // Refresh display
    renderSavedRivers();
    
    // Fetch flow data for the new river
    updateRiverFlowData(savedRivers.length - 1);
}

function renderSavedRivers() {
    var container = document.getElementById('savedRiversContainer');
    var noRiversMsg = document.getElementById('noRiversMessage');
    
    if (savedRivers.length === 0) {
        if (noRiversMsg) noRiversMsg.style.display = 'block';
        return;
    }
    
    if (noRiversMsg) noRiversMsg.style.display = 'none';
    
    var html = '';
    savedRivers.forEach(function(river, index) {
        html += createRiverCard(river, index);
    });
    
    if (container) container.innerHTML = html;
}

function createRiverCard(river, index) {
    var lastUpdatedText = river.lastUpdated ? 
        'Updated: ' + new Date(river.lastUpdated).toLocaleString() : 
        'Never updated';
        
    return '<div class="river-card">' +
        '<div class="river-card-header">' +
            '<h4 class="river-name">' + river.riverName + '</h4>' +
            '<span class="river-site-number">Site: ' + river.siteNumber + '</span>' +
        '</div>' +
        '<div class="river-flow-data">' +
            '<div class="flow-metric">' +
                '<span class="flow-value">' + (river.currentFlow || 'N/A') + '</span>' +
                '<div class="flow-label">Current CFS</div>' +
            '</div>' +
            '<div class="flow-metric">' +
                '<span class="flow-value" style="font-size: 1rem;">' + (river.flowStatus || 'Unknown') + '</span>' +
                '<div class="flow-label">Status</div>' +
            '</div>' +
        '</div>' +
        '<div class="river-actions">' +
            '<button class="btn btn-primary" onclick="updateRiverFlowData(' + index + ')">Refresh</button>' +
            '<button class="btn btn-primary" onclick="showRiverFlowGraph(' + index + ')">Graph</button>' +
            '<button class="btn btn-danger" onclick="removeRiver(' + index + ')">Remove</button>' +
        '</div>' +
        '<div class="last-updated">' + lastUpdatedText + '</div>' +
    '</div>';
}

function updateRiverFlowData(index) {
    var river = savedRivers[index];
    river.flowStatus = 'Loading...';
    renderSavedRivers();
    
    getFlowDataForDate(river.siteNumber, new Date().toISOString().split('T')[0])
        .then(function(flowData) {
            if (flowData && flowData.flowRate !== null) {
                river.currentFlow = Math.round(flowData.flowRate) + ' CFS';
                river.flowStatus = 'Active';
                river.lastUpdated = new Date().toISOString();
            } else {
                river.currentFlow = 'No Data';
                river.flowStatus = 'No Data';
                river.lastUpdated = new Date().toISOString();
            }
            renderSavedRivers();
        })
        .catch(function(error) {
            river.currentFlow = 'Error';
            river.flowStatus = 'Error';
            river.lastUpdated = new Date().toISOString();
            renderSavedRivers();
        });
}

function showRiverFlowGraph(index) {
    var river = savedRivers[index];
    var today = new Date().toISOString().split('T')[0];
    
    // Use the existing graph functionality
    getHourlyFlowData(river.siteNumber, today)
        .then(function(hourlyData) {
            // Show graph modal
            var modal = document.getElementById('flowGraphModal');
            var title = document.getElementById('graphTitle');
            title.textContent = 'Flow Rate Graph - ' + river.riverName + ' (Today)';
            modal.style.display = 'block';
            
            displayFlowChart(hourlyData, river.riverName, today);
        })
        .catch(function(error) {
            showRiverFlowStatusMessage('Error loading graph data.', 'error');
        });
}

async function removeRiver(index) {
    var river = savedRivers[index];
    if (confirm('Remove "' + (river.riverName || river.siteName) + '" from your saved rivers?')) {
        try {
            await deleteRiver(river.id);
            await loadSavedRivers(); // Reload from database
            renderSavedRivers();
            showRiverFlowStatusMessage('River removed successfully.', 'success');
        } catch (error) {
            showRiverFlowStatusMessage('Error removing river: ' + error.message, 'error');
            console.error('River remove error:', error);
        }
    }
}

function showRiverFlowStatusMessage(message, type) {
    var statusDiv = document.getElementById('riverFlowStatusMessage');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'status-message status-' + type;
        statusDiv.style.display = 'block';
    }
}

function hideRiverFlowStatusMessage() {
    var statusDiv = document.getElementById('riverFlowStatusMessage');
    if (statusDiv) statusDiv.style.display = 'none';
}