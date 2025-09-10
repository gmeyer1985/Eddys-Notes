// Moon Phase Calculation Functions

function getMoonPhase(date) {
    var phases = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    var phaseNames = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
    
    var d = new Date(date);
    var year = d.getFullYear();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    
    // Use more accurate algorithm based on astronomical calculations
    // Reference: Meeus "Astronomical Algorithms" and matching Moongiant accuracy
    
    // Calculate Julian Day Number (more precise method)
    var a = Math.floor((14 - month) / 12);
    var y = year - a;
    var m = month + 12 * a - 3;
    var jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + 1721119;
    
    // Convert to Julian Day (add 0.5 for noon)
    var jd = jdn + 0.5;
    
    // More precise new moon reference matching astronomical data
    // New Moon reference: January 6, 2000 18:14 UTC (JD 2451549.259722)
    var newMoonJd = 2451549.259722;
    var synodicMonth = 29.5305888531; // Precise synodic month length
    
    // Calculate days since reference new moon
    var daysSinceNewMoon = jd - newMoonJd;
    
    // Find current lunation cycle
    var lunationNumber = daysSinceNewMoon / synodicMonth;
    var currentCycle = lunationNumber - Math.floor(lunationNumber);
    
    // Ensure positive
    if (currentCycle < 0) currentCycle += 1;
    
    // Calculate moon age in days
    var moonAge = currentCycle * synodicMonth;
    
    // More accurate phase determination matching Moongiant
    var phase;
    if (moonAge < 1.84566) phase = 0;        // New Moon (0-1.84 days)
    else if (moonAge < 5.53699) phase = 1;   // Waxing Crescent (1.84-5.54 days)
    else if (moonAge < 9.22831) phase = 2;   // First Quarter (5.54-9.23 days)
    else if (moonAge < 12.91963) phase = 3;  // Waxing Gibbous (9.23-12.92 days)
    else if (moonAge < 16.61096) phase = 4;  // Full Moon (12.92-16.61 days)
    else if (moonAge < 20.30228) phase = 5;  // Waning Gibbous (16.61-20.30 days)
    else if (moonAge < 23.99361) phase = 6;  // Last Quarter (20.30-24.0 days)
    else if (moonAge < 27.68493) phase = 7;  // Waning Crescent (24.0-27.68 days)
    else phase = 0;                          // New Moon (27.68+ days)
    
    // Calculate illumination percentage (more accurate formula)
    var phaseAngle = 2 * Math.PI * currentCycle;
    var illumination = Math.round(50 * (1 - Math.cos(phaseAngle)));
    
    // Ensure illumination is within 0-100%
    illumination = Math.max(0, Math.min(100, illumination));
    
    return {
        emoji: phases[phase],
        name: phaseNames[phase],
        illumination: illumination + '%',
        age: Math.round(moonAge * 100) / 100 // Moon age in days (2 decimal places)
    };
}