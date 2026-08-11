// WMO weather codes as used by Open-Meteo. Reference:
// https://open-meteo.com/en/docs
const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall', 77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

// Groups WMO codes into the condition families the icon set draws — clear and
// partly-cloudy additionally split by day/night, see weatherIconKey() below.
const WEATHER_ICON_GROUPS = {
  0: 'clear', 1: 'clear',
  2: 'partlyCloudy',
  3: 'cloudy',
  45: 'fog', 48: 'fog',
  51: 'rain', 53: 'rain', 55: 'rain',
  56: 'sleet', 57: 'sleet',
  61: 'rain', 63: 'rain', 65: 'rain',
  66: 'sleet', 67: 'sleet',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
  80: 'rain', 81: 'rain', 82: 'rain',
  85: 'snow', 86: 'snow',
  95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
};

/** Maps a WMO weather code + day/night flag to a key in icons.js's WEATHER_ICONS. */
export function weatherIconKey(weatherCode, isDay) {
  const group = WEATHER_ICON_GROUPS[weatherCode] ?? 'cloudy';
  if (group === 'clear')        return isDay ? 'clearDay' : 'clearNight';
  if (group === 'partlyCloudy') return isDay ? 'partlyCloudyDay' : 'partlyCloudyNight';
  return group;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function compassDirection(deg) {
  return COMPASS[Math.round(deg / 45) % 8];
}

const CURRENT_FIELDS = 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,snow_depth,is_day';

/**
 * Fetch current conditions for a coordinate from Open-Meteo (free, no API key).
 * Throws on a network or non-OK response — the caller decides the fallback.
 */
export async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=${CURRENT_FIELDS}&daily=snowfall_sum&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
  const json = await res.json();
  const c = json.current;

  return {
    temp:          c.temperature_2m,
    feelsLike:     c.apparent_temperature,
    condition:     WEATHER_CODES[c.weather_code] ?? 'Unknown conditions',
    weatherCode:   c.weather_code,
    isDay:         c.is_day === 1,
    freshSnow:     Math.round((json.daily?.snowfall_sum?.[0] ?? 0) * 10) / 10,
    baseDepth:     Math.round(c.snow_depth * 100), // Open-Meteo reports snow_depth in metres
    windSpeed:     Math.round(c.wind_speed_10m),
    windDirection: compassDirection(c.wind_direction_10m),
  };
}
