const BASE_URL = "https://nationalweatherapi.onrender.com"; // Your Render backend
const resultDiv = document.getElementById("result");

// Reverse geocoding using OpenStreetMap Nominatim
const getCityState = async (lat, lon) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const data = await res.json();
    const city = data.address.city || data.address.town || data.address.village || data.address.county;
    const state = data.address.state_code || data.address.state;
    return { city, state };
  } catch (err) {
    console.error("Reverse geocoding failed:", err);
    return { city: null, state: null };
  }
};

// Automatic geolocation
document.getElementById("checkLocationBtn").addEventListener("click", async () => {
  resultDiv.textContent = "Getting your location...";

  if (!navigator.geolocation) {
    resultDiv.textContent = "Geolocation is not supported by your browser.";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    resultDiv.textContent = `Detected coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}\nFetching safety info...`;

    const { city, state } = await getCityState(lat, lon);
    if (!city || !state) {
      resultDiv.textContent += "\nCould not determine city/state from your location.";
      return;
    }

    fetchSafety(lat, lon, city, state);

  }, (err) => {
    resultDiv.textContent = "❌ Could not get your location.";
    console.error(err);
  });
});

// Manual city/state input
document.getElementById("checkManualBtn").addEventListener("click", async () => {
  const city = document.getElementById("cityInput").value.trim();
  const state = document.getElementById("stateInput").value.trim();

  if (!city || !state) {
    resultDiv.textContent = "Please enter both city and state!";
    return;
  }

  resultDiv.textContent = `Checking safety for ${city}, ${state}...`;

  try {
    // Geocode city/state to coordinates
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
});

// Fetch safety info from backend
const fetchSafety = async (lat, lon, city, state) => {
  try {
    const url = `${BASE_URL}/checkSafety?lat=${lat}&lon=${lon}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    if (data.location_inside_alert) {
      resultDiv.innerHTML = `⚠️ You are in an active alert zone!\nActive Alerts:\n${data.active_alerts.map(a => `${a.type} - ${a.severity}`).join("\n")}`;
    } else {
      resultDiv.textContent = "✅ Your location is safe!";
    }

    if (data.nearest_safe_cities.length) {
      resultDiv.innerHTML += `\n\nNearest Safe Cities:\n${data.nearest_safe_cities.map(c => `${c.name} - ${c.distance_km} km`).join("\n")}`;
    }

  } catch (err) {
    resultDiv.textContent = "❌ Could not fetch data. See console.";
    console.error("Fetch error details:", err);
  }
};
