const BASE_URL = "https://nationalweatherapi.onrender.com";
const resultDiv = document.getElementById("result");

let map, userMarker, safeMarkers = [], updateInterval;

// Initialize map
map = L.map('map').setView([28.5383, -81.3792], 10); // Default Orlando
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Legend
const legend = L.control({position: 'bottomright'});
legend.onAdd = function (map) {
  const div = L.DomUtil.create('div', 'info legend');
  div.innerHTML = `
    <img src="./icons/red-dot.png" width="16"> Severe/Extreme<br>
    <img src="./icons/yellow-dot.png" width="16"> Minor/Moderate<br>
    <img src="./icons/green-dot.png" width="16"> Safe/No Alert
  `;
  return div;
};
legend.addTo(map);

// Create marker with color-coded icon
const createMarker = (lat, lon, text, severity="safe") => {
  let iconUrl = "./icons/green-dot.png"; // default safe
  if (severity === "severe" || severity === "extreme") iconUrl = "./icons/red-dot.png";
  else if (severity === "minor" || severity === "moderate") iconUrl = "./icons/yellow-dot.png";

  const icon = L.icon({ iconUrl, iconSize: [32,32], iconAnchor:[16,32], popupAnchor:[0,-32] });
  return L.marker([lat, lon], { icon }).addTo(map).bindPopup(text);
};

const clearMarkers = () => {
  if (userMarker) map.removeLayer(userMarker);
  safeMarkers.forEach(m => map.removeLayer(m));
  safeMarkers = [];
};

// Reverse geocode to get city/state from coordinates
const getCityState = async (lat, lon) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const data = await res.json();
    const city = data.address.city || data.address.town || data.address.village || data.address.county;
    const state = data.address.state_code || data.address.state;
    return { city, state };
  } catch {
    return { city:null, state:null };
  }
};

// Fetch safety info
const fetchSafety = async (lat, lon, city, state) => {
  try {
    const res = await fetch(`${BASE_URL}/checkSafety?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    clearMarkers();

    let severity = "safe";
    if (data.location_inside_alert && data.active_alerts.length) {
      const highestAlert = data.active_alerts.reduce((prev, curr) => {
        const levels = ["minor", "moderate", "severe", "extreme"];
        return levels.indexOf(curr.severity.toLowerCase()) > levels.indexOf(prev.severity.toLowerCase()) ? curr : prev;
      }, { severity: "minor" });
      severity = highestAlert.severity.toLowerCase();
    }

    userMarker = createMarker(lat, lon, `You are here: ${city}, ${state}`, severity);

    const allLatLngs = [[lat, lon]];
    data.nearest_safe_cities.forEach(c => {
      safeMarkers.push(createMarker(c.lat, c.lon, `Safe City: ${c.name} (${c.distance_km} km)`));
      allLatLngs.push([c.lat, c.lon]);
    });

    map.fitBounds(allLatLngs, { padding: [50,50] });

    let text = data.location_inside_alert 
      ? `⚠️ You are in an alert zone!\nActive Alerts:\n${data.active_alerts.map(a=>`${a.type} - ${a.severity}`).join("\n")}`
      : "✅ Your location is safe!";

    if (data.nearest_safe_cities.length) {
      text += `\n\nNearest Safe Cities:\n${data.nearest_safe_cities.map(c=>`${c.name} - ${c.distance_km} km`).join("\n")}`;
    }

    resultDiv.textContent = text;

  } catch (err) {
    resultDiv.textContent = "❌ Could not fetch data. See console.";
    console.error(err);
  }
};

// Automatic geolocation
const checkLocation = async () => {
  resultDiv.textContent = "Getting your location...";
  if (!navigator.geolocation) {
    resultDiv.textContent = "Geolocation not supported.";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const { city, state } = await getCityState(lat, lon);
    if (!city || !state) {
      resultDiv.textContent = "Could not determine city/state from your location.";
      return;
    }
    fetchSafety(lat, lon, city, state);
  }, err => {
    resultDiv.textContent = "❌ Could not get your location.";
    console.error(err);
  });
};

// Manual city/state input
const checkManual = async () => {
  const city = document.getElementById("cityInput").value.trim();
  const state = document.getElementById("stateInput").value.trim();
  if (!city || !state) {
    resultDiv.textContent = "Please enter both city and state!";
    return;
  }
  resultDiv.textContent = `Checking safety for ${city}, ${state}...`;

  try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&format=json&limit=1`);
    const geoData = await geoRes.json();
    if (!geoData.length) {
      resultDiv.textContent = "Could not find coordinates for this location.";
      return;
    }
    const lat = parseFloat(geoData[0].lat);
    const lon = parseFloat(geoData[0].lon);
    fetchSafety(lat, lon, city, state);
  } catch (err) {
    resultDiv.textContent = "❌ Could not fetch data. See console.";
    console.error(err);
  }
};

// Event listeners
document.getElementById("checkLocationBtn").addEventListener("click", checkLocation);
document.getElementById("checkManualBtn").addEventListener("click", checkManual);

// Auto-update every 60s
updateInterval = setInterval(() => {
  if (userMarker) checkLocation();
}, 60000);
