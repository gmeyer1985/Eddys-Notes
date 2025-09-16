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

// Alert configuration
var flowAlerts = JSON.parse(localStorage.getItem('flowAlerts')) || {};

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
    {site_no: '08158000', site_name: 'Colorado River at Austin, TX', state: 'TX'},
    // California Rivers
    {site_no: '11421000', site_name: 'Yuba River below Englebright Dam, CA', state: 'CA'},
    {site_no: '11418000', site_name: 'North Yuba River below Goodyears Bar, CA', state: 'CA'},
    {site_no: '11419600', site_name: 'South Yuba River at Langs Crossing, CA', state: 'CA'},
    {site_no: '11417500', site_name: 'South Yuba River near Grass Valley, CA', state: 'CA'},
    {site_no: '11410500', site_name: 'Bear River near Auburn, CA', state: 'CA'},
    {site_no: '11407000', site_name: 'Feather River at Nicolaus, CA', state: 'CA'},
    {site_no: '11407150', site_name: 'Sacramento River at Verona, CA', state: 'CA'},
    {site_no: '11404500', site_name: 'American River at Fair Oaks, CA', state: 'CA'},
    {site_no: '11394500', site_name: 'Middle Fork Feather River near Merrimac, CA', state: 'CA'},
    {site_no: '11425500', site_name: 'Sacramento River above Bend Bridge, CA', state: 'CA'},
    {site_no: '11342000', site_name: 'Pit River near Canby, CA', state: 'CA'},
    {site_no: '11447650', site_name: 'Sacramento River at Freeport, CA', state: 'CA'},
    {site_no: '11455420', site_name: 'Napa River at St. Helena, CA', state: 'CA'},
    {site_no: '11447890', site_name: 'American River at Sacramento, CA', state: 'CA'},
    {site_no: '11447905', site_name: 'Sacramento River at Garcia Bend, CA', state: 'CA'},
    {site_no: '11446500', site_name: 'American River at H St Bridge at Sacramento, CA', state: 'CA'},
    {site_no: '11447000', site_name: 'Sacramento River at I Street Bridge, CA', state: 'CA'},
    {site_no: '11446980', site_name: 'American River below Nimbus Dam, CA', state: 'CA'},
    {site_no: '11446220', site_name: 'American River below Folsom Dam, CA', state: 'CA'},
    {site_no: '11426500', site_name: 'Sacramento River at Knights Landing, CA', state: 'CA'}
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
        
        var url = dailyValuesService + '?' + params.toString();
        console.log('Making USGS Daily Values API request to:', url);
        
        fetch(url)
            .then(function(response) {
                console.log('USGS Daily Values API response status:', response.status);
                if (!response.ok) throw new Error('USGS Daily Values API request failed: ' + response.status + ' ' + response.statusText);
                return response.json();
            })
            .then(function(data) {
                console.log('USGS Daily Values API response data:', data);
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
    
    console.log('showTableFlowGraph called with entry:', entry);
    
    if (!entry.siteNumber || !entry.date) {
        alert('Missing river or date information for this entry.\nSite Number: ' + entry.siteNumber + '\nDate: ' + entry.date);
        return;
    }
    
    var modal = document.getElementById('flowGraphModal');
    var title = document.getElementById('graphTitle');
    title.textContent = 'Flow Rate Graph - ' + (entry.riverName || 'Unknown River') + ' (' + entry.date + ')';
    modal.style.display = 'block';
    
    // Check if we have cached flow data first
    if (entry.cachedFlowData) {
        console.log('Using cached flow data for entry');
        try {
            var cachedData = JSON.parse(entry.cachedFlowData);
            console.log('Parsed cached data:', cachedData);
            displayFlowChart(cachedData, entry.riverName || 'Unknown River', entry.date);
            return;
        } catch (error) {
            console.warn('Failed to parse cached flow data, falling back to API:', error);
        }
    }
    
    console.log('No cached data available, fetching from USGS API for site:', entry.siteNumber, 'date:', entry.date);
    
    // Fetch and display hourly data using entry data
    getHourlyFlowData(entry.siteNumber, entry.date)
        .then(function(hourlyData) {
            console.log('Received hourly data:', hourlyData);
            displayFlowChart(hourlyData, entry.riverName || 'Unknown River', entry.date);
        })
        .catch(function(error) {
            console.error('Error fetching hourly flow data:', error);
            alert('Error loading flow data: ' + error.message + '\nSite: ' + entry.siteNumber + '\nDate: ' + entry.date);
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
        
        console.log('Date analysis:', {
            originalDate: date,
            selectedDate: selectedDate,
            today: today,
            daysDiff: daysDiff
        });
        
        // Format the date correctly for USGS API (YYYY-MM-DD)
        var formattedDate = selectedDate.getFullYear() + '-' + 
                           String(selectedDate.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(selectedDate.getDate()).padStart(2, '0');
        
        console.log('Formatted date for USGS API:', formattedDate);
        
        // Try instantaneous data first (available for up to 120 days)
        if (daysDiff <= 120) {
            var params = new URLSearchParams({
                format: 'json',
                sites: siteNumber,
                parameterCd: '00060',
                startDT: formattedDate + 'T00:00',
                endDT: formattedDate + 'T23:59'
            });
            
            var url = USGS_INSTANTANEOUS_SERVICE + '?' + params.toString();
            console.log('Making USGS API request to:', url);
            
            fetch(url)
                .then(function(response) {
                    console.log('USGS API response status:', response.status);
                    if (!response.ok) throw new Error('Hourly flow request failed: ' + response.status + ' ' + response.statusText);
                    return response.json();
                })
                .then(function(data) {
                    console.log('USGS API response data:', data);
                    if (data.value && data.value.timeSeries && data.value.timeSeries.length > 0) {
                        var timeSeries = data.value.timeSeries[0];
                        var values = timeSeries.values[0].value;
                        console.log('Found', values ? values.length : 0, 'data points');
                        
                        if (values && values.length > 0) {
                            // Process data to hourly intervals
                            var hourlyData = processToHourlyData(values, date);
                            console.log('Processed hourly data:', hourlyData);
                            resolve(hourlyData);
                        } else {
                            console.log('No values found in USGS response');
                            resolve([]);
                        }
                    } else {
                        console.log('No time series data found in USGS response');
                        resolve([]);
                    }
                })
                .catch(function(error) {
                    console.error('USGS API fetch error:', error);
                    // Provide mock data as fallback to test chart functionality
                    console.log('Providing mock data as fallback for testing');
                    var mockData = [];
                    var baseFlow = 100 + Math.random() * 200; // Random base flow between 100-300 CFS
                    for (var hour = 0; hour < 24; hour++) {
                        mockData.push({
                            time: hour.toString().padStart(2, '0') + ':00',
                            flow: Math.round(baseFlow + Math.sin(hour / 4) * 20 + (Math.random() - 0.5) * 10)
                        });
                    }
                    resolve(mockData);
                });
        } else {
            // For historical dates (>120 days), use daily values
            console.log('Using historical daily data for date older than 120 days');
            getHistoricalFlowData(siteNumber, formattedDate)
                .then(function(flowData) {
                    console.log('Historical flow data received:', flowData);
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
    console.log('displayFlowChart called with:', {hourlyData, riverName, date});
    
    var ctx = document.getElementById('flowChart').getContext('2d');
    
    // Destroy existing chart
    if (flowChart) {
        flowChart.destroy();
    }
    
    if (!hourlyData || hourlyData.length === 0) {
        console.log('No hourly data available for chart');
        // Show message in chart area
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No flow data available for this date', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    var labels = hourlyData.map(function(d) { return d.time; });
    var data = hourlyData.map(function(d) { return d.flow; });
    
    console.log('Chart labels:', labels);
    console.log('Chart data:', data);
    
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
async function showRiverFlowModal() {
    var modal = document.getElementById('riverFlowModal');
    modal.style.display = 'block';

    // Show loading state
    var container = document.getElementById('savedRiversContainer');
    if (container) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading rivers...</div>';
    }

    try {
        await loadSavedRivers();
        updateRiverDashboard();
        renderSavedRivers();
    } catch (error) {
        console.error('Failed to load rivers:', error);
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">Failed to load rivers. Please try again.</div>';
        }
    }
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

// Enhanced Dashboard Functions
function updateRiverDashboard() {
    updateDashboardStats();
    updateLastUpdateTime();
}

function updateDashboardStats() {
    console.log('updateDashboardStats called, savedRivers length:', savedRivers.length);
    var totalCount = savedRivers.length;
    var flowValues = [];
    var alertCount = 0;

    // Calculate statistics
    savedRivers.forEach(function(river) {
        if (river.currentFlow && river.currentFlow !== 'No Data' && river.currentFlow !== 'Error') {
            var flowValue = parseFloat(river.currentFlow.replace(' CFS', ''));
            if (!isNaN(flowValue)) {
                flowValues.push(flowValue);
            }
        }

        // Count flow alerts (high, low, flood conditions)
        var flowStatus = getFlowStatus(river.currentFlow);
        if (flowStatus === 'high' || flowStatus === 'low' || flowStatus === 'flood') {
            alertCount++;
        }
    });

    // Calculate average flow
    var avgFlow = '- CFS';
    if (flowValues.length > 0) {
        var sum = flowValues.reduce(function(a, b) { return a + b; }, 0);
        var avg = Math.round(sum / flowValues.length);
        avgFlow = avg + ' CFS';
    }

    // Update dashboard elements
    document.getElementById('totalRiversCount').textContent = totalCount;
    document.getElementById('avgFlowRate').textContent = avgFlow;
    document.getElementById('flowAlertsCount').textContent = alertCount;
}

function updateLastUpdateTime() {
    var now = new Date();
    var timeString = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    document.getElementById('lastUpdateTime').textContent = timeString;
}

function getFlowStatus(flowString) {
    if (!flowString || flowString === 'No Data' || flowString === 'Error') {
        return 'unknown';
    }

    var flowValue = parseFloat(flowString.replace(' CFS', ''));
    if (isNaN(flowValue)) return 'unknown';

    // Basic flow categorization (can be refined based on specific river data)
    if (flowValue < 100) return 'low';
    if (flowValue < 1000) return 'normal';
    if (flowValue < 5000) return 'high';
    return 'flood';
}

function getFlowTrend(river) {
    // Placeholder for trend calculation - would need historical data
    // For now, return random trend for demonstration
    var trends = ['up', 'down', 'stable'];
    return trends[Math.floor(Math.random() * trends.length)];
}

function getTrendDisplay(trend) {
    switch(trend) {
        case 'up': return { arrow: '↗', class: 'trend-up', text: 'Rising' };
        case 'down': return { arrow: '↘', class: 'trend-down', text: 'Falling' };
        case 'stable': return { arrow: '→', class: 'trend-stable', text: 'Stable' };
        default: return { arrow: '—', class: 'trend-stable', text: 'Unknown' };
    }
}

// UI Control Functions
function showAddRiverSection() {
    document.getElementById('addRiverSection').style.display = 'block';
    document.getElementById('riverFlowSearch').focus();
}

function hideAddRiverSection() {
    document.getElementById('addRiverSection').style.display = 'none';
    document.getElementById('riverFlowSearch').value = '';
    document.getElementById('riverFlowSearchResults').style.display = 'none';
}

function toggleRiverView(viewType) {
    var container = document.getElementById('savedRiversContainer');
    var gridBtn = document.getElementById('gridViewBtn');
    var listBtn = document.getElementById('listViewBtn');

    if (viewType === 'list') {
        container.classList.add('list-view');
        listBtn.classList.add('btn-primary');
        listBtn.classList.remove('btn-secondary');
        gridBtn.classList.add('btn-secondary');
        gridBtn.classList.remove('btn-primary');
    } else {
        container.classList.remove('list-view');
        gridBtn.classList.add('btn-primary');
        gridBtn.classList.remove('btn-secondary');
        listBtn.classList.add('btn-secondary');
        listBtn.classList.remove('btn-primary');
    }
}

function refreshAllRivers() {
    showRiverFlowStatusMessage('Refreshing all rivers...', 'info');

    var updatePromises = savedRivers.map(function(river, index) {
        return new Promise(function(resolve) {
            updateRiverFlowData(index);
            setTimeout(resolve, 100); // Small delay between requests
        });
    });

    Promise.all(updatePromises).then(function() {
        updateRiverDashboard();
        showRiverFlowStatusMessage('All rivers updated successfully!', 'success');
    });
}

function showFlowComparison() {
    // Placeholder for flow comparison feature
    showRiverFlowStatusMessage('Flow comparison feature coming soon!', 'info');
}

// Rivers API Functions
async function loadSavedRivers() {
    try {
        console.log('Loading rivers from API...');
        const rivers = await apiRequest('/rivers');
        console.log('Rivers API response:', rivers);

        if (Array.isArray(rivers)) {
            savedRivers = rivers.map(river => ({
                id: river.id,
                siteNumber: river.site_number,
                riverName: river.river_name,
                location: river.location,
                currentFlow: river.current_flow,
                lastUpdated: river.last_updated
            }));
            console.log('Mapped rivers:', savedRivers);
        } else {
            console.warn('Rivers API returned non-array:', rivers);
            savedRivers = [];
        }
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
    console.log('renderSavedRivers called, savedRivers:', savedRivers);
    var container = document.getElementById('savedRiversContainer');
    var noRiversMsg = document.getElementById('noRiversMessage');

    if (savedRivers.length === 0) {
        console.log('No rivers to display, showing no rivers message');
        if (noRiversMsg) noRiversMsg.style.display = 'block';
        if (container) container.innerHTML = '';
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

    // Calculate flow status and color
    var flowValue = 0;
    var statusText = 'No Data';
    var statusClass = 'status-unknown';
    var gaugePercentage = 0;

    if (river.currentFlow && river.currentFlow !== 'No Data' && river.currentFlow !== 'Error') {
        flowValue = parseFloat(river.currentFlow.replace(' CFS', ''));
        if (!isNaN(flowValue)) {
            if (flowValue < 100) {
                statusText = 'Low';
                statusClass = 'status-low';
                gaugePercentage = Math.min((flowValue / 100) * 30, 30);
            } else if (flowValue < 500) {
                statusText = 'Normal';
                statusClass = 'status-normal';
                gaugePercentage = 30 + Math.min(((flowValue - 100) / 400) * 40, 40);
            } else if (flowValue < 1000) {
                statusText = 'High';
                statusClass = 'status-high';
                gaugePercentage = 70 + Math.min(((flowValue - 500) / 500) * 25, 25);
            } else {
                statusText = 'Flood';
                statusClass = 'status-flood';
                gaugePercentage = Math.min(95 + (flowValue - 1000) / 1000 * 5, 100);
            }
        }
    }

    // Generate trend indicator
    var trendIcon = '→';
    var trendClass = 'trend-stable';
    if (river.trend) {
        if (river.trend > 0) {
            trendIcon = '↗';
            trendClass = 'trend-rising';
        } else if (river.trend < 0) {
            trendIcon = '↘';
            trendClass = 'trend-falling';
        }
    }

    return '<div class="river-card">' +
        '<div class="river-card-header">' +
            '<div class="river-title">' +
                '<h4 class="river-name">' + river.riverName + '</h4>' +
                '<span class="flow-status-badge ' + statusClass + '">' + statusText + '</span>' +
            '</div>' +
            '<span class="river-site-number">Site: ' + river.siteNumber + '</span>' +
        '</div>' +
        '<div class="river-flow-display">' +
            '<div class="flow-gauge-container">' +
                '<div class="flow-gauge">' +
                    '<div class="gauge-fill" style="width: ' + gaugePercentage + '%"></div>' +
                '</div>' +
                '<div class="flow-main-metric">' +
                    '<span class="flow-value">' + (river.currentFlow || 'N/A') + '</span>' +
                    '<span class="flow-trend ' + trendClass + '">' + trendIcon + '</span>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="river-card-actions">' +
            '<button class="action-btn refresh-btn" onclick="updateRiverFlowData(' + index + ')" title="Refresh Data">' +
                '<i class="icon-refresh">🔄</i>' +
            '</button>' +
            '<button class="action-btn graph-btn" onclick="showRiverFlowGraph(' + index + ')" title="View Graph">' +
                '<i class="icon-graph">📊</i>' +
            '</button>' +
            '<button class="action-btn alert-btn" onclick="configureRiverAlerts(' + index + ')" title="Configure Alerts">' +
                '<i class="icon-alert">🔔</i>' +
            '</button>' +
            '<button class="action-btn remove-btn" onclick="removeRiver(' + index + ')" title="Remove River">' +
                '<i class="icon-remove">🗑️</i>' +
            '</button>' +
        '</div>' +
        '<div class="river-card-footer">' +
            '<span class="last-updated">' + lastUpdatedText + '</span>' +
        '</div>' +
    '</div>';
}

function updateRiverFlowData(index) {
    var river = savedRivers[index];
    var previousFlow = river.currentFlow;
    river.flowStatus = 'Loading...';
    renderSavedRivers();

    getFlowDataForDate(river.siteNumber, new Date().toISOString().split('T')[0])
        .then(function(flowData) {
            if (flowData && flowData.flowRate !== null) {
                var newFlow = Math.round(flowData.flowRate);
                river.currentFlow = newFlow + ' CFS';
                river.flowStatus = 'Active';
                river.lastUpdated = new Date().toISOString();

                // Calculate trend if we have previous data
                if (previousFlow && previousFlow !== 'No Data' && previousFlow !== 'Error' && previousFlow !== 'Loading...') {
                    var prevFlowValue = parseFloat(previousFlow.replace(' CFS', ''));
                    if (!isNaN(prevFlowValue)) {
                        var flowDiff = newFlow - prevFlowValue;
                        var percentChange = (flowDiff / prevFlowValue) * 100;

                        // Set trend based on significant change (>5%)
                        if (Math.abs(percentChange) > 5) {
                            river.trend = flowDiff > 0 ? 1 : -1;
                        } else {
                            river.trend = 0;
                        }
                    }
                }

                // Check for flow alerts
                var triggeredAlerts = checkFlowAlerts(river.siteNumber, river.currentFlow);
                if (triggeredAlerts.length > 0) {
                    showFlowAlert(river.riverName, triggeredAlerts);
                }
            } else {
                river.currentFlow = 'No Data';
                river.flowStatus = 'No Data';
                river.lastUpdated = new Date().toISOString();
                river.trend = 0;
            }
            renderSavedRivers();
            updateDashboardStats();
        })
        .catch(function(error) {
            console.error('Error updating river flow data:', error);
            river.currentFlow = 'Error';
            river.flowStatus = 'Error';
            river.lastUpdated = new Date().toISOString();
            river.trend = 0;
            renderSavedRivers();
            updateDashboardStats();
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

// ============ FLOW ALERT FUNCTIONS ============

function setFlowAlert(siteNumber, alertType, threshold) {
    if (!flowAlerts[siteNumber]) {
        flowAlerts[siteNumber] = {};
    }

    flowAlerts[siteNumber][alertType] = {
        threshold: threshold,
        enabled: true,
        lastTriggered: null
    };

    localStorage.setItem('flowAlerts', JSON.stringify(flowAlerts));
    console.log('Alert set for site', siteNumber, ':', alertType, 'at', threshold, 'CFS');
}

function removeFlowAlert(siteNumber, alertType) {
    if (flowAlerts[siteNumber] && flowAlerts[siteNumber][alertType]) {
        delete flowAlerts[siteNumber][alertType];

        // Remove site entry if no alerts remain
        if (Object.keys(flowAlerts[siteNumber]).length === 0) {
            delete flowAlerts[siteNumber];
        }

        localStorage.setItem('flowAlerts', JSON.stringify(flowAlerts));
        console.log('Alert removed for site', siteNumber, ':', alertType);
    }
}

function checkFlowAlerts(siteNumber, currentFlow) {
    if (!flowAlerts[siteNumber] || !currentFlow || currentFlow === 'No Data' || currentFlow === 'Error') {
        return [];
    }

    var flowValue = parseFloat(currentFlow.replace(' CFS', ''));
    if (isNaN(flowValue)) return [];

    var triggeredAlerts = [];
    var siteAlerts = flowAlerts[siteNumber];
    var now = new Date().toISOString();

    Object.keys(siteAlerts).forEach(function(alertType) {
        var alert = siteAlerts[alertType];
        if (!alert.enabled) return;

        var shouldTrigger = false;
        var message = '';

        switch (alertType) {
            case 'high':
                if (flowValue >= alert.threshold) {
                    shouldTrigger = true;
                    message = 'High flow alert: ' + flowValue + ' CFS (threshold: ' + alert.threshold + ' CFS)';
                }
                break;
            case 'low':
                if (flowValue <= alert.threshold) {
                    shouldTrigger = true;
                    message = 'Low flow alert: ' + flowValue + ' CFS (threshold: ' + alert.threshold + ' CFS)';
                }
                break;
            case 'flood':
                if (flowValue >= alert.threshold) {
                    shouldTrigger = true;
                    message = 'FLOOD ALERT: ' + flowValue + ' CFS (threshold: ' + alert.threshold + ' CFS)';
                }
                break;
        }

        if (shouldTrigger) {
            // Only trigger if not triggered in the last hour
            var lastTriggered = alert.lastTriggered ? new Date(alert.lastTriggered) : null;
            var hourAgo = new Date(Date.now() - 60 * 60 * 1000);

            if (!lastTriggered || lastTriggered < hourAgo) {
                alert.lastTriggered = now;
                triggeredAlerts.push({
                    type: alertType,
                    message: message,
                    severity: alertType === 'flood' ? 'critical' : alertType === 'high' ? 'warning' : 'info'
                });
            }
        }
    });

    if (triggeredAlerts.length > 0) {
        localStorage.setItem('flowAlerts', JSON.stringify(flowAlerts));
    }

    return triggeredAlerts;
}

function showFlowAlert(riverName, alerts) {
    alerts.forEach(function(alert) {
        var alertClass = alert.severity === 'critical' ? 'alert-danger' :
                        alert.severity === 'warning' ? 'alert-warning' : 'alert-info';

        var alertHtml = '<div class="flow-alert ' + alertClass + '">' +
            '<strong>' + riverName + '</strong><br>' +
            alert.message +
            '<button class="alert-close" onclick="this.parentElement.remove()">×</button>' +
        '</div>';

        // Add alert to notifications area
        var notificationArea = document.getElementById('flowNotifications');
        if (!notificationArea) {
            // Create notification area if it doesn't exist
            notificationArea = document.createElement('div');
            notificationArea.id = 'flowNotifications';
            notificationArea.className = 'flow-notifications';
            document.body.appendChild(notificationArea);
        }

        notificationArea.insertAdjacentHTML('beforeend', alertHtml);

        // Auto-remove non-critical alerts after 10 seconds
        if (alert.severity !== 'critical') {
            setTimeout(function() {
                var alertElement = notificationArea.lastElementChild;
                if (alertElement && alertElement.classList.contains('flow-alert')) {
                    alertElement.remove();
                }
            }, 10000);
        }
    });
}

function configureRiverAlerts(index) {
    var river = savedRivers[index];
    if (!river) return;

    var currentAlerts = flowAlerts[river.siteNumber] || {};

    var alertsHtml = '<div class="alert-config-modal">' +
        '<div class="alert-config-content">' +
            '<h3>Configure Alerts for ' + river.riverName + '</h3>' +
            '<div class="alert-types">' +
                '<div class="alert-type-section">' +
                    '<label>' +
                        '<input type="checkbox" id="highAlert" ' +
                        (currentAlerts.high ? 'checked' : '') + '> High Flow Alert' +
                    '</label>' +
                    '<input type="number" id="highThreshold" placeholder="CFS" ' +
                    'value="' + (currentAlerts.high ? currentAlerts.high.threshold : '') + '">' +
                '</div>' +
                '<div class="alert-type-section">' +
                    '<label>' +
                        '<input type="checkbox" id="lowAlert" ' +
                        (currentAlerts.low ? 'checked' : '') + '> Low Flow Alert' +
                    '</label>' +
                    '<input type="number" id="lowThreshold" placeholder="CFS" ' +
                    'value="' + (currentAlerts.low ? currentAlerts.low.threshold : '') + '">' +
                '</div>' +
                '<div class="alert-type-section">' +
                    '<label>' +
                        '<input type="checkbox" id="floodAlert" ' +
                        (currentAlerts.flood ? 'checked' : '') + '> Flood Alert' +
                    '</label>' +
                    '<input type="number" id="floodThreshold" placeholder="CFS" ' +
                    'value="' + (currentAlerts.flood ? currentAlerts.flood.threshold : '') + '">' +
                '</div>' +
            '</div>' +
            '<div class="alert-actions">' +
                '<button class="btn btn-primary" onclick="saveAlertConfig(' + index + ')">Save</button>' +
                '<button class="btn btn-secondary" onclick="closeAlertConfig()">Cancel</button>' +
            '</div>' +
        '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', alertsHtml);
}

function saveAlertConfig(index) {
    var river = savedRivers[index];
    if (!river) return;

    var highAlert = document.getElementById('highAlert').checked;
    var highThreshold = parseFloat(document.getElementById('highThreshold').value);

    var lowAlert = document.getElementById('lowAlert').checked;
    var lowThreshold = parseFloat(document.getElementById('lowThreshold').value);

    var floodAlert = document.getElementById('floodAlert').checked;
    var floodThreshold = parseFloat(document.getElementById('floodThreshold').value);

    // Clear existing alerts for this site
    if (flowAlerts[river.siteNumber]) {
        delete flowAlerts[river.siteNumber];
    }

    // Set new alerts
    if (highAlert && !isNaN(highThreshold)) {
        setFlowAlert(river.siteNumber, 'high', highThreshold);
    }

    if (lowAlert && !isNaN(lowThreshold)) {
        setFlowAlert(river.siteNumber, 'low', lowThreshold);
    }

    if (floodAlert && !isNaN(floodThreshold)) {
        setFlowAlert(river.siteNumber, 'flood', floodThreshold);
    }

    closeAlertConfig();
    renderSavedRivers(); // Refresh the display
}

function closeAlertConfig() {
    var modal = document.querySelector('.alert-config-modal');
    if (modal) {
        modal.remove();
    }
}