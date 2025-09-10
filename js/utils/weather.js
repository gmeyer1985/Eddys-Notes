// Weather API and Utility Functions

// Replace 'YOUR_API_KEY' with your actual OpenWeatherMap API key
var OPENWEATHER_API_KEY = '03fddef136f27a712e6ef0d9ccafdbf1';

function getTimezoneFromZipcode(zipcode) {
    // Approximate timezone offset based on zipcode ranges (US-centric)
    var zipNum = parseInt(zipcode) || 0;
    
    // Eastern Time (UTC-5)
    if ((zipNum >= 0 && zipNum <= 19999) || (zipNum >= 20000 && zipNum <= 31999)) return -5;
    // Central Time (UTC-6)  
    else if ((zipNum >= 35000 && zipNum <= 41999) || (zipNum >= 50000 && zipNum <= 56999) || (zipNum >= 70000 && zipNum <= 71999) || (zipNum >= 73000 && zipNum <= 77999)) return -6;
    // Mountain Time (UTC-7)
    else if ((zipNum >= 59000 && zipNum <= 59999) || (zipNum >= 80000 && zipNum <= 84999) || (zipNum >= 86000 && zipNum <= 86999) || (zipNum >= 88000 && zipNum <= 89999)) return -7;
    // Pacific Time (UTC-8)
    else if ((zipNum >= 90000 && zipNum <= 99999) || (zipNum >= 85000 && zipNum <= 85999)) return -8;
    // Alaska Time (UTC-9)
    else if (zipNum >= 99500 && zipNum <= 99999) return -9;
    // Hawaii Time (UTC-10)
    else if (zipNum >= 96700 && zipNum <= 96899) return -10;
    // Default to Central Time
    else return -6;
}

function getWeatherData(lat, lon, date, cityState) {
    return new Promise(function(resolve, reject) {
        // Check if API key is configured
        if (OPENWEATHER_API_KEY === 'YOUR_API_KEY_HERE') {
            // Fallback to simulated data if no API key
            return getSimulatedWeatherData(lat, lon, date, cityState).then(resolve).catch(reject);
        }
        
        var dateObj = new Date(date);
        var timestamp = Math.floor(dateObj.getTime() / 1000);
        
        // OpenWeatherMap API using coordinates instead of zipcode
        var url = 'https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon + '&appid=' + OPENWEATHER_API_KEY + '&units=imperial';
        
        // Add timeout to the fetch request
        var controller = new AbortController();
        var timeoutId = setTimeout(() => {
            controller.abort();
            console.log('Weather API request timed out, using simulated data');
        }, 8000); // 8 second timeout
        
        fetch(url, { signal: controller.signal })
            .then(function(response) {
                clearTimeout(timeoutId);
                console.log('Weather API response received');
                if (!response.ok) {
                    throw new Error('Weather API request failed: ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                console.log('Weather data parsed successfully');
                // Convert pressure from hPa to inHg (1 hPa = 0.02953 inHg)
                var pressureInHg = data.main.pressure * 0.02953;
                
                resolve({
                    airTemp: Math.round(data.main.temp),
                    barometricPressure: Math.round(pressureInHg * 100) / 100, // 2 decimal places
                    windDirection: getWindDirection(data.wind.deg),
                    windSpeed: Math.round(data.wind.speed),
                    location: data.name + ', ' + data.sys.country
                });
            })
            .catch(function(error) {
                clearTimeout(timeoutId);
                console.error('Weather API error:', error);
                console.log('Falling back to simulated weather data');
                // Fallback to simulated data on error
                getSimulatedWeatherData(lat, lon, date, cityState).then(resolve).catch(reject);
            });
    });
}

function getSimulatedWeatherData(lat, lon, date, cityState) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            var latitude = parseFloat(lat) || 44.0;
            var dateObj = new Date(date);
            var month = dateObj.getMonth() + 1;
            var day = dateObj.getDate();
            
            // Temperature calculation based on latitude
            var baseTemp;
            if (latitude >= 45) baseTemp = 50; // Northern areas
            else if (latitude >= 40) baseTemp = 60; // Mid-northern areas  
            else if (latitude >= 35) baseTemp = 70; // Mid areas
            else if (latitude >= 30) baseTemp = 75; // Southern areas
            else baseTemp = 80; // Deep south/tropical
            
            var seasonalAdjustment = Math.sin((month - 4) * Math.PI / 6) * 30;
            var dailyVariation = Math.sin(day * Math.PI / 15) * 5;
            var airTemp = Math.round(baseTemp + seasonalAdjustment + dailyVariation);
            
            // Generate realistic barometric pressure (28.5 - 31.0 inHg range)
            var basePressure = 29.92; // Standard atmospheric pressure
            var pressureVariation = (Math.random() - 0.5) * 2; // -1 to +1
            var barometricPressure = Math.round((basePressure + pressureVariation) * 100) / 100;
            
            resolve({
                airTemp: Math.max(10, Math.min(105, airTemp)),
                barometricPressure: Math.max(28.5, Math.min(31.0, barometricPressure)),
                windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
                windSpeed: Math.round(Math.random() * 15 + 5)
            });
        }, 500);
    });
}

function getWindDirection(degrees) {
    var directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    var index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}